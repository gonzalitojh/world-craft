/**
 * Instantánea completa y verificada de SQLite.
 *
 * Usa `sqlite.backup` para obtener una copia consistente con la conexión viva,
 * la verifica con `inspectBackupFile` (integridad y `user_version`) y solo
 * entonces la renombra a su nombre definitivo. La copia es **completa**:
 * incluye mundos en papelera, actividad y `app_settings`, también `lastView` y
 * `recentLocation`. Los paquetes `worlds/*.zip` sí son exportaciones de mundo y
 * excluyen papelera, actividad y preferencias.
 */
import { rename, rm, stat } from 'node:fs/promises';

import { computeFileSha256, inspectBackupFile } from '../../backup/verify';
import type { SqliteDatabase } from '../../db/connection';
import { DataError } from '../errors';
import { toLibraryError } from './errors';

/** Huella de la copia de base incluida en la biblioteca. */
export interface LibraryDatabaseSnapshot {
  readonly file: string;
  readonly size: number;
  readonly sha256: string;
}

export interface CreateLibraryDatabaseSnapshotOptions {
  readonly sqlite: SqliteDatabase;
  readonly temporaryFile: string;
  readonly finalFile: string;
  readonly schemaVersion: number;
}

/** Crea, verifica y publica la copia completa de la base. */
export async function createLibraryDatabaseSnapshot(
  options: CreateLibraryDatabaseSnapshotOptions,
): Promise<LibraryDatabaseSnapshot> {
  try {
    await rm(options.temporaryFile, { force: true });

    await options.sqlite.backup(options.temporaryFile);

    if (
      inspectBackupFile(
        options.temporaryFile,
        options.schemaVersion,
        options.schemaVersion,
      ) !== 'ok'
    ) {
      throw new DataError('DATA_LIBRARY_DATABASE_FAILED');
    }

    await rename(options.temporaryFile, options.finalFile);

    const stats = await stat(options.finalFile);

    return {
      file: options.finalFile,
      size: stats.size,
      sha256: await computeFileSha256(options.finalFile),
    };
  } catch (error) {
    await rm(options.temporaryFile, { force: true }).catch(() => undefined);
    throw toLibraryError(error, 'DATA_LIBRARY_DATABASE_FAILED');
  }
}
