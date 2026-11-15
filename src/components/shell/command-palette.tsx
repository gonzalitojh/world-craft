'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useTheme } from '@/components/theme/theme-provider';
import { Button } from '@/components/ui/button';
import {
  CommandDialogContent,
  useCommandPaletteShortcut,
  type CommandPaletteItem,
} from '@/components/ui/command';
import { Dialog } from '@/components/ui/dialog';
import { NAV_LINKS } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

/**
 * Paleta de comandos del shell.
 *
 * El proveedor envuelve la aplicación entera (una sola instancia, en el layout
 * raíz) y expone `open` al resto del árbol: así la topbar, el menú móvil y
 * cualquier botón de una página abren **la misma** paleta. Montar una paleta
 * por botón multiplicaría el diálogo y el atajo global.
 *
 * Foco: al abrir se recuerda el elemento activo y al cerrar se le devuelve el
 * foco, tanto si se abrió con el botón como con `Ctrl`/`Cmd` + `K` (que no
 * tienen un `DialogTrigger` al que Radix pueda volver por sí solo).
 *
 * Contenido: los destinos de `lib/navigation` y los tres temas. `cmdk` se carga
 * de forma diferida la primera vez que se abre.
 */

type CommandPaletteContextValue = {
  /** Abre la paleta recordando el elemento que tenía el foco. */
  open: (trigger?: HTMLElement) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

type CommandPaletteProviderProps = {
  children: ReactNode;
};

export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps) {
  const router = useRouter();
  const { setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  const rememberFocus = useCallback((trigger?: HTMLElement) => {
    previousFocus.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
  }, []);

  const openPalette = useCallback(
    (trigger?: HTMLElement) => {
      rememberFocus(trigger);
      setOpen(true);
    },
    [rememberFocus],
  );

  const toggle = useCallback(() => {
    setOpen((current) => {
      if (!current) {
        rememberFocus();
      }

      return !current;
    });
  }, [rememberFocus]);

  useCommandPaletteShortcut(toggle);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        rememberFocus();
      }

      setOpen(next);
    },
    [rememberFocus],
  );

  const handleCloseAutoFocus = useCallback((event: Event) => {
    // Sin `preventDefault`, Radix intentaría enfocar un disparador que aquí no
    // existe y el foco se quedaría en el fondo.
    event.preventDefault();
    previousFocus.current?.focus();
    previousFocus.current = null;
  }, []);

  const items = useMemo<CommandPaletteItem[]>(() => {
    const navigation: CommandPaletteItem[] = NAV_LINKS.map((item) => ({
      id: `nav-${item.id}`,
      label: t(item.labelKey),
      group: t('command.groupNavigation'),
      onSelect: () => {
        router.push(item.href);
      },
    }));

    const theme: CommandPaletteItem[] = [
      {
        id: 'theme-system',
        label: t('command.themeSystem'),
        group: t('command.groupTheme'),
        onSelect: () => {
          setPreference('system');
        },
      },
      {
        id: 'theme-light',
        label: t('command.themeLight'),
        group: t('command.groupTheme'),
        onSelect: () => {
          setPreference('light');
        },
      },
      {
        id: 'theme-dark',
        label: t('command.themeDark'),
        group: t('command.groupTheme'),
        onSelect: () => {
          setPreference('dark');
        },
      },
    ];

    return [...navigation, ...theme];
  }, [router, setPreference]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open: openPalette }),
    [openPalette],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CommandPaletteContext.Provider value={value}>
        {children}
        <CommandDialogContent
          items={items}
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          onCloseAutoFocus={handleCloseAutoFocus}
        />
      </CommandPaletteContext.Provider>
    </Dialog>
  );
}

/** Acceso a la paleta. Falla si se usa fuera del proveedor. */
export function useCommandPalette(): CommandPaletteContextValue {
  const value = useContext(CommandPaletteContext);

  if (!value) {
    throw new Error(
      'useCommandPalette debe usarse dentro de <CommandPaletteProvider>.',
    );
  }

  return value;
}

type CommandPaletteButtonProps = {
  /** Clases extra para encajarlo en cada barra. */
  className?: string;
};

/** Botón de icono que abre la paleta; su etiqueta accesible va en el catálogo. */
export function CommandPaletteButton({ className }: CommandPaletteButtonProps) {
  const { open } = useCommandPalette();

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={t('a11y.openCommandPalette')}
      title={t('a11y.openCommandPaletteShortcut')}
      className={cn('shrink-0', className)}
      onClick={(event) => {
        open(event.currentTarget);
      }}
    >
      <Search aria-hidden="true" />
    </Button>
  );
}
