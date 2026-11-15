import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Tarjeta: agrupación con superficie elevada y sombra de papel.
 *
 * La elevación sale de `--elevation-card` (`shadow-card`), que se tinta con la
 * paleta de cada tema. `min-w-0` es obligatorio: dentro de un flex o un grid,
 * sin él un hijo con texto largo ensancharía la columna y provocaría scroll
 * horizontal de página.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5 shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
      {...props}
    />
  );
}

export type CardTitleProps = ComponentProps<'h3'> & {
  /**
   * Nivel del encabezado. Por defecto `h3`: una tarjeta suele colgar de la
   * sección `h2` de la página, y saltarse niveles rompe la navegación por
   * encabezados de los lectores de pantalla.
   */
  as?: 'h2' | 'h3' | 'h4';
};

export function CardTitle({ as = 'h3', className, ...props }: CardTitleProps) {
  const Heading = as;

  return (
    <Heading
      data-slot="card-title"
      className={cn(
        'min-w-0 font-display text-lg tracking-display text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('min-w-0 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('min-w-0 text-sm', className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-4',
        className,
      )}
      {...props}
    />
  );
}
