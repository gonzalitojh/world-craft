/**
 * Barra mínima del editor: negrita, cursiva, menú «Formato», enlace y mención.
 *
 * Las acciones avanzadas (párrafos, títulos, listas, cita y enlaces
 * contextuales) viven solo en el menú «Formato», que reutiliza el primitivo
 * `Menu` con disparador etiquetado e ítems marcables.
 */
import type { Editor } from '@tiptap/core';

import { ENTITY_LINK_PREFIX } from '../../../shared/contracts/entities';
import { UUID_V7_PATTERN } from '../../../shared/entities/uuid';
import { useMessages } from '../../i18n/provider';
import { IconButton } from '../icon-button';
import { Menu, type MenuItem } from '../menu';

export type EntityLinkMode = 'enabled' | 'disabled' | 'off';

export interface EditorToolbarProps {
  readonly editor: Editor | null;
  readonly disabled: boolean;
  readonly entityLinks: EntityLinkMode;
  readonly navigateLinks: boolean;
  readonly onOpenLink: () => void;
  readonly onInsertMention: () => void;
  /** Se llama al abrir «Formato» para cerrar el selector de menciones. */
  readonly onFormatOpen: () => void;
  readonly onOpenEntity: (entityId: string) => void;
}

function ChevronIcon() {
  return (
    <svg
      className="wc-menu__chevron"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 8 4 4 4-4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.2-2.2a3.5 3.5 0 0 0-5-5L9.5 5.5" />
      <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0l-2.2 2.2a3.5 3.5 0 0 0 5 5l1.2-1.2" />
    </svg>
  );
}

/** Barra de herramientas del editor enriquecido. */
export function EditorToolbar({
  editor,
  disabled,
  entityLinks,
  navigateLinks,
  onOpenLink,
  onInsertMention,
  onFormatOpen,
  onOpenEntity,
}: EditorToolbarProps) {
  const messages = useMessages();
  const controlsDisabled = disabled || editor === null;
  const linksDisabled = controlsDisabled || entityLinks === 'disabled';

  const formatItems: readonly MenuItem[] = [
    {
      id: 'paragraph',
      label: messages.entities.editor.paragraph,
      role: 'menuitemradio',
      checked: editor?.isActive('heading') !== true,
      onSelect: () => {
        editor?.chain().focus().setParagraph().run();
      },
    },
    {
      id: 'heading-1',
      label: messages.entities.editor.heading1,
      role: 'menuitemradio',
      checked: editor?.isActive('heading', { level: 1 }) ?? false,
      onSelect: () => {
        editor?.chain().focus().setHeading({ level: 1 }).run();
      },
    },
    {
      id: 'heading-2',
      label: messages.entities.editor.heading2,
      role: 'menuitemradio',
      checked: editor?.isActive('heading', { level: 2 }) ?? false,
      onSelect: () => {
        editor?.chain().focus().setHeading({ level: 2 }).run();
      },
    },
    {
      id: 'heading-3',
      label: messages.entities.editor.heading3,
      role: 'menuitemradio',
      checked: editor?.isActive('heading', { level: 3 }) ?? false,
      onSelect: () => {
        editor?.chain().focus().setHeading({ level: 3 }).run();
      },
    },
    {
      id: 'bullet-list',
      label: messages.entities.editor.bulletList,
      role: 'menuitemcheckbox',
      checked: editor?.isActive('bulletList') ?? false,
      separatorBefore: true,
      onSelect: () => {
        editor?.chain().focus().toggleBulletList().run();
      },
    },
    {
      id: 'ordered-list',
      label: messages.entities.editor.orderedList,
      role: 'menuitemcheckbox',
      checked: editor?.isActive('orderedList') ?? false,
      onSelect: () => {
        editor?.chain().focus().toggleOrderedList().run();
      },
    },
    {
      id: 'quote',
      label: messages.entities.editor.quote,
      role: 'menuitemcheckbox',
      checked: editor?.isActive('blockquote') ?? false,
      onSelect: () => {
        editor?.chain().focus().toggleBlockquote().run();
      },
    },
    {
      id: 'link-open',
      label: messages.entities.editor.linkOpen,
      separatorBefore: true,
      disabled: editor?.isActive('link') !== true,
      onSelect: () => {
        const href = editor?.getAttributes('link').href;

        if (typeof href !== 'string' || !href.startsWith(ENTITY_LINK_PREFIX)) {
          return;
        }

        const entityId = href.slice(ENTITY_LINK_PREFIX.length);

        // El href puede venir de un documento importado: solo se navega si el
        // identificador cumple el UUID v7 del contrato de enlaces internos.
        if (!UUID_V7_PATTERN.test(entityId)) {
          return;
        }

        onOpenEntity(entityId);
      },
    },
    {
      id: 'link-remove',
      label: messages.entities.editor.linkRemove,
      disabled: editor?.isActive('link') !== true,
      onSelect: () => {
        editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      },
    },
  ];

  const visibleFormatItems = navigateLinks
    ? formatItems
    : formatItems.filter((item) => item.id !== 'link-open');

  return (
    <div
      className="wc-editor__toolbar"
      role="toolbar"
      aria-label={messages.entities.editor.label}
    >
      <IconButton
        label={messages.entities.editor.bold}
        icon={
          <span
            className="wc-editor__glyph wc-editor__glyph--bold"
            data-glyph={messages.entities.editor.boldShort}
            aria-hidden="true"
          />
        }
        pressed={editor?.isActive('bold') ?? false}
        disabled={controlsDisabled}
        onClick={() => {
          editor?.chain().focus().toggleBold().run();
        }}
      />
      <IconButton
        label={messages.entities.editor.italic}
        icon={
          <span
            className="wc-editor__glyph wc-editor__glyph--italic"
            data-glyph={messages.entities.editor.italicShort}
            aria-hidden="true"
          />
        }
        pressed={editor?.isActive('italic') ?? false}
        disabled={controlsDisabled}
        onClick={() => {
          editor?.chain().focus().toggleItalic().run();
        }}
      />
      <span className="wc-editor__divider" aria-hidden="true" />
      <Menu
        label={messages.entities.editor.formatMenu}
        className="wc-editor__format"
        triggerContent={
          <>
            <span>{messages.entities.editor.format}</span>
            <ChevronIcon />
          </>
        }
        triggerClassName="wc-editor__format-trigger"
        disabled={controlsDisabled}
        checkable
        onOpenChange={(open) => {
          if (open) {
            onFormatOpen();
          }
        }}
        items={visibleFormatItems}
      />
      {entityLinks === 'off' ? null : (
        <>
          <IconButton
            label={messages.entities.editor.link}
            icon={<LinkIcon />}
            disabled={linksDisabled}
            onClick={onOpenLink}
          />
          <IconButton
            label={messages.entities.editor.mention}
            tooltip={messages.entities.editor.mentionHint}
            icon={
              // El glifo `@` es un símbolo tipográfico decorativo, no texto de
              // interfaz: el nombre accesible lo aporta `mention`.
              <span
                className="wc-editor__glyph"
                data-glyph="@"
                aria-hidden="true"
              />
            }
            disabled={linksDisabled}
            onClick={onInsertMention}
          />
        </>
      )}
    </div>
  );
}
