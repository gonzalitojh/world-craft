import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageShellProps = {
  children: ReactNode;
  /** Clases extra; por ejemplo `max-w-md` para pantallas estrechas. */
  className?: string;
};

/**
 * Contenedor común de las páginas.
 *
 * Centraliza el ancho máximo y el espaciado vertical para que todas las
 * pantallas compartan ritmo y no haya anchos hardcodeados sueltos. El ancho
 * sale de `--content-max` y los párrafos largos se limitan a `--prose-max`
 * dentro de cada página, de modo que el contenido respira en pantallas anchas
 * sin estirar la lectura.
 *
 * A 360 px el padding es de 1 rem y el contenido se adapta sin scroll
 * horizontal de página.
 */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-(--content-max) min-w-0 px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20',
        className,
      )}
    >
      {children}
    </div>
  );
}
