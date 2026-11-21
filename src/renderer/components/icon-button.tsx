import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { cx } from '../lib/class-names';
import { Tooltip } from './tooltip';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger';
export type IconButtonSize = 'md' | 'sm';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  /** Nombre accesible obligatorio: el icono por sí solo no describe la acción. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
  /** Texto de ayuda asociado con `aria-describedby` y visible al foco. */
  readonly tooltip?: string;
  /** Estado de conmutador; se anuncia con `aria-pressed`. */
  readonly pressed?: boolean;
  /** Muestra el indicador de progreso y bloquea el botón. */
  readonly loading?: boolean;
  /** Referencia al botón nativo para gestionar el foco desde el menú. */
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * Botón cuadrado que solo contiene un icono.
 *
 * El nombre accesible es obligatorio por tipos (`label`) y se aplica con
 * `aria-label`. El icono va en un contenedor `aria-hidden` para no duplicar el
 * anuncio; el tooltip, si existe, describe el botón con `aria-describedby`.
 */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  tooltip,
  pressed,
  loading = false,
  type = 'button',
  disabled = false,
  className,
  ref,
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cx(
        'wc-icon-button',
        `wc-icon-button--${variant}`,
        `wc-icon-button--${size}`,
        loading && 'wc-icon-button--loading',
        className,
      )}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-busy={loading ? true : undefined}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="wc-icon-button__spinner" aria-hidden="true" />
      ) : (
        <span className="wc-icon-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );

  return tooltip === undefined ? (
    button
  ) : (
    <Tooltip label={tooltip}>{button}</Tooltip>
  );
}
