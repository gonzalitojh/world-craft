'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { DialogDescription, DialogOverlay, DialogTitle } from './dialog';

import { cn } from '@/lib/utils';
import { t } from '@/messages';

/**
 * Panel lateral (drawer) sobre el mismo primitivo que `Dialog`.
 *
 * No usa Vaul ni gestos de arrastre: el panel se abre con un botón y se cierra
 * con Escape o con su botón de cierre. Comparte con el diálogo la trampa de
 * foco, la devolución del foco al disparador y el velo `--overlay`; cambia la
 * posición y la animación, que sale de `motion.css` según `data-side`.
 */

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export type DrawerSide = 'left' | 'right' | 'bottom';

/**
 * Posición y tamaño de cada lado. El ancho se limita con `min()` para que en
 * pantallas de 360 px el panel nunca tape el velo entero ni desborde.
 */
const sideClasses: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0 h-full w-[min(20rem,85vw)] border-r',
  right: 'inset-y-0 right-0 h-full w-[min(20rem,85vw)] border-l',
  /*
   * El panel inferior respeta el área segura del dispositivo: sin ese relleno,
   * en un móvil con gesto inferior la última acción queda debajo de la barra
   * del sistema y no se puede pulsar.
   */
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] w-full border-t pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
};

export type DrawerContentProps = ComponentProps<
  typeof DialogPrimitive.Content
> & {
  /** Borde por el que entra el panel. Por defecto, la derecha. */
  side?: DrawerSide;
  /** Título obligatorio; se pinta como nombre accesible del panel. */
  title: string;
  /** Oculta el título a la vista pero no a los lectores de pantalla. */
  titleHidden?: boolean;
  /** Descripción opcional del panel. */
  description?: string;
};

export function DrawerContent({
  side = 'right',
  title,
  titleHidden = false,
  description,
  className,
  children,
  ...props
}: DrawerContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        data-side={side}
        className={cn(
          'fixed z-(--z-dialog) flex min-w-0 flex-col gap-4 overflow-y-auto border-border bg-surface p-5 shadow-dialog',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 flex-col gap-1.5 pr-12">
          <DialogTitle className={titleHidden ? 'sr-only' : undefined}>
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </div>
        {/*
          Mismo orden que en el diálogo: el cierre se tabula después del título
          y antes del contenido, que es donde lo ve quien usa la pantalla.
        */}
        <DialogPrimitive.Close
          className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color,border-color] hover:bg-foreground/5 hover:text-foreground"
          aria-label={t('a11y.closeDrawer')}
        >
          <X aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
