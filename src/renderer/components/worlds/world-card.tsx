import { useId } from 'react';

import type { WorldSummary } from '../../../shared/contracts/worlds';
import { useI18n } from '../../i18n/provider';
import { Badge } from '../badge';
import { Button } from '../button';
import { Menu } from '../menu';
import { WorldMark } from './world-mark';

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
  /** Referencia temporal de la fecha relativa; por defecto, ahora. */
  readonly now?: number | undefined;
}

/**
 * Tarjeta de mundo para Inicio y la lista.
 *
 * Una sola acción visible («Abrir») y las otras cuatro en el menú `⋯`; la
 * tarjeta no es clicable entera para no anidar controles. La portada o la marca
 * procedural son decorativas. La fecha se pinta en relativo con `Intl` y el
 * `<time>` conserva la fecha completa en `title` y `dateTime`.
 *
 * La misma implementación sirve a la fila de Inicio y a la rejilla de Mundos:
 * el contenedor decide el número de filas de la rejilla.
 */
export function WorldCard({ world, actions, now }: WorldCardProps) {
  const { messages, formats } = useI18n();
  const titleId = useId();
  const archived = world.status === 'archived';
  const statusLabel = archived
    ? messages.worlds.status.archived
    : messages.worlds.status.active;
  const relative = formats.formatRelativeTime(world.updatedAt, now);

  return (
    <article className="wc-world-card" aria-labelledby={titleId}>
      <div className="wc-world-card__mark">
        <WorldMark worldId={world.id} coverAssetId={world.coverAssetId} />
      </div>

      <div className="wc-world-card__content">
        <div className="wc-world-card__heading">
          <h3 className="wc-world-card__title" id={titleId}>
            {world.name}
          </h3>
          <Badge tone={archived ? 'neutral' : 'success'}>{statusLabel}</Badge>
        </div>

        <p
          className="wc-world-card__summary"
          title={world.summary ?? undefined}
        >
          {world.summary ?? messages.worlds.card.noSummary}
        </p>

        <div className="wc-world-card__meta">
          {world.genres.length > 0 ? (
            <ul
              className="wc-world-card__genres"
              aria-label={messages.worlds.form.genresLabel}
            >
              {world.genres.map((genre) => (
                <li key={genre}>{genre}</li>
              ))}
            </ul>
          ) : null}
          <time
            className="wc-world-card__time"
            dateTime={new Date(world.updatedAt).toISOString()}
            title={formats.formatDateTime(world.updatedAt)}
          >
            {messages.worlds.card.relativeUpdated(relative)}
          </time>
        </div>
      </div>

      <div className="wc-world-card__actions">
        <Button
          variant="secondary"
          aria-label={messages.worlds.card.openNamed(world.name)}
          onClick={() => {
            actions.onOpen(world);
          }}
        >
          {messages.worlds.card.open}
        </Button>
        <Menu
          label={messages.worlds.card.actionsNamed(world.name)}
          align="end"
          items={[
            {
              id: 'edit',
              label: messages.worlds.card.edit,
              onSelect: () => {
                actions.onEdit(world);
              },
            },
            {
              id: 'duplicate',
              label: messages.worlds.card.duplicate,
              onSelect: () => {
                actions.onDuplicate(world);
              },
            },
            {
              id: 'archive',
              label: archived
                ? messages.worlds.card.restore
                : messages.worlds.card.archive,
              onSelect: () => {
                actions.onArchiveToggle(world);
              },
            },
            {
              id: 'delete',
              label: messages.worlds.card.delete,
              tone: 'danger',
              onSelect: () => {
                actions.onDelete(world);
              },
            },
          ]}
        />
      </div>
    </article>
  );
}
