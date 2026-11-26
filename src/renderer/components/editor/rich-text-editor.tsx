/**
 * Editor enriquecido reutilizable.
 *
 * Compone la barra mínima, el contenteditable de Tiptap, el selector de
 * menciones `@` / `[[` y el diálogo de enlace. No conoce la página de fichas ni
 * el autoguardado: recibe el documento, las candidatas y notifica los cambios y
 * las aperturas de enlaces internos. El manuscrito de M3 podrá usarlo con la
 * misma API.
 */
import Link from '@tiptap/extension-link';
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type Ref,
} from 'react';

import {
  ENTITY_LINK_PREFIX,
  type EntityRichTextDocument,
  type EntitySummary,
} from '../../../shared/contracts/entities';
import { UUID_V7_PATTERN } from '../../../shared/entities/uuid';
import type { FloatingAnchor } from '../../lib/floating-panel';
import { EditorToolbar } from './editor-toolbar';
import {
  EMPTY_MENTION_STATE,
  Mention,
  closeMention,
  getMentionState,
  insertMention,
  insertMentionTrigger,
  setActiveMention,
  setMentionCandidates,
  setMentionEnabled,
} from './extensions/mention';
import { LinkDialog } from './link-dialog';
import { buildMentionContent } from './mention-content';
import { MentionPopover } from './mention-popover';
import { filterMentionCandidates } from './mention-query';

export type EntityLinkMode = 'enabled' | 'disabled' | 'off';

export interface RichTextEditorProps {
  readonly document: EntityRichTextDocument | null;
  /** Nombre accesible del editor y de su barra. */
  readonly label: string;
  readonly labelledBy?: string | undefined;
  readonly describedBy?: string | undefined;
  readonly invalid?: boolean;
  readonly hintId?: string | undefined;
  readonly candidates: readonly EntitySummary[];
  readonly hint?: string | undefined;
  readonly disabled?: boolean;
  /** Modo lectura: sin barra, sin selector y sin atributos de formulario. */
  readonly readOnly?: boolean;
  /** `off` no monta enlace ni menciones; `disabled` los deja deshabilitados. */
  readonly entityLinks?: EntityLinkMode;
  /** Con `false`, Ctrl/Cmd+clic y «Abrir enlace» no navegan. */
  readonly navigateLinks?: boolean;
  readonly onChange: (document: EntityRichTextDocument | null) => void;
  readonly onOpenEntity?: (entityId: string) => void;
  /** Referencia al editor para foco o desplazamiento programático. */
  readonly editorRef?: Ref<Editor | null> | undefined;
}

const EMPTY_DOCUMENT: EntityRichTextDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/**
 * Editor Tiptap con la lista cerrada de nodos de la descripción y un único
 * enlace interno `wc-entity://<id>`. El JSON resultante se valida otra vez en
 * el proceso principal.
 */
export function RichTextEditor({
  document,
  label,
  labelledBy,
  describedBy,
  invalid = false,
  hintId,
  candidates,
  hint,
  disabled = false,
  readOnly = false,
  entityLinks = 'enabled',
  navigateLinks = true,
  onChange,
  onOpenEntity,
  editorRef,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const listboxId = `wc-mention-${rawId.replaceAll(':', '')}`;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        trailingNode: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        enableClickSelection: true,
        protocols: ['wc-entity'],
        isAllowedUri: (url: string) => url.startsWith(ENTITY_LINK_PREFIX),
        validate: (url: string) => url.startsWith(ENTITY_LINK_PREFIX),
      }),
      Mention.configure({
        limit: 8,
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    editable: !disabled && !readOnly,
    // Las marcas activas y el estado del selector cambian al mover el cursor,
    // no solo al editar: la barra y el combobox deben repintarse.
    shouldRerenderOnTransaction: true,
    content: (document ?? EMPTY_DOCUMENT) as never,
    editorProps: {
      attributes: {
        class: 'wc-editor__content',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getJSON() as EntityRichTextDocument);
    },
  });

  useEffect(() => {
    if (editor === null) {
      return;
    }

    editor.setEditable(!disabled && !readOnly);
    setMentionEnabled(editor, entityLinks === 'enabled' && !readOnly);

    if (entityLinks !== 'enabled') {
      closeMention(editor);
    }
  }, [editor, disabled, readOnly, entityLinks]);

  useImperativeHandle(editorRef, () => editor ?? null, [editor]);

  useEffect(() => {
    if (editor === null) {
      return;
    }

    setMentionCandidates(editor.view, candidates);
  }, [editor, candidates]);

  const mentionState =
    useEditorState({
      editor,
      selector: ({ editor: current }) =>
        current === null ? EMPTY_MENTION_STATE : getMentionState(current.state),
    }) ?? EMPTY_MENTION_STATE;

  const search = useMemo(
    () => filterMentionCandidates(candidates, mentionState.query),
    [candidates, mentionState.query],
  );
  const matches = search.matches;
  const activeIndex = Math.min(
    mentionState.activeIndex,
    Math.max(0, matches.length - 1),
  );
  const activeOptionId =
    mentionState.open && matches.length > 0
      ? `${listboxId}-option-${activeIndex}`
      : null;

  const anchor = useMemo<FloatingAnchor | null>(() => {
    if (editor === null || !mentionState.open) {
      return null;
    }

    try {
      const coords = editor.view.coordsAtPos(mentionState.to);

      return {
        top: coords.top,
        left: coords.left,
        right: coords.right,
        bottom: coords.bottom,
      };
    } catch {
      return null;
    }
  }, [editor, mentionState.open, mentionState.to]);

  // Matriz ARIA del contrato: combobox solo con menciones habilitadas; textbox
  // multilínea mientras cargan, fallan o no hay enlaces; lectura sin atributos
  // de formulario. El rol cambia sin recrear el editor para no perder foco.
  useEffect(() => {
    if (editor === null) {
      return;
    }

    const dom = editor.view.dom;

    if (readOnly) {
      for (const attribute of [
        'role',
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'aria-invalid',
        'aria-disabled',
        'aria-expanded',
        'aria-controls',
        'aria-activedescendant',
        'aria-autocomplete',
        'aria-multiline',
        'aria-owns',
        'tabindex',
      ]) {
        dom.removeAttribute(attribute);
      }

      return;
    }

    dom.setAttribute('tabindex', '0');
    dom.removeAttribute('aria-owns');

    if (disabled) {
      dom.setAttribute('aria-disabled', 'true');
    } else {
      dom.removeAttribute('aria-disabled');
    }

    if (labelledBy !== undefined) {
      dom.setAttribute('aria-labelledby', labelledBy);
      dom.removeAttribute('aria-label');
    } else {
      dom.setAttribute('aria-label', label);
      dom.removeAttribute('aria-labelledby');
    }

    if (describedBy !== undefined && describedBy.length > 0) {
      dom.setAttribute('aria-describedby', describedBy);
    } else {
      dom.removeAttribute('aria-describedby');
    }

    if (invalid) {
      dom.setAttribute('aria-invalid', 'true');
    } else {
      dom.removeAttribute('aria-invalid');
    }

    if (entityLinks === 'enabled') {
      dom.setAttribute('role', 'combobox');
      dom.setAttribute('aria-expanded', mentionState.open ? 'true' : 'false');
      dom.setAttribute('aria-controls', listboxId);
      dom.setAttribute('aria-autocomplete', 'list');
      dom.removeAttribute('aria-multiline');

      if (activeOptionId === null) {
        dom.removeAttribute('aria-activedescendant');
      } else {
        dom.setAttribute('aria-activedescendant', activeOptionId);
      }

      return;
    }

    dom.setAttribute('role', 'textbox');
    dom.setAttribute('aria-multiline', 'true');
    dom.removeAttribute('aria-expanded');
    dom.removeAttribute('aria-controls');
    dom.removeAttribute('aria-activedescendant');
    dom.removeAttribute('aria-autocomplete');
  }, [
    editor,
    readOnly,
    disabled,
    label,
    labelledBy,
    describedBy,
    invalid,
    entityLinks,
    listboxId,
    mentionState.open,
    activeOptionId,
  ]);

  useEffect(() => {
    if (editor === null) {
      return;
    }

    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(document ?? EMPTY_DOCUMENT);

    if (current !== next) {
      editor.commands.setContent((document ?? EMPTY_DOCUMENT) as never, {
        emitUpdate: false,
      });
    }
  }, [document, editor]);

  // Al desplazar la página o redimensionar, el ancla del cursor deja de ser
  // fiable: se cierra sin borrar la consulta. El scroll interno del popup no
  // cuenta.
  useEffect(() => {
    if (editor === null || readOnly || !mentionState.open) {
      return;
    }

    const close = (): void => {
      closeMention(editor);
    };
    const handleScroll = (event: Event): void => {
      const target = event.target;

      if (target instanceof Node && popoverRef.current?.contains(target)) {
        return;
      }

      close();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [editor, readOnly, mentionState.open]);

  const openLinkFromEvent = (event: MouseEvent<HTMLDivElement>): void => {
    if (readOnly) {
      // En lectura basta un clic o Enter: los enlaces son la única parada.
    } else if (!navigateLinks || (!event.ctrlKey && !event.metaKey)) {
      return;
    }

    const anchorElement = (
      event.target as HTMLElement
    ).closest<HTMLAnchorElement>('a[href^="wc-entity://"]');

    if (anchorElement === null) {
      return;
    }

    event.preventDefault();

    const href = anchorElement.getAttribute('href');

    if (href === null) {
      return;
    }

    const entityId = href.slice(ENTITY_LINK_PREFIX.length);

    // El href puede venir de un documento importado: solo se navega si el
    // identificador cumple el UUID v7 del contrato de enlaces internos.
    if (!UUID_V7_PATTERN.test(entityId)) {
      return;
    }

    onOpenEntity?.(entityId);
  };

  const handleOpenLink = (): void => {
    if (editor !== null) {
      closeMention(editor);
    }

    setLinkOpen(true);
  };

  const handleSelectLink = (entity: EntitySummary): void => {
    if (editor === null) {
      setLinkOpen(false);
      return;
    }

    const href = `${ENTITY_LINK_PREFIX}${entity.id}`;
    const chain = editor.chain().focus();

    if (editor.state.selection.empty) {
      const [mention] = buildMentionContent(editor.schema, entity, {
        trailingSpace: false,
      });

      if (mention !== undefined) {
        chain.insertContent(mention as never).run();
      }
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }

    setLinkOpen(false);
  };

  const handleInsertMention = (): void => {
    if (editor === null) {
      return;
    }

    insertMentionTrigger(editor);
  };

  return (
    <div
      className="wc-editor"
      data-readonly={readOnly ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      data-entity-links={entityLinks}
    >
      {readOnly ? null : (
        <EditorToolbar
          editor={editor}
          disabled={disabled}
          entityLinks={entityLinks}
          navigateLinks={navigateLinks}
          onOpenLink={handleOpenLink}
          onInsertMention={handleInsertMention}
          onFormatOpen={() => {
            if (editor !== null) {
              closeMention(editor);
            }
          }}
          onOpenEntity={(entityId) => {
            onOpenEntity?.(entityId);
          }}
        />
      )}

      <div className="wc-editor__surface" onClickCapture={openLinkFromEvent}>
        <EditorContent editor={editor} />

        {readOnly || entityLinks !== 'enabled' ? null : (
          <MentionPopover
            id={listboxId}
            open={mentionState.open}
            hasCandidates={candidates.length > 0}
            matches={matches}
            total={search.total}
            activeIndex={activeIndex}
            anchor={anchor}
            onSelect={(entity) => {
              if (editor !== null) {
                insertMention(editor.view, entity);
              }
            }}
            onHover={(index) => {
              if (editor !== null) {
                setActiveMention(editor, index);
              }
            }}
            elementRef={popoverRef}
          />
        )}
      </div>

      {!readOnly && hint !== undefined ? (
        <p className="wc-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}

      {readOnly || entityLinks !== 'enabled' ? null : (
        <LinkDialog
          open={linkOpen}
          candidates={candidates}
          onSelect={handleSelectLink}
          onClose={() => {
            setLinkOpen(false);
          }}
        />
      )}
    </div>
  );
}
