import { describe, expect, it } from 'vitest';

import {
  getBreadcrumbs,
  getNavItems,
  isNavItemActive,
  isPathActive,
  NAV_ITEMS,
  NAV_LINKS,
  PUBLIC_NAV_LINKS,
} from '@/lib/navigation';
import { t } from '@/messages';

/**
 * Modelo de navegación (issue #8, fase 3).
 *
 * Estas pruebas son el contrato del shell: qué destinos existen, cuáles no
 * deben ser enlaces y qué migajas produce cada ruta. Si alguien añade un
 * destino sin página, aquí se ve antes de que un usuario encuentre un 404.
 */

/** Rutas que la aplicación publica hoy. */
const EXISTING_ROUTES = ['/', '/design-system', '/health', '/login'] as const;

describe('destinos de la navegación', () => {
  it('usa identificadores únicos', () => {
    const ids = NAV_ITEMS.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('da ruta solo a los destinos disponibles', () => {
    for (const item of NAV_ITEMS) {
      if (item.disabled) {
        expect(item.href, item.id).toBeUndefined();
      } else {
        expect(item.href, item.id).toMatch(/^\//);
      }
    }
  });

  it('solo enlaza rutas que existen', () => {
    for (const item of NAV_LINKS) {
      expect(EXISTING_ROUTES).toContain(item.href);
    }
  });

  it('agrupa los destinos en navegación y próximamente', () => {
    expect(getNavItems('main').map((item) => item.id)).toEqual([
      'home',
      'design',
      'status',
    ]);
    expect(getNavItems('upcoming').map((item) => item.id)).toEqual([
      'worlds',
      'manuscripts',
    ]);
    expect(getNavItems('upcoming').every((item) => item.disabled)).toBe(true);
  });

  it('resuelve todas las etiquetas contra el catálogo', () => {
    for (const item of NAV_ITEMS) {
      expect(t(item.labelKey), item.id).not.toBe(item.labelKey);
    }
  });

  it('añade el acceso solo a la navegación pública', () => {
    expect(PUBLIC_NAV_LINKS.map((link) => link.href)).toEqual([
      '/',
      '/design-system',
      '/health',
      '/login',
    ]);
    expect(NAV_LINKS.some((link) => link.href === '/login')).toBe(false);
  });
});

describe('destino activo', () => {
  const design = NAV_ITEMS.find((item) => item.id === 'design');
  const home = NAV_ITEMS.find((item) => item.id === 'home');
  const worlds = NAV_ITEMS.find((item) => item.id === 'worlds');

  it('marca la portada solo en la portada', () => {
    expect(isPathActive('/', '/')).toBe(true);
    expect(isPathActive('/', '/health')).toBe(false);
  });

  it('marca un destino y sus rutas hijas', () => {
    expect(isPathActive('/design-system', '/design-system')).toBe(true);
    expect(isPathActive('/design-system', '/design-system/componentes')).toBe(
      true,
    );
    expect(isPathActive('/design-system', '/design-systems')).toBe(false);
  });

  it('ignora la query, el hash y la barra final', () => {
    expect(isPathActive('/health', '/health?ok=1')).toBe(true);
    expect(isPathActive('/health', '/health/#detalle')).toBe(true);
    expect(isPathActive('/design-system', '/design-system/')).toBe(true);
  });

  it('nunca marca un destino sin ruta', () => {
    expect(design && isNavItemActive(design, '/design-system')).toBe(true);
    expect(home && isNavItemActive(home, '/design-system')).toBe(false);
    expect(worlds && isNavItemActive(worlds, '/design-system')).toBe(false);
  });
});

describe('migajas de pan', () => {
  it('deja la portada como única miga en «/»', () => {
    const crumbs = getBreadcrumbs('/');

    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]?.labelKey).toBe('nav.home');
    expect(crumbs[0]?.href).toBeUndefined();
  });

  it('enlaza el padre y deja el actual sin enlace', () => {
    const crumbs = getBreadcrumbs('/design-system');

    expect(crumbs.map((crumb) => crumb.labelKey)).toEqual([
      'nav.home',
      'nav.design',
    ]);
    expect(crumbs[0]?.href).toBe('/');
    expect(crumbs[1]?.href).toBeUndefined();
  });

  it('cubre las rutas públicas con etiquetas propias', () => {
    expect(getBreadcrumbs('/login').map((crumb) => crumb.labelKey)).toEqual([
      'nav.home',
      'nav.login',
    ]);
    expect(getBreadcrumbs('/health').map((crumb) => crumb.labelKey)).toEqual([
      'nav.home',
      'nav.health',
    ]);
  });

  it('no inventa nombres para rutas desconocidas', () => {
    expect(getBreadcrumbs('/no-existe')).toEqual([
      { id: 'home', labelKey: 'nav.home' },
    ]);
  });

  it('resuelve las etiquetas contra el catálogo', () => {
    for (const crumb of getBreadcrumbs('/design-system')) {
      expect(t(crumb.labelKey)).not.toBe(crumb.labelKey);
    }
  });
});
