import type { EntitySummary } from '../../../shared/contracts/entities';
import { assetUrl } from '../../lib/asset-url';
import { Badge } from '../badge';
import { Button } from '../button';
import { useI18n } from '../../i18n/provider';
import { TypeIcon } from './type-icon';

export interface EntityCardProps {
  readonly entity: EntitySummary;
  readonly onOpen: (entity: EntitySummary) => void;
  readonly onToggleFavorite: (entity: EntitySummary) => void;
}

/**
 * Tarjeta de ficha para la lista del mundo.
 *
 * La miniatura usa `wc-asset://thumb/<id>` y nunca el archivo original. El
 * tipo se identifica con icono, color y nombre; el color no es el único
 * indicador. El nombre es un botón propio para que el teclado y el ratón
 * compartan el mismo destino sin anidar controles.
 */
export function EntityCard({
  entity,
  onOpen,
  onToggleFavorite,
}: EntityCardProps) {
  const { messages, formats } = useI18n();

  return (
    <article className="wc-entity-card" data-type-color={entity.typeColor}>
      <div className="wc-entity-card__media">
        {entity.imageAssetId !== null ? (
          <img
            className="wc-entity-card__image"
            src={assetUrl(entity.imageAssetId, 'thumb')}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="wc-entity-card__icon" aria-hidden="true">
            <TypeIcon name={entity.typeIcon} />
          </span>
        )}
      </div>

      <div className="wc-entity-card__body">
        <div className="wc-entity-card__heading">
          <Badge tone="neutral" className="wc-entity-card__type">
            <TypeIcon name={entity.typeIcon} className="wc-badge__icon" />
            {entity.typeName}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="wc-entity-card__favorite"
            aria-pressed={entity.isFavorite}
            aria-label={
              entity.isFavorite
                ? messages.entities.card.unfavoriteNamed(entity.name)
                : messages.entities.card.favoriteNamed(entity.name)
            }
            onClick={() => {
              onToggleFavorite(entity);
            }}
          >
            <span
              className="wc-editor__glyph"
              data-glyph={entity.isFavorite ? '★' : '☆'}
              aria-hidden="true"
            />
          </Button>
        </div>

        <button
          type="button"
          className="wc-entity-card__open"
          onClick={() => {
            onOpen(entity);
          }}
          aria-label={messages.entities.card.openNamed(entity.name)}
        >
          <span className="wc-entity-card__name">{entity.name}</span>
        </button>

        <p className="wc-entity-card__summary">
          {entity.summary ?? messages.entities.card.noSummary}
        </p>

        {entity.tags.length > 0 ? (
          <ul
            className="wc-entity-card__tags"
            aria-label={messages.entities.detail.tagsTitle}
          >
            {entity.tags.map((tag) => (
              <li key={tag.id}>
                <span
                  className={`wc-tag wc-tag--${tag.color}`}
                  data-testid="entity-tag"
                >
                  {tag.name}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="wc-entity-card__meta">
          {messages.entities.card.updated(formats.formatDate(entity.updatedAt))}
        </p>
      </div>
    </article>
  );
}
