/**
 * Escritor de ZIP basado en `yazl`.
 *
 * Escribe en un archivo `.partial` elegido por el servicio y publica después
 * con `rename`. Los nombres se validan con la misma política cerrada que la
 * lectura; el escritor nunca recibe rutas derivadas de datos no confiables.
 *
 * Los assets WebP ya están comprimidos y se guardan sin recompresión; el
 * manifiesto y `world.json` sí se comprimen. La fecha DOS es fija para no
 * revelar la hora local en los metadatos del ZIP.
 */
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { finished, pipeline } from 'node:stream/promises';

import yazl from 'yazl';

import type { WriteStream } from 'node:fs';

import { TransferError } from '../errors';
import { parseTransferEntryPath } from '../format/paths';

/** Opciones de un archivo añadido al ZIP. */
export interface AddArchiveFileOptions {
  readonly compress?: boolean;
}

/** Escritor de un ZIP en construcción. */
export interface ArchiveWriter {
  addBuffer(
    path: string,
    contents: Buffer,
    options?: AddArchiveFileOptions,
  ): void;
  addFile(
    path: string,
    sourceFile: string,
    options?: AddArchiveFileOptions,
  ): void;
  finalize(): Promise<void>;
  abort(): Promise<void>;
}

/** Fecha fija de los metadatos ZIP (mínimo DOS: 1980-01-01). */
const FIXED_MTIME = new Date('1980-01-01T00:00:00.000Z');

/** Crea un escritor sobre un archivo que no debe existir. */
export function createArchiveWriter(
  outputFile: string,
  signal?: AbortSignal,
): ArchiveWriter {
  const zip = new yazl.ZipFile();
  const output: WriteStream = createWriteStream(outputFile, {
    flags: 'wx',
    mode: 0o600,
  });

  let finalized = false;
  let aborted = false;
  let failure: unknown = null;
  let created = false;

  output.once('open', () => {
    created = true;
  });

  const pipelinePromise = pipeline(
    zip.outputStream as NodeJS.ReadableStream,
    output,
  ).catch((error: unknown) => {
    failure = error;
  });

  const onAbort = (): void => {
    aborted = true;
    output.destroy(new TransferError('TRANSFER_CANCELLED'));
  };

  signal?.addEventListener('abort', onAbort, { once: true });

  const assertWritable = (): void => {
    if (aborted) {
      throw new TransferError('TRANSFER_CANCELLED');
    }

    if (failure !== null) {
      throw new TransferError('TRANSFER_SAVE_FAILED', { cause: failure });
    }

    if (finalized) {
      throw new TransferError('TRANSFER_INTERNAL');
    }
  };

  const assertPath = (path: string): void => {
    parseTransferEntryPath(path);
  };

  return {
    addBuffer(path, contents, options) {
      assertWritable();
      assertPath(path);
      zip.addBuffer(contents, path, {
        mtime: FIXED_MTIME,
        mode: 0o644,
        forceDosTimestamp: true,
        compress: options?.compress ?? true,
      });
    },

    addFile(path, sourceFile, options) {
      assertWritable();
      assertPath(path);
      zip.addFile(sourceFile, path, {
        mtime: FIXED_MTIME,
        mode: 0o644,
        forceDosTimestamp: true,
        compress: options?.compress ?? false,
      });
    },

    async finalize() {
      assertWritable();
      finalized = true;

      try {
        zip.end();
        await pipelinePromise;
        await finished(output);
        throwIfAborted(signal);
      } catch (error) {
        if (created) {
          await cleanup(outputFile);
        }

        throw toWriterError(error);
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
    },

    async abort() {
      if (aborted) {
        return;
      }

      aborted = true;
      signal?.removeEventListener('abort', onAbort);
      output.destroy();
      (
        zip.outputStream as NodeJS.ReadableStream & { destroy?: () => void }
      ).destroy?.();

      if (created) {
        await cleanup(outputFile);
      }
    },
  };
}

async function cleanup(outputFile: string): Promise<void> {
  await rm(outputFile, { force: true }).catch(() => undefined);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new TransferError('TRANSFER_CANCELLED');
  }
}

function toWriterError(error: unknown): TransferError {
  if (error instanceof TransferError) {
    return error;
  }

  return new TransferError('TRANSFER_SAVE_FAILED', { cause: error });
}
