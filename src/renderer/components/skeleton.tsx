import { cx } from '../lib/class-names';

export type SkeletonVariant = 'text' | 'block' | 'circle';

export interface SkeletonProps {
  readonly variant?: SkeletonVariant;
  readonly width?: string;
  readonly height?: string;
  readonly className?: string;
}

/**
 * Marcador de carga puramente visual.
 *
 * Lleva `aria-hidden`; el contenedor que espera datos debe declarar
 * `aria-busy="true"` y anunciar el resultado por el `aria-live` del contexto.
 * El pulso solo usa colores del tema y se detiene con movimiento reducido.
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps) {
  return (
    <span
      className={cx('wc-skeleton', `wc-skeleton--${variant}`, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonTextProps {
  readonly lines?: number;
  readonly className?: string;
}

/** Bloque de varias líneas de esqueleto con la última línea más corta. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const count = Math.max(1, Math.round(lines));

  return (
    <span className={cx('wc-skeleton-text', className)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cx(
            'wc-skeleton',
            'wc-skeleton--text',
            index === count - 1 && 'wc-skeleton--last',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
