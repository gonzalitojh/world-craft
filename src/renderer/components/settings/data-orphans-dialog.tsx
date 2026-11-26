import { useState } from 'react';

import type { DataOrphanSummary } from '../../../shared/contracts/data';
import { useI18n } from '../../i18n/provider';
import { formatMessage } from '../../messages/translator';
import { dataErrorMessage } from '../../settings/data-errors';
import type { DataUiErrorCode } from '../../settings/use-data-settings';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';

export interface DataOrphansDialogProps {
  readonly open: boolean;
  readonly summary: DataOrphanSummary;
  readonly purging: boolean;
  readonly errorCode: DataUiErrorCode | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

/** Confirmación de la purga de imágenes huérfanas. */
export function DataOrphansDialog({
  open,
  summary,
  purging,
  errorCode,
  onClose,
  onConfirm,
}: DataOrphansDialogProps) {
  const i18n = useI18n();
  const messages = i18n.messages;
  const copy = messages.settings.data.orphans;
  const [confirmed, setConfirmed] = useState(false);
  const files = i18n.formats.plural(summary.purgeableFiles, copy.fileCount);
  const size = i18n.formats.formatBytes(summary.recoverableBytes);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.dialogTitle}
      dismissible={!purging}
      focusKey={purging ? 'purging' : 'confirming'}
      actions={
        <>
          <Button
            variant="secondary"
            data-autofocus={purging ? undefined : true}
            disabled={purging}
            onClick={onClose}
          >
            {copy.cancel}
          </Button>
          <Button
            variant="danger"
            loading={purging}
            disabled={!confirmed || purging}
            onClick={onConfirm}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <p>{formatMessage(copy.summary, { files, size })}</p>
      <p className="wc-settings__note">{copy.notReferenced}</p>
      <Checkbox
        label={copy.confirmLabel}
        checked={confirmed}
        disabled={purging}
        onChange={(event) => {
          setConfirmed(event.target.checked);
        }}
      />
      {purging ? (
        <p className="wc-settings__status" data-autofocus tabIndex={-1}>
          {copy.purging}
        </p>
      ) : null}
      {errorCode === null ? null : (
        <p className="wc-settings__inline-error" role="alert">
          {errorCode === 'DATA_ORPHAN_PURGE_FAILED'
            ? copy.errorCopy
            : dataErrorMessage(messages, errorCode)}
        </p>
      )}
    </Dialog>
  );
}
