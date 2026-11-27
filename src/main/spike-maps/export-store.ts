/**
 * Almacén de exportaciones del laboratorio de mapas (#80).
 *
 * El renderer nunca aporta rutas ni nombres: solo el tipo y los bytes. Este
 * módulo decide la carpeta (`userData/data/spike-maps`), genera el nombre con
 * un UUID corto, comprueba la contención real sin seguir enlaces y escribe con
 * `wx` para no sobrescribir. Devuelve únicamente el nombre relativo y el
 * tamaño; las rutas absolutas se quedan aquí.
 */
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import {
  SPIKE_EXPORT_EXTENSIONS,
  SPIKE_EXPORT_MAX_BYTES,
  SPIKE_EXPORT_MIN_BYTES,
  isSpikeExportKind,
  type SpikeExportInput,
  type SpikeExportKind,
  type SpikeExportResult,
} from '../../shared/contracts/maps-spike';
import { SPIKE_EXPORTS_DIR_NAME } from '../db/paths';

/** Códigos de error de dominio del almacén. */
export type SpikeExportErrorCode =
  | 'SPIKE_EXPORT_INVALID_INPUT'
  | 'SPIKE_EXPORT_UNAVAILABLE'
  | 'SPIKE_EXPORT_WRITE_FAILED';

/** Error controlado, sin rutas ni detalles internos en el mensaje. */
export class SpikeExportError extends Error {
  readonly code: SpikeExportErrorCode;

  constructor(
    code: SpikeExportErrorCode,
    options?: { readonly cause?: unknown },
  ) {
    super('No se pudo guardar la exportación del laboratorio.', options);
    this.name = 'SpikeExportError';
    this.code = code;
  }
}

/** Puerto usado por el handler IPC. */
export interface SpikeExportStore {
  saveExport(input: SpikeExportInput): Promise<SpikeExportResult>;
}

/** Opciones del almacén; la aleatoriedad se inyecta en las pruebas. */
export interface SpikeExportStoreOptions {
  readonly userDataDir: string;
  readonly randomBytes?: (size: number) => Uint8Array;
}

/** Nombre canónico del archivo dentro de la carpeta del spike. */
export function buildSpikeExportFileName(
  kind: SpikeExportKind,
  token: string,
): string {
  if (!isSpikeExportKind(kind) || !/^[0-9a-f]{8}$/.test(token)) {
    throw new SpikeExportError('SPIKE_EXPORT_INVALID_INPUT');
  }

  return `wc-m2-01-${kind}-${token}.${SPIKE_EXPORT_EXTENSIONS[kind]}`;
}

/** Valida el payload del dominio antes de tocar el disco. */
export function isValidSpikeExportInput(
  input: unknown,
): input is SpikeExportInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const candidate = input as {
    readonly kind?: unknown;
    readonly content?: unknown;
  };

  if (!isSpikeExportKind(candidate.kind)) {
    return false;
  }

  if (!(candidate.content instanceof Uint8Array)) {
    return false;
  }

  return (
    candidate.content.byteLength >= SPIKE_EXPORT_MIN_BYTES &&
    candidate.content.byteLength <= SPIKE_EXPORT_MAX_BYTES
  );
}

function assertLexicallyInside(root: string, candidate: string): void {
  const relation = relative(root, candidate);

  if (
    relation.length === 0 ||
    relation.startsWith('..') ||
    isAbsolute(relation)
  ) {
    throw new SpikeExportError('SPIKE_EXPORT_UNAVAILABLE');
  }
}

function isMissingError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}

/**
 * Crea el almacén real.
 *
 * `userDataDir` debe ser absoluto y no contener NUL; cualquier otra cosa deja
 * el almacén inutilizable con un error controlado. La carpeta se crea en el
 * primer guardado, no al componer la aplicación.
 */
export function createSpikeExportStore(
  options: SpikeExportStoreOptions,
): SpikeExportStore {
  if (
    typeof options.userDataDir !== 'string' ||
    options.userDataDir.trim().length === 0 ||
    options.userDataDir.includes('\0') ||
    !isAbsolute(options.userDataDir)
  ) {
    throw new SpikeExportError('SPIKE_EXPORT_UNAVAILABLE');
  }

  const root = resolve(options.userDataDir);
  const exportsDir = resolve(root, 'data', SPIKE_EXPORTS_DIR_NAME);
  const random = options.randomBytes ?? ((size: number) => randomBytes(size));

  assertLexicallyInside(root, exportsDir);

  async function ensureExportsDirectory(): Promise<void> {
    const dataDir = resolve(root, 'data');

    /**
     * Comprueba un componente antes de crear nada.
     *
     * Es clave para no crear `spike-maps` a través de una junction `data`
     * hacia una carpeta externa: si el componente existe y no es un directorio
     * real, se rechaza antes del `mkdir`.
     */
    const assertDirectoryOrMissing = async (
      candidate: string,
    ): Promise<void> => {
      try {
        const stats = await lstat(candidate);

        if (stats.isSymbolicLink() || !stats.isDirectory()) {
          throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED');
        }
      } catch (error) {
        if (error instanceof SpikeExportError) {
          throw error;
        }

        if (!isMissingError(error)) {
          throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED', {
            cause: error,
          });
        }
      }
    };

    try {
      await assertDirectoryOrMissing(dataDir);
      await assertDirectoryOrMissing(exportsDir);
      await mkdir(exportsDir, { recursive: true });
    } catch (error) {
      if (error instanceof SpikeExportError) {
        throw error;
      }

      throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED', { cause: error });
    }

    try {
      for (const candidate of [dataDir, exportsDir]) {
        const stats = await lstat(candidate);

        if (stats.isSymbolicLink() || !stats.isDirectory()) {
          throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED');
        }
      }

      const [realRoot, realExports] = await Promise.all([
        realpath(root),
        realpath(exportsDir),
      ]);
      const relation = relative(realRoot, realExports);

      if (
        relation.length === 0 ||
        relation.startsWith('..') ||
        isAbsolute(relation)
      ) {
        throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED');
      }
    } catch (error) {
      if (error instanceof SpikeExportError) {
        throw error;
      }

      if (isMissingError(error)) {
        throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED', {
          cause: error,
        });
      }

      throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED', { cause: error });
    }
  }

  async function writeWithUniqueName(
    kind: SpikeExportKind,
    content: Uint8Array,
  ): Promise<SpikeExportResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = Buffer.from(random(4)).toString('hex');
      const fileName = buildSpikeExportFileName(kind, token);

      try {
        await writeFile(join(exportsDir, fileName), content, {
          flag: 'wx',
          mode: 0o600,
        });

        return { fileName, bytes: content.byteLength };
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          continue;
        }

        throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED', {
          cause: error,
        });
      }
    }

    throw new SpikeExportError('SPIKE_EXPORT_WRITE_FAILED');
  }

  return {
    async saveExport(input: SpikeExportInput): Promise<SpikeExportResult> {
      if (!isValidSpikeExportInput(input)) {
        throw new SpikeExportError('SPIKE_EXPORT_INVALID_INPUT');
      }

      await ensureExportsDirectory();

      return writeWithUniqueName(input.kind, input.content);
    },
  };
}

/** Almacén inerte para modo seguro o userData inválido. */
export function createUnavailableSpikeExportStore(): SpikeExportStore {
  return {
    async saveExport(): Promise<SpikeExportResult> {
      throw new SpikeExportError('SPIKE_EXPORT_UNAVAILABLE');
    },
  };
}
