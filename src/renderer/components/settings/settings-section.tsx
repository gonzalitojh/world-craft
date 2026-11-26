import type { ReactNode } from 'react';

import { cx } from '../../lib/class-names';

export interface SettingsSectionProps {
  readonly id: string;
  readonly title: string;
  readonly lead?: string | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Sección editorial de Ajustes con su encabezado real.
 *
 * El `h1` pertenece a la barra superior del shell; cada sección usa `h2` para
 * conservar el esquema del documento.
 */
export function SettingsSection({
  id,
  title,
  lead,
  className,
  children,
}: SettingsSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      className={cx('wc-settings__section', className)}
      aria-labelledby={headingId}
    >
      <h2 className="wc-settings__heading" id={headingId}>
        {title}
      </h2>
      {lead === undefined ? null : <p className="wc-settings__lead">{lead}</p>}
      {children}
    </section>
  );
}
