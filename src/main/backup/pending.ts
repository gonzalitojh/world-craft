/**
 * Marcador durable de restauración.
 *
 * `data/.restore.pending` se escribe después de adquirir el lock y antes de
 * tocar la base viva, los restos o la copia pre-restore. Su presencia significa
 * «restauración en curso o interrumpida» y el arranque nunca debe crear una
 * base vacía mientras exista. El lock sigue siendo la exclusión mutua; el
 * marcador es la garantía que sobrevive a un cierre abrupto.
 *
 * Los errores no incluyen rutas ni contenido.
 */
import { rm, writeFile } from 'node:fs/promises';

/** Nombre del marcador dentro de `data/`. */
export const RESTORE_PENDING_FILE_NAME = '.restore.pending';

/**
 * Escribe el marcador con `wx`.
 *
 * Si ya existe (reintento tras un intento interrumpido, con el lock ya
 * adquirido), se reutiliza tal cual: borrarlo antes de reescribirlo abriría una
 * ventana en la que el arranque podría crear una base vacía. Cualquier otro
 * error se propaga.
 */
export async function writeRestorePending(
  file: string,
  pid: number,
  timestamp: number,
): Promise<void> {
  const payload = `${JSON.stringify({
    pid,
    createdAt: new Date(timestamp).toISOString(),
  })}\n`;

  try {
    await writeFile(file, payload, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    // Ya existe: el llamador tiene el lock y el marcador cumple su función.
  }
}

/** Elimina el marcador; el llamador conserva errores para decidir. */
export async function removeRestorePending(file: string): Promise<void> {
  await rm(file, { force: true });
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}
