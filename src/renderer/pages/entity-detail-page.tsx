import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  ENTITY_ALIAS_MAX_LENGTH,
  ENTITY_ALIASES_MAX,
  ENTITY_GALLERY_MAX,
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SUMMARY_MAX_LENGTH,
  ENTITY_TAGS_MAX,
  type EntityDetail,
  type EntityRichTextDocument,
  type EntityStatus,
  type EntitySummary,
  type EntityTag,
} from '../../shared/contracts/entities';
import {
  relationForwardLabel,
  type RelationCreateInput,
  type RelationEdge,
  type RelationType,
  type RelationTypeCreateInput,
  type RelationTypeRemoveInput,
  type RelationTypeUpdateInput,
  type RelationUpdateInput,
} from '../../shared/contracts/relations';
import type { AssetSummary } from '../../shared/contracts/assets';
import type { WorldDetail } from '../../shared/contracts/worlds';
import type {
  EntityFieldDefinition,
  EntityTypeSummary,
} from '../../shared/contracts/entity-types';
import {
  validateEntityFieldValues,
  type EntityFieldValue,
} from '../../shared/entity-types/fields';
import { validateEntityDescription } from '../../shared/entities/description';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { Dialog } from '../components/dialog';
import { SelectField } from '../components/select-field';
import { TextAreaField } from '../components/text-area-field';
import { TextField } from '../components/text-field';
import { EntityAttributesFields } from '../components/entities/entity-attributes-fields';
import { EntityDescriptionEditor } from '../components/entities/entity-description-editor';
import { EntityRelationDialog } from '../components/entities/entity-relation-dialog';
import { EntityRelationsPanel } from '../components/entities/entity-relations-panel';
import { EntityTagDialog } from '../components/entities/entity-tag-dialog';
import { Menu } from '../components/menu';
import { RelationTypeManager } from '../components/entities/relation-type-manager';
import { TypeIcon } from '../components/entities/type-icon';
import { useI18n } from '../i18n/provider';
import { assetUrl } from '../lib/asset-url';

interface Draft {
  readonly name: string;
  readonly aliasesText: string;
  readonly summary: string;
  readonly description: EntityRichTextDocument | null;
  readonly attributes: Readonly<Record<string, EntityFieldValue>>;
  readonly status: EntityStatus;
  readonly imageAssetId: string | null;
  readonly galleryAssetIds: readonly string[];
  readonly tagIds: readonly string[];
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface EntityDetailPageProps {
  readonly world: WorldDetail;
  readonly entityId: string;
  readonly onBack: () => void;
  readonly onOpenEntity: (entityId: string) => void;
  /** Avisa del nombre cargado para completar la memoria de sesión de Inicio. */
  readonly onEntityLoaded?: (entity: {
    readonly id: string;
    readonly name: string;
  }) => void;
  readonly onNotify: (tone: 'success' | 'error', message: string) => void;
}

/**
 * Detalle y edición de una ficha.
 *
 * El formulario se autoguarda con un retardo corto y también se puede guardar
 * a mano. La descripción se edita con Tiptap y se guarda como JSON validado; la
 * imagen principal y la galería solo referencian assets del mismo mundo y se
 * muestran por `wc-asset://`.
 */
export function EntityDetailPage({
  world,
  entityId,
  onBack,
  onOpenEntity,
  onEntityLoaded,
  onNotify,
}: EntityDetailPageProps) {
  const { messages, formats } = useI18n();
  const nameId = useId();
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [types, setTypes] = useState<readonly EntityTypeSummary[]>([]);
  const [tags, setTags] = useState<readonly EntityTag[]>([]);
  const [assets, setAssets] = useState<readonly AssetSummary[]>([]);
  const [candidates, setCandidates] = useState<readonly EntitySummary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mainPickerOpen, setMainPickerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagKey, setTagKey] = useState(0);
  const [relationTypes, setRelationTypes] = useState<readonly RelationType[]>(
    [],
  );
  const [relationTypesState, setRelationTypesState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [relations, setRelations] = useState<readonly RelationEdge[]>([]);
  const [relationState, setRelationState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [relationPending, setRelationPending] = useState(false);
  const [relationDialog, setRelationDialog] = useState<{
    readonly mode: 'create' | 'edit';
    readonly relation: RelationEdge | null;
  } | null>(null);
  const [relationTypesOpen, setRelationTypesOpen] = useState(false);
  const [relationReloadToken, setRelationReloadToken] = useState(0);

  const draftRef = useRef<Draft | null>(null);
  const typeRef = useRef<EntityTypeSummary | null>(null);
  const skipAutosave = useRef(false);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const requestRef = useRef(0);

  const type = types.find((entry) => entry.id === entity?.typeId) ?? null;

  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  // Inicio necesita el nombre de la ficha para el bloque «Continuar»; se avisa
  // en cuanto la ficha llega o cambia de nombre, sin alterar la navegación.
  useEffect(() => {
    if (entity !== null) {
      onEntityLoaded?.({ id: entity.id, name: entity.name });
    }
  }, [entity, onEntityLoaded]);

  const buildInput = useCallback(() => {
    const current = draftRef.current;
    const currentType = typeRef.current;

    if (current === null || currentType === null) {
      return null;
    }

    const nextErrors: Record<string, string> = {};

    if (current.name.trim().length === 0) {
      nextErrors.name = messages.components.form.requiredField;
    }

    const description = validateEntityDescription(current.description);

    if (!description.ok) {
      setGeneralError(messages.entities.detail.invalid);
      return null;
    }

    const values = validateEntityFieldValues(
      currentType.fields,
      current.attributes,
    );

    if (!values.ok) {
      for (const error of values.errors) {
        nextErrors[error.fieldKey] =
          messages.entities.attributes.errors[error.code];
      }

      setErrors(nextErrors);
      setGeneralError(messages.entities.detail.invalid);
      return null;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setGeneralError(messages.entities.detail.invalid);
      return null;
    }

    setErrors({});
    setGeneralError(null);

    const aliases = current.aliasesText
      .split(',')
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0)
      .slice(0, ENTITY_ALIASES_MAX)
      .map((alias) => alias.slice(0, ENTITY_ALIAS_MAX_LENGTH));

    return {
      worldId: world.id,
      id: entityId,
      name: current.name,
      aliases,
      summary:
        current.summary.trim().length === 0 ? null : current.summary.trim(),
      description: description.document,
      attributes: values.values,
      imageAssetId: current.imageAssetId,
      galleryAssetIds: current.galleryAssetIds,
      tagIds: current.tagIds,
      status: current.status,
    };
  }, [entityId, messages, world.id]);

  const flushRef = useRef<(showState: boolean) => Promise<void>>(
    async () => {},
  );

  const flush = useCallback(
    async (showState: boolean): Promise<void> => {
      if (savingRef.current) {
        queuedRef.current = true;
        return;
      }

      const input = buildInput();

      if (input === null) {
        setSaveState('error');
        return;
      }

      savingRef.current = true;

      if (showState) {
        setSaveState('saving');
      }

      const result = await window.worldCraft.entities.update(input);
      savingRef.current = false;

      if (result.ok && result.data !== null) {
        setEntity(result.data);
        setSaveState('saved');
      } else {
        setSaveState('error');
        setGeneralError(messages.entities.detail.saveError);
      }

      if (queuedRef.current) {
        queuedRef.current = false;
        void flushRef.current(false);
      }
    },
    [buildInput, messages],
  );

  useEffect(() => {
    flushRef.current = flush;
    return () => {
      void flush(false);
    };
  }, [flush]);

  useEffect(() => {
    requestRef.current += 1;
    const request = requestRef.current;

    void Promise.all([
      window.worldCraft.entities.get({ worldId: world.id, id: entityId }),
      window.worldCraft.entityTypes.list(world.id),
      window.worldCraft.tags.list(world.id),
      window.worldCraft.assets.list(world.id),
      window.worldCraft.entities.list({ worldId: world.id }),
      window.worldCraft.relationTypes.list(world.id),
      window.worldCraft.relations.list({
        worldId: world.id,
        filter: { entityId },
      }),
    ]).then(
      ([
        detail,
        typeList,
        tagList,
        assetList,
        entityList,
        relationTypeList,
        relationList,
      ]) => {
        if (request !== requestRef.current) {
          return;
        }

        if (detail.ok && detail.data !== null) {
          setEntity(detail.data);
          setDraft(toDraft(detail.data));
          skipAutosave.current = true;
          setSaveState('saved');
          setState('ready');
        } else {
          setState('error');
        }

        if (typeList.ok) setTypes(typeList.data);
        if (tagList.ok) setTags(tagList.data);
        if (assetList.ok) setAssets(assetList.data);
        if (entityList.ok) {
          setCandidates(
            entityList.data.filter((candidate) => candidate.id !== entityId),
          );
        }
        if (relationTypeList.ok) {
          setRelationTypes(relationTypeList.data);
          setRelationTypesState('ready');
        } else {
          setRelationTypesState('error');
        }
        if (relationList.ok) {
          setRelations(relationList.data);
          setRelationState('ready');
        } else {
          setRelationState('error');
        }
      },
    );
  }, [entityId, reloadToken, relationReloadToken, world.id]);

  useEffect(() => {
    draftRef.current = draft;

    if (draft === null) {
      return;
    }

    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }

    setSaveState('dirty');
    const timer = window.setTimeout(() => {
      void flushRef.current(true);
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft]);

  const toggleFavorite = async (): Promise<void> => {
    if (entity === null) {
      return;
    }

    const result = await window.worldCraft.entities.setFavorite({
      worldId: world.id,
      id: entity.id,
      favorite: !entity.isFavorite,
    });

    if (!result.ok || result.data === null) {
      onNotify('error', messages.entities.notices.failed);
      return;
    }

    setEntity(result.data);
    onNotify(
      'success',
      entity.isFavorite
        ? messages.entities.notices.unfavorite(entity.name)
        : messages.entities.notices.favorite(entity.name),
    );
  };

  const importImages = async (): Promise<void> => {
    if (pending) {
      return;
    }

    setPending(true);
    const result = await window.worldCraft.assets.import({ worldId: world.id });
    setPending(false);

    if (!result.ok) {
      onNotify('error', messages.entities.detail.imageError);
      return;
    }

    if (result.data.imported.length === 0) {
      return;
    }

    setAssets((current) => [...result.data.imported, ...current]);
    setDraft((current) => {
      if (current === null) {
        return current;
      }

      const ids = [
        ...current.galleryAssetIds,
        ...result.data.imported.map((asset) => asset.id),
      ].slice(0, ENTITY_GALLERY_MAX);

      return { ...current, galleryAssetIds: ids };
    });
  };

  const removeImage = (assetId: string): void => {
    setDraft((current) => {
      if (current === null) {
        return current;
      }

      return {
        ...current,
        imageAssetId:
          current.imageAssetId === assetId ? null : current.imageAssetId,
        galleryAssetIds: current.galleryAssetIds.filter(
          (entry) => entry !== assetId,
        ),
      };
    });
  };

  const setMainImage = (assetId: string): void => {
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            imageAssetId: assetId,
            galleryAssetIds: current.galleryAssetIds.includes(assetId)
              ? current.galleryAssetIds
              : [...current.galleryAssetIds, assetId].slice(
                  0,
                  ENTITY_GALLERY_MAX,
                ),
          },
    );
  };

  const createTag = async (input: {
    readonly worldId: string;
    readonly name: string;
    readonly color: EntityTag['color'];
  }): Promise<EntityTag | null> => {
    setPending(true);
    const result = await window.worldCraft.tags.create(input);
    setPending(false);

    if (!result.ok) {
      return null;
    }

    setTags((current) =>
      current.some((entry) => entry.id === result.data.id)
        ? current
        : [...current, result.data],
    );
    setDraft((current) =>
      current === null || current.tagIds.includes(result.data.id)
        ? current
        : { ...current, tagIds: [...current.tagIds, result.data.id] },
    );
    onNotify('success', messages.entities.tags.created(result.data.name));
    setTagOpen(false);
    return result.data;
  };

  const submitRelation = async (
    input: RelationCreateInput | RelationUpdateInput,
  ): Promise<boolean> => {
    if (relationPending) {
      return false;
    }

    setRelationPending(true);

    if ('id' in input) {
      const result = await window.worldCraft.relations.update(input);
      setRelationPending(false);

      if (!result.ok || result.data === null) {
        onNotify('error', messages.entities.relations.error);
        return false;
      }

      const updated = result.data;

      setRelations((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setRelationDialog(null);
      onNotify('success', messages.entities.relations.updated);
      return true;
    }

    const result = await window.worldCraft.relations.create(input);
    setRelationPending(false);

    if (!result.ok) {
      onNotify('error', messages.entities.relations.error);
      return false;
    }

    setRelations((current) => [result.data, ...current]);
    setRelationDialog(null);
    onNotify(
      'success',
      messages.entities.relations.created(
        relationForwardLabel(result.data),
        result.data.target.name,
      ),
    );
    return true;
  };

  const removeRelation = async (relation: RelationEdge): Promise<boolean> => {
    if (relationPending) {
      return false;
    }

    setRelationPending(true);
    const result = await window.worldCraft.relations.remove({
      worldId: world.id,
      id: relation.id,
    });
    setRelationPending(false);

    if (!result.ok || !result.data.deleted) {
      onNotify('error', messages.entities.relations.deleteError);
      return false;
    }

    setRelations((current) =>
      current.filter((entry) => entry.id !== relation.id),
    );
    onNotify('success', messages.entities.relations.removed);
    return true;
  };

  const createRelationType = async (
    input: RelationTypeCreateInput,
  ): Promise<RelationType | null> => {
    if (relationPending) {
      return null;
    }

    setRelationPending(true);
    const result = await window.worldCraft.relationTypes.create(input);
    setRelationPending(false);

    if (!result.ok) {
      return null;
    }

    setRelationTypes((current) => [...current, result.data]);
    onNotify(
      'success',
      messages.entities.relations.types.created(result.data.name),
    );
    return result.data;
  };

  const updateRelationType = async (
    input: RelationTypeUpdateInput,
  ): Promise<RelationType | null> => {
    if (relationPending) {
      return null;
    }

    setRelationPending(true);
    const result = await window.worldCraft.relationTypes.update(input);
    setRelationPending(false);

    if (!result.ok || result.data === null) {
      return null;
    }

    const updated = result.data;

    setRelationTypes((current) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
    setRelations((current) =>
      current.map((entry) =>
        entry.typeId === updated.id
          ? {
              ...entry,
              typeName: updated.name,
              typeInverseName: updated.inverseName,
              typeColor: updated.color,
            }
          : entry,
      ),
    );
    onNotify(
      'success',
      messages.entities.relations.types.updated(updated.name),
    );
    return updated;
  };

  const removeRelationType = async (
    input: RelationTypeRemoveInput,
  ): Promise<boolean> => {
    if (relationPending) {
      return false;
    }

    setRelationPending(true);
    const result = await window.worldCraft.relationTypes.remove(input);
    setRelationPending(false);

    if (!result.ok || !result.data.deleted) {
      return false;
    }

    const removedName =
      relationTypes.find((entry) => entry.id === input.id)?.name ?? '';

    setRelationTypes((current) =>
      current.filter((entry) => entry.id !== input.id),
    );
    onNotify('success', messages.entities.relations.types.removed(removedName));
    return true;
  };

  const deleteEntity = async (): Promise<void> => {
    if (pending) {
      return;
    }

    setPending(true);
    const result = await window.worldCraft.entities.remove({
      worldId: world.id,
      id: entityId,
    });
    setPending(false);

    if (!result.ok || !result.data.deleted) {
      onNotify('error', messages.entities.notices.notFound);
      return;
    }

    setDeleteOpen(false);
    onNotify('success', messages.entities.notices.removed(entity?.name ?? ''));
    onBack();
  };

  if (state === 'loading') {
    return (
      <div className="wc-page">
        <p className="wc-page__status" role="status">
          {messages.entities.detail.loading}
        </p>
      </div>
    );
  }

  if (state === 'error' || entity === null || draft === null || type === null) {
    return (
      <div className="wc-page">
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">
            {messages.entities.detail.errorTitle}
          </h2>
          <p>{messages.entities.detail.errorDescription}</p>
          <div className="wc-alert__actions">
            <Button variant="secondary" onClick={onBack}>
              {messages.entities.detail.back}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setReloadToken((current) => current + 1);
              }}
            >
              {messages.entities.detail.retry}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const assignedTags = draft.tagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is EntityTag => tag !== undefined);
  const availableTags = tags.filter((tag) => !draft.tagIds.includes(tag.id));
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const gallery = draft.galleryAssetIds
    .map((assetId) => assetMap.get(assetId))
    .filter((asset): asset is AssetSummary => asset !== undefined);
  const mainAsset =
    draft.imageAssetId === null
      ? null
      : (assetMap.get(draft.imageAssetId) ?? null);

  const saveLabel =
    saveState === 'saving'
      ? messages.entities.detail.saving
      : saveState === 'dirty'
        ? messages.entities.detail.unsaved
        : saveState === 'error'
          ? messages.entities.detail.saveError
          : messages.entities.detail.saved;

  return (
    <div className="wc-page wc-page--entity">
      <div className="wc-page__header">
        <Button variant="ghost" onClick={onBack}>
          {messages.entities.detail.back}
        </Button>
        <div className="wc-entity-toolbar">
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={entity.isFavorite}
            aria-label={
              entity.isFavorite
                ? messages.entities.detail.unfavorite
                : messages.entities.detail.favorite
            }
            onClick={() => {
              void toggleFavorite();
            }}
          >
            <span
              className="wc-editor__glyph"
              data-glyph={entity.isFavorite ? '★' : '☆'}
              aria-hidden="true"
            />{' '}
            {entity.isFavorite
              ? messages.entities.detail.unfavorite
              : messages.entities.detail.favorite}
          </Button>
          <Menu
            label={messages.entities.detail.menuLabel}
            triggerTooltip={messages.entities.detail.menuLabel}
            align="end"
            items={[
              {
                id: 'delete-entity',
                label: messages.entities.detail.delete,
                tone: 'danger',
                onSelect: () => {
                  setDeleteOpen(true);
                },
              },
            ]}
          />
        </div>
      </div>

      <header className="wc-entity-header">
        <span
          className={`wc-entity-header__icon wc-type-color--${type.color}`}
          aria-hidden="true"
        >
          <TypeIcon name={type.icon} />
        </span>
        <div className="wc-entity-header__body">
          <Badge tone="neutral">
            <TypeIcon name={type.icon} className="wc-badge__icon" />
            {type.name}
          </Badge>
          <h2 className="wc-entity-header__name">
            {draft.name || entity.name}
          </h2>
          <p className="wc-entity-header__meta">
            {messages.entities.card.updated(
              formats.formatDate(entity.updatedAt),
            )}{' '}
            · {entity.slug}
          </p>
        </div>
        <p
          className={`wc-save-state wc-save-state--${saveState}`}
          role="status"
          aria-live="polite"
        >
          {saveLabel}
        </p>
      </header>

      {generalError !== null ? (
        <p className="wc-alert" role="alert">
          {generalError}
        </p>
      ) : null}

      <div className="wc-entity-layout">
        <div className="wc-entity-main">
          <TextField
            label={messages.entities.detail.nameLabel}
            value={draft.name}
            maxLength={ENTITY_NAME_MAX_LENGTH}
            error={errors.name}
            required
            onChange={(event) => {
              setDraft({ ...draft, name: event.target.value });
            }}
            id={nameId}
          />

          <TextField
            label={messages.entities.detail.aliasesLabel}
            hint={messages.entities.detail.aliasesHint}
            value={draft.aliasesText}
            onChange={(event) => {
              setDraft({ ...draft, aliasesText: event.target.value });
            }}
          />

          <TextAreaField
            label={messages.entities.detail.summaryLabel}
            value={draft.summary}
            maxLength={ENTITY_SUMMARY_MAX_LENGTH}
            rows={2}
            onChange={(event) => {
              setDraft({ ...draft, summary: event.target.value });
            }}
          />

          <section className="wc-page__section">
            <h3 className="wc-page__section-title">
              {messages.entities.detail.descriptionLabel}
            </h3>
            <EntityDescriptionEditor
              document={draft.description}
              candidates={candidates}
              disabled={pending}
              onChange={(description) => {
                setDraft({ ...draft, description });
              }}
              onOpenEntity={onOpenEntity}
            />
          </section>

          <section className="wc-page__section">
            <h3 className="wc-page__section-title">
              {messages.entities.detail.attributesTitle}
            </h3>
            <EntityAttributesFields
              fields={type.fields as readonly EntityFieldDefinition[]}
              values={draft.attributes}
              candidates={candidates}
              errors={errors}
              disabled={pending}
              onChange={(key, value) => {
                setDraft((current) => {
                  if (current === null) {
                    return current;
                  }

                  const attributes = { ...current.attributes };

                  if (value === undefined) {
                    delete attributes[key];
                  } else {
                    attributes[key] = value;
                  }

                  return { ...current, attributes };
                });
              }}
            />
          </section>

          <EntityRelationsPanel
            entityId={entityId}
            relations={relations}
            types={relationTypes}
            candidates={candidates}
            state={relationState}
            pending={relationPending}
            onAdd={() => {
              setRelationDialog({ mode: 'create', relation: null });
            }}
            onEdit={(relation) => {
              setRelationDialog({ mode: 'edit', relation });
            }}
            onRemove={removeRelation}
            onManageTypes={() => {
              setRelationTypesOpen(true);
            }}
            onOpenEntity={onOpenEntity}
            onRetry={() => {
              setRelationState('loading');
              setRelationReloadToken((current) => current + 1);
            }}
          />

          <div className="wc-entity-save">
            <Button
              variant="secondary"
              loading={saveState === 'saving'}
              onClick={() => {
                void flush(true);
              }}
            >
              {messages.entities.detail.save}
            </Button>
          </div>
        </div>

        <aside className="wc-entity-side">
          <section className="wc-page__section">
            <h3 className="wc-page__section-title">
              {messages.entities.detail.imageTitle}
            </h3>
            <div className="wc-entity-image">
              {mainAsset !== null ? (
                <img
                  className="wc-entity-image__picture"
                  src={assetUrl(mainAsset.id)}
                  alt={mainAsset.alt ?? ''}
                />
              ) : (
                <p className="wc-entity-image__empty">
                  {messages.entities.detail.imageEmpty}
                </p>
              )}
            </div>
            <div className="wc-entity-image__actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMainPickerOpen(true);
                }}
                disabled={mainAsset === null && assets.length === 0}
              >
                {mainAsset === null
                  ? messages.entities.detail.chooseMain
                  : messages.entities.detail.changeMain}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() => {
                  void importImages();
                }}
              >
                {messages.entities.detail.addImages}
              </Button>
            </div>
          </section>

          <section className="wc-page__section">
            <h3 className="wc-page__section-title">
              {messages.entities.detail.galleryTitle}
            </h3>
            {gallery.length === 0 ? (
              <p className="wc-page__section-lead">
                {messages.entities.detail.galleryEmpty}
              </p>
            ) : (
              <ul className="wc-gallery">
                {gallery.map((asset, index) => (
                  <li className="wc-gallery__item" key={asset.id}>
                    <img
                      className="wc-gallery__thumb"
                      src={assetUrl(asset.id, 'thumb')}
                      alt=""
                      loading="lazy"
                    />
                    <div className="wc-gallery__actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMainImage(asset.id);
                        }}
                        disabled={draft.imageAssetId === asset.id}
                        aria-label={messages.entities.detail.setMainNamed(
                          asset.alt ??
                            messages.entities.detail.imageOption(index + 1),
                        )}
                      >
                        {draft.imageAssetId === asset.id
                          ? messages.entities.detail.mainBadge
                          : messages.entities.detail.setMain}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeImage(asset.id);
                        }}
                        aria-label={messages.entities.detail.removeImageNamed(
                          asset.alt ??
                            messages.entities.detail.imageOption(index + 1),
                        )}
                      >
                        {messages.entities.detail.removeImage}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              size="sm"
              loading={pending}
              onClick={() => {
                void importImages();
              }}
            >
              {messages.entities.detail.addImages}
            </Button>
          </section>

          <section className="wc-page__section">
            <h3 className="wc-page__section-title">
              {messages.entities.detail.tagsTitle}
            </h3>
            {assignedTags.length === 0 ? (
              <p className="wc-page__section-lead">
                {messages.entities.detail.tagsEmpty}
              </p>
            ) : (
              <ul className="wc-tag-list">
                {assignedTags.map((tag) => (
                  <li key={tag.id}>
                    <span className={`wc-tag wc-tag--${tag.color}`}>
                      {tag.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={messages.entities.detail.removeTagNamed(
                        tag.name,
                      )}
                      onClick={() => {
                        setDraft({
                          ...draft,
                          tagIds: draft.tagIds.filter(
                            (tagId) => tagId !== tag.id,
                          ),
                        });
                      }}
                    >
                      <span aria-hidden="true">×</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <SelectField
              label={messages.entities.detail.tagsTitle}
              hint={
                draft.tagIds.length >= ENTITY_TAGS_MAX
                  ? messages.entities.detail.tagsLimit(ENTITY_TAGS_MAX)
                  : undefined
              }
              value=""
              options={[
                { value: '', label: messages.entities.detail.tagsEmpty },
                ...availableTags.map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                })),
              ]}
              disabled={
                availableTags.length === 0 ||
                draft.tagIds.length >= ENTITY_TAGS_MAX
              }
              onChange={(event) => {
                if (event.target.value.length === 0) {
                  return;
                }

                setDraft({
                  ...draft,
                  tagIds: [...draft.tagIds, event.target.value],
                });
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={draft.tagIds.length >= ENTITY_TAGS_MAX}
              onClick={() => {
                setTagKey((current) => current + 1);
                setTagOpen(true);
              }}
            >
              {messages.entities.detail.newTag}
            </Button>
          </section>

          <section className="wc-page__section">
            <SelectField
              label={messages.entities.detail.statusLabel}
              value={draft.status}
              options={[
                { value: 'active', label: messages.entities.status.active },
                { value: 'draft', label: messages.entities.status.draft },
                {
                  value: 'archived',
                  label: messages.entities.status.archived,
                },
              ]}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  status: event.target.value as EntityStatus,
                });
              }}
            />
          </section>
        </aside>
      </div>

      <Dialog
        open={mainPickerOpen}
        onClose={() => {
          setMainPickerOpen(false);
        }}
        title={messages.entities.detail.imageTitle}
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              setMainPickerOpen(false);
            }}
          >
            {messages.entities.tags.cancel}
          </Button>
        }
      >
        {assets.length === 0 ? (
          <p className="wc-dialog__lead">{messages.entities.detail.noImages}</p>
        ) : (
          <ul className="wc-image-picker">
            {assets.map((asset, index) => (
              <li key={asset.id}>
                <button
                  type="button"
                  className="wc-image-picker__item"
                  aria-pressed={draft.imageAssetId === asset.id}
                  aria-label={messages.entities.detail.setMainNamed(
                    asset.alt ??
                      messages.entities.detail.imageOption(index + 1),
                  )}
                  onClick={() => {
                    setMainImage(asset.id);
                    setMainPickerOpen(false);
                  }}
                >
                  <img
                    className="wc-image-picker__thumb"
                    src={assetUrl(asset.id, 'thumb')}
                    alt=""
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <EntityTagDialog
        key={tagKey}
        open={tagOpen}
        worldId={world.id}
        pending={pending}
        onClose={() => {
          setTagOpen(false);
        }}
        onCreate={createTag}
      />

      {relationDialog !== null ? (
        <EntityRelationDialog
          open
          mode={relationDialog.mode}
          worldId={world.id}
          entityId={entityId}
          relation={relationDialog.relation}
          types={relationTypes}
          candidates={candidates}
          pending={relationPending}
          onClose={() => {
            setRelationDialog(null);
          }}
          onSubmit={submitRelation}
        />
      ) : null}

      {relationTypesOpen ? (
        <RelationTypeManager
          open
          worldId={world.id}
          types={relationTypes}
          state={relationTypesState}
          pending={relationPending}
          onClose={() => {
            setRelationTypesOpen(false);
          }}
          onRetry={() => {
            setRelationTypesState('loading');
            setRelationReloadToken((current) => current + 1);
          }}
          onCreate={createRelationType}
          onUpdate={updateRelationType}
          onRemove={removeRelationType}
        />
      ) : null}

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
        title={messages.entities.detail.deleteTitle(entity.name)}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
              }}
              disabled={pending}
            >
              {messages.entities.tags.cancel}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                void deleteEntity();
              }}
            >
              {messages.entities.detail.deleteSubmit}
            </Button>
          </>
        }
      >
        <p>{messages.entities.detail.deleteBody}</p>
      </Dialog>
    </div>
  );
}

function toDraft(entity: EntityDetail): Draft {
  return {
    name: entity.name,
    aliasesText: entity.aliases.join(', '),
    summary: entity.summary ?? '',
    description: entity.description,
    attributes: entity.attributes,
    status: entity.status,
    imageAssetId: entity.imageAssetId,
    galleryAssetIds: entity.gallery.map((item) => item.assetId),
    tagIds: entity.tags.map((tag) => tag.id),
  };
}
