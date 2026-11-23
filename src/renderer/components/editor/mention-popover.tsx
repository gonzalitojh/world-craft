/**
 * Popup presentacional del selector de menciones.
 *
 * Es el `listbox` del patrón combobox: siempre está montado en edición (oculto
 * con `hidden` cuando no hay consulta) para que `aria-controls` del editor
 * apunte siempre a un nodo existente. No captura el foco: las opciones se
 * activan con `mousedown` y `preventDefault`, de modo que el foco permanece en
 * el contenteditable.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import type { EntitySummary } from '../../../shared/contracts/entities';
import { useMessages } from '../../i18n/provider';
import { cx } from '../../lib/class-names';
import {
  placeFloatingPanel,
  type FloatingAnchor,
} from '../../lib/floating-panel';
import { TypeIcon } from '../entities/type-icon';

export interface MentionPopoverProps {
  /** Identificador estable del `listbox`. */
  readonly id: string;
  readonly open: boolean;
  readonly hasCandidates: boolean;
  readonly matches: readonly EntitySummary[];
  readonly total: number;
  readonly activeIndex: number;
  readonly anchor: FloatingAnchor | null;
  readonly onSelect: (entity: EntitySummary) => void;
  readonly onHover: (index: number) => void;
  readonly elementRef: RefObject<HTMLDivElement | null>;
}

const OPTION_ID_PREFIX = '-option-';
const FALLBACK_WIDTH = 352;

function optionId(listId: string, index: number): string {
  return `${listId}${OPTION_ID_PREFIX}${index}`;
}

/** Popup de menciones con su listbox y la región de anuncio. */
export function MentionPopover({
  id,
  open,
  hasCandidates,
  matches,
  total,
  activeIndex,
  anchor,
  onSelect,
  onHover,
  elementRef,
}: MentionPopoverProps) {
  const messages = useMessages();
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [height, setHeight] = useState(0);
  const [viewport, setViewport] = useState({ width: 1024, height: 700 });

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const measure = (): void => {
      setViewport({
        width: window.innerWidth || 1024,
        height: window.innerHeight || 700,
      });
    };

    measure();
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const node = optionRefs.current[activeIndex];

    node?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, matches.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const node = elementRef.current;

    if (node === null) {
      return;
    }

    const rect = node.getBoundingClientRect();

    if (rect.width > 0) {
      setWidth(rect.width);
    }

    if (node.scrollHeight > 0) {
      setHeight(node.scrollHeight);
    }
  }, [open, matches.length, total, viewport, elementRef]);

  const position =
    open && anchor !== null
      ? placeFloatingPanel({
          anchor,
          panel: { width, height },
          viewport,
        })
      : null;

  const announcement = !open
    ? ''
    : !hasCandidates
      ? messages.entities.editor.mentionNoEntities
      : total === 0
        ? messages.entities.editor.mentionEmpty
        : total > matches.length
          ? messages.entities.editor.mentionResultsLimited(
              matches.length,
              total,
            )
          : messages.entities.editor.mentionResults(total);

  return (
    <>
      <div
        ref={elementRef}
        className="wc-mention"
        role="presentation"
        hidden={!open}
        style={{
          top: position?.top,
          left: position?.left,
          maxHeight: position?.maxHeight,
          visibility: position === null ? 'hidden' : undefined,
        }}
      >
        <ul
          id={id}
          className="wc-mention__list"
          role="listbox"
          aria-label={messages.entities.editor.mentionListLabel}
          hidden={!open}
        >
          {open
            ? matches.map((entity, index) => (
                <li
                  key={entity.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={optionId(id, index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cx(
                    'wc-mention__option',
                    index === activeIndex && 'wc-mention__option--active',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(entity);
                  }}
                  onMouseEnter={() => {
                    onHover(index);
                  }}
                >
                  <span className="wc-mention__icon" aria-hidden="true">
                    <TypeIcon name={entity.typeIcon} />
                  </span>
                  <span className="wc-mention__label">
                    <span className="wc-mention__name">{entity.name}</span>
                    <span className="wc-mention__type">{entity.typeName}</span>
                  </span>
                </li>
              ))
            : null}
        </ul>
        {open && matches.length === 0 ? (
          <p className="wc-mention__empty">
            {hasCandidates
              ? messages.entities.editor.mentionEmpty
              : messages.entities.editor.mentionNoEntities}
          </p>
        ) : null}
      </div>
      <p
        className="wc-visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
    </>
  );
}
