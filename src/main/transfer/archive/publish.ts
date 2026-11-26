/**
 * Publicación atómica de un ZIP ya verificado.
 *
 * El `.partial` se renombra sobre el destino. Si ya existía un archivo, se
 * mueve primero a un residuo temporal y se restaura si el `rename` final falla.
 * La copia antigua nunca se borra antes de que el nuevo destino esté publicado.
 */
import { rename, rm } from 'node:fs/promises';

import { TransferError } from '../errors';
import { pathExists } from '../fs';

/** Publica `partialFile` como `destinationFile` conservando el anterior. */
export async function publishArchive(
  partialFile: string,
  destinationFile: string,
): Promise<void> {
  const backupFile = `${partialFile}.replaced`;
  let movedOriginal = false;

  try {
    if (await pathExists(destinationFile)) {
      await rm(backupFile, { force: true });
      await rename(destinationFile, backupFile);
      movedOriginal = true;
    }

    await rename(partialFile, destinationFile);
  } catch (error) {
    if (movedOriginal) {
      await rename(backupFile, destinationFile).catch(() => undefined);
    }

    throw new TransferError('TRANSFER_SAVE_FAILED', { cause: error });
  }

  // El destino ya es el ZIP nuevo. La copia antigua es un residuo temporal:
  // un fallo al borrarla no invalida una exportación correcta.
  if (movedOriginal) {
    await rm(backupFile, { force: true }).catch(() => undefined);
  }
}
