import { useState } from 'react';

import type { DataUsage } from '../../../shared/contracts/data';
import { useI18n } from '../../i18n/provider';
import { dataErrorMessage } from '../../settings/data-errors';
import type { ResourceState } from '../../settings/use-data-settings';
import { Badge } from '../badge';
import { Button } from '../button';
import { DisclosureSection } from '../disclosure-section';
import { Skeleton } from '../skeleton';

export interface DataUsageProps {
  readonly state: ResourceState<DataUsage>;
  readonly onRecalculate: () => void;
}

const CATEGORY_KEYS = [
  'database',
  'assets',
  'backups',
  'logs',
  'temporary',
] as const;

/** Uso de disco por categoría dentro de un disclosure cerrado. */
export function DataUsage({ state, onRecalculate }: DataUsageProps) {
  const i18n = useI18n();
  const messages = i18n.messages;
  const copy = messages.settings.data.usage;
  const [open, setOpen] = useState(false);
  const meta =
    state.status === 'ready'
      ? i18n.formats.formatBytes(state.data.totalBytes)
      : undefined;

  return (
    <DisclosureSection
      id="wc-settings-usage"
      title={copy.title}
      meta={meta}
      open={open}
      onToggle={setOpen}
      headingLevel={3}
    >
      {state.status === 'loading' ? (
        <div aria-busy="true" className="wc-settings__loading">
          <p className="wc-settings__note">{copy.loading}</p>
          <Skeleton height="1rem" width="55%" />
          <Skeleton height="1rem" width="40%" />
        </div>
      ) : state.status === 'unavailable' ? (
        <p className="wc-settings__unavailable">
          {messages.settings.data.unavailable}
        </p>
      ) : state.status === 'error' ? (
        <div className="wc-settings__error" role="alert">
          <p>{dataErrorMessage(messages, state.code)}</p>
          <Button variant="secondary" size="sm" onClick={onRecalculate}>
            {messages.settings.data.retry}
          </Button>
        </div>
      ) : state.status === 'ready' ? (
        <div className="wc-settings__usage">
          {state.data.partial ? (
            <div className="wc-settings__row">
              <Badge tone="warning">{copy.partialBadge}</Badge>
              <p className="wc-settings__note">{copy.partialNote}</p>
            </div>
          ) : null}
          <div className="wc-settings__table-wrap">
            <table className="wc-settings__table wc-settings__table--numeric">
              <caption className="wc-visually-hidden">{copy.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy.columns.category}</th>
                  <th scope="col">{copy.columns.size}</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_KEYS.map((category) => (
                  <tr key={category}>
                    <th scope="row">{copy.categories[category]}</th>
                    <td className="wc-settings__number">
                      {i18n.formats.formatBytes(
                        state.data.categories[category].bytes,
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="wc-settings__table-total">
                  <th scope="row">{copy.categories.total}</th>
                  <td className="wc-settings__number">
                    {i18n.formats.formatBytes(state.data.totalBytes)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="wc-settings__footer">
            <Button variant="ghost" size="sm" onClick={onRecalculate}>
              {copy.recalc}
            </Button>
          </div>
        </div>
      ) : null}
    </DisclosureSection>
  );
}
