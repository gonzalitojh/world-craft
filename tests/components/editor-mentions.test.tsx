import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type RefObject } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { RichTextEditor } from '@/renderer/components/editor/rich-text-editor';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type {
  EntityRichTextDocument,
  EntitySummary,
} from '@/shared/contracts/entities';
import type { Editor } from '@tiptap/react';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '018f0000-0000-7000-8000-000000000109';
const PUERTO_ID = '01900000-0000-7000-8000-000000000003';
const MARA_ID = '01900000-0000-7000-8000-000000000002';
const ALTAR_ID = '01900000-0000-7000-8000-000000000004';

beforeAll(() => {
  // jsdom no implementa la geometría de `Range`, que ProseMirror consulta al
  // enfocar o desplazar la selección. Un rectángulo estable evita el fallo sin
  // convertir estas pruebas en una simulación de layout.
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 2,
    bottom: 18,
    width: 2,
    height: 18,
    toJSON: () => rect,
  };
  const rectList = {
    length: 1,
    0: rect,
    item: () => rect,
    [Symbol.iterator]: function* iterate() {
      yield rect;
    },
  };

  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => rectList,
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });

  // jsdom tampoco implementa `document.elementFromPoint`. ProseMirror lo usa al
  // pulsar el contenido; con `null` cae en su propio cálculo de posición, que
  // aprovecha los rectángulos de arriba.
  Object.defineProperty(Document.prototype, 'elementFromPoint', {
    configurable: true,
    value: () => null,
  });

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

function entity(
  id: string,
  name: string,
  options: {
    readonly aliases?: readonly string[];
    readonly typeName?: string;
  } = {},
): EntitySummary {
  return {
    id,
    worldId: WORLD_ID,
    typeId: TYPE_ID,
    typeKey: 'city',
    typeName: options.typeName ?? 'Ciudad',
    typeIcon: 'building-2',
    typeColor: 'ochre',
    name,
    slug: id,
    aliases: options.aliases ?? [],
    summary: null,
    imageAssetId: null,
    isFavorite: false,
    status: 'active',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const puerto = entity(PUERTO_ID, 'Puerto Sal', {
  aliases: ['La Dársena'],
});
const mara = entity(MARA_ID, 'Mara Viento', {
  aliases: ['La Cartógrafa'],
  typeName: 'Personaje',
});
const altar = entity(ALTAR_ID, 'Altar de Sal', { typeName: 'Lugar' });
const candidates = [puerto, mara, altar];

interface HarnessOptions {
  readonly document?: EntityRichTextDocument | null;
  readonly readOnly?: boolean;
  readonly disabled?: boolean;
  readonly candidates?: readonly EntitySummary[];
  readonly onChange?: (document: EntityRichTextDocument | null) => void;
  readonly onOpenEntity?: (entityId: string) => void;
}

function renderEditor(options: HarnessOptions = {}) {
  const editorRef = createRef<Editor>();
  const onChange = options.onChange ?? vi.fn();
  const onOpenEntity = options.onOpenEntity ?? vi.fn();
  const view = render(
    <I18nProvider locale="es">
      <RichTextEditor
        document={options.document ?? null}
        label={messages.entities.detail.descriptionLabel}
        candidates={options.candidates ?? candidates}
        hint={messages.entities.detail.descriptionHint}
        readOnly={options.readOnly ?? false}
        disabled={options.disabled ?? false}
        onChange={onChange}
        onOpenEntity={onOpenEntity}
        editorRef={editorRef}
      />
    </I18nProvider>,
  );

  return { ...view, editorRef, onChange, onOpenEntity };
}

async function ready(editorRef: RefObject<Editor | null>): Promise<Editor> {
  await waitFor(() => {
    expect(editorRef.current).not.toBeNull();
  });

  return editorRef.current as Editor;
}

async function typeInEditor(editor: Editor, text: string): Promise<void> {
  await act(async () => {
    const transaction = editor.state.tr.insertText(
      text,
      editor.state.selection.from,
    );

    // La escritura no entra en el historial: así el test de deshacer comprueba
    // que la inserción de la mención es un solo paso.
    transaction.setMeta('addToHistory', false);
    editor.view.dispatch(transaction);
    editor.view.focus();
  });
}

function editorElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.wc-editor__content');

  if (element === null) {
    throw new Error('No se encontró el editor.');
  }

  return element;
}

function linkAnchor(): HTMLAnchorElement {
  const element = editorElement().querySelector<HTMLAnchorElement>(
    'a[href^="wc-entity://"]',
  );

  if (element === null) {
    throw new Error('No se encontró el enlace interno.');
  }

  return element;
}

function optionNames(): readonly string[] {
  return screen
    .queryAllByRole('option')
    .map(
      (option) => option.querySelector('.wc-mention__name')?.textContent ?? '',
    );
}

async function press(key: string): Promise<void> {
  await userEvent.setup().keyboard(key);
}

describe('barra mínima del editor', () => {
  it('muestra exactamente cinco controles, sin acciones avanzadas', async () => {
    const { editorRef } = renderEditor();
    await ready(editorRef);

    const toolbar = screen.getByRole('toolbar', {
      name: messages.entities.editor.label,
    });
    const buttons = within(toolbar).getAllByRole('button');

    expect(buttons).toHaveLength(5);
    expect(
      within(toolbar).getByRole('button', {
        name: messages.entities.editor.bold,
      }),
    ).toBeVisible();
    expect(
      within(toolbar).getByRole('button', {
        name: messages.entities.editor.italic,
      }),
    ).toBeVisible();
    expect(
      within(toolbar).getByRole('button', {
        name: messages.entities.editor.format,
      }),
    ).toBeVisible();
    expect(
      within(toolbar).getByRole('button', {
        name: messages.entities.editor.link,
      }),
    ).toBeVisible();
    expect(
      within(toolbar).getByRole('button', {
        name: messages.entities.editor.mention,
      }),
    ).toBeVisible();
    expect(
      within(toolbar).queryByRole('button', {
        name: messages.entities.editor.bulletList,
      }),
    ).toBeNull();
  });

  it('el menú Formato expone los tres bloques con roles y checks', async () => {
    const user = userEvent.setup();
    const { editorRef } = renderEditor();
    await ready(editorRef);

    await user.click(
      screen.getByRole('button', { name: messages.entities.editor.format }),
    );

    expect(
      screen.getByRole('menu', { name: messages.entities.editor.formatMenu }),
    ).toBeVisible();
    expect(
      screen.getByRole('menuitemradio', {
        name: messages.entities.editor.paragraph,
      }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('menuitemradio', {
        name: messages.entities.editor.heading1,
      }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('menuitemcheckbox', {
        name: messages.entities.editor.bulletList,
      }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.editor.linkOpen,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.editor.linkRemove,
      }),
    ).toBeDisabled();
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('aplica un título con teclado y devuelve el foco al editor', async () => {
    const user = userEvent.setup();
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await user.click(
      screen.getByRole('button', { name: messages.entities.editor.format }),
    );

    await user.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('menuitemradio', {
        name: messages.entities.editor.heading1,
      }),
    ).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(editor.isActive('heading', { level: 1 })).toBe(true);
    await waitFor(() => {
      expect(editorElement()).toHaveFocus();
    });
  });

  it('Escape cierra el menú y devuelve el foco al disparador', async () => {
    const user = userEvent.setup();
    const { editorRef } = renderEditor();
    await ready(editorRef);

    const trigger = screen.getByRole('button', {
      name: messages.entities.editor.format,
    });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('habilita abrir y quitar enlace solo con el cursor dentro de un enlace', async () => {
    const user = userEvent.setup();
    const documentWithLink: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Puerto' },
            {
              type: 'text',
              text: ' Sal',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `wc-entity://${PUERTO_ID}` },
                },
              ],
            },
          ],
        },
      ],
    };
    const { editorRef } = renderEditor({ document: documentWithLink });
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.setTextSelection(8);
    });

    await user.click(
      screen.getByRole('button', { name: messages.entities.editor.format }),
    );

    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.editor.linkOpen,
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.editor.linkRemove,
      }),
    ).toBeEnabled();
  });
});

describe('abrir enlace desde el menú Formato', () => {
  function linkedDocument(href: string): EntityRichTextDocument {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Puerto Sal',
              marks: [{ type: 'link', attrs: { href } }],
            },
          ],
        },
      ],
    };
  }

  it('abre la ficha con un UUID v7 válido', async () => {
    const user = userEvent.setup();
    const onOpenEntity = vi.fn();
    const { editorRef } = renderEditor({
      document: linkedDocument(`wc-entity://${PUERTO_ID}`),
      onOpenEntity,
    });
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.setTextSelection(5);
    });
    await user.click(
      screen.getByRole('button', { name: messages.entities.editor.format }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.editor.linkOpen,
      }),
    );

    expect(onOpenEntity).toHaveBeenCalledWith(PUERTO_ID);
  });

  it('no abre nada si el enlace interno no lleva un UUID v7 válido', async () => {
    const user = userEvent.setup();
    const onOpenEntity = vi.fn();
    const { editorRef } = renderEditor({
      // UUID v4: cumple la forma general pero no la versión 7 que exige el
      // contrato de enlaces internos.
      document: linkedDocument(
        'wc-entity://01900000-0000-4000-8000-000000000001',
      ),
      onOpenEntity,
    });
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.setTextSelection(5);
    });
    await user.click(
      screen.getByRole('button', { name: messages.entities.editor.format }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.editor.linkOpen,
      }),
    );

    expect(onOpenEntity).not.toHaveBeenCalled();
  });
});

describe('selector de menciones', () => {
  it('abre con @ y anuncia el estado combobox', async () => {
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@Puer');

    const listbox = await screen.findByRole('listbox', {
      name: messages.entities.editor.mentionListLabel,
    });
    const dom = editorElement();

    expect(dom).toHaveAttribute('role', 'combobox');
    expect(dom).toHaveAttribute('aria-expanded', 'true');
    expect(dom).toHaveAttribute('aria-controls', listbox.id);
    expect(dom).toHaveAttribute('aria-autocomplete', 'list');
    expect(dom).toHaveAttribute('tabindex', '0');
    expect(dom).not.toHaveAttribute('aria-multiline');
    expect(dom).not.toHaveAttribute('aria-owns');
    expect(dom.getAttribute('aria-activedescendant')).toBe(
      `${listbox.id}-option-0`,
    );
    expect(optionNames()).toEqual(['Puerto Sal']);
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.entities.editor.mentionResults(1),
    );
  });

  it('abre con [[ en cualquier posición y filtra por alias y tipo', async () => {
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, 'Vive en [[cartografa');

    await screen.findByRole('listbox');
    expect(optionNames()).toEqual(['Mara Viento']);
  });

  it('navega con flechas con envoltura, Inicio y Fin sin sacar el foco del editor', async () => {
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@');

    await screen.findByRole('listbox');
    expect(optionNames()).toEqual([
      'Puerto Sal',
      'Mara Viento',
      'Altar de Sal',
    ]);
    expect(editorElement()).toHaveFocus();

    await press('{ArrowUp}');
    expect(screen.getAllByRole('option')[2]).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(editorElement()).toHaveFocus();

    await press('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await press('{End}');
    expect(screen.getAllByRole('option')[2]).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await press('{Home}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true',
    );

    expect(editorElement()).toHaveFocus();
    expect(document.activeElement).toBe(editorElement());
    expect(editorElement()).toHaveAttribute('aria-expanded', 'true');
  });

  it('inserta con Enter en una sola transacción sin HTML y con espacio sin marca', async () => {
    const { editorRef, onChange } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@Puer');
    await screen.findByRole('listbox');
    await press('{Enter}');

    const json = editor.getJSON();
    const paragraph = json.content?.[0];

    expect(paragraph?.content).toEqual([
      {
        type: 'text',
        text: 'Puerto Sal',
        marks: [
          expect.objectContaining({
            type: 'link',
            attrs: expect.objectContaining({
              href: `wc-entity://${PUERTO_ID}`,
            }),
          }),
        ],
      },
      { type: 'text', text: ' ' },
    ]);
    expect(editorElement().querySelector('.wc-mention')).toBeNull();
    expect(editorElement().innerHTML).not.toContain('<b>');
    expect(screen.queryByRole('listbox', { hidden: false })).toBeNull();
    expect(onChange).toHaveBeenCalled();

    await act(async () => {
      editor.chain().focus().insertContent('sigue').run();
    });

    const updated = editor.getJSON().content?.[0]?.content ?? [];
    const last = updated.at(-1);

    expect(last?.type).toBe('text');
    expect(last?.text).toContain('sigue');
    expect(last?.marks).toBeUndefined();
  });

  it('Tab inserta sin mover el foco y Escape cierra sin borrar la consulta', async () => {
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@Puer');
    await screen.findByRole('listbox');
    expect(editorElement()).toHaveFocus();
    await press('{Tab}');

    expect(editorElement().textContent).toContain('Puerto Sal');
    expect(editor.isActive('link')).toBe(false);
    expect(editorElement()).toHaveFocus();

    await typeInEditor(editor, '@Alt');
    await screen.findByRole('listbox');
    await press('{Escape}');

    expect(editorElement().textContent).toContain('@Alt');
    expect(screen.queryByRole('listbox', { hidden: false })).toBeNull();
    expect(editorElement()).toHaveAttribute('aria-expanded', 'false');
    expect(editorElement()).not.toHaveAttribute('aria-activedescendant');
    expect(editorElement()).toHaveFocus();
  });

  it('Shift+Tab cierra el selector sin insertar y deja salir del editor', async () => {
    const user = userEvent.setup();
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@Puer');
    await screen.findByRole('listbox');
    expect(editorElement()).toHaveFocus();

    await user.tab({ shift: true });

    expect(screen.queryByRole('listbox', { hidden: false })).toBeNull();
    expect(editorElement()).toHaveAttribute('aria-expanded', 'false');
    expect(editor.getText()).toBe('@Puer');
    expect(editorElement().querySelector('a')).toBeNull();
    // El foco sigue el recorrido normal de la ventana: sale del editor.
    expect(editorElement()).not.toHaveFocus();
    expect(document.activeElement).not.toBe(editorElement());
  });

  it('con cero coincidencias muestra el vacío y Enter no inserta', async () => {
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@zzz');
    await screen.findByRole('listbox');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(
      screen.getAllByText(messages.entities.editor.mentionEmpty).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.entities.editor.mentionEmpty,
    );

    await press('{Enter}');

    expect(editor.getJSON().content?.[0]?.content ?? []).toEqual([
      { type: 'text', text: '@zzz' },
    ]);
  });

  it('sin fichas candidatas usa el mensaje del mundo vacío', async () => {
    const { editorRef } = renderEditor({ candidates: [] });
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@');
    await screen.findByRole('listbox');

    expect(
      screen.getAllByText(messages.entities.editor.mentionNoEntities).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.entities.editor.mentionNoEntities,
    );
  });

  it('no abre dentro de una marca de enlace', async () => {
    const documentWithLink: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Puerto Sal',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `wc-entity://${PUERTO_ID}` },
                },
              ],
            },
          ],
        },
      ],
    };
    const { editorRef } = renderEditor({ document: documentWithLink });
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.setTextSelection(5);
      editor.commands.insertContent('@');
    });

    expect(screen.queryByRole('listbox', { hidden: false })).toBeNull();
    expect(editorElement()).toHaveAttribute('aria-expanded', 'false');
  });

  it('el botón Mención inserta @ tras un espacio cuando hace falta', async () => {
    const user = userEvent.setup();
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, 'Hola');
    await user.click(
      screen.getByRole('button', {
        name: messages.entities.editor.mention,
      }),
    );

    await screen.findByRole('listbox');
    expect(editor.getText()).toBe('Hola @');
    expect(editorElement()).toHaveAttribute('aria-expanded', 'true');
  });

  it('el botón Mención sale de un enlace antes de insertar', async () => {
    const user = userEvent.setup();
    const documentWithLink: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Puerto Sal',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `wc-entity://${PUERTO_ID}` },
                },
              ],
            },
          ],
        },
      ],
    };
    const { editorRef } = renderEditor({ document: documentWithLink });
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.setTextSelection(5);
    });
    await user.click(
      screen.getByRole('button', {
        name: messages.entities.editor.mention,
      }),
    );

    await screen.findByRole('listbox');
    expect(editor.getText()).toBe('Puerto Sal @');

    const nodes = editor.getJSON().content?.[0]?.content ?? [];

    expect(nodes[0]?.text).toBe('Puerto Sal');
    expect(nodes[0]?.marks?.[0]?.attrs?.href).toBe(`wc-entity://${PUERTO_ID}`);
    expect(nodes.at(-1)?.marks).toBeUndefined();
  });

  it('muestra el nombre de 120 caracteres completo y sin truncar', async () => {
    const longName = 'A'.repeat(120);
    const { editorRef } = renderEditor({
      candidates: [entity(PUERTO_ID, longName)],
    });
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@');
    await screen.findByRole('listbox');

    const option = screen.getByRole('option');

    expect(option.querySelector('.wc-mention__name')?.textContent).toHaveLength(
      120,
    );
    expect(option.textContent).toContain(longName);
  });

  it('deshacer revierte la mención completa en un solo paso', async () => {
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await typeInEditor(editor, '@Puer');
    await screen.findByRole('listbox');
    await press('{Enter}');

    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks).toHaveLength(1);

    await act(async () => {
      editor.commands.undo();
    });

    expect(editor.getText()).toBe('@Puer');
    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks).toBeUndefined();
  });

  it('conserva los enlaces preexistentes al insertar otra mención', async () => {
    const documentWithLinks: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Antes ' },
            {
              type: 'text',
              text: 'Altar',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `wc-entity://${ALTAR_ID}` },
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Mara',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `wc-entity://${MARA_ID}` },
                },
              ],
            },
          ],
        },
        { type: 'paragraph' },
      ],
    };
    const { editorRef } = renderEditor({ document: documentWithLinks });
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });
    await typeInEditor(editor, '@Puer');
    await screen.findByRole('listbox');
    await press('{Enter}');

    const json = JSON.stringify(editor.getJSON());

    expect(json).toContain(`wc-entity://${ALTAR_ID}`);
    expect(json).toContain(`wc-entity://${MARA_ID}`);
    expect(json).toContain(`wc-entity://${PUERTO_ID}`);
  });

  it('el diálogo de enlace inserta el enlace interno sin HTML', async () => {
    const user = userEvent.setup();
    const { editorRef } = renderEditor();
    const editor = await ready(editorRef);

    await act(async () => {
      editor.commands.focus();
    });
    await user.click(
      screen.getByRole('button', { name: messages.entities.editor.link }),
    );

    const dialog = screen.getByRole('dialog', {
      name: messages.entities.editor.linkTitle,
    });

    await user.type(
      within(dialog).getByLabelText(messages.entities.editor.linkSearch),
      'Puerto',
    );
    await user.click(
      within(dialog).getByRole('button', { name: /Puerto Sal/ }),
    );

    expect(editor.getJSON().content?.[0]?.content).toEqual([
      {
        type: 'text',
        text: 'Puerto Sal',
        marks: [
          expect.objectContaining({
            type: 'link',
            attrs: expect.objectContaining({
              href: `wc-entity://${PUERTO_ID}`,
            }),
          }),
        ],
      },
    ]);
  });
});

describe('enlaces internos en edición', () => {
  const documentWithLink: EntityRichTextDocument = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Nació en ' },
          {
            type: 'text',
            text: 'Puerto Sal',
            marks: [
              { type: 'link', attrs: { href: `wc-entity://${PUERTO_ID}` } },
            ],
          },
        ],
      },
    ],
  };

  it('Ctrl o Cmd+clic abre la ficha sin editar el documento', async () => {
    const user = userEvent.setup();
    const onOpenEntity = vi.fn();
    const { editorRef } = renderEditor({
      document: documentWithLink,
      onOpenEntity,
    });
    const editor = await ready(editorRef);

    // user-event mantiene el modificador mientras se pulsa: es la forma de
    // simular Ctrl/Cmd+clic sin depender de una API de opciones del clic.
    await user.keyboard('{Control>}');
    await user.click(linkAnchor());
    await user.keyboard('{/Control}');
    expect(onOpenEntity).toHaveBeenCalledWith(PUERTO_ID);

    await user.keyboard('{Meta>}');
    await user.click(linkAnchor());
    await user.keyboard('{/Meta}');
    expect(onOpenEntity).toHaveBeenCalledTimes(2);
    expect(onOpenEntity).toHaveBeenLastCalledWith(PUERTO_ID);

    // Navegar no es editar: el texto y los nodos de la descripción no cambian.
    expect(editor.getText()).toBe('Nació en Puerto Sal');

    const content = editor.getJSON().content?.[0]?.content ?? [];

    expect(content.map((node) => node.text)).toEqual([
      'Nació en ',
      'Puerto Sal',
    ]);
  });

  it('no navega si el enlace interno no lleva un UUID v7 válido', async () => {
    const user = userEvent.setup();
    const onOpenEntity = vi.fn();
    const documentWithInvalidLink: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Destino inválido',
              marks: [
                {
                  type: 'link',
                  // UUID v4: cumple la forma general pero no la versión 7 que
                  // exige el contrato de enlaces internos.
                  attrs: {
                    href: 'wc-entity://01900000-0000-4000-8000-000000000001',
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const { editorRef } = renderEditor({
      document: documentWithInvalidLink,
      onOpenEntity,
    });
    await ready(editorRef);

    await user.keyboard('{Control>}');
    await user.click(linkAnchor());
    await user.keyboard('{/Control}');
    expect(onOpenEntity).not.toHaveBeenCalled();

    await user.keyboard('{Meta>}');
    await user.click(linkAnchor());
    await user.keyboard('{/Meta}');
    expect(onOpenEntity).not.toHaveBeenCalled();
  });

  it('el clic normal en edición no navega ni sale del editor', async () => {
    const user = userEvent.setup();
    const onOpenEntity = vi.fn();
    const { editorRef } = renderEditor({
      document: documentWithLink,
      onOpenEntity,
    });
    const editor = await ready(editorRef);

    await user.click(linkAnchor());

    expect(onOpenEntity).not.toHaveBeenCalled();
    expect(editor.getText()).toBe('Nació en Puerto Sal');
    expect(
      screen.getByRole('toolbar', { name: messages.entities.editor.label }),
    ).toBeVisible();
  });
});

describe('modo lectura', () => {
  it('no monta barra, listbox ni atributos de formulario', async () => {
    const documentWithLink: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Puerto Sal',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `wc-entity://${PUERTO_ID}` },
                },
              ],
            },
          ],
        },
      ],
    };
    const { editorRef } = renderEditor({
      document: documentWithLink,
      readOnly: true,
    });
    await ready(editorRef);

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    const dom = editorElement();

    for (const attribute of [
      'role',
      'aria-label',
      'aria-expanded',
      'aria-controls',
      'aria-activedescendant',
      'aria-autocomplete',
      'aria-multiline',
      'tabindex',
    ]) {
      expect(dom).not.toHaveAttribute(attribute);
    }
  });
});
