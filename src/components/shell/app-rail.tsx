'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useI18n } from '@/components/i18n/locale-provider';
import { NavIcon } from '@/components/shell/nav-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getNavItems,
  isNavItemActive,
  NAV_GROUP_LABELS,
  type NavGroup,
  type NavItem,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Rail lateral del espacio de trabajo.
 *
 * Tres anchos, una sola estructura:
 *
 * - Menos de 768 px: oculto; la navegación vive en la barra inferior.
 * - 768–1023 px: solo iconos (`--rail-width-collapsed`) con globo de ayuda,
 *   porque el hueco lo necesita el contenido.
 * - 1024 px o más: rail completo (`--rail-width`) con etiquetas y encabezados
 *   de grupo.
 *
 * El ancho y el alto salen de tokens (`--rail-width*`, `--topbar-height`) para
 * que el rail, la topbar y la barra inferior no se separen nunca.
 */

const GROUPS: readonly NavGroup[] = ['main', 'upcoming'];

export function AppRail() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '/';

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('a11y.sidebarNavigation')}
        className="hidden shrink-0 border-r bg-surface-sunken md:sticky md:top-(--topbar-height) md:flex md:h-[calc(100dvh-var(--topbar-height))] md:w-(--rail-width-collapsed) md:flex-col md:gap-6 md:self-start md:overflow-y-auto md:px-2 md:py-4 lg:w-(--rail-width) lg:px-3"
      >
        {GROUPS.map((group) => (
          <div key={group} className="min-w-0">
            <p className="hidden px-3 pb-2 font-mono text-eyebrow uppercase tracking-eyebrow text-muted-foreground lg:block">
              {t(NAV_GROUP_LABELS[group])}
            </p>
            <ul className="flex flex-col gap-1">
              {getNavItems(group).map((item) => (
                <li key={item.id} className="min-w-0">
                  <RailEntry item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}

type RailEntryProps = {
  item: NavItem;
  pathname: string;
};

function RailEntry({ item, pathname }: RailEntryProps) {
  const { t } = useI18n();
  const label = t(item.labelKey);
  const active = isNavItemActive(item, pathname);
  const base =
    'flex min-h-11 min-w-0 items-center justify-center gap-3 rounded-md px-3 text-sm transition-[color,background-color,border-color] lg:justify-start';

  const content = (
    <>
      <NavIcon name={item.icon} />
      {/* La etiqueta sigue en el árbol de accesibilidad cuando el rail está
          colapsado (`sr-only`) y se ve desde `lg`. El globo de ayuda la repite
          a quien usa el ratón. */}
      <span className="sr-only min-w-0 break-words lg:not-sr-only">
        {label}
      </span>
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {item.href ? (
          <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              base,
              active
                ? 'bg-accent-muted font-semibold text-accent shadow-[inset_2px_0_0_0_var(--accent)]'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {content}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(base, 'cursor-not-allowed text-muted-foreground')}
          >
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
