import type { TrashItem } from '../../../shared/contracts/trash';
import { useI18n } from '../../i18n/provider';
import { Button } from '../button';
import { Dialog } from '../dialog';

export interface TrashPurgeDialogProps {
  readonly item: TrashItem | null;
  readonly open: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

/** Confirmación de purga individual, con copia previa y canal de errores. */
export function TrashPurgeDialog({
  item,
  open,
  pending,
  error,
  onClose,
  onConfirm,
}: TrashPurgeDialogProps) {
  const { messages } = useI18n();

  if (item === null) {
    return null;
  }

  const body =
    item.kind === 'world'
      ? messages.trash.purgeDialog.bodyWorld
      : item.kind === 'entity'
        ? messages.trash.purgeDialog.bodyEntity
        : messages.trash.purgeDialog.bodyEntityType;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.trash.purgeDialog.title(item.name)}
      dismissible={!pending}
      actions={
        <>
          <Button
            variant="ghost"
            data-autofocus
            disabled={pending}
            onClick={onClose}
          >
            {messages.trash.purgeDialog.cancel}
          </Button>
          <Button variant="danger" loading={pending} onClick={onConfirm}>
            {messages.trash.purgeDialog.submit}
          </Button>
        </>
      }
    >
      <p className="wc-dialog__lead">{body}</p>
      <p className="wc-dialog__note">{messages.trash.purgeDialog.copyNote}</p>
      <p className="wc-dialog__note">{messages.trash.purgeDialog.assetsNote}</p>
      <p className="wc-dialog__note">
        {messages.trash.purgeDialog.irreversible}
      </p>
      {pending ? (
        <p className="wc-dialog__status" role="status">
          {messages.trash.purgeDialog.pending}
        </p>
      ) : null}
      {error === null ? null : (
        <p className="wc-field__error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
