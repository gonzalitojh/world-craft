import { useId } from 'react';

import type { WorldSummary } from '../../../shared/contracts/worlds';
import { assetUrl } from '../../lib/asset-url';
import { useI18n } from '../../i18n/provider';
import { Badge } from '../badge';
import { Button } from '../button';

/** Acciones que una tarjeta de mundo puede lanzar. */
export interface WorldCardActions {
  readonly onOpen: (world: WorldSummary) => void;
  readonly onEdit: (world: WorldSummary) => void;
  readonly onDuplicate: (world: WorldSummary) => void;
  readonly onArchiveToggle: (world: WorldSummary) => void;
  readonly onDelete: (world: WorldSummary) => void;
}

export interface WorldCardProps {
  readonly world: WorldSummary;
  readonly actions: WorldCardActions;
}

/**
 * Tarjeta de mundo para Inicio y la lista.
 *
 * La portada es decorativa (la información está en el título contiguo); si no
 * existe se muestra la inicial del mundo sobre una superficie del tema, sin
 * imágenes externas. Las acciones llevan el nombre en su etiqueta accesible
 * para que varias tarjetas no compartan nombres de botón.
 */
export function WorldCard({ world, actions }: WorldCardProps) {
  const { messages, formats } = useI18n();
  const titleId = useId();
  const archived = world.status === 'archived';
  const initial = world.name.trim().slice(0, 1).toLocaleUpperCase('es');
  const statusLabel = archived
    ? messages.worlds.status.archived
    : messages.worlds.status.active;

  return (
    <article className="wc-world-card" aria-labelledby={titleId}>
      <div className="wc-world-card__cover" aria-hidden="true">
        {world.coverAssetId !== null ? (
          <img
            className="wc-world-card__cover-image"
            src={assetUrl(world.coverAssetId)}
            alt=""
          />
        ) : (
          <span className="wc-world-card__initial">{initial}</span>
        )}
      </div>

      <div className="wc-world-card__heading">
        <h3 className="wc-world-card__title" id={titleId}>
          {world.name}
        </h3>
        <Badge tone={archived ? 'neutral' : 'success'}>{statusLabel}</Badge>
      </div>

      <p className="wc-world-card__summary">
        {world.summary ?? messages.worlds.card.noSummary}
      </p>

      {world.genres.length > 0 ? (
        <ul
          className="wc-world-card__genres"
          aria-label={messages.worlds.form.genresLabel}
        >
          {world.genres.map((genre) => (
            <li key={genre}>
              <Badge tone="accent">{genre}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="wc-world-card__meta">
        {messages.worlds.card.updated(formats.formatDate(world.updatedAt))}
      </p>

      <div className="wc-world-card__actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            actions.onOpen(world);
          }}
          aria-label={messages.worlds.card.openNamed(world.name)}
        >
          {messages.worlds.card.open}
        </Button>
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
    </article>
  );
}
