import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cx } from '../lib/class-names';
import { IconButton, type IconButtonVariant } from './icon-button';

export type MenuItemTone = 'default' | 'danger';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly tone?: MenuItemTone;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export interface MenuProps {
  /** Nombre accesible del disparador y del propio menú. */
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly align?: 'start' | 'end';
  readonly triggerVariant?: IconButtonVariant;
  /** Ayuda del disparador; se anuncia con `aria-describedby` y al foco. */
  readonly triggerTooltip?: string;
  readonly className?: string;
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" focusable="false">
      <circle cx="4.5" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="15.5" cy="10" r="1.6" />
    </svg>
  );
}

/**
 * Menú de acciones secundarias disparado por un botón «⋯».
 *
 * Sigue el patrón ARIA `menu`/`menuitem` sin trampa de foco: se abre con clic
 * o con Enter/Espacio, mueve el foco con flechas, Inicio y Fin, se cierra con
 * Escape devolviendo el foco al disparador, y también con Tab o un clic fuera.
 * Los ítems deshabilitados no reciben foco ni ejecutan su acción.
 */
export function Menu({
  label,
  items,
  align = 'start',
  triggerVariant = 'ghost',
  triggerTooltip,
  className,
}: MenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [position, setPosition] = useState<{
    readonly top: number;
    readonly left: number;
  } | null>(null);

  const enabledIndexes = items.flatMap((item, index) =>
    item.disabled === true ? [] : [index],
  );
  const firstEnabled = enabledIndexes[0] ?? 0;
  const lastEnabled = enabledIndexes[enabledIndexes.length - 1] ?? 0;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    const list = listRef.current;

    if (trigger === null || list === null) {
      return;
    }

    // El menú se posiciona respecto al viewport para no generar scroll
    // horizontal ni quedar recortado por un ancestro con overflow.
    const margin = 24;
    const triggerRect = trigger.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const spaceLeft = triggerRect.left - margin;
    const spaceRight = viewportWidth - triggerRect.right - margin;
    const fitsStart = spaceRight >= listRect.width;
    const fitsEnd = spaceLeft >= listRect.width;
    let alignToEnd = align === 'end';

    if (alignToEnd && !fitsEnd) {
      alignToEnd = fitsStart || spaceLeft > spaceRight ? false : true;
    } else if (!alignToEnd && !fitsStart) {
      alignToEnd = fitsEnd || spaceLeft > spaceRight ? true : false;
    }

    const preferredLeft = alignToEnd
      ? triggerRect.right - listRect.width
      : triggerRect.left;
    const left = Math.min(
      Math.max(preferredLeft, margin),
      Math.max(margin, viewportWidth - margin - listRect.width),
    );
    let top = triggerRect.bottom + 4;

    if (top + listRect.height > viewportHeight - margin) {
      top = Math.max(margin, triggerRect.top - listRect.height - 4);
    }

    setPosition({ top, left });
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open || position === null) {
      return;
    }

    itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex, position]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;

      if (
        target instanceof Node &&
        containerRef.current?.contains(target) !== true
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnViewportChange = (): void => {
      setOpen(false);
    };
    const handleScroll = (event: Event): void => {
      const target = event.target;

      // La rueda o el teclado pueden desplazar el propio menú: ese scroll no
      // debe cerrarlo. El desplazamiento de la página sí.
      if (target instanceof Node && listRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };
    let armed = false;
    const frame = window.requestAnimationFrame(() => {
      armed = true;
    });
    const guardedScroll = (event: Event): void => {
      if (!armed) {
        return;
      }

      handleScroll(event);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', guardedScroll, true);
    window.addEventListener('resize', closeOnViewportChange);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', guardedScroll, true);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, [open]);

  const closeAndReturnFocus = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openAt = (targetIndex: number): void => {
    setFocusIndex(targetIndex);
    setOpen(true);
  };

  const moveFocus = (delta: number): void => {
    if (enabledIndexes.length === 0) {
      return;
    }

    const currentPosition = enabledIndexes.indexOf(focusIndex);
    const position = currentPosition === -1 ? 0 : currentPosition;
    const nextPosition =
      (position + delta + enabledIndexes.length) % enabledIndexes.length;

    setFocusIndex(enabledIndexes[nextPosition] ?? firstEnabled);
  };

  const handleItemKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-1);
        return;
      case 'Home':
        event.preventDefault();
        setFocusIndex(firstEnabled);
        return;
      case 'End':
        event.preventDefault();
        setFocusIndex(lastEnabled);
        return;
      case 'Escape':
        event.preventDefault();
        closeAndReturnFocus();
        return;
      case 'Tab':
        setOpen(false);
        triggerRef.current?.focus();
        return;
      case 'PageDown':
      case 'PageUp': {
        const list = listRef.current;
        const canScroll =
          list !== null && list.scrollHeight > list.clientHeight;

        if (canScroll) {
          return;
        }

        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      default:
        return;
    }
  };

  return (
    <div ref={containerRef} className={cx('wc-menu', className)}>
      <IconButton
        ref={triggerRef}
        label={label}
        tooltip={triggerTooltip}
        icon={<MoreIcon />}
        variant={triggerVariant}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openAt(firstEnabled);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openAt(lastEnabled);
          }
        }}
        onClick={() => {
          if (open) {
            closeAndReturnFocus();
            return;
          }

          openAt(firstEnabled);
        }}
      />
      {open ? (
        <div
          ref={listRef}
          className="wc-menu__list"
          role="menu"
          id={menuId}
          aria-label={label}
          style={{
            top: position?.top,
            left: position?.left,
            visibility: position === null ? 'hidden' : 'visible',
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              className={cx(
                'wc-menu__item',
                item.tone === 'danger' && 'wc-menu__item--danger',
              )}
              tabIndex={-1}
              disabled={item.disabled}
              onKeyDown={handleItemKeyDown}
              onClick={() => {
                // Cerrar y devolver el foco antes de ejecutar la acción: si el
                // ítem abre un diálogo, este captura como disparador el botón
                // «⋯» y al cerrarse restaura el foco en el lugar correcto.
                closeAndReturnFocus();
                item.onSelect();
              }}
            >
              {item.icon === undefined ? null : (
                <span className="wc-menu__item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="wc-menu__item-label">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
