import { useId } from 'react';

import type {
  WorldActivityEntry,
  WorldSummary,
} from '../../shared/contracts/worlds';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { WorldActivityList } from '../components/worlds/world-activity-list';
import {
  WorldCard,
  type WorldCardActions,
} from '../components/worlds/world-card';
import { useI18n } from '../i18n/provider';

export type WorldLibraryState = 'loading' | 'ready' | 'error';

export interface HomePageProps {
  readonly worlds: readonly WorldSummary[];
  readonly activity: readonly WorldActivityEntry[];
  readonly state: WorldLibraryState;
  readonly actions: WorldCardActions;
  readonly onCreate: () => void;
  readonly onSeeAll: () => void;
  readonly onRetry: () => void;
}

/** Número de mundos y actividades que caben en el dashboard sin saturarlo. */
const DASHBOARD_WORLDS = 6;
const DASHBOARD_ACTIVITY = 8;

/**
 * Inicio: dashboard de mundos.
 *
 * Muestra el resumen, los mundos ordenados por actualización, la actividad
 * reciente de todos los mundos (con su nombre) y dos accesos rápidos. Con cero
 * mundos se mantiene el estado vacío que explica qué es un mundo y cómo crear
 * el primero.
 */
export function HomePage({
  worlds,
  activity,
  state,
  actions,
  onCreate,
  onSeeAll,
  onRetry,
}: HomePageProps) {
  const { messages, formats } = useI18n();
  const statsTitleId = useId();
  const worldsTitleId = useId();
  const activityTitleId = useId();
  const quickTitleId = useId();

  if (state === 'loading') {
    return (
      <div className="wc-page">
        <p className="wc-page__status" role="status">
          {messages.worlds.dashboard.loading}
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="wc-page">
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">
            {messages.worlds.dashboard.errorTitle}
          </h2>
          <p>{messages.worlds.dashboard.errorDescription}</p>
          <Button variant="secondary" onClick={onRetry}>
            {messages.worlds.dashboard.retry}
          </Button>
        </section>
      </div>
    );
  }

  if (worlds.length === 0) {
    return (
      <div className="wc-page">
        <EmptyState
          title={messages.home.emptyTitle}
          description={messages.home.emptyDescription}
          action={
            <Button onClick={onCreate}>{messages.home.emptyAction}</Button>
          }
        />

        <section className="wc-page__section" aria-labelledby={worldsTitleId}>
          <h2 className="wc-page__section-title" id={worldsTitleId}>
            {messages.home.nextStepsTitle}
          </h2>
          <ul className="wc-home__list">
            {messages.home.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="wc-page__note">{messages.home.note}</p>
        </section>
      </div>
    );
  }

  const activeWorlds = worlds.filter((world) => world.status === 'active');
  const archivedWorlds = worlds.filter((world) => world.status === 'archived');
  const recentWorlds = worlds.slice(0, DASHBOARD_WORLDS);
  const recentActivity = activity.slice(0, DASHBOARD_ACTIVITY);

  return (
    <div className="wc-page">
      <div className="wc-page__header">
        <p className="wc-page__section-lead">
          {messages.worlds.dashboard.lead}
        </p>
        <Button onClick={onCreate}>{messages.worlds.actions.create}</Button>
      </div>

      <section className="wc-page__section" aria-labelledby={statsTitleId}>
        <h2 className="wc-page__section-title" id={statsTitleId}>
          {messages.worlds.dashboard.statsTitle}
        </h2>
        <dl className="wc-stats">
          <div className="wc-stats__item">
            <dt>{messages.worlds.dashboard.statWorlds}</dt>
            <dd>{formats.formatNumber(worlds.length)}</dd>
          </div>
          <div className="wc-stats__item">
            <dt>{messages.worlds.dashboard.statActive}</dt>
            <dd>{formats.formatNumber(activeWorlds.length)}</dd>
          </div>
          <div className="wc-stats__item">
            <dt>{messages.worlds.dashboard.statArchived}</dt>
            <dd>{formats.formatNumber(archivedWorlds.length)}</dd>
          </div>
        </dl>
      </section>

      <section className="wc-page__section" aria-labelledby={worldsTitleId}>
        <div className="wc-section-heading">
          <div className="wc-section-heading__text">
            <h2 className="wc-page__section-title" id={worldsTitleId}>
              {messages.worlds.dashboard.worldsTitle}
            </h2>
            <p className="wc-page__section-lead">
              {messages.worlds.dashboard.worldsLead}
            </p>
          </div>
          {worlds.length > DASHBOARD_WORLDS ? (
            <Button variant="secondary" size="sm" onClick={onSeeAll}>
              {messages.worlds.dashboard.seeAll}
            </Button>
          ) : null}
        </div>
        <ul className="wc-world-grid">
          {recentWorlds.map((world) => (
            <li className="wc-world-grid__item" key={world.id}>
              <WorldCard world={world} actions={actions} />
            </li>
          ))}
        </ul>
      </section>

      <section className="wc-page__section" aria-labelledby={activityTitleId}>
        <h2 className="wc-page__section-title" id={activityTitleId}>
          {messages.worlds.dashboard.activityTitle}
        </h2>
        <p className="wc-page__section-lead">
          {messages.worlds.dashboard.activityLead}
        </p>
        <WorldActivityList
          entries={recentActivity}
          state="ready"
          emptyMessage={messages.worlds.dashboard.activityEmpty}
        />
      </section>

      <section className="wc-page__section" aria-labelledby={quickTitleId}>
        <h2 className="wc-page__section-title" id={quickTitleId}>
          {messages.worlds.dashboard.quickTitle}
        </h2>
        <div className="wc-quick-actions">
          <button type="button" className="wc-quick-action" onClick={onCreate}>
            <span className="wc-quick-action__title">
              {messages.worlds.dashboard.quickCreate}
            </span>
            <span className="wc-quick-action__description">
              {messages.worlds.dashboard.quickCreateDescription}
            </span>
          </button>
          <button type="button" className="wc-quick-action" onClick={onSeeAll}>
            <span className="wc-quick-action__title">
              {messages.worlds.dashboard.quickManage}
            </span>
            <span className="wc-quick-action__description">
              {messages.worlds.dashboard.quickManageDescription}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
