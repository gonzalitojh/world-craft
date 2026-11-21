import { useId, type ReactNode } from 'react';

import { cx } from '../lib/class-names';

export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  /** Icono decorativo; el título sigue siendo el indicador real. */
  readonly icon?: ReactNode;
  /** Acción principal; suele ser un botón. */
  readonly action?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

/**
 * Estado vacío que explica qué falta y qué hacer.
 *
 * Se anuncia como una región con nombre propio para que el lector de pantalla
 * pueda saltar a ella cuando cambia el contenido de la vista. La jerarquía la
 * dan el espacio y el texto: no hay caja, borde discontinuo ni superficie
 * elevada.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const titleId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <section className={cx('wc-empty', className)} aria-labelledby={titleId}>
      {icon === undefined ? null : (
        <span className="wc-empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <Heading className="wc-empty__title" id={titleId}>
        {title}
      </Heading>
      <p className="wc-empty__description">{description}</p>
      {action ? <div className="wc-empty__actions">{action}</div> : null}
    </section>
  );
}
