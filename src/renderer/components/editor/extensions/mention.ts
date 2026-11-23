/**
 * Extensión de Tiptap para el selector de menciones.
 *
 * Implementa el typeahead con un plugin propio de ProseMirror sobre
 * `@tiptap/pm`, sin `@tiptap/suggestion`: necesita dos disparadores (`@` y
 * `[[`), reglas de límite distintas y una accesibilidad combobox/listbox que
 * serían nuestras igualmente. El plugin mantiene el estado abierto, la consulta
 * y la opción activa; inserción, cierre y navegación se resuelven con
 * transacciones de ProseMirror, nunca con HTML.
 */
import { Extension, getMarkRange, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

import type { EntitySummary } from '../../../../shared/contracts/entities';

import { buildMentionNodes, mentionHref } from '../mention-content';
import {
  detectMentionQuery,
  filterMentionCandidates,
  type MentionTrigger,
} from '../mention-query';

/** Estado del selector dentro del plugin de ProseMirror. */
export interface MentionState {
  readonly open: boolean;
  readonly trigger: MentionTrigger | null;
  /** Posición del documento donde empieza el disparador. */
  readonly from: number;
  /** Posición del cursor: fin de la consulta. */
  readonly to: number;
  readonly query: string;
  readonly activeIndex: number;
}

/** Estado cerrado reutilizable. */
export const EMPTY_MENTION_STATE: MentionState = {
  open: false,
  trigger: null,
  from: 0,
  to: 0,
  query: '',
  activeIndex: 0,
};

/** Clave estable del plugin de menciones. */
export const mentionPluginKey = new PluginKey<MentionState>('wcMention');

type MentionMeta =
  | { readonly type: 'close' }
  | { readonly type: 'set-active'; readonly index: number };

/** Opciones de la extensión. */
export interface MentionExtensionOptions {
  readonly limit: number;
}

/**
 * Fichas candidatas por vista.
 *
 * Se guardan en un `WeakMap` estable para actualizarlas sin recrear el editor ni
 * tocar el documento; la vista libera la entrada cuando se desmonta.
 */
const candidatesByView = new WeakMap<EditorView, readonly EntitySummary[]>();

/** Actualiza las candidatas de una vista sin recrear la extensión. */
export function setMentionCandidates(
  view: EditorView,
  candidates: readonly EntitySummary[],
): void {
  candidatesByView.set(view, candidates);
}

function getMentionCandidates(view: EditorView): readonly EntitySummary[] {
  return candidatesByView.get(view) ?? [];
}

const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

function detectState(state: EditorState, previous: MentionState): MentionState {
  const selection = state.selection;

  if (!(selection instanceof TextSelection) || !selection.empty) {
    return EMPTY_MENTION_STATE;
  }

  const $from = selection.$from;

  if (!$from.parent.isTextblock) {
    return EMPTY_MENTION_STATE;
  }

  // Dentro de un enlace no se abre: la mención heredaría un `href` ajeno.
  if ($from.marks().some((mark) => mark.type.name === 'link')) {
    return EMPTY_MENTION_STATE;
  }

  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    '\n',
    '\n',
  );
  const detected = detectMentionQuery(textBefore);

  if (detected === null) {
    return EMPTY_MENTION_STATE;
  }

  const sameQuery =
    previous.open &&
    previous.trigger === detected.trigger &&
    previous.query === detected.query;

  return {
    open: true,
    trigger: detected.trigger,
    from: $from.start() + detected.start,
    to: selection.from,
    query: detected.query,
    activeIndex: sameQuery ? previous.activeIndex : 0,
  };
}

function closeMentionView(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(mentionPluginKey, { type: 'close' }));
}

/** Cierra el selector desde React sin borrar el texto tecleado. */
export function closeMention(editor: Editor): void {
  if (getMentionState(editor.state).open) {
    closeMentionView(editor.view);
  }
}

/** Sincroniza la opción activa desde el ratón o el teclado. */
export function setActiveMention(editor: Editor, index: number): void {
  if (!getMentionState(editor.state).open) {
    return;
  }

  editor.view.dispatch(
    editor.state.tr.setMeta(mentionPluginKey, { type: 'set-active', index }),
  );
}

/** Estado actual del selector en un estado de ProseMirror. */
export function getMentionState(state: EditorState): MentionState {
  return mentionPluginKey.getState(state) ?? EMPTY_MENTION_STATE;
}

/**
 * Sustituye el disparador y la consulta por la mención en una sola transacción:
 * un paso de deshacer, un `onUpdate` y un autoguardado.
 */
export function insertMention(
  view: EditorView,
  entity: EntitySummary,
): boolean {
  const mentionState = getMentionState(view.state);

  if (!mentionState.open || mentionState.from >= mentionState.to) {
    return false;
  }

  const { state } = view;
  const { mention, space } = buildMentionNodes(state.schema, entity);
  // Si lo siguiente ya es un espacio, no se duplica: el cursor se coloca
  // después de ese espacio, fuera de la marca de enlace.
  const following = state.doc.textBetween(
    mentionState.to,
    Math.min(mentionState.to + 1, state.doc.content.size),
    '',
    '',
  );
  const needsSpace = following !== ' ';
  const nodes = needsSpace ? [mention, space] : [mention];

  try {
    const transaction = state.tr.replaceWith(
      mentionState.from,
      mentionState.to,
      nodes,
    );
    const cursor =
      mentionState.from + entity.name.length + (needsSpace ? 1 : 0);

    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(cursor), 1),
    );
    transaction.setStoredMarks([]);
    transaction.setMeta(mentionPluginKey, { type: 'close' });
    view.dispatch(transaction);
    view.focus();
    return true;
  } catch {
    return false;
  }
}

/**
 * Acción del botón «Mención»: inserta `@` (con un espacio previo solo si el
 * carácter anterior es de palabra) y deja que el plugin abra el selector.
 */
export function insertMentionTrigger(editor: Editor): void {
  const { state } = editor;
  const linkType = state.schema.marks.link;
  const selection = state.selection;
  const linkMark = selection.$from
    .marks()
    .find((mark) => mark.type === linkType);
  let position = selection.to;

  if (linkType !== undefined && linkMark !== undefined) {
    const range = getMarkRange(
      state.doc.resolve(selection.to),
      linkType,
      linkMark.attrs,
    );

    if (range !== undefined && range !== null) {
      position = range.to;
    }
  }

  const previous = state.doc.textBetween(
    Math.max(0, position - 1),
    position,
    '',
    '',
  );
  const leading =
    previous.length > 0 && WORD_CHARACTER.test(previous) ? ' ' : '';

  editor
    .chain()
    .focus()
    .setTextSelection(position)
    .unsetMark('link')
    .insertContent(`${leading}@`)
    .run();
}

/**
 * Extensión de Tiptap con el plugin de menciones.
 *
 * No pinta DOM propio: el popup y el `listbox` viven en React y se sincronizan
 * con el estado del plugin.
 */
export const Mention = Extension.create<MentionExtensionOptions>({
  name: 'mention',

  addOptions() {
    return {
      limit: 8,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin<MentionState>({
        key: mentionPluginKey,
        state: {
          init: () => EMPTY_MENTION_STATE,
          apply(transaction, previous, _oldState, newState) {
            const meta = transaction.getMeta(mentionPluginKey) as
              MentionMeta | undefined;

            if (meta?.type === 'close') {
              return EMPTY_MENTION_STATE;
            }

            if (meta?.type === 'set-active') {
              return previous.open
                ? { ...previous, activeIndex: Math.max(0, meta.index) }
                : previous;
            }

            if (
              !transaction.docChanged &&
              !transaction.selectionSet &&
              meta === undefined
            ) {
              return previous;
            }

            return detectState(newState, previous);
          },
        },
        props: {
          handleKeyDown(view, event) {
            if (view.composing) {
              return false;
            }

            const mentionState = getMentionState(view.state);

            if (!mentionState.open) {
              return false;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              closeMentionView(view);
              return true;
            }

            const { matches } = filterMentionCandidates(
              getMentionCandidates(view),
              mentionState.query,
              options.limit,
            );

            if (matches.length === 0) {
              return false;
            }

            const active = Math.min(
              Math.max(mentionState.activeIndex, 0),
              matches.length - 1,
            );
            const moveTo = (index: number): void => {
              view.dispatch(
                view.state.tr.setMeta(mentionPluginKey, {
                  type: 'set-active',
                  index,
                }),
              );
            };

            switch (event.key) {
              case 'ArrowDown':
                event.preventDefault();
                moveTo((active + 1) % matches.length);
                return true;
              case 'ArrowUp':
                event.preventDefault();
                moveTo((active - 1 + matches.length) % matches.length);
                return true;
              case 'Home':
                event.preventDefault();
                moveTo(0);
                return true;
              case 'End':
                event.preventDefault();
                moveTo(matches.length - 1);
                return true;
              case 'Enter': {
                const entity = matches[active];

                if (entity === undefined) {
                  return false;
                }

                event.preventDefault();
                return insertMention(view, entity);
              }
              case 'Tab': {
                if (event.shiftKey) {
                  closeMentionView(view);
                  return false;
                }

                const entity = matches[active];

                if (entity === undefined) {
                  return false;
                }

                event.preventDefault();
                return insertMention(view, entity);
              }
              default:
                return false;
            }
          },
        },
        handleDOMEvents: {
          blur(view: EditorView) {
            if (getMentionState(view.state).open) {
              closeMentionView(view);
            }

            return false;
          },
          compositionstart(view: EditorView) {
            if (getMentionState(view.state).open) {
              closeMentionView(view);
            }

            return false;
          },
        },
      }),
    ];
  },
});

/** Enlace interno de una ficha; se reexporta para el diálogo de enlace. */
export { mentionHref };
