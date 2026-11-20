/**
 * Textos y acción principal del panel de actualizaciones.
 *
 * Separado del componente para poder probar todos los estados sin DOM. Recibe
 * el idioma activo: los códigos del servicio se traducen aquí y nunca se
 * muestra un mensaje interno.
 */
import type { UpdateSnapshot } from '../../shared/contracts/updates';
import type { I18n } from '../i18n/create';

/** Texto visible para el estado actual. */
export function getUpdateStatusMessage(
  snapshot: UpdateSnapshot,
  i18n: I18n,
): string {
  const { messages, formats } = i18n;

  switch (snapshot.phase) {
    case 'unavailable': {
      switch (snapshot.unavailableReason) {
        case 'not-packaged':
          return messages.updates.statuses.unavailable(
            messages.updates.reasons.notPackaged,
          );
        case 'safe-mode':
          return messages.updates.statuses.unavailable(
            messages.updates.reasons.safeMode,
          );
        case 'not-configured':
          return messages.updates.statuses.unavailable(
            messages.updates.reasons.notConfigured,
          );
        case 'module-missing':
          return messages.updates.statuses.unavailable(
            messages.updates.reasons.moduleMissing,
          );
        default:
          return messages.updates.statuses.unavailable('');
      }
    }
    case 'idle':
      return messages.updates.statuses.idle;
    case 'checking':
      return messages.updates.statuses.checking;
    case 'up-to-date':
      return messages.updates.statuses.upToDate(snapshot.currentVersion);
    case 'available':
      return messages.updates.statuses.available(
        snapshot.availableVersion ?? snapshot.currentVersion,
      );
    case 'downloading':
      return messages.updates.statuses.downloading(
        formats.formatPercent((snapshot.progressPercent ?? 0) / 100),
      );
    case 'downloaded':
      return messages.updates.statuses.downloaded(
        snapshot.availableVersion ?? snapshot.currentVersion,
      );
    case 'installing':
      return messages.updates.statuses.installing;
    case 'error':
      switch (snapshot.errorCode) {
        case 'UPDATE_DOWNLOAD_FAILED':
          return messages.updates.statuses.error(
            messages.updates.errors.downloadFailed,
          );
        case 'UPDATE_INSTALL_FAILED':
          return messages.updates.statuses.error(
            messages.updates.errors.installFailed,
          );
        case 'UPDATE_INVALID_STATE':
          return messages.updates.statuses.error(
            messages.updates.errors.invalidState,
          );
        case 'UPDATE_CHECK_FAILED':
        default:
          return messages.updates.statuses.error(
            messages.updates.errors.checkFailed,
          );
      }
    default:
      return messages.updates.statuses.idle;
  }
}

/** Etiqueta del botón principal, o `null` si la fase no admite acción. */
export function getUpdatePrimaryAction(
  snapshot: UpdateSnapshot,
  i18n: I18n,
): string | null {
  switch (snapshot.phase) {
    case 'idle':
    case 'up-to-date':
      return i18n.messages.updates.actions.check;
    case 'checking':
    case 'downloading':
      return i18n.messages.updates.actions.cancel;
    case 'available':
      return i18n.messages.updates.actions.download;
    case 'downloaded':
      return i18n.messages.updates.actions.install;
    case 'error':
      return i18n.messages.updates.actions.retry;
    default:
      return null;
  }
}
