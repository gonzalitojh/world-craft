import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  ENTITY_ALIAS_MAX_LENGTH,
  ENTITY_ALIASES_MAX,
  ENTITY_GALLERY_MAX,
  ENTITY_TAGS_MAX,
  type EntityDetail,
  type EntityRichTextDocument,
  type EntityStatus,
  type EntitySummary,
  type EntityTag,
  type EntityUpdateInput,
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
import type { EntityTypeSummary } from '../../shared/contracts/entity-types';
import {
  validateEntityFieldValues,
  type EntityFieldValue,
} from '../../shared/entity-types/fields';
import {
  extractEntityDescriptionText,
  validateEntityDescription,
} from '../../shared/entities/description';
import { Button } from '../components/button';
import { Dialog } from '../components/dialog';
import { IconButton } from '../components/icon-button';
import { Skeleton, SkeletonText } from '../components/skeleton';
import { DisclosureSection } from '../components/disclosure-section';
import { EntityAttributesFields } from '../components/entities/entity-attributes-fields';
import { EntityAttributesView } from '../components/entities/entity-attributes-view';
import { EntityDescriptionEditor } from '../components/entities/entity-description-editor';
import {
  EntityDocumentHeader,
  type DocumentMode,
  type SaveState,
} from '../components/entities/entity-document-header';
import { EntityPropertiesPanel } from '../components/entities/entity-properties-panel';
import { EntityRelationDialog } from '../components/entities/entity-relation-dialog';
import {
  EntityRelationsActions,
  EntityRelationsPanel,
} from '../components/entities/entity-relations-panel';
import { EntityResourcesSection } from '../components/entities/entity-resources-section';
import { EntityTagDialog } from '../components/entities/entity-tag-dialog';
import { RelationTypeManager } from '../components/entities/relation-type-manager';
import { useI18n } from '../i18n/provider';
import { assetUrl } from '../lib/asset-url';
import {
  PROPERTIES_WIDTH_DEFAULT,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  clampPropertiesWidth,
  type EntitySectionId,
  type EntityViewPatch,
  type EntityViewPreferences,
} from '../lib/entity-view-memory';

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

type FocusTarget =
  | 'name'
  | 'description'
  | 'attributes'
  | 'edit-trigger'
  | 'alert'
  | 'add-images'
  | 'add-relation';

interface FocusRequest {
  readonly target: FocusTarget;
  readonly token: number;
  readonly onlyIfFocusLost: boolean;
  readonly previousActive: HTMLElement | null;
}

interface ValidationFailure {
  readonly ok: false;
  readonly errors: Readonly<Record<string, string>>;
  readonly sections: readonly EntitySectionId[];
  readonly firstTarget: FocusTarget;
}

type ValidationResult =
  { readonly ok: true; readonly input: EntityUpdateInput } | ValidationFailure;

type FlushOutcome =
  | { readonly status: 'saved'; readonly stale: boolean }
  | { readonly status: 'invalid'; readonly failure: ValidationFailure }
  | { readonly status: 'error' };

interface FlushOptions {
  readonly showState: boolean;
  readonly explicit: boolean;
  /** En desmontaje no se toca estado ni se mueve el foco. */
  readonly silent?: boolean;
}

export interface EntityDetailPageProps {
  readonly world: WorldDetail;
  readonly entityId: string;
  readonly onBack: () => void;
  readonly onOpenEntity: (entityId: string) => void;
  /** Avisa del nombre cargado para completar el destino de Inicio. */
  readonly onEntityLoaded?: (entity: {
    readonly id: string;
    readonly name: string;
  }) => void;
  /** Avisa del borrado para limpiar un destino «Continuar» obsoleto. */
  readonly onEntityRemoved?: (entityId: string) => void;
  /** Estado persistido del panel y las secciones, controlado desde `App`. */
  readonly entityView: EntityViewPreferences;
  /** Consumidores del estado; solo se emiten commits explícitos. */
  readonly onEntityViewChange: (patch: EntityViewPatch) => void;
  readonly onNotify: (tone: 'success' | 'error', message: string) => void;
}

function PanelIcon() {
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
      <path d="M12.5 4v12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Detalle de una ficha como documento vivo.
 *
 * Lectura por defecto y un único modo de edición de página. El contenido se
 * autoguarda con una cola serializada; el panel de propiedades solo edita
 * portada, estado y etiquetas. Las secciones conservan su estado de plegado en
 * la memoria de sesión y los errores abren la sección afectada antes de mover
 * el foco.
 */
export function EntityDetailPage({
  world,
  entityId,
  onBack,
  onOpenEntity,
  onEntityLoaded,
  onEntityRemoved,
  entityView,
  onEntityViewChange,
  onNotify,
}: EntityDetailPageProps) {
  const { messages, formats } = useI18n();
  const nameId = useId();
  const propertiesTitleId = useId();

  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [types, setTypes] = useState<readonly EntityTypeSummary[]>([]);
  const [tags, setTags] = useState<readonly EntityTag[]>([]);
  const [assets, setAssets] = useState<readonly AssetSummary[]>([]);
  const [candidates, setCandidates] = useState<readonly EntitySummary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mode, setMode] = useState<DocumentMode>('read');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [alertKind, setAlertKind] = useState<'invalid' | 'save' | null>(null);
  const [pending, setPending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagKey, setTagKey] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
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
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const draftRef = useRef<Draft | null>(null);
  const typeRef = useRef<EntityTypeSummary | null>(null);
  const modeRef = useRef<DocumentMode>('read');
  const skipAutosave = useRef(false);
  const requestRef = useRef(0);
  const relationRequestRef = useRef(0);
  const revisionRef = useRef(0);
  const focusTokenRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const flushRef = useRef<(options: FlushOptions) => Promise<FlushOutcome>>(
    async () => ({ status: 'error' }),
  );
  const mountedRef = useRef(true);
  const dragRef = useRef<{
    readonly startX: number;
    readonly startWidth: number;
    readonly pointerId: number;
  } | null>(null);

  const type = types.find((entry) => entry.id === entity?.typeId) ?? null;
  const propertiesOpen = entityView.propertiesOpen;
  const propertiesWidth = dragWidth ?? entityView.propertiesWidth;

  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (entity !== null) {
      onEntityLoaded?.({ id: entity.id, name: entity.name });
    }
  }, [entity, onEntityLoaded]);

  const commitMemory = useCallback(
    (patch: EntityViewPatch) => {
      onEntityViewChange(patch);
    },
    [onEntityViewChange],
  );

  const ensureSectionOpen = useCallback(
    (section: EntitySectionId) => {
      commitMemory({ sections: { [section]: true } });
    },
    [commitMemory],
  );

  const requestFocus = useCallback(
    (
      target: FocusTarget,
      options: {
        readonly onlyIfFocusLost?: boolean;
        readonly previousActive?: HTMLElement | null;
      } = {},
    ) => {
      focusTokenRef.current += 1;
      setFocusRequest({
        target,
        token: focusTokenRef.current,
        onlyIfFocusLost: options.onlyIfFocusLost ?? false,
        previousActive: options.previousActive ?? null,
      });
    },
    [],
  );

  useEffect(() => {
    if (focusRequest === null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (focusRequest.onlyIfFocusLost) {
        const previous = focusRequest.previousActive;
        const lost =
          previous === null ||
          previous === document.body ||
          !document.contains(previous) ||
          document.activeElement === document.body;

        if (!lost) {
          setFocusRequest(null);
          return;
        }
      }

      let element: HTMLElement | null = null;

      switch (focusRequest.target) {
        case 'name':
          element = document.getElementById(nameId);
          break;
        case 'description':
          element = document.querySelector<HTMLElement>(
            '[data-section="description"] .wc-editor__content',
          );
          break;
        case 'attributes': {
          const invalid = document.querySelector<HTMLElement>(
            '[data-section="attributes"] [aria-invalid="true"]',
          );
          const controls = document.querySelectorAll<HTMLElement>(
            '[data-section="attributes"] .wc-form-grid input, [data-section="attributes"] .wc-form-grid select, [data-section="attributes"] .wc-form-grid textarea',
          );
          element =
            invalid ??
            [...controls].find(
              (control) =>
                !(control as HTMLInputElement | HTMLSelectElement).disabled,
            ) ??
            null;
          break;
        }
        case 'edit-trigger':
          element = document.getElementById('wc-entity-edit-trigger');
          break;
        case 'alert':
          element = document.getElementById('wc-entity-save-alert');
          break;
        case 'add-images':
          element = document.getElementById('wc-entity-add-images');
          break;
        case 'add-relation':
          element = document.getElementById('wc-entity-add-relation');
          break;
      }

      if (element !== null) {
        element.focus();

        if (
          focusRequest.target === 'name' &&
          element instanceof HTMLInputElement
        ) {
          const end = element.value.length;
          element.setSelectionRange(end, end);
        }
      }

      setFocusRequest(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusRequest, nameId]);

  const validateDraft = useCallback((): ValidationResult => {
    const current = draftRef.current;
    const currentType = typeRef.current;

    if (current === null || currentType === null) {
      return {
        ok: false,
        errors: {},
        sections: [],
        firstTarget: 'alert',
      };
    }

    const nextErrors: Record<string, string> = {};
    const affected = new Set<EntitySectionId>();
    let firstTarget: FocusTarget | null = null;

    if (current.name.trim().length === 0) {
      nextErrors.name = messages.components.form.requiredField;
      firstTarget = 'name';
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

      affected.add('attributes');

      if (firstTarget === null) {
        firstTarget = 'attributes';
      }
    }

    const description = validateEntityDescription(current.description);

    if (!description.ok) {
      nextErrors.description = messages.entities.detail.invalid;
      affected.add('description');
      firstTarget ??= 'description';
    }

    if (Object.keys(nextErrors).length > 0 || !values.ok || !description.ok) {
      return {
        ok: false,
        errors: nextErrors,
        sections: [...affected],
        firstTarget: firstTarget ?? 'alert',
      };
    }

    const aliases = current.aliasesText
      .split(',')
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0)
      .slice(0, ENTITY_ALIASES_MAX)
      .map((alias) => alias.slice(0, ENTITY_ALIAS_MAX_LENGTH));

    return {
      ok: true,
      input: {
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
      },
    };
  }, [entityId, messages, world.id]);

  const applyValidationFailure = useCallback(
    (failure: ValidationFailure, explicit: boolean) => {
      const previousActive =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      setErrors(failure.errors);
      setAlertKind('invalid');
      setSaveState('dirty');
      setMode('edit');
      modeRef.current = 'edit';

      for (const section of failure.sections) {
        ensureSectionOpen(section);
      }

      requestFocus(failure.firstTarget, {
        onlyIfFocusLost: !explicit,
        previousActive,
      });
    },
    [ensureSectionOpen, requestFocus],
  );

  const flush = useCallback(
    async (options: FlushOptions): Promise<FlushOutcome> => {
      const validation = validateDraft();

      if (!validation.ok) {
        if (!options.silent && mountedRef.current) {
          applyValidationFailure(validation, options.explicit);
        }

        return { status: 'invalid', failure: validation };
      }

      const revision = revisionRef.current;
      const input = validation.input;

      if (mountedRef.current && !options.silent) {
        setErrors({});
        setAlertKind((current) => (current === 'invalid' ? null : current));
      }

      const run = async (): Promise<'saved' | 'error'> => {
        if (options.showState && mountedRef.current && !options.silent) {
          setSaveState('saving');
        }

        const result = await window.worldCraft.entities.update(input);

        if (!result.ok || result.data === null) {
          if (mountedRef.current && !options.silent) {
            setSaveState('error');
            setAlertKind('save');

            if (options.explicit) {
              requestFocus('alert');
            }
          }

          return 'error';
        }

        if (mountedRef.current && !options.silent) {
          setEntity(result.data);
          const stale = revisionRef.current !== revision;
          setSaveState(stale ? 'dirty' : 'saved');

          if (!stale) {
            setAlertKind(null);
          }
        }

        return 'saved';
      };

      const queued = saveQueueRef.current.then(run, run);
      saveQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      const status = await queued;

      return status === 'saved'
        ? { status: 'saved', stale: revisionRef.current !== revision }
        : { status: 'error' };
    },
    [applyValidationFailure, requestFocus, validateDraft],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      document.body.classList.remove('wc-is-resizing');
      void flushRef.current({
        showState: false,
        explicit: false,
        silent: true,
      });
    };
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    const request = requestRef.current;
    relationRequestRef.current += 1;

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
          setErrors({});
          setAlertKind(null);
          setMode('read');
          modeRef.current = 'read';
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
  }, [entityId, reloadToken, world.id]);

  // Reintento aislado de relaciones y tipos de relación: no vuelve a pedir la
  // ficha ni reemplaza el borrador, de modo que un fallo de carga de relaciones
  // no descarta cambios sin guardar. El valor inicial 0 ya lo cubre la carga
  // principal.
  useEffect(() => {
    if (relationReloadToken === 0) {
      return;
    }

    relationRequestRef.current += 1;
    const request = relationRequestRef.current;

    void Promise.all([
      window.worldCraft.relationTypes.list(world.id),
      window.worldCraft.relations.list({
        worldId: world.id,
        filter: { entityId },
      }),
    ]).then(([relationTypeList, relationList]) => {
      if (request !== relationRequestRef.current) {
        return;
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
    });
  }, [entityId, relationReloadToken, world.id]);

  useEffect(() => {
    draftRef.current = draft;

    if (draft === null) {
      return;
    }

    revisionRef.current += 1;

    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }

    setSaveState('dirty');
    const timer = window.setTimeout(() => {
      void flushRef.current({ showState: true, explicit: false });
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        (event.key !== 's' && event.key !== 'S')
      ) {
        return;
      }

      // Siempre se evita el diálogo de «guardar página» de Electron.
      event.preventDefault();

      if (modeRef.current !== 'edit') {
        return;
      }

      if (document.querySelector('dialog[open]') !== null) {
        return;
      }

      void flushRef.current({ showState: true, explicit: true });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const enterEdit = useCallback(
    (target: FocusTarget) => {
      setMode('edit');
      modeRef.current = 'edit';

      if (target === 'description') {
        ensureSectionOpen('description');
      }

      if (target === 'attributes') {
        ensureSectionOpen('attributes');
      }

      requestFocus(target);
    },
    [ensureSectionOpen, requestFocus],
  );

  const handleDone = async (): Promise<void> => {
    let outcome = await flush({ showState: true, explicit: true });
    let guard = 0;

    while (outcome.status === 'saved' && outcome.stale && guard < 5) {
      outcome = await flush({ showState: true, explicit: true });
      guard += 1;
    }

    if (outcome.status === 'saved') {
      setMode('read');
      modeRef.current = 'read';
      requestFocus('edit-trigger');
    }
  };

  const toggleFavorite = async (): Promise<void> => {
    if (entity === null || favoritePending) {
      return;
    }

    setFavoritePending(true);
    const result = await window.worldCraft.entities.setFavorite({
      worldId: world.id,
      id: entity.id,
      favorite: !entity.isFavorite,
    });
    setFavoritePending(false);

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

    ensureSectionOpen('resources');
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
    requestFocus('add-relation');
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
    onEntityRemoved?.(entityId);
    onNotify('success', messages.entities.notices.removed(entity?.name ?? ''));
    onBack();
  };

  const commitWidth = (value: number): void => {
    const width = clampPropertiesWidth(value);
    setDragWidth(null);
    commitMemory({ propertiesWidth: width });
  };

  const handleResizerKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && dragRef.current !== null) {
      event.preventDefault();
      dragRef.current = null;
      setDragWidth(null);
      document.body.classList.remove('wc-is-resizing');
      return;
    }

    let next: number | null = null;

    if (event.key === 'ArrowLeft') {
      next = propertiesWidth - 16;
    } else if (event.key === 'ArrowRight') {
      next = propertiesWidth + 16;
    } else if (event.key === 'Home') {
      next = PROPERTIES_WIDTH_MIN;
    } else if (event.key === 'End') {
      next = PROPERTIES_WIDTH_MAX;
    }

    if (next === null) {
      return;
    }

    event.preventDefault();
    commitWidth(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }

    // El foco explícito permite que Escape cancele el arrastre también cuando
    // se empieza con el ratón; `preventDefault` evita que el navegador lo
    // coloque después de iniciar la captura.
    event.currentTarget.focus();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startWidth: propertiesWidth,
      pointerId: event.pointerId,
    };
    setDragWidth(propertiesWidth);
    document.body.classList.add('wc-is-resizing');
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;

    if (drag === null) {
      return;
    }

    setDragWidth(
      clampPropertiesWidth(drag.startWidth + event.clientX - drag.startX),
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;

    if (drag === null) {
      return;
    }

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }

    document.body.classList.remove('wc-is-resizing');
    commitWidth(drag.startWidth + event.clientX - drag.startX);
  };

  const handlePointerCancel = (): void => {
    dragRef.current = null;
    setDragWidth(null);
    document.body.classList.remove('wc-is-resizing');
  };

  if (state === 'loading') {
    return (
      <div className="wc-page wc-page--entity">
        <div className="wc-page__header wc-entity-pagebar">
          <Button variant="ghost" onClick={onBack}>
            {messages.entities.detail.back}
          </Button>
        </div>
        <div className="wc-entity-doc wc-entity-doc--loading" aria-busy="true">
          <div className="wc-entity-doc__main">
            <p className="wc-visually-hidden" role="status">
              {messages.entities.detail.loading}
            </p>
            <div className="wc-document-header wc-document-header--skeleton">
              <Skeleton width="8rem" height="1.25rem" />
              <Skeleton width="70%" height="2.25rem" />
              <SkeletonText lines={3} />
              <Skeleton width="40%" height="1rem" />
            </div>
            <div className="wc-disclosure wc-disclosure--skeleton">
              <Skeleton width="30%" height="1.5rem" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error' || entity === null || draft === null || type === null) {
    return (
      <div className="wc-page wc-page--entity">
        <div className="wc-page__header wc-entity-pagebar">
          <Button variant="ghost" onClick={onBack}>
            {messages.entities.detail.back}
          </Button>
        </div>
        <section
          className="wc-alert wc-alert--inline"
          role="alert"
          tabIndex={-1}
        >
          <h2 className="wc-alert__title">
            {messages.entities.detail.errorTitle}
          </h2>
          <p>{messages.entities.detail.errorDescription}</p>
          <div className="wc-alert__actions">
            <Button
              variant="secondary"
              onClick={() => {
                setState('loading');
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
  const descriptionText =
    draft.description === null
      ? ''
      : extractEntityDescriptionText(draft.description);
  const descriptionEmpty = descriptionText.trim().length === 0;
  const descriptionWords = descriptionEmpty
    ? 0
    : descriptionText.trim().split(/\s+/).length;
  const tagsLimitReached = draft.tagIds.length >= ENTITY_TAGS_MAX;
  const fields = type.fields;
  const propertiesWidthLabel = messages.entities.detail.propertiesWidth(
    formats.formatNumber(propertiesWidth),
  );

  return (
    <div className="wc-page wc-page--entity" data-mode={mode}>
      <div className="wc-page__header wc-entity-pagebar">
        <Button variant="ghost" onClick={onBack}>
          {messages.entities.detail.back}
        </Button>
        <IconButton
          className="wc-entity-pagebar__toggle"
          label={
            propertiesOpen
              ? messages.entities.detail.propertiesHide
              : messages.entities.detail.propertiesShow
          }
          tooltip={
            propertiesOpen
              ? messages.entities.detail.propertiesHide
              : messages.entities.detail.propertiesShow
          }
          icon={<PanelIcon />}
          variant={propertiesOpen ? 'secondary' : 'ghost'}
          aria-expanded={propertiesOpen}
          aria-controls="wc-entity-properties"
          onClick={() => {
            commitMemory({ propertiesOpen: !propertiesOpen });
          }}
        />
      </div>

      <div
        className="wc-entity-doc"
        data-properties={propertiesOpen ? 'open' : 'closed'}
        style={
          {
            '--wc-properties-width': `${propertiesWidth}px`,
          } as CSSProperties
        }
      >
        <div className="wc-entity-doc__main">
          <EntityDocumentHeader
            entity={entity}
            type={type}
            mode={mode}
            saveState={saveState}
            name={draft.name}
            aliasesText={draft.aliasesText}
            summary={draft.summary}
            status={draft.status}
            nameError={errors.name}
            favoritePending={favoritePending}
            nameId={nameId}
            onEdit={() => {
              enterEdit('name');
            }}
            onDone={() => {
              void handleDone();
            }}
            onSaveNow={() => {
              void flush({ showState: true, explicit: true });
            }}
            onToggleFavorite={() => {
              void toggleFavorite();
            }}
            onDelete={() => {
              setDeleteOpen(true);
            }}
            onChangeName={(value) => {
              setDraft((current) =>
                current === null ? current : { ...current, name: value },
              );
            }}
            onChangeAliases={(value) => {
              setDraft((current) =>
                current === null ? current : { ...current, aliasesText: value },
              );
            }}
            onChangeSummary={(value) => {
              setDraft((current) =>
                current === null ? current : { ...current, summary: value },
              );
            }}
          />

          {alertKind === null ? null : (
            <div
              className="wc-alert wc-alert--inline"
              role="alert"
              tabIndex={-1}
              id="wc-entity-save-alert"
            >
              <p>
                {alertKind === 'invalid'
                  ? messages.entities.detail.invalid
                  : messages.entities.detail.saveError}
              </p>
              {alertKind === 'save' ? (
                <div className="wc-alert__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void flush({ showState: true, explicit: true });
                    }}
                  >
                    {messages.entities.detail.retry}
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          <DisclosureSection
            id="wc-entity-section-description"
            title={messages.entities.detail.descriptionLabel}
            open={entityView.sections.description}
            onToggle={(open) => {
              commitMemory({ sections: { description: open } });
            }}
            meta={messages.entities.detail.descriptionMeta(descriptionWords)}
            actions={
              mode === 'read' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    enterEdit('description');
                  }}
                >
                  {descriptionEmpty
                    ? messages.entities.detail.addDescription
                    : messages.entities.detail.editDescription}
                </Button>
              ) : undefined
            }
          >
            {descriptionEmpty && mode === 'read' ? (
              <p className="wc-entity-description__empty">
                {messages.entities.detail.descriptionEmpty}
              </p>
            ) : (
              <>
                <EntityDescriptionEditor
                  document={draft.description}
                  candidates={candidates}
                  disabled={pending}
                  readOnly={mode === 'read'}
                  onChange={(description) => {
                    setDraft((current) => {
                      if (current === null) {
                        return current;
                      }

                      // Tiptap puede emitir un documento vacío al montarse.
                      // Se normaliza a `null` y solo se marca el borrador
                      // cuando el contenido cambia de verdad.
                      const nextDescription =
                        description === null ||
                        extractEntityDescriptionText(description).trim()
                          .length === 0
                          ? null
                          : description;

                      if (
                        JSON.stringify(current.description) ===
                        JSON.stringify(nextDescription)
                      ) {
                        return current;
                      }

                      return { ...current, description: nextDescription };
                    });
                  }}
                  onOpenEntity={onOpenEntity}
                />
                {mode === 'edit' && errors.description !== undefined ? (
                  <p className="wc-field__error" role="alert">
                    {errors.description}
                  </p>
                ) : null}
              </>
            )}
          </DisclosureSection>

          <DisclosureSection
            id="wc-entity-section-attributes"
            title={messages.entities.detail.attributesTitle}
            open={entityView.sections.attributes}
            onToggle={(open) => {
              commitMemory({ sections: { attributes: open } });
            }}
            meta={
              fields.length === 0
                ? undefined
                : messages.entities.detail.fieldsMeta(fields.length)
            }
            actions={
              mode === 'read' && fields.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    enterEdit('attributes');
                  }}
                >
                  {messages.entities.detail.editFields}
                </Button>
              ) : undefined
            }
          >
            {fields.length === 0 ? (
              <p className="wc-page__section-lead">
                {messages.entities.detail.attributesEmpty}
              </p>
            ) : mode === 'read' ? (
              <EntityAttributesView
                fields={fields}
                values={draft.attributes}
                candidates={candidates}
                onOpenEntity={onOpenEntity}
              />
            ) : (
              <EntityAttributesFields
                fields={fields}
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
            )}
          </DisclosureSection>

          <DisclosureSection
            id="wc-entity-section-relations"
            title={messages.entities.relations.title}
            open={entityView.sections.relations}
            onToggle={(open) => {
              commitMemory({ sections: { relations: open } });
            }}
            meta={messages.entities.detail.relationsMeta(relations.length)}
            actions={
              <EntityRelationsActions
                onAdd={() => {
                  ensureSectionOpen('relations');
                  setRelationDialog({ mode: 'create', relation: null });
                }}
                onManageTypes={() => {
                  setRelationTypesOpen(true);
                }}
                addDisabled={
                  relationTypes.length === 0 || candidates.length === 0
                }
              />
            }
          >
            <EntityRelationsPanel
              entityId={entityId}
              relations={relations}
              state={relationState}
              pending={relationPending}
              editingRelationId={
                relationDialog?.mode === 'edit'
                  ? (relationDialog.relation?.id ?? null)
                  : null
              }
              onEdit={(relation) => {
                setRelationDialog({ mode: 'edit', relation });
              }}
              onRemove={removeRelation}
              onOpenEntity={onOpenEntity}
              onRetry={() => {
                setRelationState('loading');
                setRelationReloadToken((current) => current + 1);
              }}
            />
          </DisclosureSection>

          <DisclosureSection
            id="wc-entity-section-resources"
            title={messages.entities.detail.resourcesTitle}
            open={entityView.sections.resources}
            onToggle={(open) => {
              commitMemory({ sections: { resources: open } });
            }}
            meta={messages.entities.detail.resourcesMeta(gallery.length)}
            actions={
              <Button
                id="wc-entity-add-images"
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={() => {
                  void importImages();
                }}
              >
                {messages.entities.detail.addImages}
              </Button>
            }
          >
            <EntityResourcesSection
              mainAssetId={draft.imageAssetId}
              gallery={gallery}
              pending={pending}
              onRemoveImage={removeImage}
            />
          </DisclosureSection>
        </div>

        <div
          className="wc-properties-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-controls="wc-entity-properties"
          aria-label={messages.entities.detail.propertiesResize}
          aria-valuemin={PROPERTIES_WIDTH_MIN}
          aria-valuemax={PROPERTIES_WIDTH_MAX}
          aria-valuenow={propertiesWidth}
          aria-valuetext={propertiesWidthLabel}
          tabIndex={0}
          onKeyDown={handleResizerKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onDoubleClick={() => {
            commitWidth(PROPERTIES_WIDTH_DEFAULT);
          }}
        >
          <span className="wc-properties-resizer__pill" aria-hidden="true" />
        </div>

        <EntityPropertiesPanel
          headingId={propertiesTitleId}
          mainAsset={mainAsset}
          hasAssets={assets.length > 0}
          status={draft.status}
          assignedTags={assignedTags}
          availableTags={availableTags}
          tagsLimitReached={tagsLimitReached}
          pending={pending}
          onChangeStatus={(status) => {
            setDraft((current) =>
              current === null ? current : { ...current, status },
            );
          }}
          onChooseCover={() => {
            setCoverPickerOpen(true);
          }}
          onAddTag={(tagId) => {
            setDraft((current) =>
              current === null || current.tagIds.includes(tagId)
                ? current
                : { ...current, tagIds: [...current.tagIds, tagId] },
            );
          }}
          onRemoveTag={(tagId) => {
            setDraft((current) =>
              current === null
                ? current
                : {
                    ...current,
                    tagIds: current.tagIds.filter((entry) => entry !== tagId),
                  },
            );
          }}
          onCreateTag={() => {
            setTagKey((current) => current + 1);
            setTagOpen(true);
          }}
          onGoToResources={() => {
            ensureSectionOpen('resources');
            requestFocus('add-images');
          }}
        />
      </div>

      <Dialog
        open={coverPickerOpen}
        onClose={() => {
          setCoverPickerOpen(false);
        }}
        title={messages.entities.detail.coverPickerTitle}
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              setCoverPickerOpen(false);
            }}
          >
            {messages.entities.detail.close}
          </Button>
        }
      >
        <p className="wc-dialog__lead">
          {messages.entities.detail.coverPickerLead}
        </p>
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
                  aria-label={messages.entities.detail.coverOption(index + 1)}
                  onClick={() => {
                    setMainImage(asset.id);
                    setCoverPickerOpen(false);
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
            const wasCreate = relationDialog.mode === 'create';
            setRelationDialog(null);

            if (wasCreate) {
              requestFocus('add-relation');
            }
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
