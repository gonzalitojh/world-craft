/**
 * Tarjeta de progreso de una exportación o importación.
 *
 * La fase, el detalle y el recuento forman una región viva; la barra queda
 * fuera de ella para que el lector de pantalla no anuncie cada actualización
 * dos veces. `aria-busy` también queda fuera de la región viva.
 */
import type {
  TransferOperation,
  TransferPhase,
  TransferUnit,
} from '../../../shared/contracts/transfer';
import { useI18n } from '../../i18n/provider';
import { buildProgressCount, progressPercent } from '../../transfer/format';

export interface TransferProgressProps {
  readonly operation: TransferOperation;
  readonly phase: TransferPhase;
  readonly completed: number;
  readonly total: number | null;
  readonly unit: TransferUnit;
  readonly cancelable: boolean;
  readonly cancelError: boolean;
  readonly cancelling: boolean;
}

export function TransferProgress({
  operation,
  phase,
  completed,
  total,
  unit,
  cancelable,
  cancelError,
  cancelling,
}: TransferProgressProps) {
  const { messages, formats } = useI18n();
  const percent = progressPercent(completed, total);
  const indeterminate = percent === null;
  const count = buildProgressCount(
    completed,
    total,
    unit,
    messages.transfer.progress,
    formats,
  );
  const phaseLabel = cancelling
    ? messages.transfer.progress.cancelling[operation]
    : messages.transfer.phases[phase];
  const detail = messages.transfer.phaseDetails[phase];
  const hint = cancelling
    ? messages.transfer.progress.cancellingDetail
    : cancelError
      ? messages.transfer.progress.cancelFailed
      : cancelable
        ? operation === 'export'
          ? messages.transfer.progress.cancelHintExport
          : messages.transfer.progress.cancelHintImport
        : messages.transfer.progress.lockedHint;
  const note =
    operation === 'export'
      ? messages.transfer.progress.exportNote
      : messages.transfer.progress.importNote;

  return (
    <div className="wc-transfer__progress">
      <div
        className="wc-transfer__phase"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p
          className="wc-transfer__phase-label"
          data-autofocus={!cancelable || cancelling ? true : undefined}
          tabIndex={!cancelable || cancelling ? -1 : undefined}
        >
          {phaseLabel}
        </p>
        <p className="wc-transfer__detail">{detail}</p>
        <p className="wc-transfer__count">{count}</p>
      </div>

      <div
        className={`wc-progress${indeterminate ? ' wc-progress--indeterminate' : ''}`}
        role="progressbar"
        aria-busy="true"
        aria-label={
          operation === 'export'
            ? messages.transfer.progress.exportLabel
            : messages.transfer.progress.importLabel
        }
        aria-valuetext={count}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : (total ?? undefined)}
        aria-valuenow={indeterminate ? undefined : completed}
      >
        <span
          className="wc-progress__bar"
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>

      <p
        className={`wc-transfer__hint${cancelError ? ' wc-transfer__hint--error' : ''}`}
      >
        {hint}
      </p>
      <p className="wc-transfer__note">{note}</p>
    </div>
  );
}
