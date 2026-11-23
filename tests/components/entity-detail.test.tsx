import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityDetailPage } from '@/renderer/pages/entity-detail-page';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import {
  applyEntityViewPatch,
  createDefaultUiPreferences,
  type EntityViewPatch,
  type EntityViewPreferences,
} from '@/shared/contracts/preferences';
import type { AssetSummary } from '@/shared/contracts/assets';
import type {
  EntityDetail,
  EntitySummary,
  EntityTag,
  EntityUpdateInput,
} from '@/shared/contracts/entities';
import type { EntityTypeSummary } from '@/shared/contracts/entity-types';
import type { RelationEdge, RelationType } from '@/shared/contracts/relations';
import type { IpcResult } from '@/shared/contracts/result';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';
import type { WorldDetail } from '@/shared/contracts/worlds';

process.env.TZ = 'America/Los_Angeles';

const BASE_TIME = 1_760_000_000_000;
const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const PUERTO_ID = '01900000-0000-7000-8000-000000000003';
const TYPE_ID = '018f0000-0000-7000-8000-000000000109';
const RELATION_TYPE_ID = '018f0000-0000-7000-8000-000000000110';
const TAG_ID = '01900000-0000-7000-8000-000000000004';
const TAG_SUR_ID = '01900000-0000-7000-8000-000000000005';
const ASSET_ID = '01900000-0000-7000-8000-000000000006';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

const world: WorldDetail = {
  id: WORLD_ID,
  name: 'Las Mareas Grises',
  slug: 'las-mareas-grises',
  summary: 'Una historia de mareas y cartógrafos.',
  genres: ['Fantasía'],
  language: 'es',
  status: 'active',
  coverAssetId: null,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
  archivedAt: null,
  description: null,
};

const norte: EntityTag = {
  id: TAG_ID,
  worldId: WORLD_ID,
  name: 'Norte',
  color: 'ochre',
  createdAt: BASE_TIME,
};

const sur: EntityTag = {
  id: TAG_SUR_ID,
  worldId: WORLD_ID,
  name: 'Sur',
  color: 'moss',
  createdAt: BASE_TIME,
};

const retrato: AssetSummary = {
  id: ASSET_ID,
  worldId: WORLD_ID,
  width: 512,
  height: 512,
  alt: 'Retrato',
  createdAt: BASE_TIME,
};

const puerto: EntitySummary = {
  id: PUERTO_ID,
  worldId: WORLD_ID,
  typeId: TYPE_ID,
  typeKey: 'city',
  typeName: 'Ciudad',
  typeIcon: 'building-2',
  typeColor: 'ochre',
  name: 'Puerto Sal',
  slug: 'puerto-sal',
  aliases: [],
  summary: null,
  imageAssetId: null,
  isFavorite: false,
  status: 'active',
  tags: [],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const baseType: EntityTypeSummary = {
  id: TYPE_ID,
  worldId: null,
  key: 'character',
  name: 'Personaje',
  icon: 'user-round',
  color: 'moss',
  isSystem: true,
  fields: [
    { key: 'origen', label: 'Origen', type: 'text', required: false },
    { key: 'edad', label: 'Edad', type: 'number', required: false },
    { key: 'fundacion', label: 'Fundación', type: 'date', required: false },
    {
      key: 'rango',
      label: 'Rango',
      type: 'select',
      required: false,
      options: [
        { value: 'capitana', label: 'Capitana' },
        { value: 'piloto', label: 'Piloto' },
      ],
    },
    {
      key: 'aliado',
      label: 'Aliado',
      type: 'reference',
      required: false,
    },
  ],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const baseEntity: EntityDetail = {
  id: ENTITY_ID,
  worldId: WORLD_ID,
  typeId: TYPE_ID,
  typeKey: 'character',
  typeName: 'Personaje',
  typeIcon: 'user-round',
  typeColor: 'moss',
  name: 'Mara Viento',
  slug: 'mara-viento',
  aliases: ['La Cartógrafa'],
  summary: 'Cartógrafa de las mareas.',
  description: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Mara dibuja mapas con tinta de sal.' },
        ],
      },
    ],
  },
  attributes: {
    origen: 'Puerto Sal',
    edad: 34,
    fundacion: '2026-01-01',
    rango: 'capitana',
    aliado: PUERTO_ID,
  },
  imageAssetId: ASSET_ID,
  gallery: [{ assetId: ASSET_ID, width: 512, height: 512, alt: 'Retrato' }],
  isFavorite: false,
  status: 'active',
  tags: [norte],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const relationType: RelationType = {
  id: RELATION_TYPE_ID,
  worldId: null,
  key: 'located-in',
  name: 'Ubicado en',
  inverseName: 'Contiene',
  color: 'prussian',
  isSystem: true,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const RELATION_ID = '01900000-0000-7000-8000-000000000020';
const BACKLINK_ID = '01900000-0000-7000-8000-000000000021';
const ALTAR_ID = '01900000-0000-7000-8000-000000000022';

const outgoingRelation: RelationEdge = {
  id: RELATION_ID,
  worldId: WORLD_ID,
  typeId: RELATION_TYPE_ID,
  typeKey: relationType.key,
  typeName: relationType.name,
  typeInverseName: relationType.inverseName,
  typeColor: relationType.color,
  isSystemType: true,
  label: null,
  inverseLabel: null,
  notes: 'Vive aquí desde niña.',
  strength: 4,
  metadata: {},
  source: {
    id: ENTITY_ID,
    name: 'Mara Viento',
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
  },
  target: {
    id: PUERTO_ID,
    name: 'Puerto Sal',
    typeKey: 'city',
    typeName: 'Ciudad',
    typeIcon: 'building-2',
    typeColor: 'ochre',
  },
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const backlinkRelation: RelationEdge = {
  ...outgoingRelation,
  id: BACKLINK_ID,
  notes: null,
  source: {
    id: ALTAR_ID,
    name: 'Altar de sal',
    typeKey: 'place',
    typeName: 'Lugar',
    typeIcon: 'map-pin',
    typeColor: 'danger',
  },
  target: {
    id: ENTITY_ID,
    name: 'Mara Viento',
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
  },
};

interface ApiOptions {
  readonly type?: EntityTypeSummary;
  readonly entity?: EntityDetail;
  readonly updateError?: boolean | (() => boolean);
  readonly updateImpl?: (
    input: EntityUpdateInput,
  ) => Promise<IpcResult<EntityDetail>>;
  readonly relationsErrorOnce?: boolean;
  readonly relations?: readonly RelationEdge[];
}

function createApi(options: ApiOptions = {}) {
  const entity = options.entity ?? baseEntity;
  const type = options.type ?? baseType;
  const update = vi.fn(async (input: EntityUpdateInput) => {
    if (options.updateImpl !== undefined) {
      return options.updateImpl(input);
    }

    const shouldFail =
      typeof options.updateError === 'function'
        ? options.updateError()
        : options.updateError === true;

    return shouldFail
      ? { ok: false as const, error: { code: 'internal', message: 'fallo' } }
      : {
          ok: true as const,
          data: {
            ...entity,
            ...input,
            updatedAt: BASE_TIME + 1,
          } as EntityDetail,
        };
  });
  const get = vi.fn(async () => ({ ok: true as const, data: entity }));
  let relationListCalls = 0;
  const listRelations = vi.fn(async () => {
    relationListCalls += 1;

    return options.relationsErrorOnce === true && relationListCalls === 1
      ? { ok: false as const, error: { code: 'internal', message: 'fallo' } }
      : { ok: true as const, data: options.relations ?? [] };
  });
  const setFavorite = vi.fn(async (input: { readonly favorite: boolean }) => ({
    ok: true as const,
    data: { ...entity, isFavorite: input.favorite },
  }));
  const remove = vi.fn(async () => ({
    ok: true as const,
    data: { deleted: true },
  }));
  const removeRelation = vi.fn(async () => ({
    ok: true as const,
    data: { deleted: true },
  }));
  const importAssets = vi.fn(async () => ({
    ok: true as const,
    data: { imported: [] },
  }));

  const api = {
    entities: {
      get,
      list: vi.fn(async () => ({ ok: true as const, data: [puerto] })),
      update,
      setFavorite,
      remove,
    },
    entityTypes: {
      list: vi.fn(async () => ({ ok: true as const, data: [type] })),
    },
    tags: {
      list: vi.fn(async () => ({
        ok: true as const,
        data: [norte, sur],
      })),
      create: vi.fn(),
    },
    assets: {
      list: vi.fn(async () => ({ ok: true as const, data: [retrato] })),
      import: importAssets,
    },
    relationTypes: {
      list: vi.fn(async () => ({
        ok: true as const,
        data: [relationType],
      })),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    relations: {
      list: listRelations,
      create: vi.fn(),
      update: vi.fn(),
      remove: removeRelation,
    },
  } as unknown as WorldCraftApi;

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: api,
  });

  return {
    api,
    get,
    update,
    setFavorite,
    remove,
    removeRelation,
    importAssets,
  };
}

let viewState: EntityViewPreferences =
  createDefaultUiPreferences().entityView;

function renderPage(options: ApiOptions = {}) {
  const mocks = createApi(options);
  const onBack = vi.fn();
  const onNotify = vi.fn();
  const onOpenEntity = vi.fn();
  const onEntityRemoved = vi.fn();

  function Harness() {
    const [entityView, setEntityView] = useState<EntityViewPreferences>(
      () => viewState,
    );
    const onEntityViewChange = (patch: EntityViewPatch): void => {
      viewState = applyEntityViewPatch(viewState, patch);
      setEntityView(viewState);
    };

    return (
      <EntityDetailPage
        world={world}
        entityId={ENTITY_ID}
        onBack={onBack}
        onOpenEntity={onOpenEntity}
        onNotify={onNotify}
        onEntityRemoved={onEntityRemoved}
        entityView={entityView}
        onEntityViewChange={onEntityViewChange}
      />
    );
  }

  const view = render(
    <I18nProvider locale="es">
      <Harness />
    </I18nProvider>,
  );

  return {
    ...view,
    ...mocks,
    onBack,
    onNotify,
    onOpenEntity,
    onEntityRemoved,
  };
}

async function waitForEntity(name = 'Mara Viento'): Promise<void> {
  await screen.findByRole('heading', { level: 2, name });
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function saveStatus(): HTMLElement {
  const status = document.querySelector<HTMLElement>('.wc-save-state');

  if (status === null) {
    throw new Error('No se encontró el estado de guardado.');
  }

  return status;
}

function headerNameField(): HTMLInputElement {
  const header = document.querySelector<HTMLElement>('.wc-document-header');

  if (header === null) {
    throw new Error('No se encontró la cabecera del documento.');
  }

  return within(header).getByLabelText(messages.entities.detail.nameLabel, {
    exact: false,
  }) as HTMLInputElement;
}

async function enterEdit(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLInputElement> {
  await user.click(
    screen.getByRole('button', { name: messages.entities.detail.edit }),
  );
  const name = headerNameField();

  await waitFor(() => {
    expect(name).toHaveFocus();
  });

  return name;
}

beforeEach(() => {
  viewState = createDefaultUiPreferences().entityView;
});

describe('ficha como documento vivo', () => {
  it('se abre en lectura, sin campos de nombre, alias ni resumen', async () => {
    renderPage();
    await waitForEntity();

    expect(saveStatus()).toHaveTextContent(messages.entities.detail.saved);
    expect(
      screen.queryByRole('textbox', {
        name: messages.entities.detail.nameLabel,
      }),
    ).toBeNull();
    expect(
      screen.queryByLabelText(messages.entities.detail.aliasesLabel),
    ).toBeNull();
    expect(
      screen.queryByLabelText(messages.entities.detail.summaryLabel),
    ).toBeNull();
    expect(screen.getByText('Cartógrafa de las mareas.')).toBeVisible();
    expect(
      screen.getByText('Mara dibuja mapas con tinta de sal.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: messages.entities.detail.favoriteLabel,
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByText(messages.entities.status.active, {
        selector: '.wc-badge',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: messages.entities.detail.edit }),
    ).toBeVisible();

    // El editor de lectura no conserva el rol de formulario de Tiptap.
    const editor = document.querySelector<HTMLElement>('.wc-editor__content');

    expect(editor).not.toBeNull();
    await waitFor(() => {
      expect(editor?.getAttribute('role')).toBeNull();
      expect(editor?.getAttribute('aria-label')).toBeNull();
      expect(editor?.getAttribute('aria-expanded')).toBeNull();
      expect(editor?.getAttribute('aria-controls')).toBeNull();
      expect(editor?.getAttribute('aria-activedescendant')).toBeNull();
      expect(editor?.getAttribute('aria-autocomplete')).toBeNull();
      expect(editor?.getAttribute('tabindex')).toBeNull();
    });

    // La ficha técnica se lee como `dl`, no como tabla.
    await userEvent.click(
      screen.getByRole('button', {
        name: new RegExp(messages.entities.detail.attributesTitle),
      }),
    );
    const attributesSection = document.getElementById(
      'wc-entity-section-attributes',
    );

    expect(attributesSection?.querySelector('dl')).not.toBeNull();
    expect(attributesSection?.querySelector('table')).toBeNull();
    expect(screen.getByText('Origen')).toBeVisible();
  });

  it('en edición la barra tiene cinco controles y las acciones avanzadas viven en Formato', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForEntity();

    await enterEdit(user);

    const toolbar = screen.getByRole('toolbar', {
      name: messages.entities.editor.label,
    });

    expect(within(toolbar).getAllByRole('button')).toHaveLength(5);
    expect(
      within(toolbar).queryByRole('button', {
        name: messages.entities.editor.bulletList,
      }),
    ).toBeNull();

    await user.click(
      within(toolbar).getByRole('button', {
        name: messages.entities.editor.format,
      }),
    );

    expect(
      screen.getByRole('menuitemradio', {
        name: messages.entities.editor.paragraph,
      }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('menuitemcheckbox', {
        name: messages.entities.editor.quote,
      }),
    ).toHaveAttribute('aria-checked', 'false');

    const editor = document.querySelector<HTMLElement>('.wc-editor__content');

    expect(editor).toHaveAttribute('role', 'combobox');
    expect(editor).toHaveAttribute('aria-expanded', 'false');
    expect(editor?.getAttribute('aria-controls')).toMatch(/^wc-mention-/);
    expect(editor).not.toHaveAttribute('aria-multiline');
  });

  it('Editar enfoca Nombre y Listo guarda y devuelve el foco a Editar', async () => {
    const user = userEvent.setup();
    const { update } = renderPage();
    await waitForEntity();

    const name = await enterEdit(user);

    expect(
      screen.getByLabelText(messages.entities.detail.aliasesLabel),
    ).toBeVisible();
    expect(
      screen.getByLabelText(messages.entities.detail.summaryLabel),
    ).toBeVisible();

    await user.clear(name);
    await user.type(name, 'Mara de las Nieblas');
    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.done }),
    );

    await waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(update.mock.calls[0]?.[0].name).toBe('Mara de las Nieblas');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: messages.entities.detail.edit }),
      ).toHaveFocus();
    });
    const header = document.querySelector<HTMLElement>('.wc-document-header');

    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).queryByLabelText(
        messages.entities.detail.nameLabel,
        { exact: false },
      ),
    ).toBeNull();
  });

  it('Guardar ahora llama a update y el autoguardado conserva la última edición', async () => {
    const user = userEvent.setup();
    const { update } = renderPage();
    await waitForEntity();

    const name = await enterEdit(user);

    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.save }),
    );
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole('button', { name: messages.entities.detail.done }),
    ).toBeVisible();

    await user.type(name, ' II');
    await waitFor(
      () => {
        expect(update.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3000 },
    );
    expect(update.mock.calls.at(-1)?.[0].name).toContain('II');
  });

  it('un error de campo con Listo abre Campos del tipo y enfoca el control', async () => {
    const requiredType: EntityTypeSummary = {
      ...baseType,
      fields: [
        {
          key: 'origen',
          label: 'Origen',
          type: 'text',
          required: true,
        },
      ],
    };
    const user = userEvent.setup();
    const { update } = renderPage({
      type: requiredType,
      entity: { ...baseEntity, attributes: {} },
    });
    await waitForEntity();

    await enterEdit(user);
    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.done }),
    );

    const toggle = screen.getByRole('button', {
      name: new RegExp(messages.entities.detail.attributesTitle),
    });
    const control = document.getElementById('wc-attribute-origen');

    expect(control).not.toBeNull();

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(control).toHaveFocus();
    });
    expect(update).not.toHaveBeenCalled();
    expect(
      screen.getByText(messages.entities.detail.invalid),
    ).toBeInTheDocument();
  });

  it('el error de autoguardado abre la sección sin robar el foco', async () => {
    const requiredType: EntityTypeSummary = {
      ...baseType,
      fields: [
        {
          key: 'origen',
          label: 'Origen',
          type: 'text',
          required: true,
        },
      ],
    };
    const user = userEvent.setup();
    const { update } = renderPage({
      type: requiredType,
      entity: { ...baseEntity, attributes: {} },
    });
    await waitForEntity();

    const name = await enterEdit(user);
    await user.type(name, ' II');

    await waitFor(
      () => {
        expect(
          screen.getByText(messages.entities.detail.invalid),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(
      screen.getByRole('button', {
        name: new RegExp(messages.entities.detail.attributesTitle),
      }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(name).toHaveFocus();
    expect(update).not.toHaveBeenCalled();
  });

  it('las secciones se pliegan con teclado y su cuerpo cerrado queda oculto', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForEntity();

    const descriptionToggle = screen.getByRole('button', {
      name: new RegExp(messages.entities.detail.descriptionLabel),
    });
    const attributesToggle = screen.getByRole('button', {
      name: new RegExp(messages.entities.detail.attributesTitle),
    });
    const attributesBody = document.getElementById(
      'wc-entity-section-attributes-body',
    );

    expect(descriptionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(attributesToggle).toHaveAttribute('aria-expanded', 'false');
    expect(attributesToggle).toHaveAttribute(
      'aria-controls',
      'wc-entity-section-attributes-body',
    );
    expect(attributesBody).toHaveAttribute('hidden');

    descriptionToggle.focus();
    await user.keyboard('{Enter}');
    expect(descriptionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      document.getElementById('wc-entity-section-description-body'),
    ).toHaveAttribute('hidden');

    await user.keyboard(' ');
    expect(descriptionToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(attributesToggle);
    expect(attributesToggle).toHaveAttribute('aria-expanded', 'true');
    expect(attributesBody).not.toHaveAttribute('hidden');
  });

  it('el panel de propiedades solo contiene portada, estado y etiquetas', async () => {
    renderPage();
    await waitForEntity();

    const panel = screen.getByRole('complementary', {
      name: messages.entities.detail.propertiesTitle,
    });

    expect(
      within(panel).getByRole('heading', {
        name: messages.entities.detail.coverTitle,
      }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('heading', {
        name: messages.entities.detail.tagsTitle,
      }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByLabelText(messages.entities.detail.statusLabel),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox')).toBeNull();
    expect(panel.querySelector('dl')).toBeNull();
    expect(panel.querySelector('.wc-gallery')).toBeNull();
  });

  it('ocultar y mostrar el panel recuerda el estado durante la sesión', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await waitForEntity();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.detail.propertiesHide,
      }),
    );
    expect(
      screen.getByRole('button', {
        name: messages.entities.detail.propertiesShow,
      }),
    ).toHaveAttribute('aria-expanded', 'false');

    first.unmount();
    renderPage();
    await waitForEntity();

    const toggle = screen.getByRole('button', {
      name: messages.entities.detail.propertiesShow,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(
      screen.getByRole('button', {
        name: messages.entities.detail.propertiesHide,
      }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('el separador cambia el ancho con teclado y lo recuerda', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await waitForEntity();

    const separator = screen.getByRole('separator', {
      name: messages.entities.detail.propertiesResize,
    });

    expect(separator).toHaveAttribute('aria-valuemin', '280');
    expect(separator).toHaveAttribute('aria-valuemax', '360');
    expect(separator).toHaveAttribute('aria-valuenow', '320');

    separator.focus();
    await user.keyboard('{ArrowRight}');
    expect(separator).toHaveAttribute('aria-valuenow', '336');
    await user.keyboard('{Home}');
    expect(separator).toHaveAttribute('aria-valuenow', '280');
    await user.keyboard('{End}');
    expect(separator).toHaveAttribute('aria-valuenow', '360');
    expect(separator).toHaveAttribute('aria-valuetext', '360 píxeles');
    await user.keyboard('{ArrowRight}');
    expect(separator).toHaveAttribute('aria-valuenow', '360');

    first.unmount();
    renderPage();
    await waitForEntity();

    expect(
      screen.getByRole('separator', {
        name: messages.entities.detail.propertiesResize,
      }),
    ).toHaveAttribute('aria-valuenow', '360');
  });

  it('la galería vive en Recursos y no repite «Usar como principal»', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForEntity();

    await user.click(screen.getByRole('button', { name: /^Recursos/ }));

    const resources = document.getElementById('wc-entity-section-resources');

    expect(resources).not.toBeNull();
    expect(resources?.querySelector('.wc-gallery__thumb')).not.toBeNull();
    expect(
      within(resources as HTMLElement).getByText(
        messages.entities.detail.coverBadge,
      ),
    ).toBeInTheDocument();
    expect(
      within(resources as HTMLElement).getByRole('button', {
        name: messages.entities.detail.removeCoverNamed('Retrato'),
      }),
    ).toBeInTheDocument();
    expect(
      within(resources as HTMLElement).queryByRole('button', {
        name: /Usar como principal/,
      }),
    ).toBeNull();
    expect(
      within(resources as HTMLElement).getByRole('button', {
        name: messages.entities.detail.addImages,
      }),
    ).toBeInTheDocument();
  });

  it('Ctrl+S guarda solo en edición y no actúa con un diálogo abierto', async () => {
    const user = userEvent.setup();
    const { update } = renderPage();
    await waitForEntity();

    // Fuera de edición se evita el diálogo del navegador, pero no se guarda.
    expect(fireEvent.keyDown(window, { key: 's', ctrlKey: true })).toBe(false);
    expect(update).not.toHaveBeenCalled();

    await enterEdit(user);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });

    // Con un diálogo abierto, el atajo se cancela pero no guarda.
    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.menuLabel }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: messages.entities.detail.delete }),
    );
    expect(
      screen.getByRole('dialog', {
        name: messages.entities.detail.deleteTitle('Mara Viento'),
      }),
    ).toBeVisible();

    expect(fireEvent.keyDown(window, { key: 's', ctrlKey: true })).toBe(false);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 50);
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('al desmontar guarda el último borrador aunque el debounce no haya vencido', async () => {
    const user = userEvent.setup();
    const { update, unmount } = renderPage();
    await waitForEntity();

    const name = await enterEdit(user);
    await user.clear(name);
    await user.type(name, 'Mara Inacabada');

    unmount();

    await waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(update.mock.calls[0]?.[0].name).toBe('Mara Inacabada');
  });

  it('reintentar las relaciones no recarga la ficha ni descarta el borrador', async () => {
    const user = userEvent.setup();
    const { get } = renderPage({ relationsErrorOnce: true });
    await waitForEntity();

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(messages.entities.relations.title),
      }),
    );
    expect(
      screen.getByText(messages.entities.relations.loadError),
    ).toBeVisible();

    const name = await enterEdit(user);
    await user.clear(name);
    await user.type(name, 'Mara Inacabada');

    await user.click(
      screen.getByRole('button', { name: messages.entities.relations.retry }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(messages.entities.relations.emptyTitle),
      ).toBeVisible();
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(name).toHaveValue('Mara Inacabada');
    expect(
      screen.getByRole('button', { name: messages.entities.detail.done }),
    ).toBeVisible();
    expect(screen.queryByText(messages.entities.detail.saveError)).toBeNull();
  });

  it('integra relaciones por dirección, navega al backlink y borra sin tocar fichas', async () => {
    const user = userEvent.setup();
    const { remove, removeRelation, onOpenEntity } = renderPage({
      relations: [outgoingRelation, backlinkRelation],
    });
    await waitForEntity();

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(messages.entities.relations.title),
      }),
    );

    const section = document.querySelector<HTMLElement>(
      '[data-section="relations"]',
    );

    expect(section).not.toBeNull();

    expect(
      within(section as HTMLElement).getByRole('heading', {
        level: 4,
        name: messages.entities.relations.outgoingTitle,
      }),
    ).toBeInTheDocument();
    expect(
      within(section as HTMLElement).getByRole('heading', {
        level: 4,
        name: messages.entities.relations.incomingTitle,
      }),
    ).toBeInTheDocument();
    expect(section?.querySelector('.wc-disclosure__meta')?.textContent).toBe(
      messages.entities.detail.relationsMeta(2),
    );

    await user.click(
      within(section as HTMLElement).getByRole('button', {
        name: messages.entities.relations.openEntityNamed('Altar de sal'),
      }),
    );
    expect(onOpenEntity).toHaveBeenCalledWith(ALTAR_ID);

    const row = section?.querySelector<HTMLElement>(
      `li[data-relation-id="${RELATION_ID}"]`,
    );

    expect(row).not.toBeNull();

    await user.click(
      within(row as HTMLElement).getByRole('button', {
        name: /^Acciones de la relación/,
      }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    );

    const dialog = document.querySelector<HTMLElement>('dialog');

    await user.click(
      within(dialog as HTMLElement).getByRole('button', {
        name: messages.entities.relations.removeSubmit,
      }),
    );

    await waitFor(() => {
      expect(removeRelation).toHaveBeenCalledWith({
        worldId: WORLD_ID,
        id: RELATION_ID,
      });
    });
    await waitFor(() => {
      expect(
        section?.querySelector(`li[data-relation-id="${RELATION_ID}"]`),
      ).toBeNull();
    });

    // Las dos fichas siguen existiendo y el backlink permanece.
    expect(remove).not.toHaveBeenCalled();
    expect(
      within(section as HTMLElement).getByRole('button', {
        name: messages.entities.relations.openEntityNamed('Altar de sal'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: messages.entities.relations.openEntityNamed('Puerto Sal'),
      }),
    ).toBeNull();
    expect(section?.querySelector('.wc-disclosure__meta')?.textContent).toBe(
      messages.entities.detail.relationsMeta(1),
    );
  });

  it('un fallo al guardar conserva el borrador y el reintento lo persiste', async () => {
    const user = userEvent.setup();
    let fail = true;
    const { update } = renderPage({ updateError: () => fail });
    await waitForEntity();

    const name = await enterEdit(user);
    await user.clear(name);
    await user.type(name, 'Mara de las Nieblas');

    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.save }),
    );

    expect(
      await screen.findByText(messages.entities.detail.saveError),
    ).toBeVisible();
    expect(name).toHaveValue('Mara de las Nieblas');
    expect(update.mock.calls[0]?.[0].name).toBe('Mara de las Nieblas');
    expect(saveStatus()).toHaveTextContent(
      messages.entities.detail.saveFailedShort,
    );

    // El autoguardado pendiente también falla y deja el estado estable antes
    // de reintentar, para que el recuento de llamadas sea determinista.
    await waitFor(
      () => {
        expect(update.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3000 },
    );
    const callsBeforeRetry = update.mock.calls.length;

    fail = false;
    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.retry }),
    );

    await waitFor(() => {
      expect(screen.queryByText(messages.entities.detail.saveError)).toBeNull();
      expect(saveStatus()).toHaveTextContent(messages.entities.detail.saved);
    });
    expect(update.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    expect(update.mock.calls.at(-1)?.[0].name).toBe('Mara de las Nieblas');
    expect(name).toHaveValue('Mara de las Nieblas');
  });

  it('un guardado en curso no anuncia Guardado si el borrador cambió', async () => {
    const user = userEvent.setup();
    const gates: {
      readonly input: EntityUpdateInput;
      readonly gate: Deferred<IpcResult<EntityDetail>>;
    }[] = [];
    let updateCall = 0;
    const { update } = renderPage({
      updateImpl: (input) => {
        const call = updateCall;
        updateCall += 1;

        // Las llamadas posteriores a las dos controladas se resuelven solas
        // para que un autoguardado tardío no deje el estado colgado.
        if (call >= 2) {
          return Promise.resolve({
            ok: true,
            data: { ...baseEntity, ...input, updatedAt: BASE_TIME + call },
          } as IpcResult<EntityDetail>);
        }

        const gate = deferred<IpcResult<EntityDetail>>();
        gates[call] = { input, gate };

        return gate.promise;
      },
    });
    await waitForEntity();

    const name = await enterEdit(user);
    await user.clear(name);
    await user.type(name, 'Mara uno');

    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.save }),
    );
    await waitFor(() => {
      expect(gates).toHaveLength(1);
    });

    await user.type(name, ' y dos');
    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.save }),
    );
    expect(update).toHaveBeenCalledTimes(1);

    const first = gates[0];

    first?.gate.resolve({
      ok: true,
      data: {
        ...baseEntity,
        ...first.input,
        updatedAt: BASE_TIME + 1,
      } as EntityDetail,
    });

    await waitFor(() => {
      expect(gates).toHaveLength(2);
    });
    expect(update).toHaveBeenCalledTimes(2);
    expect(gates[1]?.input.name).toBe('Mara uno y dos');
    expect(saveStatus()).not.toHaveTextContent(messages.entities.detail.saved);

    const second = gates[1];

    second?.gate.resolve({
      ok: true,
      data: {
        ...baseEntity,
        ...second.input,
        updatedAt: BASE_TIME + 2,
      } as EntityDetail,
    });

    await waitFor(() => {
      expect(saveStatus()).toHaveTextContent(messages.entities.detail.saved);
    });
    expect(name).toHaveValue('Mara uno y dos');
  });

  it('favorita conserva su nombre y la papelera confirma el borrado', async () => {
    const user = userEvent.setup();
    const { setFavorite, remove, onBack, onEntityRemoved } = renderPage();
    await waitForEntity();

    const favorite = screen.getByRole('button', {
      name: messages.entities.detail.favoriteLabel,
      exact: true,
    });

    await user.click(favorite);
    await waitFor(() => {
      expect(setFavorite).toHaveBeenCalledWith({
        worldId: WORLD_ID,
        id: ENTITY_ID,
        favorite: true,
      });
    });
    expect(
      screen.getByRole('button', {
        name: messages.entities.detail.favoriteLabel,
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(
      screen.getByRole('button', { name: messages.entities.detail.menuLabel }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: messages.entities.detail.delete }),
    );

    const dialog = screen.getByRole('dialog', {
      name: messages.entities.detail.deleteTitle('Mara Viento'),
    });

    await user.click(
      within(dialog).getByRole('button', {
        name: messages.entities.detail.deleteSubmit,
      }),
    );

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({
        worldId: WORLD_ID,
        id: ENTITY_ID,
      });
      expect(onEntityRemoved).toHaveBeenCalledWith(ENTITY_ID);
      expect(onBack).toHaveBeenCalled();
    });
  });

  it('explica los valores vacíos y las referencias rotas en la ficha técnica', async () => {
    const user = userEvent.setup();
    renderPage({
      entity: {
        ...baseEntity,
        attributes: {
          edad: 34,
          rango: 'capitana',
          aliado: '01900000-0000-7000-8000-000000000999',
        },
      },
    });
    await waitForEntity();

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(messages.entities.detail.attributesTitle),
      }),
    );

    expect(
      screen.getAllByText(messages.entities.detail.emptyValue).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(messages.entities.detail.referenceMissing),
    ).toBeVisible();
  });

  it('formatea las fechas de campo en UTC sin desplazar el día', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForEntity();

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(messages.entities.detail.attributesTitle),
      }),
    );

    const expected = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date('2026-01-01T00:00:00Z'));

    expect(screen.getByText(expected)).toBeVisible();
  });
});
