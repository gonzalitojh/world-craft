import { useId } from 'react';

import type {
  WorldActivityEntry,
  WorldSummary,
} from '../../shared/contracts/worlds';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { Skeleton, SkeletonText } from '../components/skeleton';
import { WorldActivityList } from '../components/worlds/world-activity-list';
import {
  WorldCard,
  type WorldCardActions,
} from '../components/worlds/world-card';
import { useI18n } from '../i18n/provider';
import type { ContinueTarget } from '../lib/recent-location';

export type WorldLibraryState = 'loading' | 'ready' | 'error';

export interface HomePageProps {
  readonly worlds: readonly WorldSummary[];
  readonly activity: readonly WorldActivityEntry[];
  readonly state: WorldLibraryState;
  readonly actions: WorldCardActions;
  /** Último destino de la sesión; si es `null`, el bloque se omite. */
  readonly continueTarget: ContinueTarget | null;
  /** Referencia temporal de las fechas relativas; por defecto, ahora. */
  readonly now?: number | undefined;
  readonly onCreate: () => void;
  readonly onContinue: (target: ContinueTarget) => void;
  readonly onSeeAll: () => void;
  readonly onRetry: () => void;
}

/** Mundos y actividades que caben en la mesa de trabajo sin saturarla. */
const RECENT_WORLDS = 5;
const RECENT_ACTIVITY = 5;
const SKELETON_ROWS = 3;

/**
 * Inicio: mesa de trabajo.
 *
 * «Continuar» retoma el último mundo o ficha de la sesión, «Mundos recientes»
 * es la estantería y «Actividad reciente» queda en segundo plano. No hay
 * contadores ni rejilla de accesos rápidos: la acción primaria «Crear mundo»
 * vive en la barra superior; con cero mundos manda el estado vacío.
 */
export function HomePage({
  worlds,
  activity,
  state,
  actions,
  continueTarget,
  now,
  onCreate,
  onContinue,
  onSeeAll,
  onRetry,
}: HomePageProps) {
  const { messages, formats } = useI18n();
  const continueTitleId = useId();
  const continueDestinationId = useId();
  const worldsTitleId = useId();
  const activityTitleId = useId();
  const nextStepsTitleId = useId();

  const continueWorld =
    continueTarget === null
      ? null
      : (worlds.find((world) => world.id === continueTarget.worldId) ?? null);

  const continueSection =
    continueTarget !== null && continueWorld !== null ? (
      <section
        className="wc-page__section wc-continue"
        aria-labelledby={continueTitleId}
      >
        <h2 className="wc-page__section-title" id={continueTitleId}>
          {messages.home.continueTitle}
        </h2>
        <div className="wc-continue__panel">
          <div className="wc-continue__text">
            <h3 className="wc-continue__title" id={continueDestinationId}>
              {continueTarget.kind === 'entity'
                ? (continueTarget.entityName ??
                  messages.home.continueEntityFallback)
                : continueTarget.worldName}
            </h3>
            <p className="wc-continue__meta">
              {continueTarget.kind === 'entity'
                ? messages.home.continueEntityMeta(continueTarget.worldName)
                : messages.worlds.card.relativeUpdated(
                    formats.formatRelativeTime(continueWorld.updatedAt, now),
                  )}
            </p>
          </div>
          <div className="wc-continue__action">
            <Button
              variant="secondary"
              aria-describedby={continueDestinationId}
              onClick={() => {
                onContinue(continueTarget);
              }}
            >
              {continueTarget.kind === 'entity'
                ? messages.home.continueEntityAction
                : messages.home.continueWorldAction}
            </Button>
          </div>
        </div>
      </section>
    ) : null;

  if (state === 'loading') {
    return (
      <div className="wc-page" aria-busy="true">
        <p className="wc-visually-hidden" role="status">
          {messages.home.loading}
        </p>
        {continueSection}
        <section className="wc-page__section" aria-labelledby={worldsTitleId}>
          <h2 className="wc-page__section-title" id={worldsTitleId}>
            {messages.home.recentTitle}
          </h2>
          <ul className="wc-world-rows" aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index}>
                <div className="wc-world-card wc-world-card--skeleton">
                  <div className="wc-world-card__mark">
                    <Skeleton variant="block" className="wc-world-mark" />
                  </div>
                  <div className="wc-world-card__content">
                    <SkeletonText lines={3} />
                  </div>
                  <div className="wc-world-card__actions">
                    <Skeleton
                      variant="block"
                      className="wc-world-skeleton__action"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="wc-page">
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">{messages.home.errorTitle}</h2>
          <p>{messages.home.errorDescription}</p>
          <Button variant="secondary" onClick={onRetry}>
            {messages.home.retry}
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

        <section
          className="wc-page__section"
          aria-labelledby={nextStepsTitleId}
        >
          <h2 className="wc-page__section-title" id={nextStepsTitleId}>
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

  const recentWorlds = worlds.slice(0, RECENT_WORLDS);
  const recentActivity = activity.slice(0, RECENT_ACTIVITY);

  return (
    <div className="wc-page">
      {continueSection}

      <section className="wc-page__section" aria-labelledby={worldsTitleId}>
        <div className="wc-section-heading">
          <h2 className="wc-page__section-title" id={worldsTitleId}>
            {messages.home.recentTitle}
          </h2>
          {worlds.length > RECENT_WORLDS ? (
            <Button variant="ghost" size="sm" onClick={onSeeAll}>
              {messages.home.seeAll}
            </Button>
          ) : null}
        </div>
        <ul className="wc-world-rows">
          {recentWorlds.map((world) => (
            <li key={world.id}>
              <WorldCard world={world} actions={actions} now={now} />
            </li>
          ))}
        </ul>
      </section>

      <section
        className="wc-page__section wc-home-activity"
        aria-labelledby={activityTitleId}
      >
        <h2 className="wc-page__section-title" id={activityTitleId}>
          {messages.home.activityTitle}
        </h2>
        <WorldActivityList
          entries={recentActivity}
          state="ready"
          emptyMessage={messages.home.activityEmpty}
        />
      </section>
    </div>
  );
}
