import type { ReactNode } from 'react';

import { cx } from '../lib/class-names';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Insignia de estado.
 *
 * El tono solo colorea la superficie; el texto visible es siempre el
 * indicador real, de modo que la información no depende del color.
 */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cx('wc-badge', `wc-badge--${tone}`, className)}>
      {children}
    </span>
  );
}
