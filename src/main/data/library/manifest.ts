/**
 * Manifiesto `world-craft-library` v1.
 *
 * Es la única fuente de verdad de las entradas externas: base completa,
 * `settings.json` y cada paquete `worlds/<slug>.zip`, con tamaño y SHA-256. El
 * manifiesto no se incluye a sí mismo. Zod es estricto y exige coherencia entre
 * los recuentos de cada mundo y el agregado de la biblioteca.
 */
import { z } from 'zod';

import {
  TRANSFER_MAX_PATH_LENGTH,
  TRANSFER_WARNING_CODES,
  type TransferCounts,
  type TransferWarning,
} from '../../../shared/contracts/transfer';
import {
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
} from '../../../shared/contracts/worlds';
import { DATA_LIBRARY_FORMAT } from '../constants';
import { DataError } from '../errors';
import {
  LIBRARY_DATABASE_PATH,
  LIBRARY_MAX_WORLDS,
  LIBRARY_MANIFEST_MAX_BYTES,
  LIBRARY_SETTINGS_FILE,
} from './constants';
import {
  buildLibraryWorldPath,
  parseLibraryEntryPath,
} from './paths';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const countsSchema = z
  .strictObject({
    entities: z.number().int().min(0),
    entityTypes: z.number().int().min(0),
    relationTypes: z.number().int().min(0),
    tags: z.number().int().min(0),
    relations: z.number().int().min(0),
    versions: z.number().int().min(0),
    assets: z.number().int().min(0),
  })
  .strict();

const warningSchema = z
  .strictObject({
    code: z.enum(TRANSFER_WARNING_CODES),
    count: z.number().int().min(1),
  })
  .strict();

const warningsSchema = z
  .array(warningSchema)
  .max(TRANSFER_WARNING_CODES.length);

const worldSchema = z
  .strictObject({
    slug: z
      .string()
      .min(1)
      .max(80)
      .regex(WORLD_SLUG_PATTERN),
    name: z.string().min(1).max(WORLD_NAME_MAX_LENGTH),
    path: z.string().min(1).max(TRANSFER_MAX_PATH_LENGTH),
    size: z.number().int().min(1),
    sha256: sha256Schema,
    counts: countsSchema,
    warnings: warningsSchema,
  })
  .strict();

/** Esquema estricto del manifiesto de la biblioteca. */
export const libraryManifestSchema = z
  .strictObject({
    format: z.literal(DATA_LIBRARY_FORMAT.id),
    formatVersion: z.literal(DATA_LIBRARY_FORMAT.version),
    schemaVersion: z.number().int().min(1),
    appVersion: z.string().min(1).max(40),
    exportedAt: z
      .string()
      .min(20)
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value))),
    database: z
      .strictObject({
        path: z.literal(LIBRARY_DATABASE_PATH),
        size: z.number().int().min(1),
        sha256: sha256Schema,
        integrity: z.literal('ok'),
        schemaVersion: z.number().int().min(1),
      })
      .strict(),
    settings: z
      .strictObject({
        path: z.literal(LIBRARY_SETTINGS_FILE),
        size: z.number().int().min(1),
        sha256: sha256Schema,
      })
      .strict(),
    worlds: z.array(worldSchema).max(LIBRARY_MAX_WORLDS),
    counts: countsSchema,
    warnings: warningsSchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.database.schemaVersion !== manifest.schemaVersion) {
      context.addIssue({
        code: 'custom',
        message: 'La versión de la base no coincide con el manifiesto.',
        path: ['database', 'schemaVersion'],
      });
    }

    const paths = new Set<string>();
    const slugs = new Set<string>();

    for (const world of manifest.worlds) {
      let parsed;

      try {
        parsed = parseLibraryEntryPath(world.path);
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'Ruta de mundo no permitida.',
          path: ['worlds'],
        });
        continue;
      }

      if (parsed.kind !== 'world' || parsed.slug !== world.slug) {
        context.addIssue({
          code: 'custom',
          message: 'La ruta del mundo no coincide con su slug.',
          path: ['worlds'],
        });
      }

      const pathKey = world.path.toLowerCase();
      const slugKey = world.slug.toLowerCase();

      if (paths.has(pathKey)) {
        context.addIssue({
          code: 'custom',
          message: 'La biblioteca repite una ruta de mundo.',
          path: ['worlds'],
        });
      }

      if (slugs.has(slugKey)) {
        context.addIssue({
          code: 'custom',
          message: 'La biblioteca repite un slug de mundo.',
          path: ['worlds'],
        });
      }

      paths.add(pathKey);
      slugs.add(slugKey);
    }

    const expected = sumCounts(manifest.worlds.map((world) => world.counts));

    if (!countsEqual(manifest.counts, expected)) {
      context.addIssue({
        code: 'custom',
        message: 'Los recuentos agregados no coinciden con los mundos.',
        path: ['counts'],
      });
    }

    assertUniqueWarnings(manifest.warnings, ['warnings'], context);

    for (const world of manifest.worlds) {
      assertUniqueWarnings(world.warnings, ['worlds'], context);
    }
  });

export type LibraryManifest = z.infer<typeof libraryManifestSchema>;

/** Entrada de mundo del manifiesto. */
export type LibraryWorldManifest = LibraryManifest['worlds'][number];

/** Datos para construir un manifiesto ya verificados por el servicio. */
export interface CreateLibraryManifestInput {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly database: {
    readonly size: number;
    readonly sha256: string;
    readonly schemaVersion: number;
  };
  readonly settings: {
    readonly size: number;
    readonly sha256: string;
  };
  readonly worlds: readonly {
    readonly slug: string;
    readonly name: string;
    readonly size: number;
    readonly sha256: string;
    readonly counts: TransferCounts;
    readonly warnings: readonly TransferWarning[];
  }[];
  readonly counts: TransferCounts;
  readonly warnings: readonly TransferWarning[];
}

/** Construye y valida el manifiesto de la biblioteca. */
export function createLibraryManifest(
  input: CreateLibraryManifestInput,
): LibraryManifest {
  let worlds: Array<
    CreateLibraryManifestInput['worlds'][number] & {
      readonly path: string;
    }
  >;

  try {
    worlds = input.worlds.map((world) => ({
      ...world,
      path: buildLibraryWorldPath(world.slug),
    }));
  } catch (error) {
    throw new DataError('DATA_LIBRARY_MANIFEST_INVALID', { cause: error });
  }

  const parsed = libraryManifestSchema.safeParse({
    format: DATA_LIBRARY_FORMAT.id,
    formatVersion: DATA_LIBRARY_FORMAT.version,
    schemaVersion: input.schemaVersion,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    database: {
      path: LIBRARY_DATABASE_PATH,
      size: input.database.size,
      sha256: input.database.sha256,
      integrity: 'ok',
      schemaVersion: input.database.schemaVersion,
    },
    settings: {
      path: LIBRARY_SETTINGS_FILE,
      size: input.settings.size,
      sha256: input.settings.sha256,
    },
    worlds,
    counts: input.counts,
    warnings: input.warnings,
  });

  if (!parsed.success) {
    throw new DataError('DATA_LIBRARY_MANIFEST_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Valida un manifiesto ya deserializado. */
export function parseLibraryManifest(value: unknown): LibraryManifest {
  const parsed = libraryManifestSchema.safeParse(value);

  if (!parsed.success) {
    throw new DataError('DATA_LIBRARY_MANIFEST_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Valida `manifest.json` desde texto. */
export function parseLibraryManifestJson(text: string): LibraryManifest {
  if (Buffer.byteLength(text, 'utf8') > LIBRARY_MANIFEST_MAX_BYTES) {
    throw new DataError('DATA_LIBRARY_MANIFEST_INVALID');
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new DataError('DATA_LIBRARY_MANIFEST_INVALID');
  }

  return parseLibraryManifest(value);
}

/** Serializa el manifiesto con formato legible e inspeccionable. */
export function serializeLibraryManifest(manifest: LibraryManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Comprueba que el conjunto real de entradas coincide con el manifiesto.
 *
 * `actual` excluye `manifest.json` y asocia cada ruta con su tamaño real.
 */
export function verifyLibraryFileSet(
  manifest: LibraryManifest,
  actual: ReadonlyMap<string, number>,
): void {
  const expected = new Map<string, number>([
    [manifest.settings.path, manifest.settings.size],
    [manifest.database.path, manifest.database.size],
    ...manifest.worlds.map(
      (world) => [world.path, world.size] as const,
    ),
  ]);

  if (actual.size !== expected.size) {
    throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
  }

  for (const [path, size] of expected) {
    if (actual.get(path) !== size) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }
  }
}

/** Suma recuentos de varios mundos. */
export function sumCounts(
  counts: readonly TransferCounts[],
): TransferCounts {
  const total = {
    entities: 0,
    entityTypes: 0,
    relationTypes: 0,
    tags: 0,
    relations: 0,
    versions: 0,
    assets: 0,
  };

  for (const item of counts) {
    total.entities += item.entities;
    total.entityTypes += item.entityTypes;
    total.relationTypes += item.relationTypes;
    total.tags += item.tags;
    total.relations += item.relations;
    total.versions += item.versions;
    total.assets += item.assets;
  }

  return total;
}

/** Fusiona avisos por código, en el orden estable del contrato. */
export function mergeWarnings(
  warnings: readonly (readonly TransferWarning[])[],
): TransferWarning[] {
  const counts = new Map<string, number>();

  for (const group of warnings) {
    for (const warning of group) {
      counts.set(warning.code, (counts.get(warning.code) ?? 0) + warning.count);
    }
  }

  return TRANSFER_WARNING_CODES.flatMap((code) => {
    const count = counts.get(code);

    return count === undefined ? [] : [{ code, count }];
  });
}

function countsEqual(left: TransferCounts, right: TransferCounts): boolean {
  return (
    left.entities === right.entities &&
    left.entityTypes === right.entityTypes &&
    left.relationTypes === right.relationTypes &&
    left.tags === right.tags &&
    left.relations === right.relations &&
    left.versions === right.versions &&
    left.assets === right.assets
  );
}

interface RefinementContext {
  addIssue(issue: {
    readonly code: 'custom';
    readonly message: string;
    readonly path: (string | number)[];
  }): void;
}

function assertUniqueWarnings(
  warnings: readonly TransferWarning[],
  path: (string | number)[],
  context: RefinementContext,
): void {
  const codes = new Set<string>();

  for (const warning of warnings) {
    if (codes.has(warning.code)) {
      context.addIssue({
        code: 'custom',
        message: 'La biblioteca repite un código de aviso.',
        path,
      });
    }

    codes.add(warning.code);
  }
}
