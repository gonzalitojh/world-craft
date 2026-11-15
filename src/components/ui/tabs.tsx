'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Pestañas sobre `@radix-ui/react-tabs`.
 *
 * El primitivo aporta los roles (`tablist`, `tab`, `tabpanel`), la navegación
 * con flechas, Inicio/Fin, el `aria-controls` y el `aria-selected`. Aquí solo se
 * pinta el estado activo con el token de acento y se asegura el objetivo táctil
 * de 44 px en cada pestaña.
 *
 * El panel es enfocable (`tabIndex` 0) porque puede contener contenido
 * desplazable, así que **no se le quita el foco visible**: hereda la regla
 * global `:focus-visible` como cualquier otro elemento de la página.
 */

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex min-w-0 flex-wrap items-stretch gap-1 border-b border-border',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-t-md border-b-2 border-transparent px-3 text-center text-sm font-medium text-muted-foreground transition-[color,background-color,border-color] hover:text-foreground',
        'data-[state=active]:border-accent data-[state=active]:text-accent',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('mt-4 min-w-0 text-sm text-foreground', className)}
      {...props}
    />
  );
}
