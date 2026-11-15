'use client';

import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { t } from '@/messages';

/**
 * Paleta de comandos global.
 *
 * El contenido (`cmdk`) se importa con `next/dynamic` y `ssr: false` **solo
 * cuando la paleta se abre**, de modo que la dependencia no viaja en el bundle
 * inicial ni en el HTML del servidor.
 *
 * Piezas:
 *
 * - `useCommandPaletteShortcut`: engancha `Ctrl`/`Cmd` + `K` en la ventana.
 * - `CommandDialogContent`: el diálogo con el contenido diferido; lo usan tanto
 *   el disparador suelto como el proveedor del shell (que controla el estado y
 *   necesita devolver el foco a un elemento que no es un `DialogTrigger`).
 * - `CommandPaletteDialog`: disparador + diálogo, con su propio estado.
 *
 * Teclado: flechas, Inicio/Fin y Enter los resuelve `cmdk`; Escape cierra y el
 * diálogo devuelve el foco a quien lo abrió.
 */

export type CommandPaletteItem = {
  /** Identificador estable dentro de la lista. */
  id: string;
  /** Texto visible y valor de búsqueda. */
  label: string;
  /** Grupo visible; si falta, va al grupo genérico. */
  group?: string;
  onSelect: () => void;
};

const CommandPalette = dynamic(
  () => import('./command-palette').then((module) => module.CommandPalette),
  { ssr: false, loading: () => null },
);

/**
 * Atajo global de la paleta.
 *
 * Recibe una función estable: el efecto se vuelve a enganchar solo si cambia,
 * y así no se acumulan escuchas.
 */
export function useCommandPaletteShortcut(toggle: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // Sin esto el navegador enfoca su buscador en algunos navegadores.
        event.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggle]);
}

export type CommandDialogContentProps = {
  items: readonly CommandPaletteItem[];
  /** El contenido solo se monta con la paleta abierta. */
  open: boolean;
  onClose: () => void;
  /**
   * Se ejecuta al cerrar antes de que Radix devuelva el foco. Quien controla el
   * estado desde fuera lo usa para enfocar el disparador real.
   */
  onCloseAutoFocus?: (event: Event) => void;
  className?: string;
};

/** Diálogo de la paleta, para montarlo dentro de un `<Dialog>` controlado. */
export function CommandDialogContent({
  items,
  open,
  onClose,
  onCloseAutoFocus,
  className,
}: CommandDialogContentProps) {
  return (
    <DialogContent
      title={t('command.title')}
      titleHidden
      hideCloseButton
      className={className ?? 'max-w-xl gap-0 overflow-hidden p-0'}
      {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
    >
      {open ? <CommandPalette items={items} onClose={onClose} /> : null}
    </DialogContent>
  );
}

export type CommandPaletteDialogProps = {
  items: readonly CommandPaletteItem[];
  /** Etiqueta accesible del disparador; por defecto, la del catálogo. */
  triggerLabel?: string;
  className?: string;
};

export function CommandPaletteDialog({
  items,
  triggerLabel,
  className,
}: CommandPaletteDialogProps) {
  const [open, setOpen] = useState(false);
  const trigger = triggerLabel ?? t('a11y.openCommandPalette');
  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  useCommandPaletteShortcut(toggle);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={trigger}
          title={t('a11y.openCommandPaletteShortcut')}
          className={className}
        >
          <Search aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <CommandDialogContent
        items={items}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </Dialog>
  );
}
