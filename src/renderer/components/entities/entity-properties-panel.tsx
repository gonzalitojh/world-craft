import type { AssetSummary } from '../../../shared/contracts/assets';
import {
  ENTITY_TAGS_MAX,
  type EntityStatus,
  type EntityTag,
} from '../../../shared/contracts/entities';
import { Button } from '../button';
import { SelectField } from '../select-field';
import { assetUrl } from '../../lib/asset-url';
import { useI18n } from '../../i18n/provider';

export interface EntityPropertiesPanelProps {
  readonly headingId: string;
  readonly mainAsset: AssetSummary | null;
  readonly hasAssets: boolean;
  readonly status: EntityStatus;
  readonly assignedTags: readonly EntityTag[];
  readonly availableTags: readonly EntityTag[];
  readonly tagsLimitReached: boolean;
  readonly pending: boolean;
  readonly onChangeStatus: (status: EntityStatus) => void;
  readonly onChooseCover: () => void;
  readonly onAddTag: (tagId: string) => void;
  readonly onRemoveTag: (tagId: string) => void;
  readonly onCreateTag: () => void;
  readonly onGoToResources: () => void;
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="7" cy="8" r="1.3" fill="currentColor" />
      <path
        d="m4.5 14 4-4 3 3 2.5-2.5 2.5 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Inspector de propiedades de la ficha.
 *
 * Contiene solo portada, estado y etiquetas. La galería, los campos y las
 * relaciones viven en el documento; este panel no es un formulario paralelo.
 */
export function EntityPropertiesPanel({
  headingId,
  mainAsset,
  hasAssets,
  status,
  assignedTags,
  availableTags,
  tagsLimitReached,
  pending,
  onChangeStatus,
  onChooseCover,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onGoToResources,
}: EntityPropertiesPanelProps) {
  const { messages } = useI18n();
  const addTagHint = tagsLimitReached
    ? messages.entities.detail.tagsLimit(ENTITY_TAGS_MAX)
    : availableTags.length === 0
      ? assignedTags.length === 0
        ? messages.entities.detail.tagsNone
        : messages.entities.detail.noAvailableTags
      : undefined;

  return (
    <aside
      className="wc-entity-properties"
      id="wc-entity-properties"
      aria-labelledby={headingId}
    >
      <h2 className="wc-entity-properties__title" id={headingId}>
        {messages.entities.detail.propertiesTitle}
      </h2>

      <div className="wc-entity-properties__grid">
        <section className="wc-entity-properties__block wc-entity-properties__block--cover">
          <h3 className="wc-entity-properties__label">
            {messages.entities.detail.coverTitle}
          </h3>
          <div className="wc-entity-cover">
            {mainAsset === null ? (
              <div className="wc-entity-cover__empty">
                <ImageIcon />
                <p>{messages.entities.detail.coverEmpty}</p>
              </div>
            ) : (
              <img
                className="wc-entity-cover__picture"
                src={assetUrl(mainAsset.id)}
                alt={mainAsset.alt ?? ''}
              />
            )}
          </div>
          {hasAssets ? (
            <Button variant="secondary" size="sm" onClick={onChooseCover}>
              {mainAsset === null
                ? messages.entities.detail.chooseCover
                : messages.entities.detail.changeCover}
            </Button>
          ) : (
            <div className="wc-entity-properties__hint">
              <p>{messages.entities.detail.coverHintEmpty}</p>
              <Button variant="ghost" size="sm" onClick={onGoToResources}>
                {messages.entities.detail.goToResources}
              </Button>
            </div>
          )}
        </section>

        <section className="wc-entity-properties__block wc-entity-properties__block--status">
          <SelectField
            label={messages.entities.detail.statusLabel}
            value={status}
            options={[
              { value: 'active', label: messages.entities.status.active },
              { value: 'draft', label: messages.entities.status.draft },
              { value: 'archived', label: messages.entities.status.archived },
            ]}
            onChange={(event) => {
              onChangeStatus(event.target.value as EntityStatus);
            }}
          />
        </section>

        <section className="wc-entity-properties__block wc-entity-properties__block--tags">
          <h3 className="wc-entity-properties__label">
            {messages.entities.detail.tagsTitle}
          </h3>
          {assignedTags.length === 0 ? null : (
            <ul
              className="wc-tag-list"
              aria-label={messages.entities.detail.tagsAssignedLabel}
            >
              {assignedTags.map((tag) => (
                <li key={tag.id}>
                  <span
                    className={`wc-tag wc-tag--${tag.color} wc-tag--dismissible`}
                  >
                    <span className="wc-tag__label">{tag.name}</span>
                    <button
                      type="button"
                      className="wc-tag__remove"
                      aria-label={messages.entities.detail.removeTagNamed(
                        tag.name,
                      )}
                      disabled={pending}
                      onClick={() => {
                        onRemoveTag(tag.id);
                      }}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SelectField
            label={messages.entities.detail.tagAddLabel}
            hint={addTagHint}
            value=""
            disabled={tagsLimitReached || availableTags.length === 0}
            options={[
              {
                value: '',
                label: messages.entities.detail.tagAddPlaceholder,
              },
              ...availableTags.map((tag) => ({
                value: tag.id,
                label: tag.name,
              })),
            ]}
            onChange={(event) => {
              if (event.target.value.length === 0) {
                return;
              }

              onAddTag(event.target.value);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={tagsLimitReached}
            onClick={onCreateTag}
          >
            {messages.entities.detail.newTag}
          </Button>
        </section>
      </div>
    </aside>
  );
}
