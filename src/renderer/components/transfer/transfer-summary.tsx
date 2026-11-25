/**
 * Resumen de éxito o error de una transferencia.
 *
 * El éxito se anuncia en una región `aria-live`; el error usa `role="alert"`.
 * Los recuentos, tamaños y plurales se resuelven con el catálogo y `Intl`.
 */
import type {
  TransferCounts,
  TransferExportResult,
  TransferImportResult,
  TransferOperation,
} from '../../../shared/contracts/transfer';
import { useI18n } from '../../i18n/provider';
import { formatBytes } from '../../transfer/format';
import {
  hasTransferWarnings,
  type TransferFailureCode,
} from '../../transfer/state';

const COUNT_KEYS = [
  'entities',
  'entityTypes',
  'relations',
  'relationTypes',
  'tags',
  'versions',
  'assets',
] as const;

export type TransferSummaryProps =
  | { readonly kind: 'exported'; readonly result: TransferExportResult }
  | { readonly kind: 'imported'; readonly result: TransferImportResult }
  | {
      readonly kind: 'failed';
      readonly operation: TransferOperation;
      readonly code: TransferFailureCode;
    };

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 3.5 17 16H3L10 3.5Z" />
      <path d="M10 8v3.5" />
      <circle cx="10" cy="13.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CountsList({
  counts,
  title,
}: {
  readonly counts: TransferCounts;
  readonly title: string;
}) {
  const { messages, formats } = useI18n();

  return (
    <section className="wc-transfer__section">
      <h3 className="wc-transfer__section-title">{title}</h3>
      <ul className="wc-transfer__counts">
        {COUNT_KEYS.map((key) => (
          <li key={key} className="wc-transfer__count-item">
            <span className="wc-transfer__count-label">
              {messages.transfer.summary.counts[key]}
            </span>
            <span className="wc-transfer__count-value">
              {formats.formatNumber(counts[key])}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WarningsList({
  result,
}: {
  readonly result: TransferExportResult | TransferImportResult;
}) {
  const { messages, formats } = useI18n();
  const warnings = result.warnings.filter((warning) => warning.count > 0);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="wc-transfer__section">
      <h3 className="wc-transfer__section-title">
        {messages.transfer.summary.warningsTitle}
      </h3>
      <ul className="wc-transfer__warnings">
        {warnings.map((warning) => (
          <li key={warning.code} className="wc-transfer__warning">
            <span className="wc-transfer__notice-icon" aria-hidden="true">
              <WarningIcon />
            </span>
            <span>
              {formats.plural(
                warning.count,
                messages.transfer.summary.warnings[warning.code],
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuccessSummary({
  result,
  kind,
}: {
  readonly result: TransferExportResult | TransferImportResult;
  readonly kind: 'exported' | 'imported';
}) {
  const { messages, formats } = useI18n();
  const withWarnings = hasTransferWarnings(result);
  const imported =
    kind === 'imported' ? (result as TransferImportResult) : null;
  const exported =
    kind === 'exported' ? (result as TransferExportResult) : null;

  return (
    <div className="wc-transfer__summary">
      <p
        className="wc-transfer__notice"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {imported !== null
          ? withWarnings
            ? messages.transfer.summary.importedWithWarnings(imported.worldName)
            : messages.transfer.summary.imported(imported.worldName)
          : exported !== null
            ? withWarnings
              ? messages.transfer.summary.exportedWithWarnings(
                  exported.worldName,
                )
              : messages.transfer.summary.exported(exported.worldName)
            : null}
      </p>

      <dl className="wc-transfer__meta">
        {exported !== null ? (
          <>
            <div className="wc-transfer__meta-row">
              <dt className="wc-transfer__meta-label">
                {messages.transfer.summary.fileLabel}
              </dt>
              <dd className="wc-transfer__meta-value wc-transfer__meta-value--mono">
                {exported.fileName}
              </dd>
            </div>
            <div className="wc-transfer__meta-row">
              <dt className="wc-transfer__meta-label">
                {messages.transfer.summary.sizeLabel}
              </dt>
              <dd className="wc-transfer__meta-value">
                {formatBytes(exported.size, formats)}
              </dd>
            </div>
          </>
        ) : null}
        {imported !== null ? (
          <div className="wc-transfer__meta-row">
            <dt className="wc-transfer__meta-label">
              {messages.transfer.summary.slugLabel}
            </dt>
            <dd className="wc-transfer__meta-value wc-transfer__meta-value--mono">
              {imported.slug}
            </dd>
          </div>
        ) : null}
      </dl>

      {imported !== null && imported.slugAdjusted ? (
        <p className="wc-transfer__notice">
          <span className="wc-transfer__notice-icon" aria-hidden="true">
            <WarningIcon />
          </span>
          {messages.transfer.summary.slugAdjusted(imported.slug)}
        </p>
      ) : null}

      <CountsList
        counts={result.counts}
        title={
          kind === 'exported'
            ? messages.transfer.summary.countsExport
            : messages.transfer.summary.countsImport
        }
      />
      <WarningsList result={result} />
    </div>
  );
}

function FailedSummary({
  operation,
  code,
}: {
  readonly operation: TransferOperation;
  readonly code: TransferFailureCode;
}) {
  const { messages } = useI18n();
  const message =
    messages.transfer.errors.codes[code] ??
    messages.transfer.errors.codes.UNKNOWN;

  return (
    <div className="wc-transfer__summary" role="alert">
      <p className="wc-transfer__notice">{message}</p>
      <p className="wc-transfer__detail">
        {operation === 'export'
          ? messages.transfer.errors.reassuranceExport
          : messages.transfer.errors.reassuranceImport}
      </p>
    </div>
  );
}

/** Resumen presentacional de una transferencia terminada. */
export function TransferSummary(props: TransferSummaryProps) {
  if (props.kind === 'failed') {
    return <FailedSummary operation={props.operation} code={props.code} />;
  }

  return <SuccessSummary result={props.result} kind={props.kind} />;
}
