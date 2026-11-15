import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Campo de texto de una línea.
 *
 * - 44 px de alto mínimo en móvil (`h-11`) para que el área táctil cumpla.
 * - `aria-invalid` se soporta de forma explícita: el borde y el anillo de error
 *   salen de `--danger`, así que se ven en los dos temas.
 * - El foco visible lo pone la regla global `:focus-visible`; no se anula aquí.
 */
export function Input({
  className,
  type = 'text',
  ...props
}: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/30',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
