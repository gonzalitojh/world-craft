/**
 * Manifiesto del formato `world-craft-world` versión 1.
 *
 * Es la única fuente de verdad del paquete: identifica el formato, la versión
 * de esquema de la base de origen, el mundo, los recuentos y cada archivo con
 * su tamaño y SHA-256. El manifiesto no se incluye a sí mismo en `files`.
 *
 * Zod es estricto: un campo desconocido, un checksum mal formado, una ruta
 * fuera de la política o un recuento incoherente invalidan el paquete entero.
 */
import { z } from 'zod';

import {
  TRANSFER_FORMAT,
  TRANSFER_FORMAT_VERSION,
  TRANSFER_MAX_ASSETS,
  TRANSFER_MAX_PATH_LENGTH,
  TRANSFER_MANIFEST_MAX_BYTES,
  TRANSFER_WARNING_CODES,
  TRANSFER_WORLD_JSON_MAX_BYTES,
  type TransferCounts,
  type TransferWarning,
} from '../../../shared/contracts/transfer';
import {
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
} from '../../../shared/contracts/worlds';
import { UUID_V7_PATTERN } from '../../db/ids';
import { TRANSFER_WORLD_FILE } from '../constants';
import { TransferError } from '../errors';
import { parseTransferEntryPath } from './paths';
import { assertSupportedTransferFormat } from './version';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const warningSchema = z
  .strictObject({
    code: z.enum(TRANSFER_WARNING_CODES),
    count: z.number().int().min(1),
  })
  .strict();

/** Esquema estricto del manifiesto. */
export const transferManifestSchema = z
  .strictObject({
    format: z.literal(TRANSFER_FORMAT),
    formatVersion: z.literal(TRANSFER_FORMAT_VERSION),
    schemaVersion: z.number().int().min(1),
    appVersion: z.string().min(1).max(40),
    exportedAt: z
      .string()
      .min(20)
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value))),
    assetsIncluded: z.literal(true),
    world: z
      .strictObject({
        sourceId: z.string().regex(UUID_V7_PATTERN),
        name: z.string().min(1).max(WORLD_NAME_MAX_LENGTH),
        slug: z.string().min(1).max(80).regex(WORLD_SLUG_PATTERN),
      })
      .strict(),
    counts: z
      .strictObject({
        entities: z.number().int().min(0),
        entityTypes: z.number().int().min(0),
        relationTypes: z.number().int().min(0),
        tags: z.number().int().min(0),
        relations: z.number().int().min(0),
        versions: z.number().int().min(0),
        assets: z.number().int().min(0),
      })
      .strict(),
    files: z
      .array(
        z
          .strictObject({
            path: z.string().min(1).max(TRANSFER_MAX_PATH_LENGTH),
            size: z.number().int().min(0),
            sha256: sha256Schema,
          })
          .strict(),
      )
      .min(1)
      .max(TRANSFER_MAX_ASSETS + 1),
    warnings: z.array(warningSchema).max(TRANSFER_WARNING_CODES.length),
  })
  .strict()
  .superRefine((manifest, context) => {
    const paths = new Set<string>();
    let assetFiles = 0;
    let worldFiles = 0;

    for (const file of manifest.files) {
      let parsed;

      try {
        parsed = parseTransferEntryPath(file.path);
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'El manifiesto contiene una ruta no permitida.',
          path: ['files'],
        });
        continue;
      }

      if (parsed.kind === 'manifest') {
        context.addIssue({
          code: 'custom',
          message: 'El manifiesto no puede listarse a sí mismo.',
          path: ['files'],
        });
      }

      if (parsed.kind === 'world') {
        worldFiles += 1;

        if (file.size > TRANSFER_WORLD_JSON_MAX_BYTES) {
          context.addIssue({
            code: 'custom',
            message: 'world.json supera el tamaño máximo.',
            path: ['files'],
          });
        }
      }

      if (parsed.kind === 'asset') {
        assetFiles += 1;
      }

      const key = file.path.toLowerCase();

      if (paths.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'El manifiesto repite una ruta.',
          path: ['files'],
        });
      }

      paths.add(key);
    }

    if (worldFiles !== 1 || !paths.has(TRANSFER_WORLD_FILE)) {
      context.addIssue({
        code: 'custom',
        message: 'El manifiesto debe listar world.json una sola vez.',
        path: ['files'],
      });
    }

    if (assetFiles !== manifest.counts.assets) {
      context.addIssue({
        code: 'custom',
        message: 'El recuento de assets no coincide con los archivos.',
        path: ['counts', 'assets'],
      });
    }

    if (manifest.counts.assets > TRANSFER_MAX_ASSETS) {
      context.addIssue({
        code: 'custom',
        message: 'El manifiesto supera el número máximo de assets.',
        path: ['counts', 'assets'],
      });
    }

    const codes = new Set<string>();

    for (const warning of manifest.warnings) {
      if (codes.has(warning.code)) {
        context.addIssue({
          code: 'custom',
          message: 'El manifiesto repite un código de aviso.',
          path: ['warnings'],
        });
      }

      codes.add(warning.code);
    }
  });

export type TransferManifest = z.infer<typeof transferManifestSchema>;

/** Archivo declarado por el manifiesto. */
export interface TransferManifestFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

/** Datos para construir un manifiesto. */
export interface CreateManifestInput {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly world: {
    readonly sourceId: string;
    readonly name: string;
    readonly slug: string;
  };
  readonly counts: TransferCounts;
  readonly files: readonly TransferManifestFile[];
  readonly warnings: readonly TransferWarning[];
}

/** Construye y valida un manifiesto a partir de datos ya calculados. */
export function createManifest(input: CreateManifestInput): TransferManifest {
  const parsed = transferManifestSchema.safeParse({
    format: TRANSFER_FORMAT,
    formatVersion: TRANSFER_FORMAT_VERSION,
    schemaVersion: input.schemaVersion,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    assetsIncluded: true,
    world: input.world,
    counts: input.counts,
    files: input.files,
    warnings: input.warnings,
  });

  if (!parsed.success) {
    throw new TransferError('TRANSFER_MANIFEST_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Valida un manifiesto ya deserializado. */
export function parseManifest(value: unknown): TransferManifest {
  assertSupportedTransferFormat(value);

  const parsed = transferManifestSchema.safeParse(value);

  if (!parsed.success) {
    throw new TransferError('TRANSFER_MANIFEST_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Lee y valida `manifest.json` desde texto. */
export function parseManifestJson(text: string): TransferManifest {
  if (Buffer.byteLength(text, 'utf8') > TRANSFER_MANIFEST_MAX_BYTES) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new TransferError('TRANSFER_MANIFEST_INVALID');
  }

  return parseManifest(value);
}

/** Serializa el manifiesto con formato legible e inspeccionable. */
export function serializeManifest(manifest: TransferManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Comprueba que el conjunto real de entradas coincide con el manifiesto.
 *
 * El lector ya validó nombres y tamaños; esta comprobación detecta un paquete
 * con archivos de más o de menos sin volver a recorrer el ZIP.
 */
export function verifyManifestFileSet(
  manifest: TransferManifest,
  actual: ReadonlyMap<string, number>,
): void {
  if (actual.size !== manifest.files.length) {
    throw new TransferError('TRANSFER_MANIFEST_INVALID');
  }

  for (const file of manifest.files) {
    if (actual.get(file.path) !== file.size) {
      throw new TransferError('TRANSFER_MANIFEST_INVALID');
    }
  }
}

/** Recuentos vacíos para una exportación sin contenido. */
export const EMPTY_TRANSFER_COUNTS: TransferCounts = {
  entities: 0,
  entityTypes: 0,
  relationTypes: 0,
  tags: 0,
  relations: 0,
  versions: 0,
  assets: 0,
};
