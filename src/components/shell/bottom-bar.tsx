'use client';

import { LogIn, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { NavIcon } from '@/components/shell/nav-icon';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import {
  getNavItems,
  isPathActive,
  NAV_LINKS,
  type NavItem,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

/**
 * Barra inferior de móvil.
 *
 * Cuatro destinos con objetivo táctil de 44 px: los tres navegables y «Más»,
 * que abre un panel inferior con lo que no cabe (acceso, próximamente,
 * licencia y estado).
 *
 * Detalles que importan:
 *
 * - `pb-[env(safe-area-inset-bottom)]`: en móviles con gesto inferior la barra
 *   no se come el último botón del sistema.
 * - `min-h-(--bottombar-height)`: la barra mide de verdad lo que el token dice.
 *   De él dependen la reserva del `main` y el desplazamiento de los avisos; sin
 *   esta clase, el token (68 px) y la barra real (44 px de contenido) no
 *   coincidían y el aviso flotaba por encima de la navegación.
 * - El alto total lo reserva el shell con `--bottombar-height` en el `main`,
 *   así el último elemento siempre se puede alcanzar.
 * - El panel se cierra al pulsar un destino (no con un efecto sobre la ruta,
 *   que provocaría un render en cascada).
 */

/** Destinos directos de la barra: los tres navegables, en orden. */
const BAR_ITEMS = NAV_LINKS;

export function BottomBar() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <div
        data-slot="bottom-bar"
        className="fixed inset-x-0 bottom-0 z-(--z-topbar) min-h-(--bottombar-height) border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <nav
          aria-label={t('a11y.mainNavigation')}
          className="mx-auto w-full max-w-(--content-max) min-w-0 px-1"
        >
          <ul className="flex min-w-0 items-stretch">
            {BAR_ITEMS.map((item) => (
              <li key={item.id} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={
                    isPathActive(item.href, pathname) ? 'page' : undefined
                  }
                  className={cn(
                    'flex h-full min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs',
                    isPathActive(item.href, pathname)
                      ? 'font-semibold text-accent shadow-[inset_0_2px_0_0_var(--accent)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <NavIcon name={item.icon} />
                  <span className="min-w-0 break-words">
                    {t(item.labelKey)}
                  </span>
                </Link>
              </li>
            ))}
            <li className="min-w-0 flex-1">
              <DrawerTrigger asChild>
                <button
                  type="button"
                  aria-label={t('a11y.openMore')}
                  className="flex h-full min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <NavIcon name="more" />
                  <span className="min-w-0 break-words">{t('nav.more')}</span>
                </button>
              </DrawerTrigger>
            </li>
          </ul>
        </nav>
      </div>
      <DrawerContent
        side="bottom"
        title={t('shell.moreTitle')}
        description={t('shell.moreDescription')}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="more-acceso" className="min-w-0">
            <h2
              id="more-acceso"
              className="font-display text-base tracking-display text-foreground"
            >
              {t('nav.login')}
            </h2>
            <p className="mt-1 min-w-0">
              <Link
                href="/login"
                onClick={close}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-accent underline-offset-4 hover:underline"
              >
                <LogIn aria-hidden="true" className="size-4 shrink-0" />
                {t('login.title')}
              </Link>
            </p>
          </section>
          <section aria-labelledby="more-proximamente" className="min-w-0">
            <h2
              id="more-proximamente"
              className="font-display text-base tracking-display text-foreground"
            >
              {t('nav.groupUpcoming')}
            </h2>
            <ul className="mt-1 flex flex-col gap-1">
              {getNavItems('upcoming').map((item: NavItem) => (
                <li key={item.id} className="min-w-0">
                  <span
                    aria-disabled="true"
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-md text-sm text-muted-foreground"
                  >
                    <NavIcon name={item.icon} className="size-4" />
                    <span className="min-w-0 break-words">
                      {t(item.labelKey)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('shell.upcomingNote')}
            </p>
          </section>
          <section aria-labelledby="more-licencia" className="min-w-0">
            <h2
              id="more-licencia"
              className="font-display text-base tracking-display text-foreground"
            >
              {t('shell.licenseTitle')}
            </h2>
            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <ScrollText aria-hidden="true" className="size-4 shrink-0" />
              {t('shell.licenseNote')}
            </p>
          </section>
          <section aria-labelledby="more-estado" className="min-w-0">
            <h2
              id="more-estado"
              className="font-display text-base tracking-display text-foreground"
            >
              {t('shell.statusTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('shell.statusNote')}
            </p>
            <p className="mt-1">
              <Link
                href="/health"
                onClick={close}
                className="inline-flex min-h-11 items-center rounded-sm text-sm text-accent underline-offset-4 hover:underline"
              >
                {t('nav.health')}
              </Link>
            </p>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
