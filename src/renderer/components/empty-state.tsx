import { useId, type ReactNode } from 'react';

import { cx } from '../lib/class-names';

export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  /** Acción principal; suele ser un botón. */
  readonly action?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

/**
 * Estado vacío que explica qué falta y qué hacer.
 *
 * Se anuncia como una región con nombre propio para que el lector de pantalla
 * pueda saltar a ella cuando cambia el contenido de la vista.
 */
export function EmptyState({
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const titleId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <section className={cx('wc-empty', className)} aria-labelledby={titleId}>
      <Heading className="wc-empty__title" id={titleId}>
        {title}
      </Heading>
      <p className="wc-empty__description">{description}</p>
      {action ? <div className="wc-empty__actions">{action}</div> : null}
    </section>
  );
}
