'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/components/i18n/locale-provider';
import { cn } from '@/lib/utils';

/**
 * Piezas de maquetación de la página viva del sistema de diseño.
 *
 * `DesignSection` es el bloque de nivel 2 (Fundamentos, Componentes…) y
 * `Specimen` el de nivel 3 (un componente o una escala). La jerarquía de
 * encabezados es fija para que la navegación por encabezados de un lector de
 * pantalla describa la página real: un solo `h1`, secciones en `h2` y piezas en
 * `h3`.
 */

type DesignSectionProps = {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
};

export function DesignSection({
  id,
  title,
  note,
  children,
}: DesignSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mt-14 min-w-0 scroll-mt-(--topbar-height) border-t pt-8"
    >
      <h2
        id={`${id}-title`}
        className="min-w-0 font-display text-display-md tracking-display text-foreground"
      >
        {title}
      </h2>
      <p className="mt-3 max-w-(--prose-max) min-w-0 text-muted-foreground">
        {note}
      </p>
      <div className="mt-8 flex min-w-0 flex-col gap-10">{children}</div>
    </section>
  );
}

type SpecimenProps = {
  id: string;
  title: string;
  /** Cuándo usarlo; se pinta bajo el ejemplo con su etiqueta. */
  note: string;
  children: ReactNode;
  /** Clases extra para la caja del ejemplo. */
  className?: string;
};

export function Specimen({
  id,
  title,
  note,
  children,
  className,
}: SpecimenProps) {
  const { t } = useI18n();

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <h3
        id={`${id}-title`}
        className="min-w-0 font-display text-xl tracking-display text-foreground"
      >
        {title}
      </h3>
      <div
        className={cn(
          'mt-3 flex min-w-0 flex-wrap items-center gap-3 rounded-lg border bg-surface-raised p-4',
          className,
        )}
      >
        {children}
      </div>
      <p className="mt-3 max-w-(--prose-max) min-w-0 text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          {t('design.usageLabel')}.
        </span>{' '}
        {note}
      </p>
    </section>
  );
}
