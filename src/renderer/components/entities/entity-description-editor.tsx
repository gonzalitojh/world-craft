import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import {
  ENTITY_LINK_PREFIX,
  type EntityRichTextDocument,
  type EntitySummary,
} from '../../../shared/contracts/entities';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityDescriptionEditorProps {
  readonly document: EntityRichTextDocument | null;
  readonly candidates: readonly EntitySummary[];
  readonly disabled: boolean;
  readonly onChange: (document: EntityRichTextDocument | null) => void;
  readonly onOpenEntity: (entityId: string) => void;
}

const EMPTY_DOCUMENT: EntityRichTextDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/**
 * Editor de la descripción enriquecida.
 *
 * Tiptap 3 con el conjunto básico (párrafos, títulos, listas, cita, negrita,
 * cursiva y saltos) y un único tipo de enlace: `wc-entity://<id>` a otra ficha
 * del mismo mundo. No se pega HTML ni se permiten enlaces externos; el JSON que
 * produce se valida otra vez en el proceso principal.
 */
export function EntityDescriptionEditor({
  document,
  candidates,
  disabled,
  onChange,
  onOpenEntity,
}: EntityDescriptionEditorProps) {
  const { messages } = useI18n();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

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
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    editable: !disabled,
    // Las marcas activas cambian al mover el cursor, no solo al editar: el
    // toolbar debe repintarse para que «Abrir enlace» y los estados
    // `aria-pressed` sean fiables sin tocar el documento.
    shouldRerenderOnTransaction: true,
    // El contrato usa readonly para el renderer; Tiptap espera su JSON mutable.
    content: (document ?? EMPTY_DOCUMENT) as never,
    editorProps: {
      attributes: {
        class: 'wc-editor__content',
        'aria-label': messages.entities.detail.descriptionLabel,
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getJSON() as EntityRichTextDocument);
    },
  });

  useEffect(() => {
    if (editor === null) {
      return;
    }

    editor.setEditable(!disabled);
  }, [editor, disabled]);

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

  const filtered = candidates.filter((candidate) => {
    const term = linkSearch.trim().toLocaleLowerCase('es');

    return (
      term.length === 0 ||
      candidate.name.toLocaleLowerCase('es').includes(term) ||
      candidate.typeName.toLocaleLowerCase('es').includes(term)
    );
  });

  const insertLink = (entity: EntitySummary): void => {
    if (editor === null) {
      return;
    }

    const href = `${ENTITY_LINK_PREFIX}${entity.id}`;
    const chain = editor.chain().focus();

    if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: 'text',
          text: entity.name,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }

    setLinkOpen(false);
    setLinkSearch('');
  };

  const openLinkFromEvent = (event: MouseEvent<HTMLDivElement>): void => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      'a[href^="wc-entity://"]',
    );

    if (anchor === null) {
      return;
    }

    event.preventDefault();
    onOpenEntity(
      anchor.getAttribute('href')?.slice(ENTITY_LINK_PREFIX.length) ?? '',
    );
  };

  return (
    <div className="wc-editor">
      <div
        className="wc-editor__toolbar"
        role="toolbar"
        aria-label={messages.entities.editor.label}
      >
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={editor?.isActive('bold') ?? false}
          aria-label={messages.entities.editor.bold}
          disabled={disabled || editor === null}
          onClick={() => {
            editor?.chain().focus().toggleBold().run();
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph={messages.entities.editor.boldShort}
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={editor?.isActive('italic') ?? false}
          aria-label={messages.entities.editor.italic}
          disabled={disabled || editor === null}
          onClick={() => {
            editor?.chain().focus().toggleItalic().run();
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph={messages.entities.editor.italicShort}
            aria-hidden="true"
          />
        </Button>
        {([1, 2, 3] as const).map((level) => (
          <Button
            key={level}
            variant="ghost"
            size="sm"
            aria-pressed={editor?.isActive('heading', { level }) ?? false}
            aria-label={
              level === 1
                ? messages.entities.editor.heading1
                : level === 2
                  ? messages.entities.editor.heading2
                  : messages.entities.editor.heading3
            }
            disabled={disabled || editor === null}
            onClick={() => {
              editor?.chain().focus().toggleHeading({ level }).run();
            }}
          >
            <span
              className="wc-editor__glyph"
              data-glyph={messages.entities.editor.headingShort(level)}
              aria-hidden="true"
            />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={editor?.isActive('bulletList') ?? false}
          aria-label={messages.entities.editor.bulletList}
          disabled={disabled || editor === null}
          onClick={() => {
            editor?.chain().focus().toggleBulletList().run();
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph="•"
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={editor?.isActive('orderedList') ?? false}
          aria-label={messages.entities.editor.orderedList}
          disabled={disabled || editor === null}
          onClick={() => {
            editor?.chain().focus().toggleOrderedList().run();
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph="1."
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={editor?.isActive('blockquote') ?? false}
          aria-label={messages.entities.editor.quote}
          disabled={disabled || editor === null}
          onClick={() => {
            editor?.chain().focus().toggleBlockquote().run();
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph="“”"
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={editor?.isActive('link') ?? false}
          aria-label={messages.entities.editor.link}
          disabled={disabled || editor === null}
          onClick={() => {
            setLinkOpen(true);
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph="🔗"
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={messages.entities.editor.linkRemove}
          disabled={disabled || editor === null || !editor.isActive('link')}
          onClick={() => {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
          }}
        >
          <span
            className="wc-editor__glyph"
            data-glyph="⛓"
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || editor === null || !editor.isActive('link')}
          onClick={() => {
            const href = editor?.getAttributes('link').href;

            if (
              typeof href === 'string' &&
              href.startsWith(ENTITY_LINK_PREFIX)
            ) {
              onOpenEntity(href.slice(ENTITY_LINK_PREFIX.length));
            }
          }}
        >
          {messages.entities.editor.linkOpen}
        </Button>
      </div>

      <div onClickCapture={openLinkFromEvent}>
        <EditorContent editor={editor} />
      </div>

      <p className="wc-field__hint">
        {messages.entities.detail.descriptionHint}
      </p>

      <Dialog
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setLinkSearch('');
        }}
        title={messages.entities.editor.linkTitle}
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              setLinkOpen(false);
              setLinkSearch('');
            }}
          >
            {messages.entities.editor.linkCancel}
          </Button>
        }
      >
        <p className="wc-dialog__lead">{messages.entities.editor.linkLead}</p>
        <TextField
          label={messages.entities.editor.linkSearch}
          value={linkSearch}
          onChange={(event) => {
            setLinkSearch(event.target.value);
          }}
          autoFocus
        />
        {filtered.length === 0 ? (
          <p className="wc-dialog__lead">
            {messages.entities.editor.linkEmpty}
          </p>
        ) : (
          <ul className="wc-link-list">
            {filtered.map((candidate) => (
              <li key={candidate.id}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="wc-link-list__item"
                  onClick={() => {
                    insertLink(candidate);
                  }}
                >
                  <span className="wc-link-list__name">{candidate.name}</span>
                  <span className="wc-link-list__type">
                    {candidate.typeName}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
