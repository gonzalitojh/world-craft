import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Etiqueta de estado.
 *
 * Cada variante combina una superficie teñida con el texto del mismo estado
 * (`--success-surface` con `--success`), parejas que `tests/unit/tokens.test.ts`
 * mide a 4.5:1 en los dos temas. El color nunca es la única información: el
 * componente está pensado para llevar texto y, si hace falta, un icono; el
 * icono es decorativo (`aria-hidden`) para que el lector no lea el símbolo
 * además del texto.
 */
export const badgeVariants = cva(
  'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-raised text-foreground',
        accent: 'border-transparent bg-accent-muted text-accent',
        success: 'border-transparent bg-success-surface text-success',
        warning: 'border-transparent bg-warning-surface text-warning',
        danger: 'border-transparent bg-danger-surface text-danger',
        info: 'border-transparent bg-info-surface text-info',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    /** Icono decorativo que acompaña al texto. */
    icon?: ReactNode;
  };

export function Badge({
  className,
  variant,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </span>
  );
}
