'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { useI18n } from '@/components/i18n/locale-provider';
import { cn } from '@/lib/utils';

/**
 * Diálogo modal sobre `@radix-ui/react-dialog`.
 *
 * El primitivo ya resuelve lo difícil: trampa de foco, cierre con Escape,
 * bloqueo del scroll de fondo y devolución del foco al disparador. Aquí solo se
 * añaden los tokens y una regla propia: **el título es obligatorio**, porque un
 * diálogo sin nombre accesible es un diálogo que un lector de pantalla anuncia
 * como «diálogo» y nada más.
 *
 * `DialogContent` recibe `title` y lo pinta; con `titleHidden` sigue existiendo
 * para lectores de pantalla pero no se ve (paletas de comandos, buscadores).
 * La descripción es opcional y, si falta, Radix no la referencia.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="overlay"
      className={cn('fixed inset-0 z-(--z-overlay) bg-overlay', className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'min-w-0 font-display text-xl tracking-display text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('min-w-0 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex min-w-0 flex-col gap-1.5 pr-12', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export type DialogContentProps = ComponentProps<
  typeof DialogPrimitive.Content
> & {
  /** Título obligatorio; se pinta como nombre accesible del diálogo. */
  title: string;
  /** Oculta el título a la vista pero no a los lectores de pantalla. */
  titleHidden?: boolean;
  /** Descripción opcional del diálogo. */
  description?: string;
  /**
   * Oculta el botón de cierre de la esquina. Solo para composiciones que ya
   * cierran de otra forma (una paleta de comandos con Escape y su propia
   * interfaz); nunca para un formulario.
   */
  hideCloseButton?: boolean;
};

export function DialogContent({
  title,
  titleHidden = false,
  description,
  hideCloseButton = false,
  className,
  children,
  ...props
}: DialogContentProps) {
  const { t } = useI18n();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed left-1/2 top-1/2 z-(--z-dialog) flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-dialog',
          className,
        )}
        {...props}
      >
        <DialogHeader>
          <DialogTitle className={titleHidden ? 'sr-only' : undefined}>
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {/*
          El cierre va antes de `children` en el documento, no solo en la
          esquina: el orden de tabulación debe coincidir con el visual (arriba
          a la derecha del título) aunque su posición sea absoluta.
        */}
        {hideCloseButton ? null : (
          <DialogPrimitive.Close
            className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color,border-color] hover:bg-foreground/5 hover:text-foreground"
            aria-label={t('a11y.closeDialog')}
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
