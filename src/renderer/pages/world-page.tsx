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
import { WorldMark } from '../components/worlds/world-mark';
import { WorldModuleNav } from '../components/worlds/world-module-nav';
import { useEntityCount } from '../hooks/use-entity-count';
import { useI18n } from '../i18n/provider';
import { cx } from '../lib/class-names';

export interface WorldPageProps {
  readonly world: WorldDetail | null;
  readonly state: 'loading' | 'ready' | 'error';
  readonly activity: readonly WorldActivityEntry[];
  readonly activityState: WorldActivityState;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onRetryActivity: () => void;
  readonly onOpenEntities: () => void;
}

/**
 * Marco modular de un mundo.
 *
 * La identidad (marca, estado, resumen y géneros) no repite el nombre ni las
 * acciones de la barra superior. La navegación modular lleva solo a Fichas; el
 * Resumen reúne la descripción y los datos, la Preparación el progreso y la
 * Actividad queda al final como información secundaria. El recuento de fichas
 * es asíncrono y, si falla, se omite sin bloquear la página.
 */
export function WorldPage({
  world,
  state,
  activity,
  activityState,
  onBack,
  onRetry,
  onRetryActivity,
  onOpenEntities,
}: WorldPageProps) {
  const { messages, formats } = useI18n();
  const summaryId = useId();
  const metadataId = useId();
  const progressId = useId();
  const activityId = useId();
  const entityCount = useEntityCount(world?.id ?? null);

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

  return (
    <div className="wc-page">
      <div className="wc-page__header">
        <Button variant="ghost" onClick={onBack}>
          {messages.worlds.detail.back}
        </Button>
      </div>

      <header className="wc-world-header">
        <WorldMark worldId={world.id} coverAssetId={world.coverAssetId} />

        <div className="wc-world-header__body">
          <div className="wc-world-header__meta">
            <Badge tone={archived ? 'neutral' : 'success'}>{statusLabel}</Badge>
          </div>

          <p
            className={cx(
              'wc-world-header__summary',
              world.summary === null && 'wc-world-header__summary--empty',
            )}
          >
            {world.summary ?? messages.worlds.detail.noSummary}
          </p>

          <ul
            className="wc-world-header__genres"
            aria-label={messages.worlds.form.genresLabel}
          >
            {world.genres.map((genre) => (
              <li key={genre}>
                <Badge tone="accent">{genre}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <WorldModuleNav
        entityCount={entityCount}
        onOpenEntities={onOpenEntities}
      />

      <section className="wc-page__section" aria-labelledby={summaryId}>
        <h2 className="wc-page__section-title" id={summaryId}>
          {messages.worlds.detail.summaryTitle}
        </h2>
        <p
          className={cx(
            'wc-world-description',
            world.description === null && 'wc-world-description--empty',
          )}
        >
          {world.description ?? messages.worlds.detail.noDescription}
        </p>

        <div className="wc-world-data">
          <h3 className="wc-world-section__title" id={metadataId}>
            {messages.worlds.detail.metadataTitle}
          </h3>
          <dl className="wc-world-meta" aria-labelledby={metadataId}>
            <div className="wc-world-meta__pair">
              <dt className="wc-world-meta__term">
                {messages.worlds.detail.meta.slug}
              </dt>
              <dd className="wc-world-meta__value">{world.slug}</dd>
            </div>
            <div className="wc-world-meta__pair">
              <dt className="wc-world-meta__term">
                {messages.worlds.detail.meta.language}
              </dt>
              <dd className="wc-world-meta__value">{languageLabel}</dd>
            </div>
            <div className="wc-world-meta__pair">
              <dt className="wc-world-meta__term">
                {messages.worlds.detail.meta.created}
              </dt>
              <dd className="wc-world-meta__value">
                <time dateTime={new Date(world.createdAt).toISOString()}>
                  {formats.formatDate(world.createdAt)}
                </time>
              </dd>
            </div>
            <div className="wc-world-meta__pair">
              <dt className="wc-world-meta__term">
                {messages.worlds.detail.meta.updated}
              </dt>
              <dd className="wc-world-meta__value">
                <time dateTime={new Date(world.updatedAt).toISOString()}>
                  {formats.formatDate(world.updatedAt)}
                </time>
              </dd>
            </div>
          </dl>
        </div>
      </section>

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

      <section
        className="wc-page__section wc-world-activity"
        aria-labelledby={activityId}
      >
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
    </div>
  );
}
