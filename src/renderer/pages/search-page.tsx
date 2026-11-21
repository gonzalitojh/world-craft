import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import type { WorldSummary } from '../../shared/contracts/worlds';
import type { EntityTypeSummary } from '../../shared/contracts/entity-types';
import type { EntityTag } from '../../shared/contracts/entities';
import type {
  SearchFilters,
  SearchHit,
  SearchResponse,
  SearchSuggestions,
} from '../../shared/contracts/search';
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_STATUSES,
} from '../../shared/contracts/search';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { SelectField } from '../components/select-field';
import { TextField } from '../components/text-field';
import { SearchHighlight } from '../components/search/search-highlight';
import { SearchKindIcon } from '../components/search/search-kind-icon';
import { useI18n } from '../i18n/provider';

type PageState = 'idle' | 'loading' | 'ready' | 'error';

export interface SearchPageProps {
  readonly worlds: readonly WorldSummary[];
  readonly initialQuery: string;
  readonly onOpenHit: (hit: SearchHit) => void;
}

/**
 * Página de búsqueda global.
 *
 * La consulta y los filtros se resuelven en el proceso principal; aquí solo se
 * compone el estado de la interfaz. Las peticiones obsoletas se descartan con
 * un contador para que una respuesta lenta no pise una consulta más reciente.
 */
export function SearchPage({
  worlds,
  initialQuery,
  onOpenHit,
}: SearchPageProps) {
  const { messages, formats } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [worldId, setWorldId] = useState('');
  const [kind, setKind] = useState('');
  const [entityTypeId, setEntityTypeId] = useState('');
  const [tagId, setTagId] = useState('');
  const [status, setStatus] = useState('');
  const [types, setTypes] = useState<readonly EntityTypeSummary[]>([]);
  const [tags, setTags] = useState<readonly EntityTag[]>([]);
  const [loadedWorldId, setLoadedWorldId] = useState<string | null>(null);
  const [state, setState] = useState<PageState>(
    initialQuery.trim().length > 0 ? 'loading' : 'idle',
  );
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(
    null,
  );
  const [suggestionsState, setSuggestionsState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const requestRef = useRef(0);

  useEffect(() => {
    let active = true;

    void window.worldCraft.search.suggestions().then((result) => {
      if (!active) {
        return;
      }

      setSuggestions(result.ok ? result.data : null);
      setSuggestionsState(result.ok ? 'ready' : 'error');
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (worldId.length === 0) {
      return;
    }

    let active = true;

    void Promise.all([
      window.worldCraft.entityTypes.list(worldId),
      window.worldCraft.tags.list(worldId),
    ]).then(([typeResult, tagResult]) => {
      if (!active) {
        return;
      }

      setTypes(typeResult.ok ? typeResult.data : []);
      setTags(tagResult.ok ? tagResult.data : []);
      setLoadedWorldId(worldId);
    });

    return () => {
      active = false;
    };
  }, [worldId]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      requestRef.current += 1;
      setState('idle');
      setResponse(null);
      return;
    }

    requestRef.current += 1;
    const request = requestRef.current;
    setState('loading');

    const filters: SearchFilters = {
      ...(worldId.length === 0 ? {} : { worldId }),
      ...(kind.length === 0 ? {} : { kind: kind as SearchFilters['kind'] }),
      ...(entityTypeId.length === 0 ? {} : { entityTypeId }),
      ...(tagId.length === 0 ? {} : { tagId }),
      ...(status.length === 0
        ? {}
        : { status: status as SearchFilters['status'] }),
    };
    const result = await window.worldCraft.search.query({
      query: trimmed,
      filters,
      limit: 50,
    });

    if (request !== requestRef.current) {
      return;
    }

    if (result.ok) {
      setResponse(result.data);
      setState('ready');
    } else {
      setResponse(null);
      setState('error');
    }
  }, [entityTypeId, kind, query, status, tagId, worldId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch();
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [runSearch]);

  const clearFilters = (): void => {
    setWorldId('');
    setKind('');
    setEntityTypeId('');
    setTagId('');
    setStatus('');
  };

  const hasFilters =
    worldId.length > 0 ||
    kind.length > 0 ||
    entityTypeId.length > 0 ||
    tagId.length > 0 ||
    status.length > 0;
  const trimmedQuery = query.trim();
  const availableTypes = loadedWorldId === worldId ? types : [];
  const availableTags = loadedWorldId === worldId ? tags : [];
  const fuzzyLabel =
    response !== null && response.fuzzyTerms.length > 0
      ? messages.search.fuzzy(
          response.fuzzyTerms.map((term) => `«${term}»`).join(', '),
        )
      : null;

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[data-search-result]',
      ),
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[Math.min(current + 1, items.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[Math.max(current - 1, 0)]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const renderHit = (hit: SearchHit) => {
    const kindLabel = messages.search.kinds[hit.kind];
    const statusLabel =
      hit.status === 'active' ? null : messages.search.statusValue[hit.status];

    return (
      <li key={hit.id}>
        <button
          type="button"
          className="wc-search-hit"
          data-search-result
          onClick={() => {
            onOpenHit(hit);
          }}
        >
          <span className="wc-visually-hidden">
            {messages.search.openPrefix}
          </span>
          <span
            className="wc-search-hit__icon"
            data-kind={hit.kind}
            aria-hidden="true"
          >
            <SearchKindIcon kind={hit.kind} className="wc-search-hit__glyph" />
          </span>
          <span className="wc-search-hit__body">
            <span className="wc-search-hit__heading">
              <span className="wc-search-hit__title">
                <SearchHighlight text={hit.titleHighlight} />
              </span>
              {hit.isFavorite ? (
                <Badge tone="neutral" className="wc-search-hit__favorite">
                  <span aria-hidden="true">★</span>
                  {messages.search.favoriteBadge}
                </Badge>
              ) : null}
            </span>
            <span className="wc-search-hit__meta">
              <Badge tone="neutral">
                <span className="wc-visually-hidden">
                  {messages.search.kindBadge(kindLabel)}
                </span>
                {kindLabel}
              </Badge>
              <span className="wc-search-hit__world">{hit.worldName}</span>
              {statusLabel !== null ? (
                <span className="wc-search-hit__status">{statusLabel}</span>
              ) : null}
              <span className="wc-search-hit__date">
                {messages.search.updated(formats.formatDate(hit.updatedAt))}
              </span>
            </span>
            <span className="wc-search-hit__snippet">
              {hit.snippet.length > 0 ? (
                <SearchHighlight text={hit.snippet} />
              ) : (
                <span className="wc-search-hit__empty">
                  {messages.search.noSnippet}
                </span>
              )}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="wc-page wc-page--search">
      <header className="wc-page__intro">
        <h2 className="wc-page__title">{messages.search.title}</h2>
        <p className="wc-page__lead">{messages.search.lead}</p>
      </header>

      <section
        className="wc-filters wc-filters--search"
        aria-label={messages.search.filtersLabel}
      >
        <TextField
          label={messages.search.inputLabel}
          type="search"
          placeholder={messages.search.inputPlaceholder}
          value={query}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <SelectField
          label={messages.search.worldLabel}
          value={worldId}
          onChange={(event) => {
            setWorldId(event.target.value);
            setEntityTypeId('');
            setTagId('');
          }}
          options={[
            { value: '', label: messages.search.worldAll },
            ...worlds.map((world) => ({ value: world.id, label: world.name })),
          ]}
        />
        <SelectField
          label={messages.search.kindLabel}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value);
          }}
          options={[
            { value: '', label: messages.search.kindAll },
            { value: 'world', label: messages.search.kinds.world },
            { value: 'entity', label: messages.search.kinds.entity },
            { value: 'relation', label: messages.search.kinds.relation },
          ]}
        />
        <SelectField
          label={messages.search.entityTypeLabel}
          value={entityTypeId}
          disabled={worldId.length === 0}
          hint={
            worldId.length === 0 ? messages.search.entityTypeHint : undefined
          }
          onChange={(event) => {
            setEntityTypeId(event.target.value);
          }}
          options={[
            { value: '', label: messages.search.entityTypeAll },
            ...availableTypes.map((type) => ({
              value: type.id,
              label: type.name,
            })),
          ]}
        />
        <SelectField
          label={messages.search.tagLabel}
          value={tagId}
          disabled={worldId.length === 0}
          hint={worldId.length === 0 ? messages.search.tagHint : undefined}
          onChange={(event) => {
            setTagId(event.target.value);
          }}
          options={[
            { value: '', label: messages.search.tagAll },
            ...availableTags.map((tag) => ({ value: tag.id, label: tag.name })),
          ]}
        />
        <SelectField
          label={messages.search.statusLabel}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
          }}
          options={[
            { value: '', label: messages.search.statusAll },
            ...SEARCH_STATUSES.map((value) => ({
              value,
              label: messages.search.statuses[value],
            })),
          ]}
        />
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {messages.search.clearFilters}
          </Button>
        ) : null}
      </section>

      {trimmedQuery.length === 0 ? (
        <section className="wc-search-suggestions">
          <p className="wc-page__section-lead">
            {messages.search.suggestionsLead}
          </p>
          {suggestionsState === 'loading' ? (
            <p className="wc-page__status" role="status">
              {messages.search.suggestionsLoading}
            </p>
          ) : suggestionsState === 'error' ? (
            <p className="wc-page__status" role="status">
              {messages.search.suggestionsError}
            </p>
          ) : suggestions === null ||
            (suggestions.recent.length === 0 &&
              suggestions.favorites.length === 0) ? (
            <p className="wc-page__status">
              {messages.search.suggestionsEmpty}
            </p>
          ) : (
            <>
              {suggestions.recent.length > 0 ? (
                <section className="wc-search-suggestion-group">
                  <h3 className="wc-page__section-title">
                    {messages.search.recentTitle}
                  </h3>
                  <ul
                    className="wc-search-results"
                    aria-label={messages.search.recentTitle}
                    onKeyDown={handleListKeyDown}
                  >
                    {suggestions.recent.map(renderHit)}
                  </ul>
                </section>
              ) : null}
              {suggestions.favorites.length > 0 ? (
                <section className="wc-search-suggestion-group">
                  <h3 className="wc-page__section-title">
                    {messages.search.favoritesTitle}
                  </h3>
                  <ul
                    className="wc-search-results"
                    aria-label={messages.search.favoritesTitle}
                    onKeyDown={handleListKeyDown}
                  >
                    {suggestions.favorites.map(renderHit)}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {trimmedQuery.length > 0 ? (
        <section className="wc-search-summary" aria-live="polite">
          {state === 'loading' ? (
            <p className="wc-page__status">{messages.search.loading}</p>
          ) : null}
          {state === 'ready' && response !== null ? (
            <>
              <p className="wc-search-summary__count">
                <Badge tone="neutral">
                  {messages.search.count(response.total)}
                </Badge>
                {response.total > response.items.length ? (
                  <span className="wc-search-summary__time">
                    {messages.search.showing(
                      response.items.length,
                      response.total,
                    )}
                  </span>
                ) : null}
                <span className="wc-search-summary__time">
                  {messages.search.took(response.tookMs)}
                </span>
              </p>
              {fuzzyLabel !== null ? (
                <p className="wc-search-summary__fuzzy">{fuzzyLabel}</p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {state === 'error' ? (
        <section className="wc-alert" role="alert">
          <h2 className="wc-alert__title">{messages.search.errorTitle}</h2>
          <p>{messages.search.errorDescription}</p>
          <div className="wc-alert__actions">
            <Button
              variant="secondary"
              onClick={() => {
                void runSearch();
              }}
            >
              {messages.search.retry}
            </Button>
          </div>
        </section>
      ) : null}

      {state === 'ready' && response !== null ? (
        response.items.length > 0 ? (
          <ul
            className="wc-search-results"
            aria-label={messages.search.listLabel}
            onKeyDown={handleListKeyDown}
          >
            {response.items.map(renderHit)}
          </ul>
        ) : (
          <section className="wc-empty" aria-live="polite">
            <h3 className="wc-empty__title">{messages.search.emptyTitle}</h3>
            <p className="wc-empty__description">
              {messages.search.emptyDescription}
            </p>
            {hasFilters ? (
              <div className="wc-empty__actions">
                <Button variant="secondary" onClick={clearFilters}>
                  {messages.search.clearFilters}
                </Button>
              </div>
            ) : null}
          </section>
        )
      ) : null}
    </div>
  );
}
