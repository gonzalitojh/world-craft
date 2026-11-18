import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactNode,
} from 'react';

import { cx } from '../lib/class-names';

interface TriggerAttributes {
  'aria-describedby'?: string | undefined;
}

export interface TooltipProps {
  readonly label: string;
  /** Disparador; debe ser un control enfocable, normalmente un botón. */
  readonly children: ReactNode;
  /** Alineación del bocadillo respecto al disparador. */
  readonly align?: 'start' | 'end';
}

/**
 * Tooltip para datos breves o iconos.
 *
 * Aparece con el foco y con el ratón, describe al disparador con
 * `aria-describedby` y se oculta con Escape o al salir. No calcula posiciones:
 * el bocadillo es absoluto respecto al disparador, con un ancho máximo para no
 * salirse de la ventana.
 */
export function Tooltip({ label, children, align = 'start' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

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
      className={cx('wc-tooltip', align === 'end' && 'wc-tooltip--end')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          hide();
        }
      }}
    >
      {trigger}
      {visible ? (
        <span className="wc-tooltip__bubble" role="tooltip" id={tooltipId}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
