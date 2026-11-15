import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Estilos del botón.
 *
 * Conserva los nombres estándar de shadcn/ui (`default`, `outline`, `ghost`,
 * `destructive`, `link`) pero los mapea a los tokens semánticos de World Craft.
 *
 * Decisiones que no son obvias:
 *
 * - Altura mínima de 44 px en móvil (`h-11`), también en `sm`: el objetivo
 *   táctil de las guías de accesibilidad no depende del tamaño del texto. Solo
 *   a partir de `sm` (puntero fino habitual) `sm` baja a 36 px.
 * - El hover usa `accent-strong` y `danger-strong`, tonos más contrastados que
 *   el color base. Nada de `/90`: bajar la opacidad del acento acercaría el
 *   texto al fondo y rompería el contraste AA en uno de los dos temas.
 * - El estado deshabilitado no baja la opacidad: usa superficie elevada y texto
 *   atenuado, que mantienen el contraste AA en los dos temas.
 * - `outline` y `ghost` se aclaran con `foreground/5`, un velo del propio token
 *   de tinta que funciona igual en claro y en oscuro.
 * - La transición enumera color, fondo y borde en lugar de usar
 *   `transition-colors`: en Tailwind 4 esa utilidad incluye `outline-color`, así
 *   que el anillo de foco arrancaba con el `currentColor` del texto y se veía
 *   como un destello de bajo contraste antes de llegar al token `--focus`.
 */
export const buttonVariants = cva(
  'inline-flex min-w-0 items-center justify-center gap-2 rounded-md border border-transparent text-center font-medium transition-[color,background-color,border-color] disabled:pointer-events-none disabled:border-border disabled:bg-surface-raised disabled:text-muted-foreground aria-disabled:pointer-events-none aria-disabled:border-border aria-disabled:bg-surface-raised aria-disabled:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink hover:bg-accent-strong',
        outline:
          'border-border bg-transparent text-foreground hover:bg-foreground/5',
        ghost: 'bg-transparent text-foreground hover:bg-foreground/5',
        destructive: 'bg-danger text-danger-ink hover:bg-danger-strong',
        link: 'bg-transparent text-accent underline-offset-4 hover:text-accent-strong hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm: 'h-11 px-3 text-sm sm:h-9',
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
    /**
     * Muestra un indicador de progreso, marca `aria-busy` y bloquea el botón.
     * Con `asChild` no se pinta el indicador (el hijo debe ser un único nodo).
     */
    loading?: boolean;
  };

/**
 * Botón base del sistema de diseño.
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
  loading = false,
  disabled = false,
  type,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const busy = loading ? { 'aria-busy': true } : {};

  if (asChild) {
    return (
      <Slot
        data-slot="button"
        aria-disabled={disabled || undefined}
        className={classes}
        {...busy}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={classes}
      {...busy}
      {...props}
    >
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}
