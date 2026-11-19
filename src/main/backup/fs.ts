/**
 * Comprobaciones de existencia de archivos para copias y restauración.
 *
 * Solo `ENOENT` y `ENOTDIR` significan ausencia. Un error de permisos, un
 * volumen desconectado o cualquier otro fallo se propaga: tratarlo como
 * «no existe» podría crear una copia vacía o pisar datos que sí están.
 */
import { stat } from 'node:fs/promises';

/** Indica si la ruta existe, sea archivo o carpeta. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);

    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw error;
  }
}

/** Indica si la ruta existe y es un archivo regular. */
export async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw error;
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
