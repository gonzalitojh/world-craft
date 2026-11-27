import { useEffect, useRef, useState } from 'react';

import { useMessages } from '../i18n/provider';
import type { MapsSpikeActions, MapsSpikeState } from '../maps-spike/state';
import { useSpikeMap } from '../maps-spike/use-spike-map';
import { supportsWebGl2 } from '../maps-spike/webgl';
import { MapsSpikeView } from './maps-spike-view';

function goHome(): void {
  window.location.hash = '';
}

const NOOP_ACTIONS: MapsSpikeActions = {
  setMode: () => {},
  deleteSelected: () => {},
  deselect: () => {},
  clearAll: async () => {},
  loadDemo500: async () => {},
  importFeatures: async () => {},
  exportSvg: async () => {},
  exportPng: async () => {},
  exportGeoJson: async () => {},
  exportReportJson: async () => {},
  exportReportMarkdown: async () => {},
  fitView: () => {},
  measurePerformance: async () => {},
  toggleLayer: () => {},
  retryEngine: () => {},
  recheckWebgl: () => {},
  goHome,
};

/**
 * Laboratorio interno del spike de mapas (#80).
 *
 * La página solo resuelve la sonda WebGL2 y monta el hook diferido; toda la
 * pintura y la interacción viven en `MapsSpikeLab`, que no se ejecuta si la
 * sesión no puede crear WebGL2.
 */
export function MapsSpikePage() {
  const messages = useMessages();
  const [webglAvailable, setWebglAvailable] = useState(() => supportsWebGl2());
  const emptyContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.getElementById('wc-main')?.focus();
  }, []);

  if (!webglAvailable) {
    const state: MapsSpikeState = {
      status: 'unsupported',
      error: null,
      mode: 'select',
      features: [],
      counts: { regions: 0, paths: 0, places: 0 },
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
        environment: messages.mapsSpike.webgl.environmentUnavailable,
      },
      announcement: '',
      theme:
        document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    };
    const actions: MapsSpikeActions = {
      ...NOOP_ACTIONS,
      recheckWebgl: () => {
        setWebglAvailable(supportsWebGl2());
      },
      goHome,
    };

    return (
      <MapsSpikeView
        state={state}
        actions={actions}
        containerRef={emptyContainer}
      />
    );
  }

  return <MapsSpikeLab />;
}

function MapsSpikeLab() {
  const { containerRef, state, actions } = useSpikeMap({ retryToken: 0 });

  return (
    <MapsSpikeView
      state={state}
      actions={actions}
      containerRef={containerRef}
    />
  );
}
