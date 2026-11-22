import type { MouseEvent } from 'react';

import {
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SUMMARY_MAX_LENGTH,
  type EntityDetail,
  type EntityStatus,
} from '../../../shared/contracts/entities';
import type { EntityTypeSummary } from '../../../shared/contracts/entity-types';
import { Badge, type BadgeTone } from '../badge';
import { Button } from '../button';
import { Menu } from '../menu';
import { TextAreaField } from '../text-area-field';
import { TextField } from '../text-field';
import { TypeIcon } from './type-icon';
import { useI18n } from '../../i18n/provider';

export type DocumentMode = 'read' | 'edit';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface EntityDocumentHeaderProps {
  readonly entity: EntityDetail;
  readonly type: EntityTypeSummary;
  readonly mode: DocumentMode;
  readonly saveState: SaveState;
  readonly name: string;
  readonly aliasesText: string;
  readonly summary: string;
  readonly status: EntityStatus;
  readonly nameError?: string | undefined;
  readonly favoritePending: boolean;
  readonly nameId: string;
  readonly onEdit: () => void;
  readonly onDone: () => void;
  readonly onSaveNow: () => void;
  readonly onToggleFavorite: () => void;
  readonly onDelete: () => void;
  readonly onChangeName: (value: string) => void;
  readonly onChangeAliases: (value: string) => void;
  readonly onChangeSummary: (value: string) => void;
}

const STATUS_TONES: Readonly<Record<EntityStatus, BadgeTone>> = {
  active: 'success',
  draft: 'warning',
  archived: 'neutral',
};

/**
 * Cabecera del documento de una ficha.
 *
 * En lectura muestra el tipo, el estado, el título, los alias y el resumen como
 * texto; en edición sustituye alias y resumen por sus campos y añade «Guardar
 * ahora» y «Listo». El estado de guardado es una región viva siempre montada.
 * El clic en el título es solo un atajo de ratón: el camino accesible es
 * «Editar».
 */
export function EntityDocumentHeader({
  entity,
  type,
  mode,
  saveState,
  name,
  aliasesText,
  summary,
  status,
  nameError,
  favoritePending,
  nameId,
  onEdit,
  onDone,
  onSaveNow,
  onToggleFavorite,
  onDelete,
  onChangeName,
  onChangeAliases,
  onChangeSummary,
}: EntityDocumentHeaderProps) {
  const { messages, formats } = useI18n();
  const aliases = aliasesText
    .split(',')
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
  const summaryText = summary.trim();
  const title =
    name.trim().length > 0 ? name : messages.entities.detail.untitled;
  const saveLabel =
    saveState === 'saving'
      ? messages.entities.detail.saving
      : saveState === 'dirty'
        ? messages.entities.detail.unsaved
        : saveState === 'error'
          ? messages.entities.detail.saveFailedShort
          : messages.entities.detail.saved;

  const handleTitleClick = (event: MouseEvent<HTMLHeadingElement>): void => {
    if (mode !== 'read') {
      return;
    }

    const selection = window.getSelection();

    if (selection !== null && !selection.isCollapsed) {
      return;
    }

    // Solo se evita el atajo si el clic venía de un enlace u otro control
    // dentro del título; hoy el título solo contiene texto.
    event.preventDefault();
    onEdit();
  };

  return (
    <header className="wc-document-header">
      <div className="wc-document-header__top">
        <div className="wc-document-header__badges">
          <Badge tone="neutral">
            <TypeIcon name={type.icon} className="wc-badge__icon" />
            {type.name}
          </Badge>
          <Badge tone={STATUS_TONES[status]}>
            {messages.entities.status[status]}
          </Badge>
        </div>

        <div className="wc-document-header__actions">
          <p
            className={`wc-save-state wc-save-state--${saveState}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {saveLabel}
          </p>
          <Button
            className="wc-document-header__favorite"
            variant="secondary"
            size="sm"
            aria-pressed={entity.isFavorite}
            disabled={favoritePending}
            onClick={onToggleFavorite}
          >
            <span className="wc-document-header__star" aria-hidden="true">
              {entity.isFavorite ? '★' : '☆'}
            </span>
            {messages.entities.detail.favoriteLabel}
          </Button>
          {mode === 'read' ? (
            <Button
              id="wc-entity-edit-trigger"
              variant="secondary"
              size="sm"
              onClick={onEdit}
            >
              {messages.entities.detail.edit}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                aria-keyshortcuts="Control+S"
                onClick={onSaveNow}
              >
                {messages.entities.detail.save}
              </Button>
              <Button variant="primary" size="md" onClick={onDone}>
                {messages.entities.detail.done}
              </Button>
            </>
          )}
          <Menu
            label={messages.entities.detail.menuLabel}
            triggerTooltip={messages.entities.detail.menuLabel}
            align="end"
            items={[
              {
                id: 'delete-entity',
                label: messages.entities.detail.delete,
                tone: 'danger',
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>

      <h2
        className="wc-document-header__title"
        data-editable={mode === 'read' ? 'true' : undefined}
        data-untitled={name.trim().length === 0 ? 'true' : undefined}
        onClick={handleTitleClick}
      >
        {title}
      </h2>

      {mode === 'read' ? (
        <>
          {aliases.length > 0 ? (
            <p className="wc-document-header__aliases">
              {messages.entities.detail.aliasLine(formats.formatList(aliases))}
            </p>
          ) : null}
          {summaryText.length > 0 ? (
            <p className="wc-document-header__summary">{summaryText}</p>
          ) : null}
        </>
      ) : (
        <div className="wc-document-header__fields">
          <TextField
            id={nameId}
            label={messages.entities.detail.nameLabel}
            value={name}
            maxLength={ENTITY_NAME_MAX_LENGTH}
            required
            error={nameError}
            onChange={(event) => {
              onChangeName(event.target.value);
            }}
          />
          <TextField
            label={messages.entities.detail.aliasesLabel}
            hint={messages.entities.detail.aliasesHint}
            value={aliasesText}
            onChange={(event) => {
              onChangeAliases(event.target.value);
            }}
          />
          <TextAreaField
            label={messages.entities.detail.summaryLabel}
            placeholder={messages.entities.detail.summaryPlaceholder}
            value={summary}
            maxLength={ENTITY_SUMMARY_MAX_LENGTH}
            rows={2}
            onChange={(event) => {
              onChangeSummary(event.target.value);
            }}
          />
        </div>
      )}

      <p className="wc-document-header__meta">
        <time dateTime={new Date(entity.updatedAt).toISOString()}>
          {messages.entities.card.updated(formats.formatDate(entity.updatedAt))}
        </time>
        <span className="wc-document-header__separator" aria-hidden="true">
          ·
        </span>
        <code className="wc-document-header__slug">{entity.slug}</code>
      </p>
    </header>
  );
}
