import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface TriggerAttributes {
  'aria-describedby'?: string | undefined;
}

export interface TooltipProps {
  readonly label: string;
  /** Disparador; debe ser un control enfocable, normalmente un botón. */
  readonly children: ReactNode;
  /** Alineación preferida del bocadillo respecto al disparador. */
  readonly align?: 'start' | 'end';
}

/**
 * Tooltip para datos breves o iconos.
 *
 * Aparece con el foco y con el ratón, describe al disparador con
 * `aria-describedby` y se oculta con Escape o al salir. Se posiciona respecto
 * al viewport (`position: fixed`), con `max-content` y un máximo de 18rem: si
 * el disparador está junto al borde derecho, el bocadillo se voltea y se limita
 * para no generar scroll horizontal ni quedar recortado por un ancestro.
 */
export function Tooltip({ label, children, align = 'start' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{
    readonly top: number;
    readonly left: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    const trigger = wrapperRef.current;
    const bubble = bubbleRef.current;

    if (trigger === null || bubble === null) {
      return;
    }

    const margin = 24;
    const triggerRect = trigger.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const preferredLeft =
      align === 'end' ? triggerRect.right - bubbleRect.width : triggerRect.left;
    const left = Math.min(
      Math.max(preferredLeft, margin),
      Math.max(margin, viewportWidth - margin - bubbleRect.width),
    );
    const triggerCenter = triggerRect.top + triggerRect.height / 2;
    const preferAbove = triggerCenter > viewportHeight / 2;
    const below = triggerRect.bottom + 8;
    const above = triggerRect.top - bubbleRect.height - 8;
    const fitsBelow = below + bubbleRect.height <= viewportHeight - margin;
    const fitsAbove = above >= margin;
    let top: number;

    if (preferAbove && fitsAbove) {
      top = above;
    } else if (!preferAbove && fitsBelow) {
      top = below;
    } else if (fitsAbove) {
      top = above;
    } else {
      top = Math.max(
        margin,
        Math.min(below, viewportHeight - margin - bubbleRect.height),
      );
    }

    setPosition({ top, left });
  }, [visible, align]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const hideOnViewportChange = (): void => {
      setVisible(false);
    };

    window.addEventListener('scroll', hideOnViewportChange, true);
    window.addEventListener('resize', hideOnViewportChange);

    return () => {
      window.removeEventListener('scroll', hideOnViewportChange, true);
      window.removeEventListener('resize', hideOnViewportChange);
    };
  }, [visible]);

  const show = (): void => {
    setVisible(true);
  };

  const hide = (): void => {
    setVisible(false);
  };

  const describedBy = [
    isValidElement<TriggerAttributes>(children)
      ? children.props['aria-describedby']
      : undefined,
    visible ? tooltipId : undefined,
  ]
    .filter((entry): entry is string => entry !== undefined && entry !== '')
    .join(' ');

  const trigger = isValidElement<TriggerAttributes>(children)
    ? cloneElement(children, {
        'aria-describedby': describedBy.length > 0 ? describedBy : undefined,
      })
    : children;

  return (
    <span
      ref={wrapperRef}
      className="wc-tooltip"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && visible) {
          // El primer Escape cierra solo el tooltip: se detiene la propagación
          // y se cancela la acción nativa del `<dialog>` que lo contiene.
          event.preventDefault();
          event.stopPropagation();
          hide();
        }
      }}
    >
      {trigger}
      {visible ? (
        <span
          ref={bubbleRef}
          className="wc-tooltip__bubble"
          role="tooltip"
          id={tooltipId}
          style={{
            top: position?.top,
            left: position?.left,
            visibility: position === null ? 'hidden' : 'visible',
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
