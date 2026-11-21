import { useCallback, useEffect, useRef, useState } from 'react';

import type { EntitySummary, EntityTag } from '../../shared/contracts/entities';
import type { WorldDetail } from '../../shared/contracts/worlds';
import type { EntityTypeSummary } from '../../shared/contracts/entity-types';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { SelectField } from '../components/select-field';
import { TextField } from '../components/text-field';
import { EntityCard } from '../components/entities/entity-card';
import { EntityCreateDialog } from '../components/entities/entity-create-dialog';
import { EntityTypeManager } from '../components/entities/entity-type-manager';
import { Menu } from '../components/menu';
import { useI18n } from '../i18n/provider';

type ListState = 'loading' | 'ready' | 'error';

export interface EntitiesPageProps {
  readonly world: WorldDetail;
  readonly onBack: () => void;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onNotify: (tone: 'success' | 'error', message: string) => void;
}

/**
 * Lista de fichas de un mundo.
 *
 * La búsqueda y los filtros se resuelven en el proceso principal y siempre
 * llevan el `worldId`; la interfaz no mezcla fichas de otros mundos. Las
 * peticiones obsoletas se descartan con un contador para que una respuesta
 * lenta no pise el filtro actual.
 */
export function EntitiesPage({
  world,
  onBack,
  onOpenEntity,
  onNotify,
}: EntitiesPageProps) {
  const { messages } = useI18n();
  const [entities, setEntities] = useState<readonly EntitySummary[]>([]);
  const [types, setTypes] = useState<readonly EntityTypeSummary[]>([]);
  const [tags, setTags] = useState<readonly EntityTag[]>([]);
  const [state, setState] = useState<ListState>('loading');
  const [typesError, setTypesError] = useState(false);
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState('');
  const [tagId, setTagId] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [typesOpen, setTypesOpen] = useState(false);
  const [typesKey, setTypesKey] = useState(0);
  const [pending, setPending] = useState(false);
  const requestRef = useRef(0);

  const loadEntities = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    setState('loading');

    const result = await window.worldCraft.entities.list({
      worldId: world.id,
      filter: {
        ...(search.trim().length === 0 ? {} : { search: search.trim() }),
        ...(typeId.length === 0 ? {} : { typeId }),
        ...(tagId.length === 0 ? {} : { tagId }),
        ...(favorite ? { favorite: true } : {}),
        ...(status.length === 0
          ? {}
          : { status: status as EntitySummary['status'] }),
      },
    });

    if (request !== requestRef.current) {
      return;
    }

    if (result.ok) {
      setEntities(result.data);
      setState('ready');
    } else {
      setState('error');
    }
  }, [favorite, search, status, tagId, typeId, world.id]);

  const loadTypes = useCallback(async () => {
    const result = await window.worldCraft.entityTypes.list(world.id);

    if (result.ok) {
      setTypes(result.data);
      setTypesError(false);
    } else {
      setTypesError(true);
    }
  }, [world.id]);

  const loadTags = useCallback(async () => {
    const result = await window.worldCraft.tags.list(world.id);

    if (result.ok) {
      setTags(result.data);
    }
  }, [world.id]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      window.worldCraft.entityTypes.list(world.id),
      window.worldCraft.tags.list(world.id),
    ]).then(([typeResult, tagResult]) => {
      if (!active) {
        return;
      }

      if (typeResult.ok) {
        setTypes(typeResult.data);
        setTypesError(false);
      } else {
        setTypesError(true);
      }

      if (tagResult.ok) {
        setTags(tagResult.data);
      }
    });

    return () => {
      active = false;
    };
  }, [world.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEntities();
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadEntities]);

  const toggleFavorite = async (entity: EntitySummary): Promise<void> => {
    const result = await window.worldCraft.entities.setFavorite({
      worldId: world.id,
      id: entity.id,
      favorite: !entity.isFavorite,
    });

    if (!result.ok || result.data === null) {
      onNotify('error', messages.entities.notices.failed);
      return;
    }

    setEntities((current) => {
      const next = !entity.isFavorite;

      // Con el filtro de favoritas activo, quitar una ficha la saca de la
      // lista sin esperar a otra consulta.
      return favorite && !next
        ? current.filter((entry) => entry.id !== entity.id)
        : current.map((entry) =>
            entry.id === entity.id ? (result.data ?? entry) : entry,
          );
    });

    onNotify(
      'success',
      entity.isFavorite
        ? messages.entities.notices.unfavorite(entity.name)
        : messages.entities.notices.favorite(entity.name),
    );
  };

  const createEntity = async (input: {
    readonly worldId: string;
    readonly typeId: string;
    readonly name: string;
    readonly summary?: string | null | undefined;
  }): Promise<boolean> => {
    if (pending) {
      return false;
    }

    setPending(true);
    const result = await window.worldCraft.entities.create(input);
    setPending(false);

    if (!result.ok) {
      onNotify('error', messages.entities.notices.invalid);
      return false;
    }

    setCreateOpen(false);
    onNotify('success', messages.entities.notices.created(result.data.name));
    await loadEntities();
    onOpenEntity(result.data.id);
    return true;
  };

  const clearFilters = (): void => {
    setSearch('');
    setTypeId('');
    setTagId('');
    setFavorite(false);
    setStatus('');
  };

  const hasFilters =
    search.trim().length > 0 ||
    typeId.length > 0 ||
    tagId.length > 0 ||
    favorite ||
    status.length > 0;
  const empty = state === 'ready' && entities.length === 0;

  // Con el estado vacío sin filtros, la primaria es la del propio estado
  // vacío. La cabecera retira su botón para no duplicar la acción ni el nombre
  // accesible; con filtros activos sí lo conserva porque el vacío solo ofrece
  // «Quitar filtros» como secundaria.
  const showHeaderCreate = !empty || hasFilters;

  return (
    <div className="wc-page wc-page--entities">
      <div className="wc-page__header">
        <Button variant="ghost" onClick={onBack}>
          {messages.entities.list.backToWorld}
        </Button>
        <div className="wc-entity-toolbar">
          {showHeaderCreate ? (
            <Button
              onClick={() => {
                setCreateKey((current) => current + 1);
                setCreateOpen(true);
              }}
              disabled={types.length === 0}
            >
              {messages.entities.list.create}
            </Button>
          ) : null}
          <Menu
            label={messages.entities.list.menuLabel}
            triggerTooltip={messages.entities.list.menuLabel}
            align="end"
            items={[
              {
                id: 'manage-types',
                label: messages.entities.list.manageTypes,
                onSelect: () => {
                  setTypesKey((current) => current + 1);
                  setTypesOpen(true);
                },
              },
            ]}
          />
        </div>
      </div>

      <header className="wc-page__intro">
        <h2 className="wc-page__title">{messages.entities.list.title}</h2>
        <p className="wc-page__lead">{messages.entities.list.lead}</p>
        <p className="wc-page__section-lead">{world.name}</p>
      </header>

      {typesError ? (
        <p className="wc-alert" role="alert">
          {messages.entities.list.typesError}
        </p>
      ) : null}

      <section
        className="wc-filters"
        aria-label={messages.entities.list.filtersLabel}
      >
        <TextField
          label={messages.entities.list.searchLabel}
          type="search"
          placeholder={messages.entities.list.searchPlaceholder}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <SelectField
          label={messages.entities.list.typeLabel}
          value={typeId}
          onChange={(event) => {
            setTypeId(event.target.value);
          }}
          options={[
            { value: '', label: messages.entities.list.typeAll },
            ...types.map((type) => ({ value: type.id, label: type.name })),
          ]}
        />
        <SelectField
          label={messages.entities.list.tagLabel}
          value={tagId}
          onChange={(event) => {
            setTagId(event.target.value);
          }}
          options={[
            { value: '', label: messages.entities.list.tagAll },
            ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
          ]}
        />
        <SelectField
          label={messages.entities.list.statusLabel}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
          }}
          options={[
            { value: '', label: messages.entities.statusFilter.all },
            { value: 'active', label: messages.entities.statusFilter.active },
            { value: 'draft', label: messages.entities.statusFilter.draft },
            {
              value: 'archived',
              label: messages.entities.statusFilter.archived,
            },
          ]}
        />
        <label className="wc-check wc-check--inline">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(event) => {
              setFavorite(event.target.checked);
            }}
          />
          <span>{messages.entities.list.favoriteLabel}</span>
        </label>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {messages.entities.list.clearFilters}
          </Button>
        ) : null}
      </section>

      {state === 'loading' ? (
        <p className="wc-page__status" role="status">
          {messages.entities.list.loading}
        </p>
      ) : null}

      {state === 'error' ? (
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">
            {messages.entities.list.errorTitle}
          </h2>
          <p>{messages.entities.list.errorDescription}</p>
          <div className="wc-alert__actions">
            <Button
              variant="secondary"
              onClick={() => {
                void loadEntities();
              }}
            >
              {messages.entities.list.retry}
            </Button>
          </div>
        </section>
      ) : null}

      {state === 'ready' && entities.length > 0 ? (
        <>
          <p className="wc-page__section-lead">
            <Badge tone="neutral">
              {messages.entities.list.count(entities.length)}
            </Badge>
          </p>
          <ul className="wc-entity-grid">
            {entities.map((entity) => (
              <li key={entity.id}>
                <EntityCard
                  entity={entity}
                  onOpen={(selected) => {
                    onOpenEntity(selected.id);
                  }}
                  onToggleFavorite={(selected) => {
                    void toggleFavorite(selected);
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {empty ? (
        <EmptyState
          title={
            hasFilters
              ? messages.entities.list.emptyFilterTitle
              : messages.entities.list.emptyTitle
          }
          description={
            hasFilters
              ? messages.entities.list.emptyFilterDescription
              : messages.entities.list.emptyDescription
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                {messages.entities.list.clearFilters}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setCreateKey((current) => current + 1);
                  setCreateOpen(true);
                }}
                disabled={types.length === 0}
              >
                {messages.entities.list.create}
              </Button>
            )
          }
        />
      ) : null}

      <EntityCreateDialog
        key={createKey}
        open={createOpen}
        worldId={world.id}
        types={types}
        pending={pending}
        onClose={() => {
          setCreateOpen(false);
        }}
        onSubmit={createEntity}
      />

      <EntityTypeManager
        key={typesKey}
        open={typesOpen}
        worldId={world.id}
        types={types}
        onClose={() => {
          setTypesOpen(false);
        }}
        onChanged={async () => {
          await Promise.all([loadTypes(), loadTags(), loadEntities()]);
        }}
        onNotify={onNotify}
      />
    </div>
  );
}
