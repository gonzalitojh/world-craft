import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Campo de texto de varias líneas.
 *
 * Comparte tokens y estados con `Input`: 44 px de alto mínimo (lo garantiza
 * `min-h-28`, que ya supera el objetivo táctil), borde de error con
 * `aria-invalid` y texto de ayuda asociado por el consumidor (`Field` lo hace
 * por ti con `aria-describedby`).
 */
export function Textarea({
  className,
  rows = 4,
  ...props
}: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      data-slot="textarea"
      className={cn(
        'flex min-h-28 w-full min-w-0 resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/30',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
