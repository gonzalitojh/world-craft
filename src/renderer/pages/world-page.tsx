import { useId } from 'react';

import type {
  WorldActivityEntry,
  WorldDetail,
} from '../../shared/contracts/worlds';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import {
  WorldActivityList,
  type WorldActivityState,
} from '../components/worlds/world-activity-list';
import type { WorldCardActions } from '../components/worlds/world-card';
import { useI18n } from '../i18n/provider';
import { assetUrl } from '../lib/asset-url';

export interface WorldPageProps {
  readonly world: WorldDetail | null;
  readonly state: 'loading' | 'ready' | 'error';
  readonly activity: readonly WorldActivityEntry[];
  readonly activityState: WorldActivityState;
  readonly actions: WorldCardActions;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onRetryActivity: () => void;
  readonly onOpenEntities: () => void;
}

/**
 * Página de un mundo.
 *
 * Reúne la ficha del mundo, su preparación, los accesos a las secciones futuras
 * y la actividad **de ese mundo**, sin filas de otros mundos. La portada es
 * opcional y decorativa; su selector llega con la galería de imágenes.
 */
export function WorldPage({
  world,
  state,
  activity,
  activityState,
  actions,
  onBack,
  onRetry,
  onRetryActivity,
  onOpenEntities,
}: WorldPageProps) {
  const { messages, formats } = useI18n();
  const metaId = useId();
  const progressId = useId();
  const quickId = useId();
  const activityId = useId();

  if (state === 'loading') {
    return (
      <div className="wc-page">
        <p className="wc-page__status" role="status">
          {messages.worlds.detail.loading}
        </p>
      </div>
    );
  }

  if (state === 'error' || world === null) {
    return (
      <div className="wc-page">
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">
            {messages.worlds.detail.errorTitle}
          </h2>
          <p>{messages.worlds.detail.errorDescription}</p>
          <div className="wc-alert__actions">
            <Button variant="secondary" onClick={onRetry}>
              {messages.worlds.dashboard.retry}
            </Button>
            <Button variant="ghost" onClick={onBack}>
              {messages.worlds.detail.errorBack}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const archived = world.status === 'archived';
  const initial = world.name.trim().slice(0, 1).toLocaleUpperCase('es');
  const statusLabel = archived
    ? messages.worlds.status.archived
    : messages.worlds.status.active;
  const languageLabel = messages.worlds.languages[world.language];
  const checks = [
    { key: 'summary', done: world.summary !== null },
    { key: 'description', done: world.description !== null },
    { key: 'genres', done: world.genres.length > 0 },
  ] as const;
  const completed = checks.filter((check) => check.done).length;
  const percent = Math.round((completed / checks.length) * 100);
  const percentLabel = formats.formatPercent(percent / 100);

  const modules = [
    {
      ...messages.worlds.detail.quick.entities,
      available: true,
    },
    {
      ...messages.worlds.detail.quick.maps,
      available: false,
    },
    {
      ...messages.worlds.detail.quick.manuscripts,
      available: false,
    },
    {
      ...messages.worlds.detail.quick.game,
      available: false,
    },
  ];

  return (
    <div className="wc-page">
      <div className="wc-page__header">
        <Button variant="ghost" onClick={onBack}>
          {messages.worlds.detail.back}
        </Button>
        <div className="wc-world-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              actions.onEdit(world);
            }}
            aria-label={messages.worlds.card.editNamed(world.name)}
          >
            {messages.worlds.card.edit}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              actions.onDuplicate(world);
            }}
            aria-label={messages.worlds.card.duplicateNamed(world.name)}
          >
            {messages.worlds.card.duplicate}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              actions.onArchiveToggle(world);
            }}
            aria-label={
              archived
                ? messages.worlds.card.restoreNamed(world.name)
                : messages.worlds.card.archiveNamed(world.name)
            }
          >
            {archived
              ? messages.worlds.card.restore
              : messages.worlds.card.archive}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              actions.onDelete(world);
            }}
            aria-label={messages.worlds.card.deleteNamed(world.name)}
          >
            {messages.worlds.card.delete}
          </Button>
        </div>
      </div>

      <article className="wc-world-hero">
        <div className="wc-world-hero__cover" aria-hidden="true">
          {world.coverAssetId !== null ? (
            <img
              className="wc-world-hero__cover-image"
              src={assetUrl(world.coverAssetId)}
              alt=""
            />
          ) : (
            <span className="wc-world-hero__initial">{initial}</span>
          )}
        </div>

        <div className="wc-world-hero__body">
          <div className="wc-world-hero__heading">
            <h2 className="wc-world-hero__title">{world.name}</h2>
            <Badge tone={archived ? 'neutral' : 'success'}>{statusLabel}</Badge>
          </div>

          <p className="wc-world-hero__summary">
            {world.summary ?? messages.worlds.detail.noSummary}
          </p>

          {world.genres.length > 0 ? (
            <ul
              className="wc-world-hero__genres"
              aria-label={messages.worlds.form.genresLabel}
            >
              {world.genres.map((genre) => (
                <li key={genre}>
                  <Badge tone="accent">{genre}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="wc-world-hero__description">
            {world.description ?? messages.worlds.detail.noDescription}
          </p>

          <section aria-labelledby={metaId}>
            <h3 className="wc-world-section__title" id={metaId}>
              {messages.worlds.detail.metadataTitle}
            </h3>
            <ul className="wc-world-meta">
              <li className="wc-world-meta__row">
                {messages.worlds.detail.slug(world.slug)}
              </li>
              <li className="wc-world-meta__row">
                {messages.worlds.detail.language(languageLabel)}
              </li>
              <li className="wc-world-meta__row">
                {messages.worlds.detail.created(
                  formats.formatDate(world.createdAt),
                )}
              </li>
              <li className="wc-world-meta__row">
                {messages.worlds.detail.updated(
                  formats.formatDate(world.updatedAt),
                )}
              </li>
            </ul>
          </section>
        </div>
      </article>

      <section className="wc-page__section" aria-labelledby={progressId}>
        <h2 className="wc-page__section-title" id={progressId}>
          {messages.worlds.detail.progressTitle}
        </h2>
        <p className="wc-page__section-lead">
          {messages.worlds.detail.progressLead}
        </p>
        <div
          className="wc-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={percentLabel}
          aria-label={messages.worlds.detail.progressPercent(percentLabel)}
        >
          <span
            className="wc-progress__bar"
            style={{ inlineSize: `${percent}%` }}
          />
        </div>
        <p className="wc-progress__value">
          {messages.worlds.detail.progressValue(completed, checks.length)}
        </p>
        <ul className="wc-progress__list">
          {checks.map((check) => (
            <li className="wc-progress__item" key={check.key}>
              <span className="wc-progress__label">
                {messages.worlds.detail.fields[check.key]}
              </span>
              <Badge tone={check.done ? 'success' : 'neutral'}>
                {check.done
                  ? messages.worlds.detail.progressDone
                  : messages.worlds.detail.progressPending}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="wc-page__section" aria-labelledby={activityId}>
        <h2 className="wc-page__section-title" id={activityId}>
          {messages.worlds.detail.activityTitle}
        </h2>
        <p className="wc-page__section-lead">
          {messages.worlds.detail.activityLead}
        </p>
        <WorldActivityList
          entries={activity}
          state={activityState}
          emptyMessage={messages.worlds.detail.activityEmpty}
          errorMessage={messages.worlds.detail.activityError}
          onRetry={onRetryActivity}
          showWorldName={false}
        />
      </section>

      <section className="wc-page__section" aria-labelledby={quickId}>
        <h2 className="wc-page__section-title" id={quickId}>
          {messages.worlds.detail.quickTitle}
        </h2>
        <p className="wc-page__section-lead">
          {messages.worlds.detail.quickLead}
        </p>
        <ul className="wc-quick-grid">
          {modules.map((module) => (
            <li className="wc-quick-card" key={module.title}>
              <div className="wc-quick-card__heading">
                <h3 className="wc-quick-card__title">{module.title}</h3>
                {module.available ? null : (
                  <Badge tone="neutral">
                    {messages.worlds.detail.quickPlanned}
                  </Badge>
                )}
              </div>
              <p className="wc-quick-card__description">{module.description}</p>
              {module.available ? (
                <Button variant="secondary" size="sm" onClick={onOpenEntities}>
                  {messages.entities.list.title}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
