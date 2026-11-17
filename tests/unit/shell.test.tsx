// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithI18n } from '../helpers/render';

import { AppRail } from '@/components/shell/app-rail';
import { BottomBar } from '@/components/shell/bottom-bar';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { CommandPaletteProvider } from '@/components/shell/command-palette';
import { Topbar } from '@/components/shell/topbar';
import { ThemeProvider } from '@/components/theme/theme-provider';
import ErrorPage from '@/app/error';
import Loading from '@/app/loading';
import NotFound from '@/app/not-found';
import { getBreadcrumbs } from '@/lib/navigation';
import { es } from '@/messages/es';

/**
 * Shell (issue #8, fase 3): topbar, rail, barra inferior, migajas y selector
 * de tema.
 *
 * Se comprueba el contrato que no se ve en una captura: qué es enlace, qué se
 * anuncia como no disponible, dónde está el `aria-current` y que los paneles se
 * abren y se cierran. El detalle de foco y teclado se cubre en E2E, donde hay
 * un navegador de verdad.
 */

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  }),
}));

/*
 * Las páginas de carga y 404 son Server Components asíncronos: resuelven el
 * idioma con `cookies()`/`headers()`, que no existen en jsdom. Se sustituye el
 * módulo de servidor por el mismo contrato servido con el catálogo real.
 */
vi.mock('@/lib/i18n/server', async () => {
  const { createFormatters } = await import('@/lib/i18n/format');
  const { createTranslator } = await import('@/messages/translator');
  const { es } = await import('@/messages/es');

  return {
    getLocale: async () => 'es',
    getI18n: async () => ({
      locale: 'es',
      messages: es,
      t: createTranslator(es),
      format: createFormatters('es'),
      availableLocales: ['es'],
    }),
  };
});

beforeEach(() => {
  navigation.pathname = '/';
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
});

/** Envuelve el componente con los proveedores que usa el shell real. */
function renderInShell(node: ReactNode) {
  return renderWithI18n(
    <ThemeProvider>
      <CommandPaletteProvider>{node}</CommandPaletteProvider>
    </ThemeProvider>,
  );
}

describe('Topbar', () => {
  it('muestra la marca, la navegación pública y el selector de tema', () => {
    renderInShell(<Topbar variant="public" />);

    expect(screen.getByRole('link', { name: es.a11y.brandHome })).toBeTruthy();

    const nav = screen.getByRole('navigation', {
      name: es.a11y.mainNavigation,
    });

    for (const label of [
      es.nav.home,
      es.nav.design,
      es.nav.health,
      es.nav.login,
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }

    expect(screen.getByLabelText(es.theme.label)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: es.a11y.openCommandPalette }),
    ).toBeTruthy();
  });

  it('marca con aria-current el destino activo', () => {
    navigation.pathname = '/design-system';

    renderInShell(<Topbar variant="public" />);

    const nav = screen.getByRole('navigation', {
      name: es.a11y.mainNavigation,
    });

    expect(
      within(nav)
        .getByRole('link', { name: es.nav.design })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(nav)
        .getByRole('link', { name: es.nav.home })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('cambia la navegación por migajas en el espacio de trabajo', () => {
    navigation.pathname = '/design-system';

    renderInShell(<Topbar variant="workspace" />);

    const crumbs = screen.getByRole('navigation', {
      name: es.a11y.breadcrumbs,
    });

    expect(
      within(crumbs).getByRole('link', { name: es.nav.home }),
    ).toBeTruthy();
    expect(
      within(crumbs).getByText(es.nav.design).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.queryByRole('navigation', { name: es.a11y.mainNavigation }),
    ).toBeNull();
  });

  it('abre el menú de navegación en móvil y lo cierra con Escape', async () => {
    renderInShell(<Topbar variant="public" />);

    fireEvent.click(screen.getByRole('button', { name: es.a11y.openMenu }));

    const menu = await screen.findByRole('dialog', {
      name: es.shell.menuTitle,
    });

    expect(
      within(menu).getByRole('navigation', { name: es.a11y.mobileNavigation }),
    ).toBeTruthy();
    expect(
      within(menu).getByRole('link', { name: es.nav.design }),
    ).toBeTruthy();
    expect(within(menu).getByText(es.nav.worlds)).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('AppRail', () => {
  it('pinta los destinos disponibles como enlaces y los futuros como no disponibles', () => {
    navigation.pathname = '/health';

    renderInShell(<AppRail />);

    const rail = screen.getByRole('navigation', {
      name: es.a11y.sidebarNavigation,
    });

    for (const label of [es.nav.home, es.nav.design, es.nav.health]) {
      expect(within(rail).getByRole('link', { name: label })).toBeTruthy();
    }

    // «Próximamente» no son enlaces: nunca generan un 404.
    expect(
      within(rail).queryByRole('link', { name: es.nav.worlds }),
    ).toBeNull();
    expect(within(rail).getByText(es.nav.worlds)).toBeTruthy();
    expect(
      within(rail).getByText(es.nav.worlds).closest('[aria-disabled="true"]'),
    ).not.toBeNull();
    expect(
      within(rail)
        .getByText(es.nav.manuscripts)
        .closest('[aria-disabled="true"]'),
    ).not.toBeNull();
  });

  it('marca el destino activo con aria-current', () => {
    navigation.pathname = '/design-system';

    renderInShell(<AppRail />);

    const rail = screen.getByRole('navigation', {
      name: es.a11y.sidebarNavigation,
    });

    expect(
      within(rail)
        .getByRole('link', { name: es.nav.design })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(rail)
        .getByRole('link', { name: es.nav.home })
        .getAttribute('aria-current'),
    ).toBeNull();
  });
});

describe('BottomBar', () => {
  it('ofrece cuatro destinos con objetivo táctil y abre «Más»', async () => {
    navigation.pathname = '/';

    renderInShell(<BottomBar />);

    const nav = screen.getByRole('navigation', {
      name: es.a11y.mainNavigation,
    });
    const links = within(nav).getAllByRole('link');

    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
    }

    const more = within(nav).getByRole('button', { name: es.a11y.openMore });

    expect(more.className).toContain('min-h-11');

    // La barra mide lo que el token reserva: `main` y los avisos dependen de él.
    expect(
      document.querySelector('[data-slot="bottom-bar"]')?.className,
    ).toContain('min-h-(--bottombar-height)');

    fireEvent.click(more);

    const panel = await screen.findByRole('dialog', {
      name: es.shell.moreTitle,
    });

    expect(
      within(panel).getByRole('link', { name: es.login.title }),
    ).toBeTruthy();
    expect(within(panel).getByText(es.shell.licenseNote)).toBeTruthy();
    expect(
      within(panel).getByRole('link', { name: es.nav.health }),
    ).toBeTruthy();
    expect(within(panel).getByText(es.nav.worlds)).toBeTruthy();
  });
});

describe('Breadcrumbs', () => {
  it('usa una lista ordenada, enlaza el padre y marca el actual', () => {
    renderWithI18n(<Breadcrumbs items={getBreadcrumbs('/design-system')} />);

    const nav = screen.getByRole('navigation', {
      name: es.a11y.breadcrumbs,
    });
    const list = within(nav).getByRole('list');

    expect(list.tagName).toBe('OL');
    expect(within(nav).getByRole('link', { name: es.nav.home })).toBeTruthy();
    expect(
      within(nav).getByText(es.nav.design).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('no repite enlace en la página actual', () => {
    renderWithI18n(<Breadcrumbs items={getBreadcrumbs('/health')} />);

    const nav = screen.getByRole('navigation', {
      name: es.a11y.breadcrumbs,
    });

    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    expect(within(nav).getByText(es.nav.health)).toBeTruthy();
  });
});

describe('estados de ruta', () => {
  /*
   * La frontera de error y la página 404 no se pueden provocar en un E2E sin
   * añadir rutas de prueba a la aplicación, así que se comprueba aquí lo que
   * importa: que no se queden sin chrome y que el enlace de salto tenga destino.
   */

  it('el estado de carga no monta cabecera, main ni pie', async () => {
    renderWithI18n(await Loading());

    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('la frontera de error conserva el shell público', () => {
    renderWithI18n(
      <ThemeProvider>
        <CommandPaletteProvider>
          <ErrorPage error={new Error('fallo de prueba')} reset={() => {}} />
        </CommandPaletteProvider>
      </ThemeProvider>,
    );

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('contenido');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('button', { name: es.error.retry })).toBeTruthy();
  });

  it('la página 404 conserva el shell público', async () => {
    renderWithI18n(
      <ThemeProvider>
        <CommandPaletteProvider>{await NotFound()}</CommandPaletteProvider>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: es.notFound.title }),
    ).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('contenido');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });
});
