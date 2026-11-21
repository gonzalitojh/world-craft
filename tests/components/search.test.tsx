import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '@/renderer/components/command-palette';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { SearchPage } from '@/renderer/pages/search-page';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';
import type {
  SearchHit,
  SearchResponse,
  SearchSuggestions,
} from '@/shared/contracts/search';
import type { WorldSummary } from '@/shared/contracts/worlds';

const BASE_TIME = 1_760_000_000_000;
const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const TYPE_ID = '01900000-0000-7000-8000-000000000003';
const TAG_ID = '01900000-0000-7000-8000-000000000004';
const scrollIntoView = vi.fn();

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider locale="es">{ui}</I18nProvider>);
}

const world: WorldSummary = {
  id: WORLD_ID,
  name: 'Las Mareas Grises',
  slug: 'las-mareas-grises',
  summary: null,
  genres: [],
  language: 'es',
  status: 'active',
  coverAssetId: null,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
  archivedAt: null,
};

const hit: SearchHit = {
  id: `entity:${ENTITY_ID}`,
  kind: 'entity',
  sourceId: ENTITY_ID,
  contextId: null,
  worldId: WORLD_ID,
  worldName: world.name,
  title: 'Gandalf el Gris',
  titleHighlight: '\u0001Gandalf\u0002 el Gris',
  snippet: 'Mago de la \u0001Tierra\u0002 Media',
  status: 'active',
  isFavorite: true,
  updatedAt: BASE_TIME,
};

const response: SearchResponse = {
  items: [hit],
  total: 1,
  tookMs: 7,
  fuzzyTerms: [],
};

const suggestions: SearchSuggestions = {
  recent: [],
  favorites: [hit],
};

function stubApi(
  overrides: {
    readonly query?: (input: unknown) => Promise<unknown>;
    readonly suggestions?: (input?: unknown) => Promise<unknown>;
  } = {},
) {
  const search = {
    query: overrides.query ?? vi.fn(async () => ({ ok: true, data: response })),
    suggestions:
      overrides.suggestions ??
      vi.fn(async () => ({ ok: true, data: suggestions })),
    rebuild: async () => ({ ok: true, data: { documents: 3, tookMs: 2 } }),
  };

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: {
      search,
      entityTypes: {
        list: async () => ({
          ok: true,
          data: [
            {
              id: TYPE_ID,
              worldId: WORLD_ID,
              key: 'character',
              name: 'Personaje',
              icon: 'user-round',
              color: 'moss',
              isSystem: true,
              fields: [],
              createdAt: BASE_TIME,
              updatedAt: BASE_TIME,
            },
          ],
        }),
      },
      tags: {
        list: async () => ({
          ok: true,
          data: [
            {
              id: TAG_ID,
              worldId: WORLD_ID,
              name: 'Istari',
              color: 'moss',
              createdAt: BASE_TIME,
            },
          ],
        }),
      },
    } satisfies Partial<WorldCraftApi>,
  });

  return search;
}

describe('página de búsqueda global', () => {
  beforeEach(() => {
    stubApi();
  });

  it('muestra resultados resaltados, cuenta y tiempo, y abre el resultado', async () => {
    const user = userEvent.setup();
    const onOpenHit = vi.fn();

    renderWithI18n(
      <SearchPage worlds={[world]} initialQuery="gand" onOpenHit={onOpenHit} />,
    );

    expect(await screen.findByText(/1 resultado/)).toBeInTheDocument();
    expect(screen.getByText(messages.search.took(7))).toBeInTheDocument();

    const result = screen.getByRole('button', {
      name: /Gandalf el Gris/,
    });

    expect(within(result).getByText('Gandalf')).toHaveClass(
      'wc-search-hit__mark',
    );
    expect(within(result).getByText('Tierra')).toHaveClass(
      'wc-search-hit__mark',
    );
    expect(within(result).getByText(/Favorita/)).toBeInTheDocument();

    await user.click(result);
    expect(onOpenHit).toHaveBeenCalledWith(hit);
  });

  it('envía los filtros combinados al proceso principal', async () => {
    const user = userEvent.setup();
    const query = stubApi().query;

    renderWithI18n(
      <SearchPage worlds={[world]} initialQuery="gand" onOpenHit={() => {}} />,
    );

    await screen.findByText(/1 resultado/);
    await user.selectOptions(
      screen.getByLabelText(messages.search.worldLabel),
      WORLD_ID,
    );
    await screen.findByRole('option', { name: 'Personaje' });
    await screen.findByRole('option', { name: 'Istari' });
    await user.selectOptions(
      screen.getByLabelText(messages.search.entityTypeLabel),
      TYPE_ID,
    );
    await user.selectOptions(
      screen.getByLabelText(messages.search.tagLabel),
      TAG_ID,
    );
    await user.selectOptions(
      screen.getByLabelText(messages.search.statusLabel),
      'active',
    );
    await user.selectOptions(
      screen.getByLabelText(messages.search.kindLabel),
      'entity',
    );

    await waitFor(() => {
      expect(query).toHaveBeenLastCalledWith({
        query: 'gand',
        filters: {
          worldId: WORLD_ID,
          kind: 'entity',
          entityTypeId: TYPE_ID,
          tagId: TAG_ID,
          status: 'active',
        },
        limit: 50,
      });
    });
  });

  it('anuncia los términos aproximados y navega con flechas entre resultados', async () => {
    const user = userEvent.setup();
    stubApi({
      query: async () => ({
        ok: true,
        data: {
          ...response,
          items: [
            hit,
            {
              ...hit,
              id: 'world:1',
              kind: 'world',
              sourceId: '01900000-0000-7000-8000-000000000099',
              title: 'Las Mareas Grises',
              titleHighlight: '\u0001Mareas\u0002',
              worldName: 'Las Mareas Grises',
              isFavorite: false,
            },
          ],
          total: 2,
          fuzzyTerms: ['gandalf'],
        },
      }),
    });

    renderWithI18n(
      <SearchPage
        worlds={[world]}
        initialQuery="gandolf"
        onOpenHit={() => {}}
      />,
    );

    expect(
      await screen.findByText(/resultados parecidos a «gandalf»/),
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', {
      name: /Abrir/,
    });

    buttons[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(buttons[1]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(buttons[0]).toHaveFocus();
  });

  it('muestra recientes y favoritos cuando no hay consulta', async () => {
    renderWithI18n(
      <SearchPage worlds={[world]} initialQuery="" onOpenHit={() => {}} />,
    );

    expect(
      await screen.findByRole('heading', {
        name: messages.search.favoritesTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Gandalf el Gris/,
      }),
    ).toBeInTheDocument();
  });
});

describe('paleta de comandos', () => {
  beforeEach(() => {
    stubApi();
  });

  function renderPalette(
    overrides: Partial<Parameters<typeof CommandPalette>[0]> = {},
  ) {
    const props = {
      open: true,
      onClose: vi.fn(),
      onNavigate: vi.fn(),
      onOpenSearch: vi.fn(),
      onOpenHit: vi.fn(),
      onCreateWorld: vi.fn(),
      onCreateEntity: vi.fn(),
      onToggleTheme: vi.fn(),
      onRebuild: vi.fn(),
      ...overrides,
    };

    return {
      props,
      ...renderWithI18n(<CommandPalette {...props} />),
    };
  }

  it('expone el patrón combobox y ejecuta el primer comando con Enter', async () => {
    const user = userEvent.setup();
    const { props } = renderPalette();
    const input = screen.getByRole('combobox', {
      name: messages.palette.inputLabel,
    });

    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls');

    await user.keyboard('{Enter}');

    expect(props.onClose).toHaveBeenCalled();
    expect(props.onNavigate).toHaveBeenCalledWith('home');
  });

  it('filtra comandos y abre un resultado rápido con flechas y Enter', async () => {
    const user = userEvent.setup();
    const { props } = renderPalette();
    const input = screen.getByRole('combobox');

    await user.type(input, 'gand');
    const option = await screen.findByRole('option', {
      name: new RegExp(hit.title),
    });

    expect(option).toHaveAttribute('aria-selected', 'false');

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getAllByRole('option')[1]).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(scrollIntoView).toHaveBeenCalled();

    await user.keyboard('{Enter}');

    expect(props.onOpenHit).toHaveBeenCalledWith(hit);
  });

  it('muestra el aviso cuando no hay coincidencias', async () => {
    const user = userEvent.setup();
    stubApi({
      query: async () => ({
        ok: true,
        data: { ...response, items: [], total: 0, fuzzyTerms: [] },
      }),
    });
    renderPalette();
    const input = screen.getByRole('combobox');

    await user.type(input, 'zzzz');

    expect(
      await screen.findByText(messages.palette.noResults),
    ).toBeInTheDocument();
  });

  it('muestra un error propio si la búsqueda rápida falla', async () => {
    const user = userEvent.setup();
    stubApi({
      query: async () => ({
        ok: false,
        error: { code: 'INTERNAL_ERROR' },
      }),
    });
    renderPalette();
    const input = screen.getByRole('combobox');

    await user.type(input, 'gand');

    expect(await screen.findByText(messages.palette.error)).toBeInTheDocument();
    expect(
      screen.queryByText(messages.palette.noResults),
    ).not.toBeInTheDocument();
  });
});
