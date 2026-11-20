/**
 * Textos y acción principal del panel de actualizaciones.
 *
 * Separado del componente para poder probar todos los estados sin DOM. Los
 * códigos del servicio se traducen aquí; nunca se muestra un mensaje interno.
 */
import type { UpdateSnapshot } from '../../shared/contracts/updates';
import { messages } from '../messages/es';
import { formatPercent } from './format';

/** Texto visible para el estado actual. */
export function getUpdateStatusMessage(snapshot: UpdateSnapshot): string {
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
        formatPercent(snapshot.progressPercent ?? 0),
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
): string | null {
  switch (snapshot.phase) {
    case 'idle':
    case 'up-to-date':
      return messages.updates.actions.check;
    case 'checking':
    case 'downloading':
      return messages.updates.actions.cancel;
    case 'available':
      return messages.updates.actions.download;
    case 'downloaded':
      return messages.updates.actions.install;
    case 'error':
      return messages.updates.actions.retry;
    default:
      return null;
  }
}
