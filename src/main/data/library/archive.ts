/**
 * Índice del ZIP externo de la biblioteca.
 *
 * Reutiliza el núcleo genérico del lector de transferencia con la lista blanca
 * de `parseLibraryEntryPath`. No impone el conjunto exacto: eso lo hace la
 * verificación posterior.
 */
import type { ArchiveLimits } from '../../transfer/archive/reader';
import { readArchiveIndexWithPolicy } from '../../transfer/archive/reader';
import { DataError } from '../errors';
import {
  LIBRARY_MANIFEST_MAX_BYTES,
  LIBRARY_SETTINGS_MAX_BYTES,
} from './constants';
import {
  parseLibraryEntryPath,
  type ParsedLibraryEntry,
} from './paths';

/** Tipo del índice de la biblioteca. */
export type LibraryArchiveIndex = Awaited<
  ReturnType<typeof readLibraryArchiveIndex>
>;

/** Lee y valida el índice central del ZIP de la biblioteca. */
export function readLibraryArchiveIndex(
  filePath: string,
  limits: ArchiveLimits = {},
  signal?: AbortSignal,
) {
  return readArchiveIndexWithPolicy<ParsedLibraryEntry>(
    filePath,
    {
      parsePath: parseLibraryEntryPath,
      maxBytesByKind: {
        manifest: LIBRARY_MANIFEST_MAX_BYTES,
        settings: LIBRARY_SETTINGS_MAX_BYTES,
      },
    },
    limits,
    signal,
  ).catch((error: unknown) => {
    if (error instanceof DataError) {
      throw error;
    }

    if (
      error instanceof Error &&
      'code' in error &&
      (error as { readonly code?: unknown }).code === 'TRANSFER_ENTRY_REJECTED'
    ) {
      throw new DataError('DATA_LIBRARY_ENTRY_INVALID', { cause: error });
    }

    throw error;
  });
}
