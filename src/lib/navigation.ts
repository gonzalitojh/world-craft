import type { MessageKey } from '@/messages/translator';

/**
 * Modelo de navegación del shell (issue #8, fase 3).
 *
 * Aquí solo hay datos y funciones puras: ni React ni rutas de Next. Así el
 * mismo listado alimenta la topbar, el rail, la barra inferior, el menú móvil y
 * la paleta de comandos, y los tests lo comprueban sin montar componentes.
 *
 * Regla que se mantiene en todo el archivo: un destino sin página no lleva
 * `href` y se marca `disabled`. Nunca se pinta como enlace, así que jamás
 * genera un 404 ni un enlace muerto para lectores de pantalla.
 */

/** Iconos que la navegación puede pedir. El shell los mapea a `lucide-react`. */
export type NavIconName =
  'home' | 'design' | 'status' | 'worlds' | 'manuscripts' | 'more';

/** Grupos visibles de la navegación, en el orden en que se pintan. */
export type NavGroup = 'main' | 'upcoming';

/** Un destino de la navegación. */
export type NavItem = {
  /** Identificador estable: se usa como clave de React y en la paleta. */
  id: string;
  /** Texto visible, siempre del catálogo centralizado. */
  labelKey: MessageKey;
  /** Ruta del destino. Los elementos de «Próximamente» no la tienen. */
  href?: string;
  icon: NavIconName;
  group: NavGroup;
  /** Sin `href` y sin interacción: se anuncia como no disponible. */
  disabled: boolean;
};

/** Encabezado de cada grupo, con su texto centralizado. */
export const NAV_GROUP_LABELS: Record<NavGroup, MessageKey> = {
  main: 'nav.groupMain',
  upcoming: 'nav.groupUpcoming',
};

/**
 * Destinos del shell en el orden del rail.
 *
 * Inicio, Diseño y Estado existen hoy; Mundos y Manuscritos se anuncian como
 * «Próximamente» para que la estructura sea la definitiva sin prometer rutas
 * que todavía no existen.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    href: '/',
    icon: 'home',
    group: 'main',
    disabled: false,
  },
  {
    id: 'design',
    labelKey: 'nav.design',
    href: '/design-system',
    icon: 'design',
    group: 'main',
    disabled: false,
  },
  {
    id: 'status',
    labelKey: 'nav.health',
    href: '/health',
    icon: 'status',
    group: 'main',
    disabled: false,
  },
  {
    id: 'worlds',
    labelKey: 'nav.worlds',
    icon: 'worlds',
    group: 'upcoming',
    disabled: true,
  },
  {
    id: 'manuscripts',
    labelKey: 'nav.manuscripts',
    icon: 'manuscripts',
    group: 'upcoming',
    disabled: true,
  },
];

/** Destinos de un grupo, en el orden declarado. */
export function getNavItems(group: NavGroup): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.group === group);
}

/** Destinos navegables (los únicos que valen para la paleta de comandos). */
export const NAV_LINKS: readonly (NavItem & { href: string })[] =
  NAV_ITEMS.filter(
    (item): item is NavItem & { href: string } =>
      !item.disabled && item.href !== undefined,
  );

/** Enlace suelto de navegación: sin icono ni grupo. */
export type NavLink = {
  id: string;
  labelKey: MessageKey;
  href: string;
};

/**
 * Navegación pública de escritorio: los destinos navegables más el acceso.
 *
 * «Entrar» solo se ofrece en la web pública; dentro del taller no tiene sentido
 * porque la sesión ya existe.
 */
export const PUBLIC_NAV_LINKS: readonly NavLink[] = [
  ...NAV_LINKS.map(({ id, labelKey, href }) => ({ id, labelKey, href })),
  { id: 'login', labelKey: 'nav.login', href: '/login' },
];

/** Normaliza una ruta: sin query, sin hash y sin barra final. */
function normalizePathname(pathname: string): string {
  const [path = '/'] = pathname.split(/[?#]/);
  const trimmed = path.replace(/\/+$/, '');

  return trimmed === '' ? '/' : trimmed;
}

/**
 * Indica si una ruta corresponde a la ruta actual.
 *
 * La portada solo coincide consigo misma; el resto también con sus rutas hijas
 * (`/design-system/componentes` mantiene «Diseño» activo).
 */
export function isPathActive(href: string, pathname: string): boolean {
  const current = normalizePathname(pathname);

  if (href === '/') {
    return current === '/';
  }

  return current === href || current.startsWith(`${href}/`);
}

/** Indica si un destino corresponde a la ruta actual. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.href ? isPathActive(item.href, pathname) : false;
}

/** Migaja de pan: texto centralizado y ruta opcional (el último no la lleva). */
export type Breadcrumb = {
  id: string;
  labelKey: MessageKey;
  href?: string;
};

/** Rutas que aparecen como hijos de la portada en las migajas. */
const ROUTE_CRUMBS: readonly {
  id: string;
  href: string;
  labelKey: MessageKey;
}[] = [
  { id: 'design', href: '/design-system', labelKey: 'nav.design' },
  { id: 'health', href: '/health', labelKey: 'nav.health' },
  { id: 'login', href: '/login', labelKey: 'nav.login' },
];

/**
 * Migajas de una ruta: portada + página actual.
 *
 * Una ruta desconocida (el 404) devuelve solo la portada: es más honesto que
 * inventar un nombre para algo que no existe.
 */
export function getBreadcrumbs(pathname: string): readonly Breadcrumb[] {
  const current = normalizePathname(pathname);
  const home: Breadcrumb = { id: 'home', labelKey: 'nav.home' };

  if (current === '/') {
    return [home];
  }

  const match = ROUTE_CRUMBS.find((crumb) => crumb.href === current);

  if (!match) {
    return [home];
  }

  return [
    { id: 'home', labelKey: 'nav.home', href: '/' },
    { id: match.id, labelKey: match.labelKey },
  ];
}
