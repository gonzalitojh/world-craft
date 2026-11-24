import { useEffect, useId, useRef, useState } from 'react';

import type { TrashEmptyResult } from '../../../shared/contracts/trash';
import { useI18n } from '../../i18n/provider';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';

export interface TrashEmptyDialogProps {
  readonly open: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly result: TrashEmptyResult | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

/** Confirmación del vaciado completo con casilla obligatoria. */
export function TrashEmptyDialog({
  open,
  pending,
  error,
  result,
  onClose,
  onConfirm,
}: TrashEmptyDialogProps) {
  const { messages, formats } = useI18n();
  const checkboxId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (result === null || !open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      closeRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open, result]);

  const close = (): void => {
    setConfirmed(false);
    onClose();
  };

  const summary =
    result === null
      ? null
      : [
          formats.plural(
            result.purged.worlds,
            messages.trash.emptyDialog.worlds,
          ),
          formats.plural(
            result.purged.entities,
            messages.trash.emptyDialog.entities,
          ),
          formats.plural(
            result.purged.entityTypes,
            messages.trash.emptyDialog.entityTypes,
          ),
        ];
  const emptySummary =
    result !== null &&
    result.purged.worlds === 0 &&
    result.purged.entities === 0 &&
    result.purged.entityTypes === 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={messages.trash.emptyDialog.title}
      dismissible={!pending}
      actions={
        result !== null ? (
          <Button ref={closeRef} variant="secondary" onClick={close}>
            {messages.trash.emptyDialog.close}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              data-autofocus
              disabled={pending}
              onClick={close}
            >
              {messages.trash.emptyDialog.cancel}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={!confirmed}
              onClick={onConfirm}
            >
              {messages.trash.emptyDialog.submit}
            </Button>
          </>
        )
      }
    >
      {result === null ? (
        <>
          <p className="wc-dialog__lead">{messages.trash.emptyDialog.lead}</p>
          <Checkbox
            id={checkboxId}
            label={messages.trash.emptyDialog.checkbox}
            checked={confirmed}
            autoFocusOnOpen
            disabled={pending}
            onChange={(event) => {
              setConfirmed(event.currentTarget.checked);
            }}
          />
          <p className="wc-dialog__note">
            {messages.trash.emptyDialog.copyNote}
          </p>
          <p className="wc-dialog__note">
            {messages.trash.emptyDialog.assetsNote}
          </p>
          <p className="wc-dialog__note">
            {messages.trash.emptyDialog.irreversible}
          </p>
          {pending ? (
            <p className="wc-dialog__status" role="status">
              {messages.trash.emptyDialog.pending}
            </p>
          ) : null}
          {error === null ? null : (
            <p className="wc-field__error" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="wc-trash-summary" role="status">
          {emptySummary ? (
            <p className="wc-dialog__lead">
              {messages.trash.emptyDialog.alreadyEmpty}
            </p>
          ) : (
            <>
              <p className="wc-dialog__lead">
                {messages.trash.emptyDialog.summaryLead}
              </p>
              <p>{summary?.join(' · ')}</p>
              {result.skipped > 0 ? (
                <p>
                  {formats.plural(
                    result.skipped,
                    messages.trash.emptyDialog.skipped,
                  )}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
