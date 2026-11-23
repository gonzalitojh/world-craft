import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/provider';
import { Button } from '../button';
import { Dialog } from '../dialog';

export interface RelationDeleteDialogProps {
  readonly open: boolean;
  /** Etiqueta efectiva de la relación en esta ficha. */
  readonly label: string;
  /** Nombre de la ficha contraparte. */
  readonly name: string;
  readonly pending: boolean;
  readonly error: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * Confirmación modal del borrado de una relación.
 *
 * Reutiliza `Dialog` para la trampa de foco y el velo. El foco inicial cae en
 * «Cancelar»; mientras la petición está en curso el cierre se bloquea (C2) y el
 * foco se mueve al cuerpo del diálogo, porque el botón destructivo se
 * deshabilita (C4). Si falla, el diálogo sigue abierto y el foco vuelve al
 * botón para reintentar.
 */
export function RelationDeleteDialog({
  open,
  label,
  name,
  pending,
  error,
  onCancel,
  onConfirm,
}: RelationDeleteDialogProps) {
  const { messages } = useI18n();
  const relations = messages.entities.relations;
  const wasPending = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');

    if (dialog === null) {
      return;
    }

    if (pending) {
      dialog.querySelector<HTMLElement>('.wc-dialog__body')?.focus();
    } else if (wasPending.current && error) {
      dialog
        .querySelector<HTMLElement>('[data-relation-delete-submit]')
        ?.focus();
    }

    wasPending.current = pending;
  }, [open, pending, error]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={relations.removeTitle(label, name)}
      dismissible={!pending}
      actions={
        <>
          <Button
            variant="ghost"
            data-autofocus="true"
            disabled={pending}
            onClick={onCancel}
          >
            {relations.cancel}
          </Button>
          <Button
            variant="danger"
            data-relation-delete-submit="true"
            loading={pending}
            onClick={onConfirm}
          >
            {relations.removeSubmit}
          </Button>
        </>
      }
    >
      <p>{relations.removeBody}</p>
      {error ? (
        <p className="wc-alert wc-alert--inline" role="alert">
          {relations.deleteError}
        </p>
      ) : null}
    </Dialog>
  );
}
