import type { ReactNode } from 'react';

import { cx } from '../lib/class-names';

export interface DisclosureSectionProps {
  /** Identificador estable de la sección, también usado en `data-section`. */
  readonly id: string;
  readonly title: string;
  readonly open: boolean;
  readonly onToggle: (open: boolean) => void;
  /** Acciones reales de la sección; nunca se anidan dentro del botón. */
  readonly actions?: ReactNode;
  /** Dato secundario del encabezado (recuento de palabras, campos…). */
  readonly meta?: string | undefined;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
  readonly children: ReactNode;
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path
        d="m4 6 4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Sección plegable con encabezado real y acciones separadas.
 *
 * El `h3` conserva el esquema del documento y contiene un botón que plegado es
 * el propio título. El cuerpo permanece montado al cerrar y se oculta con
 * `hidden`, de modo que el editor de descripción conserva su estado. Las
 * acciones viven fuera del botón para no anidar controles.
 */
export function DisclosureSection({
  id,
  title,
  open,
  onToggle,
  actions,
  meta,
  headingLevel = 3,
  className,
  children,
}: DisclosureSectionProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const headingId = `${id}-heading`;
  const bodyId = `${id}-body`;

  return (
    <section
      className={cx('wc-disclosure', className)}
      id={id}
      data-section={id.replace(/^wc-entity-section-/, '')}
      data-open={open}
      aria-labelledby={headingId}
    >
      <div className="wc-disclosure__header">
        <Heading className="wc-disclosure__heading" id={headingId}>
          <button
            type="button"
            className="wc-disclosure__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => {
              onToggle(!open);
            }}
          >
            <span className="wc-disclosure__chevron" aria-hidden="true">
              <ChevronIcon />
            </span>
            <span className="wc-disclosure__title">{title}</span>
            {meta === undefined ? null : (
              <span className="wc-disclosure__meta">{meta}</span>
            )}
          </button>
        </Heading>
        {actions === undefined ? null : (
          <div className="wc-disclosure__actions">{actions}</div>
        )}
      </div>
      <div
        className="wc-disclosure__body"
        id={bodyId}
        data-open={open}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
}
