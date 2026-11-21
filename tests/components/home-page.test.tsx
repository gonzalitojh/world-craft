import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { HomePage } from '@/renderer/pages/home-page';
import type { ContinueTarget } from '@/renderer/lib/recent-location';
import type {
  WorldActivityEntry,
  WorldSummary,
} from '@/shared/contracts/worlds';

const NOW = Date.parse('2026-11-21T12:00:00.000Z');

const actions = {
  onOpen: vi.fn(),
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onArchiveToggle: vi.fn(),
  onDelete: vi.fn(),
};

function renderHome(ui: ReactElement) {
  return render(<I18nProvider locale="es">{ui}</I18nProvider>);
}

function makeWorld(index: number): WorldSummary {
  return {
    id: `world-${index}`,
    name: `Mundo ${index}`,
    slug: `mundo-${index}`,
    summary: `Resumen del mundo ${index}.`,
    genres: ['Fantasía'],
    language: 'es',
    status: 'active',
    coverAssetId: null,
    createdAt: NOW - 10 * 86_400_000,
    updatedAt: NOW - 5 * 60_000,
    archivedAt: null,
  };
}

function makeActivity(index: number): WorldActivityEntry {
  return {
    id: `activity-${index}`,
    worldId: 'world-1',
    worldName: 'Mundo 1',
    action: 'world.updated',
    entityType: 'world',
    entityId: 'world-1',
    createdAt: NOW - index * 60_000,
  };
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    worlds: [] as readonly WorldSummary[],
    activity: [] as readonly WorldActivityEntry[],
    state: 'ready' as const,
    actions,
    continueTarget: null as ContinueTarget | null,
    now: NOW,
    onCreate: vi.fn(),
    onContinue: vi.fn(),
    onSeeAll: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe('Inicio como mesa de trabajo', () => {
  it('muestra los mundos recientes y la actividad sin contadores ni accesos rápidos', () => {
    const worlds = [makeWorld(1), makeWorld(2)];
    const activity = Array.from({ length: 8 }, (_, index) =>
      makeActivity(index),
    );
    const { container } = renderHome(
      <HomePage {...baseProps({ worlds, activity })} />,
    );

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.home.recentTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: messages.home.continueTitle,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.home.activityTitle,
      }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.wc-activity__item')).toHaveLength(5);
    expect(container.querySelector('.wc-stats')).toBeNull();
    expect(container.querySelector('.wc-quick-action')).toBeNull();

    // Con mundos, la primaria vive en la barra: el contenido no añade otra.
    expect(container.querySelectorAll('.wc-button--primary')).toHaveLength(0);
  });

  it('limita a cinco mundos y ofrece «Ver todos» solo cuando sobran', () => {
    const onSeeAll = vi.fn();
    const worlds = Array.from({ length: 6 }, (_, index) =>
      makeWorld(index + 1),
    );

    renderHome(<HomePage {...baseProps({ worlds, onSeeAll })} />);

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: messages.home.seeAll }));

    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('oculta «Ver todos» con cinco mundos o menos', () => {
    const worlds = Array.from({ length: 2 }, (_, index) =>
      makeWorld(index + 1),
    );

    renderHome(<HomePage {...baseProps({ worlds })} />);

    expect(
      screen.queryByRole('button', { name: messages.home.seeAll }),
    ).not.toBeInTheDocument();
  });

  it('muestra «Continuar» con el mundo abierto y su fecha relativa', () => {
    const worlds = [makeWorld(1)];
    const onContinue = vi.fn();
    const target: ContinueTarget = {
      kind: 'world',
      worldId: worlds[0]!.id,
      worldName: worlds[0]!.name,
      entityId: null,
      entityName: null,
    };

    const { container } = renderHome(
      <HomePage
        {...baseProps({ worlds, continueTarget: target, onContinue })}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.home.continueTitle,
      }),
    ).toBeInTheDocument();

    const continueRegion = screen.getByRole('region', {
      name: messages.home.continueTitle,
    });
    expect(
      within(continueRegion).getByRole('heading', {
        level: 3,
        name: target.worldName,
      }),
    ).toBeInTheDocument();
    expect(
      within(continueRegion).getByText(
        messages.worlds.card.relativeUpdated('hace 5 minutos'),
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: messages.home.continueWorldAction }),
    );

    expect(onContinue).toHaveBeenCalledWith(target);

    const time = container.querySelector('time');
    expect(time).toHaveAttribute(
      'dateTime',
      new Date(worlds[0]!.updatedAt).toISOString(),
    );
    expect(time).toHaveAttribute('title');
  });

  it('muestra «Continuar» con una ficha y el nombre del mundo', () => {
    const worlds = [makeWorld(1)];
    const target: ContinueTarget = {
      kind: 'entity',
      worldId: worlds[0]!.id,
      worldName: worlds[0]!.name,
      entityId: 'entity-7',
      entityName: 'Aldo Varela',
    };

    renderHome(<HomePage {...baseProps({ worlds, continueTarget: target })} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Aldo Varela' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.home.continueEntityMeta(target.worldName)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.home.continueEntityAction }),
    ).toBeInTheDocument();
  });

  it('usa el texto de reserva si la ficha aún no tiene nombre', () => {
    const worlds = [makeWorld(1)];
    const target: ContinueTarget = {
      kind: 'entity',
      worldId: worlds[0]!.id,
      worldName: worlds[0]!.name,
      entityId: 'entity-7',
      entityName: null,
    };

    renderHome(<HomePage {...baseProps({ worlds, continueTarget: target })} />);

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: messages.home.continueEntityFallback,
      }),
    ).toBeInTheDocument();
  });

  it('omite «Continuar» cuando no hay destino', () => {
    renderHome(<HomePage {...baseProps({ worlds: [makeWorld(1)] })} />);

    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: messages.home.continueTitle,
      }),
    ).not.toBeInTheDocument();
  });

  it('anuncia la carga con aria-busy, role=status y esqueleto', () => {
    const { container } = renderHome(
      <HomePage {...baseProps({ state: 'loading' })} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(messages.home.loading);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.wc-world-card--skeleton')).toHaveLength(
      3,
    );
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: messages.home.activityTitle,
      }),
    ).not.toBeInTheDocument();
  });

  it('muestra el error con reintento', () => {
    const onRetry = vi.fn();

    renderHome(<HomePage {...baseProps({ state: 'error', onRetry })} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(messages.home.errorTitle);
    expect(alert).toHaveTextContent(messages.home.errorDescription);

    fireEvent.click(screen.getByRole('button', { name: messages.home.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('en el estado vacío la única primaria es la del propio estado', () => {
    const { container } = renderHome(<HomePage {...baseProps()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: messages.home.emptyTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.home.emptyAction }),
    ).toBeInTheDocument();

    const primaries = container.querySelectorAll('.wc-button--primary');
    expect(primaries).toHaveLength(1);
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: messages.home.recentTitle,
      }),
    ).not.toBeInTheDocument();
  });
});
