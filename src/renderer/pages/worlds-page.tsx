import { useId, useMemo, useState } from 'react';

import type { WorldSummary } from '../../shared/contracts/worlds';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { SelectField } from '../components/select-field';
import { TextField } from '../components/text-field';
import {
  WorldCard,
  type WorldCardActions,
} from '../components/worlds/world-card';
import { useI18n } from '../i18n/provider';
import type { WorldLibraryState } from './home-page';

type StatusFilter = 'all' | 'active' | 'archived';

export interface WorldsPageProps {
  readonly worlds: readonly WorldSummary[];
  readonly state: WorldLibraryState;
  readonly actions: WorldCardActions;
  readonly onCreate: () => void;
  readonly onRetry: () => void;
}

/**
 * Lista completa de mundos.
 *
 * El filtro y la búsqueda son locales: la lista ya viene aislada por mundo y
 * sin filas en papelera. El recuento usa plurales de `Intl` y los estados vacíos
 * distinguen «no hay ningún mundo» de «el filtro no coincide».
 */
export function WorldsPage({
  worlds,
  state,
  actions,
  onCreate,
  onRetry,
}: WorldsPageProps) {
  const { messages, formats } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(formats.intlLocale);

    return worlds.filter((world) => {
      if (status !== 'all' && world.status !== status) {
        return false;
      }

      if (normalized.length === 0) {
        return true;
      }

      return (
        world.name.toLocaleLowerCase(formats.intlLocale).includes(normalized) ||
        world.slug.includes(normalized) ||
        (world.summary ?? '')
          .toLocaleLowerCase(formats.intlLocale)
          .includes(normalized)
      );
    });
  }, [worlds, query, status, formats.intlLocale]);

  const statusOptions = [
    { value: 'all', label: messages.worlds.list.statusAll },
    { value: 'active', label: messages.worlds.list.statusActive },
    { value: 'archived', label: messages.worlds.list.statusArchived },
  ];

  if (state === 'loading') {
    return (
      <div className="wc-page">
        <p className="wc-page__status" role="status">
          {messages.worlds.list.loading}
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="wc-page">
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">{messages.worlds.list.errorTitle}</h2>
          <p>{messages.worlds.list.errorDescription}</p>
          <Button variant="secondary" onClick={onRetry}>
            {messages.worlds.list.retry}
          </Button>
        </section>
      </div>
    );
  }

  if (worlds.length === 0) {
    return (
      <div className="wc-page">
        <EmptyState
          title={messages.worlds.list.emptyTitle}
          description={messages.worlds.list.emptyDescription}
          action={
            <Button onClick={onCreate}>{messages.worlds.actions.create}</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="wc-page">
      <div className="wc-page__header">
        <p className="wc-page__section-lead">{messages.worlds.list.lead}</p>
      </div>

      <div className="wc-toolbar">
        <TextField
          id={searchId}
          type="search"
          label={messages.worlds.list.searchLabel}
          placeholder={messages.worlds.list.searchPlaceholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <SelectField
          label={messages.worlds.list.statusLabel}
          options={statusOptions}
          value={status}
          onChange={(event) => {
            const value = event.target.value;
            setStatus(
              value === 'active' || value === 'archived' ? value : 'all',
            );
          }}
        />
        <p className="wc-toolbar__count" role="status">
          {formats.plural(filtered.length, messages.worlds.list.count)}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={messages.worlds.list.emptyFilterTitle}
          description={messages.worlds.list.emptyFilterDescription}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setStatus('all');
              }}
            >
              {messages.worlds.list.clearFilters}
            </Button>
          }
        />
      ) : (
        <>
          <h2 className="wc-visually-hidden">
            {messages.worlds.list.resultsTitle}
          </h2>
          <ul className="wc-world-grid">
            {filtered.map((world) => (
              <li className="wc-world-grid__item" key={world.id}>
                <WorldCard world={world} actions={actions} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
