import { useEffect, useRef, useState } from 'react';

import type {
  DataOrphanSummary,
  DataQuarantineCounts,
} from '../../../shared/contracts/data';
import { useI18n } from '../../i18n/provider';
import { formatMessage } from '../../messages/translator';
import { dataErrorMessage } from '../../settings/data-errors';
import type { OrphansState } from '../../settings/use-data-settings';
import { Button } from '../button';
import { DataOrphansDialog } from './data-orphans-dialog';

export interface DataOrphansProps {
  readonly state: OrphansState;
  readonly busy: boolean;
  readonly unavailable: boolean;
  readonly quarantine: DataQuarantineCounts | null;
  readonly onAnalyze: () => void;
  readonly onPurge: () => Promise<boolean>;
}

const SUMMARY_ROWS = [
  ['purgeable', 'purgeableFiles'],
  ['unreferenced', 'unreferencedFiles'],
  ['thumbnails', 'orphanThumbnails'],
  ['temporary', 'temporaryFiles'],
  ['missing', 'missingFiles'],
  ['suspicious', 'suspiciousLinks'],
  ['unexpected', 'unexpectedEntries'],
] as const;

/** Gestión de imágenes huérfanas con plan y purga confirmada. */
export function DataOrphans({
  state,
  busy,
  unavailable,
  quarantine,
  onAnalyze,
  onPurge,
}: DataOrphansProps) {
  const i18n = useI18n();
  const messages = i18n.messages;
  const copy = messages.settings.data.orphans;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingSummary, setPendingSummary] =
    useState<DataOrphanSummary | null>(null);
  const resultRef = useRef<HTMLHeadingElement | null>(null);
  const purging = state.status === 'purging';

  useEffect(() => {
    if (state.status === 'done') {
      // El resultado recibe foco y no se repite en el anunciador.
      resultRef.current?.focus();
    }
  }, [state.status]);
  const fileCount = (count: number): string =>
    i18n.formats.plural(count, copy.fileCount);
  const openDialog = (summary: DataOrphanSummary): void => {
    setPendingSummary(summary);
    setDialogOpen(true);
  };
  const closeDialog = (): void => {
    if (!purging) {
      setDialogOpen(false);
    }
  };
  const confirmPurge = async (): Promise<void> => {
    const success = await onPurge();

    if (success) {
      setDialogOpen(false);
    }
  };

  return (
    <div className="wc-settings__subsection">
      <h3 className="wc-settings__subheading">{copy.title}</h3>
      <p className="wc-settings__note">{copy.lead}</p>
      <p className="wc-settings__note">{copy.safety}</p>

      {quarantine !== null && quarantine.references > 0 ? (
        <p className="wc-settings__notice">
          {i18n.formats.plural(quarantine.references, copy.quarantineNotice)}
        </p>
      ) : null}

      {state.status === 'planning' ? (
        <div aria-busy="true" className="wc-settings__loading">
          <p className="wc-settings__status">{copy.analyzing}</p>
        </div>
      ) : state.status === 'unavailable' ? (
        <p className="wc-settings__unavailable">
          {messages.settings.data.unavailable}
        </p>
      ) : state.status === 'error' && !dialogOpen ? (
        <div className="wc-settings__error" role="alert">
          <p>{dataErrorMessage(messages, state.code)}</p>
          <Button variant="secondary" size="sm" onClick={onAnalyze}>
            {messages.settings.data.retry}
          </Button>
        </div>
      ) : state.status === 'done' ? (
        <div className="wc-settings__result">
          <h3
            className="wc-settings__result-title"
            tabIndex={-1}
            ref={resultRef}
          >
            {copy.resultTitle}
          </h3>
          <p>
            {formatMessage(copy.result, {
              files: fileCount(state.result.purgedFiles),
              size: i18n.formats.formatBytes(state.result.purgedBytes),
            })}
          </p>
        </div>
      ) : state.status === 'ready' ? (
        state.summary.purgeableFiles === 0 ? (
          <p className="wc-settings__empty">{copy.empty}</p>
        ) : (
          <>
            <dl className="wc-settings__summary">
              {SUMMARY_ROWS.map(([row, field]) => (
                <div className="wc-settings__summary-row" key={row}>
                  <dt>{copy.rows[row]}</dt>
                  <dd>{i18n.formats.formatNumber(state.summary[field])}</dd>
                </div>
              ))}
              <div className="wc-settings__summary-row">
                <dt>{copy.recoverable}</dt>
                <dd>
                  {i18n.formats.formatBytes(state.summary.recoverableBytes)}
                </dd>
              </div>
            </dl>
            <div className="wc-settings__actions">
              <Button
                variant="secondary"
                size="sm"
                disabled={unavailable || busy}
                onClick={() => {
                  openDialog(state.summary);
                }}
              >
                {copy.purge}
              </Button>
            </div>
          </>
        )
      ) : null}

      {state.status === 'idle' ||
      state.status === 'ready' ||
      state.status === 'done' ? (
        <div className="wc-settings__actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={unavailable || busy}
            onClick={onAnalyze}
          >
            {copy.analyze}
          </Button>
        </div>
      ) : null}

      {dialogOpen && pendingSummary !== null ? (
        <DataOrphansDialog
          open
          summary={pendingSummary}
          purging={purging}
          errorCode={state.status === 'error' ? state.code : null}
          onClose={closeDialog}
          onConfirm={() => {
            void confirmPurge();
          }}
        />
      ) : null}
    </div>
  );
}
