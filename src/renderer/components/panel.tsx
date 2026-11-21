import { useId, type ReactNode } from 'react';

import { cx } from '../lib/class-names';

export interface PanelProps {
  readonly title: string;
  readonly description?: string;
  /** Acciones del encabezado, normalmente un menú `⋯` o un botón de icono. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

/**
 * Sección con encabezado real y acciones.
 *
 * Es presentacional: no gestiona plegado ni estado (llega con #132). La
 * jerarquía la dan la superficie y el espacio, sin borde ni sombra por defecto.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  footer,
  headingLevel = 2,
  className,
}: PanelProps) {
  const titleId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <section className={cx('wc-panel', className)} aria-labelledby={titleId}>
      <header className="wc-panel__header">
        <div className="wc-panel__heading">
          <Heading className="wc-panel__title" id={titleId}>
            {title}
          </Heading>
          {description === undefined ? null : (
            <p className="wc-panel__description">{description}</p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="wc-panel__actions">{actions}</div>
        )}
      </header>
      <div className="wc-panel__body">{children}</div>
      {footer === undefined ? null : (
        <footer className="wc-panel__footer">{footer}</footer>
      )}
    </section>
  );
}
