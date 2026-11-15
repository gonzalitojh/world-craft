'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Globo de ayuda sobre `@radix-ui/react-tooltip`.
 *
 * Uso previsto: **solo** botones de icono y el rail colapsado, es decir, sitios
 * donde el texto no cabe en la interfaz. Nunca como única etiqueta accesible:
 * el disparador debe llevar su propio `aria-label`, porque el globo no existe
 * para quien navega con teclado táctil o con lector de pantalla hasta que se
 * abre, y Radix lo oculta a los lectores cuando está cerrado.
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;

export function TooltipTrigger({
  className,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      className={cn('min-w-0', className)}
      {...props}
    />
  );
}

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-(--z-dialog) max-w-xs min-w-0 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-foreground shadow-card',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-surface-raised" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
