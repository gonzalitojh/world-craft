'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { CommandPaletteButton } from '@/components/shell/command-palette';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { NavIcon } from '@/components/shell/nav-icon';
import { ThemeSelector } from '@/components/theme/theme-selector';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import {
  getBreadcrumbs,
  isPathActive,
  NAV_ITEMS,
  PUBLIC_NAV_LINKS,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

/**
 * Barra superior del shell.
 *
 * Hay dos variantes con la misma marca y las mismas acciones:
 *
 * - `public`: navegación horizontal en escritorio; en móvil, un botón de menú
 *   que abre el mismo listado dentro de un panel lateral.
 * - `workspace`: migajas de pan, porque dentro del taller interesa saber dónde
 *   estás más que repetir la navegación del rail.
 *
 * La barra es `sticky` y usa `--topbar-height` para que el rail sepa dónde
 * empezar sin números mágicos.
 */

export type TopbarVariant = 'public' | 'workspace';

type TopbarProps = {
  variant?: TopbarVariant;
};

const linkClasses =
  'inline-flex min-h-11 items-center rounded-sm px-1 text-sm underline-offset-4 hover:text-accent hover:underline';

export function Topbar({ variant = 'public' }: TopbarProps) {
  const pathname = usePathname() ?? '/';

  return (
    <header className="sticky top-0 z-(--z-topbar) border-b bg-surface">
      <div className="mx-auto flex min-h-(--topbar-height) w-full max-w-(--content-max) min-w-0 items-center gap-2 px-3 sm:px-6 lg:px-8">
        {variant === 'public' ? <MobileMenu pathname={pathname} /> : null}

        <Link
          href="/"
          aria-label={t('a11y.brandHome')}
          className="min-w-0 rounded-sm font-display text-base font-semibold tracking-display sm:text-lg"
        >
          {t('meta.applicationName')}
        </Link>

        <div className="hidden min-w-0 flex-1 items-center md:flex">
          {variant === 'public' ? (
            <PublicNav pathname={pathname} />
          ) : (
            <Breadcrumbs items={getBreadcrumbs(pathname)} />
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <CommandPaletteButton />
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}

type PathnameProps = {
  pathname: string;
};

/** Navegación horizontal de la web pública (escritorio). */
function PublicNav({ pathname }: PathnameProps) {
  return (
    <nav aria-label={t('a11y.mainNavigation')} className="min-w-0">
      <ul className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
        {PUBLIC_NAV_LINKS.map((item) => {
          const active = isPathActive(item.href, pathname);

          return (
            <li key={item.id} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  linkClasses,
                  active ? 'font-medium text-accent' : 'text-foreground',
                )}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Menú móvil de la web pública.
 *
 * El panel se cierra al pulsar un destino: el layout no se vuelve a montar al
 * navegar, así que sin esto seguiría abierto encima de la página nueva. Se
 * cierra desde el propio enlace y no desde un efecto sobre la ruta, que
 * provocaría un render en cascada.
 */
function MobileMenu({ pathname }: PathnameProps) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('a11y.openMenu')}
          className="md:hidden"
        >
          <Menu aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        side="left"
        title={t('shell.menuTitle')}
        description={t('shell.menuDescription')}
      >
        <nav aria-label={t('a11y.mobileNavigation')} className="min-w-0">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.id} className="min-w-0">
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={
                      isPathActive(item.href, pathname) ? 'page' : undefined
                    }
                    className="flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 text-sm text-foreground hover:bg-foreground/5"
                  >
                    <NavIcon name={item.icon} />
                    <span className="min-w-0 break-words">
                      {t(item.labelKey)}
                    </span>
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
                  >
                    <NavIcon name={item.icon} />
                    <span className="min-w-0 break-words">
                      {t(item.labelKey)}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <p className="min-w-0 text-sm text-muted-foreground">
          {t('shell.upcomingNote')}
        </p>
        <p className="min-w-0">
          <Link
            href="/login"
            onClick={close}
            className="inline-flex min-h-11 items-center rounded-sm text-sm text-accent underline-offset-4 hover:underline"
          >
            {t('nav.login')}
          </Link>
        </p>
      </DrawerContent>
    </Drawer>
  );
}
