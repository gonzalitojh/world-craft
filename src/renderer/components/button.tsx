import type { ButtonHTMLAttributes, Ref } from 'react';

import { cx } from '../lib/class-names';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Muestra el indicador de progreso y bloquea el botón. */
  readonly loading?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * Botón nativo con variantes del sistema de diseño.
 *
 * El estado `loading` añade `aria-busy`, deshabilita el control y pinta un
 * indicador puramente visual (`aria-hidden`): el nombre accesible sigue siendo
 * el texto del botón y el lector de pantalla sabe que está ocupado.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  disabled = false,
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cx(
        'wc-button',
        `wc-button--${variant}`,
        `wc-button--${size}`,
        loading && 'wc-button--loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
    >
      {loading ? (
        <span className="wc-button__spinner" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
