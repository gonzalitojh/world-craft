import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Selector nativo.
 *
 * Se usa `<select>` a propósito y no el primitivo de Radix: el control nativo
 * ya es accesible por teclado, lo anuncian bien los lectores de pantalla y en
 * móvil abre el selector del sistema. `appearance-none` quita la flecha del
 * navegador para pintar un chevron propio, decorativo y `aria-hidden`: el
 * nombre accesible sigue viniendo de la etiqueta asociada.
 */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <div className="relative w-full min-w-0">
      <select
        data-slot="select"
        className={cn(
          'h-11 w-full min-w-0 appearance-none rounded-md border border-border bg-surface-raised py-2 pl-3 pr-10 text-sm text-foreground',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/30',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-muted-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
