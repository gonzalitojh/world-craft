import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import type { SearchHit } from '../../shared/contracts/search';
import { Dialog } from '../components/dialog';
import { SearchKindIcon } from '../components/search/search-kind-icon';
import { useI18n } from '../i18n/provider';
import type { AppNavView } from '../shell/app-shell';

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onNavigate: (view: AppNavView) => void;
  readonly onOpenSearch: (query: string) => void;
  readonly onOpenHit: (hit: SearchHit) => void;
  readonly onCreateWorld: () => void;
  readonly onCreateEntity: () => void;
  readonly onToggleTheme: () => void;
  readonly onRebuild: () => void;
}

interface PaletteCommand {
  readonly id: string;
  readonly label: string;
  readonly run: () => void;
}

interface PaletteItem {
  readonly id: string;
  readonly type: 'command' | 'search-all' | 'hit';
  readonly label: string;
  readonly command?: PaletteCommand;
  readonly hit?: SearchHit;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('es');
}

/**
 * Paleta de comandos Ctrl+K.
 *
 * Patrón combobox/listbox: el foco permanece en el campo, `aria-activedescendant`
 * apunta a la opción activa y las flechas, Inicio, Fin, Enter y Escape se
 * gestionan aquí. El diálogo nativo aporta el velo y la trampa de foco.
 */
export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onOpenSearch,
  onOpenHit,
  onCreateWorld,
  onCreateEntity,
  onToggleTheme,
  onRebuild,
}: CommandPaletteProps) {
  const { messages } = useI18n();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{
    readonly query: string;
    readonly items: readonly SearchHit[];
    readonly failed: boolean;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const listId = useId();
  const hintsId = useId();

  useEffect(() => {
    const trimmed = query.trim();

    if (!open || trimmed.length === 0) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void window.worldCraft.search
        .query({ query: trimmed, limit: 6 })
        .then((response) => {
          if (!active) {
            return;
          }

          setResult({
            query: trimmed,
            items: response.ok ? response.data.items : [],
            failed: !response.ok,
          });
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const commands = useMemo<readonly PaletteCommand[]>(
    () => [
      {
        id: 'go-home',
        label: messages.palette.commands.home,
        run: () => {
          onNavigate('home');
        },
      },
      {
        id: 'go-search',
        label: messages.palette.commands.search,
        run: () => {
          onOpenSearch('');
        },
      },
      {
        id: 'go-worlds',
        label: messages.palette.commands.worlds,
        run: () => {
          onNavigate('worlds');
        },
      },
      {
        id: 'go-settings',
        label: messages.palette.commands.settings,
        run: () => {
          onNavigate('settings');
        },
      },
      {
        id: 'create-world',
        label: messages.palette.commands.createWorld,
        run: onCreateWorld,
      },
      {
        id: 'create-entity',
        label: messages.palette.commands.createEntity,
        run: onCreateEntity,
      },
      {
        id: 'toggle-theme',
        label: messages.palette.commands.toggleTheme,
        run: onToggleTheme,
      },
      {
        id: 'rebuild-search',
        label: messages.palette.commands.rebuild,
        run: onRebuild,
      },
    ],
    [
      messages,
      onCreateEntity,
      onCreateWorld,
      onNavigate,
      onOpenSearch,
      onRebuild,
      onToggleTheme,
    ],
  );

  const trimmed = query.trim();
  const hits = useMemo(
    () => (result !== null && result.query === trimmed ? result.items : []),
    [result, trimmed],
  );
  const searchFailed =
    result !== null && result.query === trimmed && result.failed;
  const searching =
    trimmed.length > 0 && (result === null || result.query !== trimmed);
  const items = useMemo<readonly PaletteItem[]>(() => {
    const normalized = normalize(trimmed);
    const filtered =
      normalized.length === 0
        ? commands
        : commands.filter((command) =>
            normalize(command.label).includes(normalized),
          );
    const commandItems: PaletteItem[] = filtered.map((command) => ({
      id: command.id,
      type: 'command',
      label: command.label,
      command,
    }));

    if (trimmed.length === 0) {
      return commandItems;
    }

    return [
      ...commandItems,
      {
        id: 'search-all',
        type: 'search-all',
        label: messages.palette.searchFor(trimmed),
      },
      ...hits.map<PaletteItem>((hit) => ({
        id: `hit-${hit.id}`,
        type: 'hit',
        label: hit.title,
        hit,
      })),
    ];
  }, [commands, hits, messages, trimmed]);

  const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

  useEffect(() => {
    if (!open) {
      return;
    }

    itemRefs.current[safeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, safeIndex, items.length]);

  const runItem = useCallback(
    (item: PaletteItem | undefined) => {
      if (item === undefined) {
        return;
      }

      onClose();

      if (item.type === 'command') {
        item.command?.run();
      } else if (item.type === 'search-all') {
        onOpenSearch(trimmed);
      } else if (item.hit !== undefined) {
        onOpenHit(item.hit);
      }
    },
    [onClose, onOpenHit, onOpenSearch, trimmed],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, items.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runItem(items[safeIndex]);
    }
  };

  const activeItem = items[safeIndex];
  const empty =
    trimmed.length > 0 &&
    !searching &&
    !searchFailed &&
    result !== null &&
    result.query === trimmed &&
    result.items.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.palette.title}
      className="wc-palette-dialog"
    >
      <div className="wc-palette">
        <input
          type="text"
          className="wc-palette__input"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeItem === undefined ? undefined : `${listId}-${activeItem.id}`
          }
          aria-describedby={hintsId}
          aria-label={messages.palette.inputLabel}
          placeholder={messages.palette.placeholder}
          value={query}
          autoComplete="off"
          spellCheck={false}
          data-autofocus
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />

        <ul
          className="wc-palette__list"
          id={listId}
          role="listbox"
          aria-label={messages.palette.listLabel}
        >
          {items.map((item, index) => {
            const selected = index === safeIndex;

            return (
              <li
                key={item.id}
                id={`${listId}-${item.id}`}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                role="option"
                aria-selected={selected}
                className="wc-palette__item"
                data-selected={selected || undefined}
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
                onClick={() => {
                  runItem(item);
                }}
              >
                {item.type === 'command' ? (
                  <>
                    <span className="wc-palette__badge">
                      {messages.palette.commandBadge}
                    </span>
                    <span className="wc-palette__label">{item.label}</span>
                  </>
                ) : item.type === 'search-all' ? (
                  <>
                    <span className="wc-palette__glyph" aria-hidden="true">
                      ↵
                    </span>
                    <span className="wc-palette__label">{item.label}</span>
                  </>
                ) : item.hit !== undefined ? (
                  <>
                    <span
                      className="wc-palette__glyph"
                      data-kind={item.hit.kind}
                      aria-hidden="true"
                    >
                      <SearchKindIcon
                        kind={item.hit.kind}
                        className="wc-palette__icon"
                      />
                    </span>
                    <span className="wc-palette__label">
                      {item.hit.title}
                      <span className="wc-palette__sub">
                        {messages.search.kinds[item.hit.kind]} ·{' '}
                        {item.hit.worldName}
                      </span>
                    </span>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>

        {searching ? (
          <p className="wc-palette__status" role="status">
            {messages.palette.loading}
          </p>
        ) : null}
        {searchFailed ? (
          <p className="wc-palette__status" role="alert">
            {messages.palette.error}
          </p>
        ) : null}
        {empty ? (
          <p className="wc-palette__status" role="status">
            {messages.palette.noResults}
          </p>
        ) : null}

        <p className="wc-palette__hints" id={hintsId}>
          {messages.palette.hints}
        </p>
      </div>
    </Dialog>
  );
}
