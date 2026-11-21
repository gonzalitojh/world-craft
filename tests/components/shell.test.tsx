import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { MenuItem } from '@/renderer/components/menu';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import {
  AppShell,
  type AppShellProps,
  type AppView,
} from '@/renderer/shell/app-shell';
import { createIdleUpdateSnapshot } from '@/shared/contracts/updates';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';

beforeAll(() => {
  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: {
      appInfo: { version: '0.1.0' },
      updates: {
        getState: async () => ({
          ok: true,
          data: createIdleUpdateSnapshot('0.1.0'),
        }),
        onStateChanged: () => () => {},
      },
    } satisfies Partial<WorldCraftApi>,
  });
});

function renderShell(overrides: Partial<AppShellProps> = {}) {
  const props: AppShellProps = {
    view: 'home',
    title: 'Panel de trabajo',
    onNavigate: vi.fn(),
    onOpenPalette: vi.fn(),
    theme: 'light',
    onToggleTheme: vi.fn(),
    ...overrides,
    children: <p>Contenido de la vista.</p>,
  };
  const view: ReactElement = (
    <I18nProvider locale="es">
      <AppShell {...props} />
    </I18nProvider>
  );
  const result = render(view);

  return { props, ...result };
}

function nav(): HTMLElement {
  return screen.getByRole('navigation', {
    name: messages.shell.navigationLabel,
  });
}

describe('AppShell', () => {
  it('muestra solo Inicio y Mundos, sin Muestras, lema ni versión', () => {
    renderShell();

    const items = within(nav()).getAllByRole('button');

    expect(items.map((item) => item.textContent)).toEqual([
      messages.shell.views.home,
      messages.shell.views.worlds,
    ]);
    expect(
      screen.queryByRole('button', { name: messages.shell.views.samples }),
    ).toBeNull();
    expect(screen.queryByText('Taller de cartógrafo')).toBeNull();
    expect(document.querySelector('.wc-shell__version')).toBeNull();
  });

  it('marca Inicio como página actual', () => {
    renderShell();

    expect(
      within(nav()).getByRole('button', { name: messages.shell.views.home }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav()).getByRole('button', { name: messages.shell.views.worlds }),
    ).not.toHaveAttribute('aria-current');
  });

  it('marca Mundos como actual también en mundo, fichas y ficha', () => {
    for (const view of ['worlds', 'world', 'entities', 'entity'] as const) {
      const { unmount } = renderShell({ view: view as AppView });

      expect(
        within(nav()).getByRole('button', {
          name: messages.shell.views.worlds,
        }),
        view,
      ).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });

  it('pliega el rail con nombres accesibles y tooltip al foco', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();

    renderShell({ onCollapsedChange });

    const toggle = screen.getByRole('button', {
      name: messages.shell.collapse,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'wc-navigation');

    await user.click(toggle);

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(onCollapsedChange).toHaveBeenCalledOnce();

    const expanded = screen.getByRole('button', {
      name: messages.shell.expand,
    });

    expect(expanded).toHaveAttribute('aria-expanded', 'false');

    const home = within(nav()).getByRole('button', {
      name: messages.shell.views.home,
    });

    expect(home).toHaveAttribute('aria-label', messages.shell.views.home);
    expect(screen.queryByText(messages.shell.views.home)).toBeNull();

    home.focus();

    expect(
      await screen.findByRole('tooltip', { name: messages.shell.views.home }),
    ).toBeInTheDocument();
  });

  it('respeta el estado plegado controlado y siempre notifica', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();

    renderShell({ collapsed: true, onCollapsedChange });

    const toggle = screen.getByRole('button', { name: messages.shell.expand });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(
      screen.getByRole('button', { name: messages.shell.expand }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('renderiza la acción primaria y como máximo una', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = renderShell({
      primaryAction: { label: 'Crear mundo', onSelect },
    });
    const primaries = container.querySelectorAll(
      '.wc-topbar__actions > .wc-button--primary',
    );

    expect(primaries).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Crear mundo' }));

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('no dibuja primaria si la vista no la define', () => {
    const { container } = renderShell();

    expect(
      container.querySelectorAll('.wc-topbar__actions > .wc-button--primary'),
    ).toHaveLength(0);
  });

  it('abre el menú de secundarias y ejecuta la acción devolviendo el foco', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const items: readonly MenuItem[] = [
      { id: 'edit', label: 'Editar mundo', onSelect: onEdit },
    ];

    renderShell({ secondaryActions: items });

    const trigger = screen.getByRole('button', {
      name: messages.shell.viewMenuLabel,
    });

    await user.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Editar mundo' }));

    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('abre la paleta desde el disparador con su atajo y tooltip', async () => {
    const user = userEvent.setup();
    const onOpenPalette = vi.fn();

    renderShell({ onOpenPalette });

    const trigger = screen.getByRole('button', {
      name: messages.shell.searchTrigger,
    });

    expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Control+K');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveClass('wc-topbar__search');

    // El atajo visual es decorativo: el accesible es aria-keyshortcuts.
    expect(trigger.querySelector('.wc-topbar__search-kbd')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    trigger.focus();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      messages.shell.searchTrigger,
    );

    await user.click(trigger);

    expect(onOpenPalette).toHaveBeenCalledOnce();
  });

  it('trunca el título a una línea y conserva el texto completo', () => {
    const title = 'Crónica de las Mareas Grises y los pactos de sal';
    const { container } = renderShell({ title });

    const heading = screen.getByRole('heading', { level: 1, name: title });

    expect(heading).toHaveAttribute('title', title);
    expect(heading).toHaveClass('wc-topbar__title');
    expect(container.querySelector('h1')).toBe(heading);
  });

  it('conmuta el tema con un icono sin aria-pressed', async () => {
    const user = userEvent.setup();
    const onToggleTheme = vi.fn();

    renderShell({ theme: 'light', onToggleTheme });

    const toggle = screen.getByRole('button', {
      name: messages.shell.theme.switchLabel(messages.shell.theme.currentLight),
    });

    expect(toggle).not.toHaveAttribute('aria-pressed');

    await user.click(toggle);

    expect(onToggleTheme).toHaveBeenCalledOnce();
  });
});
