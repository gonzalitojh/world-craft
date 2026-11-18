import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cx } from '../lib/class-names';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  /** Nombre accesible del conjunto de pestañas. */
  readonly label: string;
  /** Pestaña seleccionada al montar; por defecto, la primera. */
  readonly initialId?: string;
  readonly className?: string;
}

/**
 * Pestañas con los patrones ARIA de `tablist`/`tab`/`tabpanel`.
 *
 * Usa tabindex móvil: solo la pestaña activa entra en el orden de tabulación y
 * las flechas, Inicio y Fin mueven el foco. Solo se monta el panel activo, así
 * que no hay contenido duplicado ni paneles ocultos con `display: none`; por
 * eso `aria-controls` solo se declara en la pestaña activa, que es la única que
 * tiene un panel real al que apuntar.
 */
export function Tabs({ items, label, initialId, className }: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [requestedId, setRequestedId] = useState(
    initialId ?? items[0]?.id ?? '',
  );

  const foundIndex = items.findIndex((item) => item.id === requestedId);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;
  const activeItem = items[activeIndex];

  if (!activeItem) {
    return null;
  }

  const tabId = (id: string): string => `${baseId}-tab-${id}`;
  const panelId = (id: string): string => `${baseId}-panel-${id}`;

  const activate = (index: number): void => {
    const item = items[index];

    if (!item) {
      return;
    }

    setRequestedId(item.id);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    const lastIndex = items.length - 1;
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = index >= lastIndex ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        nextIndex = index <= 0 ? lastIndex : index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    activate(nextIndex);
  };

  return (
    <div className={cx('wc-tabs', className)}>
      <div className="wc-tabs__list" role="tablist" aria-label={label}>
        {items.map((item, index) => {
          const selected = item.id === activeItem.id;

          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(item.id)}
              className="wc-tabs__tab"
              aria-selected={selected}
              aria-controls={selected ? panelId(item.id) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setRequestedId(item.id);
              }}
              onKeyDown={(event) => {
                handleKeyDown(event, index);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        className="wc-tabs__panel"
        role="tabpanel"
        id={panelId(activeItem.id)}
        aria-labelledby={tabId(activeItem.id)}
        tabIndex={0}
      >
        {activeItem.content}
      </div>
    </div>
  );
}
