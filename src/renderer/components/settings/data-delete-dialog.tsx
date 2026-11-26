import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/provider';
import { dataErrorMessage } from '../../settings/data-errors';
import type { DeleteState } from '../../settings/use-data-settings';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';
import { TextField } from '../text-field';

export interface DataDeleteDialogProps {
  readonly state: DeleteState;
  readonly onClose: () => void;
  readonly onConfirm: (keepBackups: boolean) => void;
}

/** Confirmación destructiva del borrado total. */
export function DataDeleteDialog({
  state,
  onClose,
  onConfirm,
}: DataDeleteDialogProps) {
  const i18n = useI18n();
  const messages = i18n.messages;
  const copy = messages.settings.data.danger;
  const [keepBackups, setKeepBackups] = useState(false);
  const [phrase, setPhrase] = useState('');
  const resultRef = useRef<HTMLHeadingElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const deleting = state.status === 'deleting';
  const done = state.status === 'done';
  const matches = phrase.trim() === copy.phraseValue;
  const phraseError =
    phrase.length > 0 && !matches ? copy.phraseError : undefined;
  const partial = done && state.result.status === 'partial';
  const panelTitle = partial ? copy.partialTitle : copy.doneTitle;
  const forcedOpen =
    done &&
    (state.result.status === 'deleted' ||
      (state.result.status === 'partial' && state.result.restartRequired));
  const closeLabel = messages.components.dialog.close;

  useEffect(() => {
    if (state.status === 'deleting') {
      statusRef.current?.focus();
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'done') {
      resultRef.current?.focus();
    }
  }, [state.status]);

  const deleteError =
    state.status === 'error'
      ? state.code === 'DATA_DELETE_COPY_FAILED'
        ? copy.error
        : dataErrorMessage(messages, state.code)
      : null;

  return (
    <Dialog
      open={state.status !== 'closed'}
      onClose={onClose}
      title={copy.dialogTitle}
      dismissible={!deleting && !forcedOpen}
      actions={
        done ? (
          forcedOpen ? undefined : (
            <Button variant="secondary" onClick={onClose}>
              {closeLabel}
            </Button>
          )
        ) : (
          <>
            <Button
              variant="secondary"
              data-autofocus
              disabled={deleting}
              onClick={onClose}
            >
              {copy.cancel}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={!matches || deleting}
              onClick={() => {
                onConfirm(keepBackups);
              }}
            >
              {copy.confirm}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div>
          <h3
            className="wc-settings__result-title"
            tabIndex={-1}
            ref={resultRef}
          >
            {panelTitle}
          </h3>
          <p>
            {partial
              ? state.result.restartRequired
                ? copy.partialRestartBody
                : copy.partialBody
              : copy.doneBody}
          </p>
          {partial && state.result.remaining.length > 0 ? (
            <>
              <p className="wc-settings__label">{copy.remainingLabel}</p>
              <ul className="wc-settings__list">
                {state.result.remaining.map((category) => (
                  <li key={category}>{copy.categories[category]}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <p>{copy.dialogLead}</p>
          <div className="wc-settings__danger-lists">
            <div>
              <h3 className="wc-settings__dialog-subheading">
                {copy.deleteTitle}
              </h3>
              <ul className="wc-settings__list">
                {copy.deleteItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="wc-settings__dialog-subheading">
                {copy.keepTitle}
              </h3>
              <ul className="wc-settings__list">
                {copy.keepItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <Checkbox
            label={copy.keepBackupsLabel}
            hint={copy.keepBackupsHint}
            checked={keepBackups}
            disabled={deleting}
            onChange={(event) => {
              setKeepBackups(event.target.checked);
            }}
          />

          <TextField
            label={copy.phraseLabel}
            value={phrase}
            error={phraseError}
            disabled={deleting}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setPhrase(event.target.value);
            }}
          />

          {deleting ? (
            <p className="wc-settings__status" tabIndex={-1} ref={statusRef}>
              {copy.deleting}
            </p>
          ) : null}

          {deleteError === null ? null : (
            <p className="wc-settings__inline-error" role="alert">
              {deleteError}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
