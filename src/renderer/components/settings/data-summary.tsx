import { useI18n } from '../../i18n/provider';
import type { DataCounts } from '../../../shared/contracts/data';
import { dataErrorMessage } from '../../settings/data-errors';
import type { ResourceState } from '../../settings/use-data-settings';
import { Button } from '../button';
import { Skeleton } from '../skeleton';

export interface DataSummaryProps {
  readonly state: ResourceState<DataCounts>;
  readonly onRetry: () => void;
}

/** Resumen cuantitativo de los datos. */
export function DataSummary({ state, onRetry }: DataSummaryProps) {
  const i18n = useI18n();
  const messages = i18n.messages;
  const copy = messages.settings.data.summary;

  return (
    <div className="wc-settings__subsection">
      <h3 className="wc-settings__subheading">{copy.title}</h3>
      {state.status === 'loading' ? (
        <div aria-busy="true" className="wc-settings__loading">
          <p className="wc-settings__note">{messages.settings.data.loading}</p>
          <Skeleton height="1rem" width="60%" />
          <Skeleton height="1rem" width="45%" />
        </div>
      ) : state.status === 'unavailable' ? (
        <p className="wc-settings__unavailable">
          {messages.settings.data.unavailable}
        </p>
      ) : state.status === 'error' ? (
        <div className="wc-settings__error" role="alert">
          <p>{dataErrorMessage(messages, state.code)}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {messages.settings.data.retry}
          </Button>
        </div>
      ) : state.status === 'ready' ? (
        <dl className="wc-settings__summary">
          <div className="wc-settings__summary-row">
            <dt>{copy.worldsActive}</dt>
            <dd>{i18n.formats.formatNumber(state.data.worlds.active)}</dd>
          </div>
          <div className="wc-settings__summary-row">
            <dt>{copy.worldsArchived}</dt>
            <dd>{i18n.formats.formatNumber(state.data.worlds.archived)}</dd>
          </div>
          <div className="wc-settings__summary-row">
            <dt>{copy.worldsTrash}</dt>
            <dd>{i18n.formats.formatNumber(state.data.worlds.trash)}</dd>
          </div>
          <div className="wc-settings__summary-row">
            <dt>{copy.entities}</dt>
            <dd>{i18n.formats.formatNumber(state.data.entities)}</dd>
          </div>
          <div className="wc-settings__summary-row">
            <dt>{copy.assets}</dt>
            <dd>{i18n.formats.formatNumber(state.data.assets)}</dd>
          </div>
          <div className="wc-settings__summary-row">
            <dt>{copy.backups}</dt>
            <dd>{i18n.formats.formatNumber(state.data.backups)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
