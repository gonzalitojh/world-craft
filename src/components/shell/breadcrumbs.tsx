import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import type { Breadcrumb } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

/**
 * Migajas de pan.
 *
 * Semántica: `<nav>` con nombre accesible y una lista ordenada, que es lo que
 * esperan los lectores de pantalla para anunciar «elemento 2 de 2». El último
 * elemento no es un enlace y lleva `aria-current="page"`.
 *
 * En móvil solo se ven el padre y la página actual (`index < length - 2` se
 * oculta hasta `sm`): con dos niveles no cambia nada, pero la regla deja sitio
 * a rutas más profundas sin enseñar una miga cortada.
 *
 * Los textos no se truncan con puntos suspensivos: envuelven con
 * `break-words`, porque una miga es contenido esencial.
 */
type BreadcrumbsProps = {
  items: readonly Breadcrumb[];
  /** Nombre accesible del `nav`; por defecto, «Ruta de navegación». */
  label?: string;
  className?: string;
};

export function Breadcrumbs({ items, label, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label={label ?? t('a11y.breadcrumbs')}
      className={cn('min-w-0', className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const hiddenOnMobile = index < items.length - 2;

          return (
            <li
              key={item.id}
              className={cn(
                'flex min-w-0 items-center gap-x-2',
                hiddenOnMobile ? 'hidden sm:flex' : 'flex',
              )}
            >
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="min-w-0 break-words text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t(item.labelKey)}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'min-w-0 break-words',
                    isLast
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </span>
              )}
              {isLast ? null : (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
