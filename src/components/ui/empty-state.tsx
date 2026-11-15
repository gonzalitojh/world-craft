import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { t } from '@/messages';

/**
 * Estado vacío: «aquí todavía no hay nada».
 *
 * Es un patrón, no un adorno: siempre explica qué falta, por qué y qué puede
 * hacer la persona. Por eso la acción es opcional pero el título no (cae a un
 * texto genérico centralizado). El icono es decorativo; el significado lo
 * llevan el título y la descripción.
 */
export type EmptyStateProps = {
  icon?: ReactNode;
  /** Título del estado. Si falta, usa el texto genérico del catálogo. */
  title?: string;
  /**
   * Elemento del título. `h3` por defecto; `h4` cuando el estado vacío cuelga
   * de un `h3` (un espécimen del catálogo, una tarjeta) y `p` cuando no debe
   * aparecer en el índice de encabezados.
   */
  titleAs?: 'p' | 'h2' | 'h3' | 'h4';
  description?: string;
  /** Acción principal (normalmente un `Button`). */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  titleAs = 'h3',
  description,
  action,
  className,
}: EmptyStateProps) {
  const Title = titleAs;

  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex min-w-0 flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface-sunken px-5 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted-foreground [&_svg]:size-6"
        >
          {icon}
        </span>
      ) : null}
      <Title className="min-w-0 font-display text-lg tracking-display text-foreground">
        {title ?? t('empty.defaultTitle')}
      </Title>
      {description ? (
        <p className="max-w-prose min-w-0 text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
