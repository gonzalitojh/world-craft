import type { UpdateSnapshot } from '../../shared/contracts/updates';
import { useI18n } from '../i18n/provider';
import {
  getUpdatePrimaryAction,
  getUpdateStatusMessage,
} from '../updates/status';
import { Button } from './button';
import { Dialog } from './dialog';

export interface UpdatesDialogProps {
  readonly open: boolean;
  readonly snapshot: UpdateSnapshot;
  /** Error de transporte IPC; nunca contiene detalles internos. */
  readonly commandError: string | null;
  readonly onClose: () => void;
  readonly onCheck: () => void;
  readonly onCancel: () => void;
  readonly onDownload: () => void;
  readonly onInstall: () => void;
}

/**
 * Diálogo de actualizaciones.
 *
 * Es presentacional: recibe el snapshot y las órdenes, sin conocer el preload.
 * El `<dialog>` nativo aporta trampa de foco, cierre con Escape y devolución
 * del foco al disparador. El estado se anuncia en una región `aria-live` y la
 * descarga usa `<progress>` con valor y etiqueta accesibles.
 */
export function UpdatesDialog({
  open,
  snapshot,
  commandError,
  onClose,
  onCheck,
  onCancel,
  onDownload,
  onInstall,
}: UpdatesDialogProps) {
  const i18n = useI18n();
  const { messages } = i18n;
  const lastCheckedAt = snapshot.lastCheckedAt;
  const lastChecked =
    lastCheckedAt !== null && !Number.isNaN(new Date(lastCheckedAt).getTime())
      ? i18n.formats.formatDateTime(lastCheckedAt)
      : null;
  const percent = i18n.formats.formatPercent(
    (snapshot.progressPercent ?? 0) / 100,
  );
  const message = getUpdateStatusMessage(snapshot, i18n);
  const actionLabel = getUpdatePrimaryAction(snapshot, i18n);
  const downloadProgress = snapshot.progressPercent ?? 0;
  const isError = commandError !== null || snapshot.phase === 'error';

  const runPrimaryAction = (): void => {
    switch (snapshot.phase) {
      case 'checking':
      case 'downloading':
        onCancel();
        return;
      case 'available':
        onDownload();
        return;
      case 'downloaded':
        onInstall();
        return;
      default:
        onCheck();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.updates.title}
      className="wc-updates"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {messages.components.dialog.close}
          </Button>
          {actionLabel === null ? null : (
            <Button variant="primary" onClick={runPrimaryAction}>
              {actionLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="wc-updates__body">
        <dl className="wc-updates__meta">
          <div className="wc-updates__meta-row">
            <dt className="wc-updates__meta-label">
              {messages.updates.installedVersionLabel}
            </dt>
            <dd className="wc-updates__meta-value">
              {snapshot.currentVersion}
            </dd>
          </div>
          <div className="wc-updates__meta-row">
            <dt className="wc-updates__meta-label">
              {messages.updates.lastCheckedLabel}
            </dt>
            <dd className="wc-updates__meta-value">
              {lastChecked ?? messages.updates.neverChecked}
            </dd>
          </div>
        </dl>

        {commandError === null ? null : (
          <p className="wc-updates__status" role="alert">
            {commandError}
          </p>
        )}

        <p
          className="wc-updates__status"
          role={isError ? 'alert' : 'status'}
          aria-live={isError ? 'assertive' : 'polite'}
          aria-atomic="true"
          aria-busy={
            snapshot.phase === 'checking' ||
            snapshot.phase === 'downloading' ||
            snapshot.phase === 'installing'
          }
        >
          {message}
        </p>

        {snapshot.phase === 'downloading' ? (
          <div className="wc-updates__download">
            <progress
              className="wc-updates__progress"
              max={100}
              value={downloadProgress}
              aria-label={messages.updates.progressLabel(percent)}
              aria-valuetext={messages.updates.percentValue(percent)}
            />
            <span className="wc-updates__percent" aria-hidden="true">
              {messages.updates.percentValue(percent)}
            </span>
          </div>
        ) : null}

        <p className="wc-updates__privacy">{messages.updates.privacy}</p>
      </div>
    </Dialog>
  );
}
