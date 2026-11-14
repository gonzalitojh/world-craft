import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Estilos del botón.
 *
 * Conserva los nombres estándar de shadcn/ui (`default`, `outline`, `ghost`,
 * `destructive`) pero los mapea a los tokens semánticos de World Craft. La
 * altura mínima es 44 px (`h-11`) para cumplir el tamaño táctil recomendado.
 *
 * El estado deshabilitado no baja la opacidad: usa superficie elevada y texto
 * atenuado, que mantienen el contraste AA en los dos temas.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border border-transparent text-center font-medium transition-colors disabled:pointer-events-none disabled:border-border disabled:bg-surface-raised disabled:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink hover:bg-accent/90',
        outline:
          'border-border bg-transparent text-foreground hover:bg-foreground/5',
        ghost: 'bg-transparent text-foreground hover:bg-foreground/5',
        destructive: 'bg-danger text-danger-ink hover:bg-danger/90',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza el hijo (por ejemplo un `<Link>`) en lugar de un `<button>`. */
    asChild?: boolean;
  };

/**
 * Botón base del scaffold.
 *
 * No usa `whitespace-nowrap`: las etiquetas largas deben envolver en móvil.
 * El foco visible viene de la regla global `:focus-visible`; el componente no
 * lo anula.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
