/**
 * Selector nativo de imágenes para la galería de fichas.
 *
 * Las rutas las produce Electron y se quedan en el proceso principal: el
 * renderer solo recibe los metadatos del asset ya importado. El diálogo se
 * abre sobre la ventana principal y no acepta selección de directorios.
 */
import { dialog, type OpenDialogOptions } from 'electron';

import { messages } from '../messages/es';
import { getMainWindow } from '../window';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];

/** Abre el diálogo nativo y devuelve las rutas elegidas; vacío al cancelar. */
export async function pickImageFiles(): Promise<readonly string[]> {
  const options: OpenDialogOptions = {
    title: messages.assetsPicker.title,
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: messages.assetsPicker.filterName, extensions: IMAGE_EXTENSIONS },
    ],
  };
  const window = getMainWindow();
  const result =
    window === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(window, options);

  return result.canceled ? [] : result.filePaths;
}
