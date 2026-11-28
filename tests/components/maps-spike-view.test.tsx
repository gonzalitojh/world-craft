import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { MapsSpikeView } from '@/renderer/pages/maps-spike-view';
import { es as messages } from '@/renderer/messages/es';
import type {
  MapsSpikeActions,
  MapsSpikeState,
  SpikeFeatureRecord,
  SpikeSelectedItem,
} from '@/renderer/maps-spike/state';
import type { SpikeFeature } from '@/renderer/maps-spike/geojson';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

const point: SpikeFeature = {
  type: 'Feature',
  id: 'punto-1',
  geometry: { type: 'Point', coordinates: [1.23456, 2.34567] },
  properties: { mode: 'point', layer: 'places' },
};

const polygon: SpikeFeature = {
  type: 'Feature',
  id: 'region-1',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
  properties: { mode: 'polygon', layer: 'regions' },
};

const records: readonly SpikeFeatureRecord[] = [
  { id: 'region-1', feature: polygon },
  { id: 'punto-1', feature: point },
];

const selected: readonly SpikeSelectedItem[] = [
  {
    id: 'region-1',
    feature: polygon,
    layer: 'regions',
    mode: 'polygon',
    vertices: 4,
    coordinates: null,
    lengthMeters: null,
    perimeterMeters: 444_780,
    areaSquareMeters: 12_364_000_000,
  },
];

function state(overrides: Partial<MapsSpikeState> = {}): MapsSpikeState {
  return {
    status: 'ready',
    error: null,
    mode: 'select',
    features: records,
    counts: { regions: 1, paths: 0, places: 1 },
    visibleLayers: { regions: true, paths: true, places: true },
    selected: [],
    busy: 'idle',
    importError: null,
    exportErrors: {},
    exports: {},
    metrics: {
      report: null,
      loadMs: null,
      phase: 'idle',
      environment: 'Windows · WebGL2 · 1024×700',
    },
    announcement: '',
    theme: 'light',
    ...overrides,
  };
}

function actions(overrides: Partial<MapsSpikeActions> = {}): MapsSpikeActions {
  return {
    setMode: vi.fn(),
    deleteSelected: vi.fn(),
    deselect: vi.fn(),
    clearAll: vi.fn(async () => {}),
    loadDemo500: vi.fn(async () => {}),
    importFeatures: vi.fn(async () => {}),
    exportSvg: vi.fn(async () => {}),
    exportPng: vi.fn(async () => {}),
    exportGeoJson: vi.fn(async () => {}),
    fitView: vi.fn(),
    measurePerformance: vi.fn(async () => {}),
    toggleLayer: vi.fn(),
    retryEngine: vi.fn(),
    recheckWebgl: vi.fn(),
    goHome: vi.fn(),
    ...overrides,
  };
}

function renderView(
  viewState: MapsSpikeState = state(),
  viewActions: MapsSpikeActions = actions(),
) {
  return {
    viewActions,
    ...render(
      <I18nProvider locale="es">
        <MapsSpikeView
          state={viewState}
          actions={viewActions}
          containerRef={{ current: null }}
        />
      </I18nProvider>,
    ),
  };
}

describe('MapsSpikeView', () => {
  it('muestra banner, toolbar, capas y el modo Seleccionar inicial', () => {
    renderView();

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.mapsSpike.banner.title,
      }),
    ).toBeVisible();
    expect(screen.getByText(messages.mapsSpike.banner.badge)).toBeVisible();
    expect(
      screen.getByRole('button', { name: messages.mapsSpike.modes.select }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    const regionsCheckbox = screen.getByRole('checkbox', {
      name: 'Mostrar Regiones',
    });

    expect(regionsCheckbox).toBeChecked();
    expect(regionsCheckbox).toHaveAttribute(
      'aria-describedby',
      'wc-maps-spike-layer-count-regions',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Mostrar Caminos' }),
    ).toBeChecked();
    expect(screen.getAllByText('1 elemento')).toHaveLength(2);
    expect(screen.getByText('0 elementos')).toBeVisible();
  });

  it('cambia de modo, elimina selección y abre el diálogo de vaciado', async () => {
    const viewActions = actions();
    renderView(state({ selected }), viewActions);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: messages.mapsSpike.modes.point }),
    );
    expect(viewActions.setMode).toHaveBeenCalledWith('point');

    await user.click(
      screen.getByRole('button', {
        name: messages.mapsSpike.toolbar.delete,
      }),
    );
    expect(viewActions.deleteSelected).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole('button', { name: messages.mapsSpike.toolbar.clear }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', {
        name: messages.mapsSpike.dialog.clearTitle,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', {
          name: messages.mapsSpike.dialog.cancel,
        }),
      ).toHaveFocus();
    });

    await user.click(
      within(dialog).getByRole('button', {
        name: messages.mapsSpike.dialog.clearConfirm,
      }),
    );
    expect(viewActions.clearAll).toHaveBeenCalledTimes(1);
  });

  it('marca aria-busy en el diálogo mientras vacía', async () => {
    const viewActions = actions();
    const { rerender } = renderView(state(), viewActions);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: messages.mapsSpike.toolbar.clear }),
    );

    const dialog = await screen.findByRole('dialog');

    rerender(
      <I18nProvider locale="es">
        <MapsSpikeView
          state={state({ busy: 'clearing' })}
          actions={viewActions}
          containerRef={{ current: null }}
        />
      </I18nProvider>,
    );

    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(dialog).toBeVisible();
  });

  it('carga 500 directamente o pide confirmación si hay datos', async () => {
    const emptyActions = actions();
    const empty = renderView(
      state({
        features: [],
        counts: { regions: 0, paths: 0, places: 0 },
      }),
      emptyActions,
    );
    const user = userEvent.setup();

    await user.click(
      screen.getAllByRole('button', {
        name: messages.mapsSpike.layers.load500,
      })[0] as HTMLElement,
    );
    expect(emptyActions.loadDemo500).toHaveBeenCalledTimes(1);
    empty.unmount();

    const withDataActions = actions();
    renderView(state(), withDataActions);
    await user.click(
      screen.getByRole('button', {
        name: messages.mapsSpike.layers.load500,
      }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', {
        name: messages.mapsSpike.dialog.replaceTitle,
      }),
    ).toBeVisible();
    expect(withDataActions.loadDemo500).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole('button', {
        name: messages.mapsSpike.dialog.replaceConfirm,
      }),
    );
    expect(withDataActions.loadDemo500).toHaveBeenCalledTimes(1);
  });

  it('ejecuta la importación desde el input oculto y muestra el error inline', async () => {
    const viewActions = actions();
    const { container, rerender } = renderView(state(), viewActions);
    const input = container.querySelector<HTMLInputElement>('input[type=file]');

    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [
          new File(['{}'], 'mundo.geojson', { type: 'application/geo+json' }),
        ],
      },
    });

    await waitFor(() => {
      expect(viewActions.importFeatures).toHaveBeenCalledTimes(1);
    });

    rerender(
      <I18nProvider locale="es">
        <MapsSpikeView
          state={state({ importError: 'Archivo inválido.' })}
          actions={viewActions}
          containerRef={{ current: null }}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Archivo inválido.');
  });

  it('renderiza la selección y las medidas', async () => {
    renderView(state({ selected }));
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('tab', {
        name: messages.mapsSpike.panel.tabs.selection,
      }),
    );

    expect(
      screen.getByRole('heading', { name: '1 elemento seleccionado' }),
    ).toBeVisible();
    expect(screen.getByText(/región|Regiones/)).toBeVisible();
    expect(screen.getByText(/12\.364/)).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: messages.mapsSpike.selection.deselect,
      }),
    ).toBeVisible();
    expect(screen.getAllByText(/Sin medir/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', {
        name: messages.mapsSpike.metrics.measure,
      }),
    ).toBeDisabled();
    expect(screen.getByText(messages.mapsSpike.metrics.needDemo)).toBeVisible();
  });

  it('exporta solo lo visible y deshabilita sin capas', async () => {
    const viewActions = actions();
    const { unmount } = renderView(state(), viewActions);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('tab', {
        name: messages.mapsSpike.panel.tabs.export,
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: messages.mapsSpike.export.actions.svg,
      }),
    );
    expect(viewActions.exportSvg).toHaveBeenCalledTimes(1);
    unmount();

    renderView(
      state({
        visibleLayers: { regions: false, paths: false, places: false },
      }),
      actions(),
    );
    await user.click(
      screen.getByRole('tab', {
        name: messages.mapsSpike.panel.tabs.export,
      }),
    );
    expect(
      screen.getByRole('button', {
        name: messages.mapsSpike.export.actions.svg,
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(messages.mapsSpike.export.hiddenHint),
    ).toBeVisible();
  });

  it('cubre los estados WebGL2 y error de motor', () => {
    const { unmount } = renderView(state({ status: 'unsupported' }));

    expect(
      screen.getByRole('heading', {
        name: messages.mapsSpike.webgl.unsupportedTitle,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: messages.mapsSpike.webgl.recheck,
      }),
    ).toBeVisible();
    unmount();

    renderView(state({ status: 'error', error: 'Detalle técnico' }));
    expect(
      screen.getByRole('heading', {
        name: messages.mapsSpike.map.engineErrorTitle,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: messages.mapsSpike.map.retry }),
    ).toBeVisible();
  });
});
