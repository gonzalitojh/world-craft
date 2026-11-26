/** Traducción estable de códigos de datos; nunca muestra mensajes crudos. */
import type { MessageCatalog } from '../messages';
import type { DataUiErrorCode } from './use-data-settings';

export function dataErrorMessage(
  messages: MessageCatalog,
  code: DataUiErrorCode,
): string {
  return (
    messages.settings.data.errors.codes[code] ??
    messages.settings.data.errors.codes.UNKNOWN
  );
}
