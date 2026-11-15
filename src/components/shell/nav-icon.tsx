import {
  Activity,
  BookOpen,
  Ellipsis,
  Globe2,
  House,
  Palette,
  type LucideIcon,
} from 'lucide-react';

import type { NavIconName } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Iconos de la navegación.
 *
 * `lib/navigation.ts` no importa React ni `lucide-react`: solo declara un
 * nombre de icono, y este componente es el único que lo traduce a un símbolo.
 * Así la navegación se prueba en `node` sin montar nada.
 *
 * El icono siempre es decorativo (`aria-hidden`): el nombre accesible lo pone
 * el texto del destino o su `aria-label`.
 */
const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  design: Palette,
  status: Activity,
  worlds: Globe2,
  manuscripts: BookOpen,
  more: Ellipsis,
};

type NavIconProps = {
  name: NavIconName;
  className?: string;
};

export function NavIcon({ name, className }: NavIconProps) {
  const Icon = ICONS[name];

  return (
    <Icon aria-hidden="true" className={cn('size-5 shrink-0', className)} />
  );
}
