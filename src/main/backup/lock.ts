/**
 * Lock de restauración compartido por la restauración y el arranque.
 *
 * El lock vive en `data/.restore.lock`, se crea con `wx` y contiene solo el PID
 * y la fecha. Un lock de un proceso que ya no vive es obsoleto; si no se puede
 * leer se trata como vivo para no arriesgar dos restauraciones a la vez. Los
 * errores no incluyen rutas.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';

/** Nombre del lock dentro de `data/`. */
export const RESTORE_LOCK_FILE_NAME = '.restore.lock';

/** Estado de un lock existente. */
export type RestoreLockState = 'missing' | 'stale' | 'held';

/** Resultado de intentar adquirir el lock. */
export type RestoreLockAcquisition = 'acquired' | 'held' | 'io';

/** Inspecciona el lock sin modificarlo. */
export async function inspectRestoreLock(
  lockFile: string,
): Promise<RestoreLockState> {
  let raw: string;

  try {
    raw = await readFile(lockFile, 'utf8');
  } catch (error) {
    return isMissingPathError(error) ? 'missing' : 'held';
  }

  const pid = parseLockPid(raw);

  if (pid !== null && isProcessAlive(pid)) {
    return 'held';
  }

  return 'stale';
}

/** Elimina el lock; el llamador decide si un fallo es bloqueante. */
export async function removeRestoreLock(lockFile: string): Promise<void> {
  await rm(lockFile, { force: true });
}

/**
 * Adquiere el lock o informa de que otro proceso lo tiene.
 *
 * Un lock obsoleto se elimina y se reintenta una vez. Cualquier fallo de disco
 * se devuelve como `io` para que la restauración no continúe a ciegas.
 */
export async function acquireRestoreLock(
  lockFile: string,
  pid: number,
  timestamp: number,
): Promise<RestoreLockAcquisition> {
  const payload = `${JSON.stringify({
    pid,
    createdAt: new Date(timestamp).toISOString(),
  })}\n`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFile(lockFile, payload, { encoding: 'utf8', flag: 'wx' });

      return 'acquired';
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        return 'io';
      }

      if ((await inspectRestoreLock(lockFile)) === 'held') {
        return 'held';
      }

      try {
        await removeRestoreLock(lockFile);
      } catch {
        return 'io';
      }
    }
  }

  return 'held';
}

function parseLockPid(raw: string): number | null {
  try {
    const value = JSON.parse(raw) as unknown;

    if (
      typeof value === 'object' &&
      value !== null &&
      'pid' in value &&
      typeof value.pid === 'number' &&
      Number.isInteger(value.pid) &&
      value.pid > 0
    ) {
      return value.pid;
    }

    return null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    // `EPERM` indica que el proceso existe pero no tenemos permiso para
    // señalizarlo; cualquier otro error se trata como proceso inexistente.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}
