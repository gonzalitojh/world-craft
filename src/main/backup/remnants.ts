/**
 * Detección de restos de una restauración interrumpida.
 *
 * Se ejecuta al arrancar, antes de calcular si la base es nueva y antes de
 * abrirla. El marcador `.restore.pending`, un `.rollback*` o un `.restore.tmp*`
 * indican que hay una restauración en curso o que el proceso anterior murió a
 * mitad: no se debe crear una base vacía ni tocar los restos. Un
 * `.restore.lock` sin otros restos solo bloquea si su PID sigue vivo; si está
 * muerto se elimina y el arranque continúa.
 *
 * No se borra ningún resto de datos: una restauración posterior los preserva en
 * `backups/pre-restore/`. Solo un lock obsoleto se retira.
 */
import { join } from 'node:path';

import { pathExists } from './fs';
import {
  inspectRestoreLock,
  removeRestoreLock,
  RESTORE_LOCK_FILE_NAME,
} from './lock';
import { RESTORE_PENDING_FILE_NAME } from './pending';

/** Resultado de inspeccionar los restos de restauración. */
export type RestoreRemnantInspection =
  | { readonly status: 'clear' }
  | { readonly status: 'interrupted' }
  | { readonly status: 'io-error' };

export interface InspectRestoreRemnantsOptions {
  readonly dataDir: string;
  readonly databaseFile: string;
}

/**
 * Detecta restos de restauración y limpia solo un lock obsoleto.
 *
 * Devuelve `io-error` si no se puede comprobar el sistema de archivos o
 * eliminar un lock obsoleto; el arranque lo trata como un fallo de apertura.
 */
export async function inspectRestoreRemnants(
  options: InspectRestoreRemnantsOptions,
): Promise<RestoreRemnantInspection> {
  try {
    for (const file of restoreRemnantFiles(options)) {
      if (await pathExists(file)) {
        return { status: 'interrupted' };
      }
    }

    const lockFile = join(options.dataDir, RESTORE_LOCK_FILE_NAME);
    const lock = await inspectRestoreLock(lockFile);

    if (lock === 'held') {
      return { status: 'interrupted' };
    }

    if (lock === 'stale') {
      await removeRestoreLock(lockFile);
    }

    return { status: 'clear' };
  } catch {
    return { status: 'io-error' };
  }
}

/** Rutas que dejan una restauración en curso o a medias, sin el lock. */
export function restoreRemnantFiles(
  options: InspectRestoreRemnantsOptions,
): readonly string[] {
  const rollback = `${options.databaseFile}.rollback`;
  const temporary = `${options.databaseFile}.restore.tmp`;

  return [
    rollback,
    `${rollback}-wal`,
    `${rollback}-shm`,
    `${rollback}-journal`,
    temporary,
    `${temporary}-wal`,
    `${temporary}-shm`,
    `${temporary}-journal`,
    join(options.dataDir, RESTORE_PENDING_FILE_NAME),
  ];
}
