import { useMessages } from '../../i18n/provider';
import { Button, type ButtonVariant } from '../button';
import { Dialog } from '../dialog';

export interface WorldConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly pending: boolean;
  readonly tone?: Extract<ButtonVariant, 'primary' | 'danger'>;
  readonly onClose: () => void;
  /** La confirmación la ejecuta el padre y cierra el diálogo si termina bien. */
  readonly onConfirm: () => void;
}

/**
 * Diálogo de confirmación para archivar, restaurar o mover a la papelera.
 *
 * El texto explica qué ocurre y si hay recuperación. El botón destructivo usa
 * la variante de peligro y el foco inicial sigue el orden natural del `<dialog>`
 * nativo, sin trampas de foco propias.
 */
export function WorldConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  tone = 'primary',
  onClose,
  onConfirm,
}: WorldConfirmDialogProps) {
  const messages = useMessages();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.worlds.confirm.cancel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}
