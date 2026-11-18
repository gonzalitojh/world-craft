import { useId, type ReactNode } from 'react';

import { cx } from '../lib/class-names';

export type CardTone = 'plain' | 'accent';

export interface CardProps {
  readonly title: string;
  readonly tone?: CardTone;
  /** Nivel del título dentro de la jerarquía de la página. */
  readonly headingLevel?: 2 | 3;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Tarjeta como `<article>` etiquetado por su título.
 *
 * El título es un encabezado real para que la estructura de la página siga
 * siendo navegable por encabezados; el nivel se ajusta al contexto.
 */
export function Card({
  title,
  tone = 'plain',
  headingLevel = 2,
  children,
  className,
}: CardProps) {
  const titleId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <article
      className={cx(
        'wc-card',
        tone === 'accent' && 'wc-card--accent',
        className,
      )}
      aria-labelledby={titleId}
    >
      <Heading className="wc-card__title" id={titleId}>
        {title}
      </Heading>
      <div className="wc-card__body">{children}</div>
    </article>
  );
}
