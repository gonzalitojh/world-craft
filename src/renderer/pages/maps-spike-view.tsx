import { useId, useRef, useState, type ReactNode } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Panel,
  Tabs,
} from '../components';
import { useI18n, useMessages } from '../i18n/provider';
import { cx } from '../lib/class-names';
import { SPIKE_LAYERS, type SpikeMode } from '../maps-spike/layers';
import {
  formatArea,
  formatCoordinate,
  formatDistance,
} from '../maps-spike/geometry';
import type { MapsSpikeViewProps } from '../maps-spike/state';
import { MAP_CANVAS_HELP_ID } from '../maps-spike/state';
import type { SpikeExportKind } from '../../shared/contracts/maps-spike';
import '../styles/maps-spike.css';

const TOOLBAR_MODES: readonly SpikeMode[] = [
  'point',
  'linestring',
  'polygon',
  'rectangle',
  'circle',
  'select',
];

function SvgIcon({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function ModeIcon({ mode }: { readonly mode: SpikeMode }) {
  switch (mode) {
    case 'point':
      return (
        <SvgIcon>
          <circle cx="8" cy="8" r="3" />
        </SvgIcon>
      );
    case 'linestring':
      return (
        <SvgIcon>
          <path d="M3 12l4-8 6 4" />
        </SvgIcon>
      );
    case 'polygon':
      return (
        <SvgIcon>
          <path d="M8 2.5l5 3v5l-5 3-5-3v-5z" />
        </SvgIcon>
      );
    case 'rectangle':
      return (
        <SvgIcon>
          <rect x="3" y="4" width="10" height="8" rx="1" />
        </SvgIcon>
      );
    case 'circle':
      return (
        <SvgIcon>
          <ellipse cx="8" cy="8" rx="5" ry="4" />
        </SvgIcon>
      );
    case 'select':
      return (
        <SvgIcon>
          <path d="M3 2l6 8-2.5.5L8 14 6.5 14 5 10.5 3 12z" />
        </SvgIcon>
      );
  }
}

function TrashIcon() {
  return (
    <SvgIcon>
      <path d="M3 5h10M6 5V3h4v2M5 5l1 8h4l1-8M7 7v4M9 7v4" />
    </SvgIcon>
  );
}

function ClearIcon() {
  return (
    <SvgIcon>
      <path d="M3 4h10M5 4l.7 9h4.6L11 4M6.5 7v3M9.5 7v3" />
    </SvgIcon>
  );
}

function FitIcon() {
  return (
    <SvgIcon>
      <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
    </SvgIcon>
  );
}

function ImportIcon() {
  return (
    <SvgIcon>
      <path d="M8 2v8M5 7l3 3 3-3M3 12v2h10v-2" />
    </SvgIcon>
  );
}

/** Vista presentacional; no importa MapLibre ni Terra Draw. */
export function MapsSpikeView({
  state,
  actions,
  containerRef,
}: MapsSpikeViewProps) {
  const messages = useMessages();
  const { formats } = useI18n();
  const [dialog, setDialog] = useState<'clear' | 'replace' | null>(null);
  const [exportingKind, setExportingKind] = useState<SpikeExportKind | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modeRefs = useRef<Partial<Record<SpikeMode, HTMLButtonElement | null>>>(
    {},
  );
  const clearButtonRef = useRef<HTMLButtonElement | null>(null);
  const importButtonRef = useRef<HTMLButtonElement | null>(null);
  const loadButtonRef = useRef<HTMLButtonElement | null>(null);
  const canvasTitleId = useId();
  const importErrorId = useId();
  const importAlertId = useId();
  const totalFeatures =
    state.counts.regions + state.counts.paths + state.counts.places;
  const visibleCount = SPIKE_LAYERS.filter(
    (layer) => state.visibleLayers[layer.id],
  ).length;
  const hasVisibleFeatures = SPIKE_LAYERS.some(
    (layer) => state.visibleLayers[layer.id] && state.counts[layer.id] > 0,
  );
  const interactive = state.status === 'ready' && state.busy === 'idle';
  const dialogBusy =
    dialog === 'clear'
      ? state.busy === 'clearing'
      : dialog === 'replace'
        ? state.busy === 'generating'
        : false;

  const focusAfterRender = (element: HTMLElement | null): void => {
    if (element === null) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.focus();
      });
    });
  };

  const setMode = (mode: SpikeMode): void => {
    actions.setMode(mode);
  };

  const handleDelete = (): void => {
    const hadSelection = state.selected.length > 0;
    actions.deleteSelected();

    if (hadSelection) {
      modeRefs.current.select?.focus();
    }
  };

  const handleClearConfirm = async (): Promise<void> => {
    await actions.clearAll();
    setDialog(null);
    focusAfterRender(modeRefs.current.point ?? null);
  };

  const handleReplaceConfirm = async (): Promise<void> => {
    await actions.loadDemo500();
    setDialog(null);
  };

  const handleLoad500 = async (): Promise<void> => {
    if (totalFeatures > 0) {
      setDialog('replace');
      return;
    }

    await actions.loadDemo500();
  };

  const handleExport = async (
    kind: SpikeExportKind,
    action: () => Promise<void>,
  ): Promise<void> => {
    setExportingKind(kind);

    try {
      await action();
    } finally {
      setExportingKind(null);
    }
  };

  const selectionCollection = {
    type: 'FeatureCollection' as const,
    features: state.selected.map((item) => item.feature),
  };
  const selectedByLayer = SPIKE_LAYERS.map((layer) => ({
    layer,
    count: state.selected.filter((item) => item.layer === layer.id).length,
  })).filter((entry) => entry.count > 0);
  const selectedLength = state.selected.reduce(
    (total, item) => total + (item.lengthMeters ?? 0),
    0,
  );
  const selectedArea = state.selected.reduce(
    (total, item) => total + (item.areaSquareMeters ?? 0),
    0,
  );

  const countLabel = (count: number): string =>
    formats.plural(count, messages.mapsSpike.layers.count);

  return (
    <div
      className="wc-page wc-maps-spike"
      data-maps-spike-ready={state.status === 'ready' ? 'true' : undefined}
      data-feature-count={String(totalFeatures)}
      data-layer-count-regions={String(state.counts.regions)}
      data-layer-count-paths={String(state.counts.paths)}
      data-layer-count-places={String(state.counts.places)}
      data-map-theme={state.theme}
      data-metrics-state={state.metrics.phase}
    >
      <section
        className="wc-maps-spike__banner"
        aria-labelledby={`${canvasTitleId}-banner`}
      >
        <div className="wc-maps-spike__banner-heading">
          <span className="wc-maps-spike__banner-icon" aria-hidden="true">
            <SvgIcon>
              <path d="M8 2l6 11H2z" />
              <path d="M8 6v3M8 11.5v.1" />
            </SvgIcon>
          </span>
          <h2
            className="wc-maps-spike__banner-title"
            id={`${canvasTitleId}-banner`}
          >
            {messages.mapsSpike.banner.title}
          </h2>
          <span className="wc-maps-spike__badge">
            {messages.mapsSpike.banner.badge}
          </span>
        </div>
        <p className="wc-maps-spike__banner-text">
          {messages.mapsSpike.banner.body}
        </p>
      </section>

      {state.status === 'unsupported' || state.status === 'error' ? null : (
        <div className="wc-maps-spike__toolbar">
          <div
            className="wc-maps-spike__toolbar-group"
            role="group"
            aria-label={messages.mapsSpike.toolbar.modeGroup}
          >
            {TOOLBAR_MODES.map((mode) => (
              <Button
                key={mode}
                ref={(element) => {
                  modeRefs.current[mode] = element;
                }}
                size="sm"
                variant="secondary"
                className={cx(
                  'wc-maps-spike__mode-button',
                  state.mode === mode && 'wc-maps-spike__mode-button--active',
                )}
                aria-pressed={state.mode === mode}
                disabled={!interactive}
                onClick={() => {
                  setMode(mode);
                }}
              >
                <ModeIcon mode={mode} />
                <span>{messages.mapsSpike.modes[mode]}</span>
              </Button>
            ))}
          </div>
          <div
            className="wc-maps-spike__toolbar-group wc-maps-spike__toolbar-group--actions"
            role="group"
            aria-label={messages.mapsSpike.toolbar.actionGroup}
          >
            <Button
              size="sm"
              variant="secondary"
              disabled={!interactive || state.selected.length === 0}
              onClick={handleDelete}
            >
              <TrashIcon />
              <span>{messages.mapsSpike.toolbar.delete}</span>
            </Button>
            <Button
              ref={clearButtonRef}
              size="sm"
              variant="secondary"
              disabled={!interactive || totalFeatures === 0}
              onClick={() => {
                setDialog('clear');
              }}
            >
              <ClearIcon />
              <span>{messages.mapsSpike.toolbar.clear}</span>
            </Button>
          </div>
        </div>
      )}

      {state.status === 'unsupported' ? (
        <section className="wc-maps-spike__error-block" role="alert">
          <h2 className="wc-page__section-title">
            {messages.mapsSpike.webgl.unsupportedTitle}
          </h2>
          <p className="wc-page__note">
            {messages.mapsSpike.webgl.unsupportedDescription}
          </p>
          {state.metrics.environment.length > 0 ? (
            <p className="wc-maps-spike__mono">
              {messages.mapsSpike.webgl.environment(state.metrics.environment)}
            </p>
          ) : null}
          <div className="wc-maps-spike__row">
            <Button variant="secondary" onClick={actions.recheckWebgl}>
              {messages.mapsSpike.webgl.recheck}
            </Button>
            <Button variant="secondary" onClick={actions.goHome}>
              {messages.mapsSpike.webgl.goHome}
            </Button>
          </div>
        </section>
      ) : state.status === 'error' ? (
        <section className="wc-maps-spike__error-block" role="alert">
          <h2 className="wc-page__section-title">
            {messages.mapsSpike.map.engineErrorTitle}
          </h2>
          <details className="wc-maps-spike__details">
            <summary className="wc-maps-spike__details-summary">
              {messages.mapsSpike.map.engineErrorDetail}
            </summary>
            <pre className="wc-maps-spike__pre">{state.error ?? ''}</pre>
          </details>
          <div className="wc-maps-spike__row">
            <Button variant="secondary" onClick={actions.retryEngine}>
              {messages.mapsSpike.map.retry}
            </Button>
            <Button variant="secondary" onClick={actions.goHome}>
              {messages.mapsSpike.webgl.goHome}
            </Button>
          </div>
        </section>
      ) : (
        <div
          className="wc-maps-spike__workbench"
          aria-busy={state.busy !== 'idle' || state.status === 'loading'}
        >
          <section
            className="wc-maps-spike__stage"
            aria-labelledby={canvasTitleId}
          >
            <h2 className="wc-visually-hidden" id={canvasTitleId}>
              {messages.mapsSpike.map.canvasTitle}
            </h2>
            <div
              className={cx(
                'wc-maps-spike__canvas-frame',
                state.busy !== 'idle' && 'wc-maps-spike__canvas-frame--busy',
              )}
            >
              <div
                className="wc-maps-spike__canvas"
                ref={containerRef}
                role="application"
                aria-label={messages.mapsSpike.map.canvasLabel}
                aria-describedby={MAP_CANVAS_HELP_ID}
              />
              <span className="wc-maps-spike__chip" aria-hidden="true">
                {messages.mapsSpike.map.chip}
              </span>
              <div className="wc-maps-spike__fit">
                <IconButton
                  label={messages.mapsSpike.map.fit}
                  tooltip={messages.mapsSpike.map.fit}
                  size="sm"
                  variant="secondary"
                  icon={<FitIcon />}
                  disabled={!interactive || !hasVisibleFeatures}
                  onClick={actions.fitView}
                />
              </div>
              {state.status === 'loading' ? (
                <div className="wc-maps-spike__loading" aria-busy="true">
                  <span className="wc-maps-spike__skeleton" />
                  <p>{messages.mapsSpike.map.loading}</p>
                </div>
              ) : totalFeatures === 0 ? (
                <p className="wc-maps-spike__canvas-empty" aria-hidden="true">
                  {messages.mapsSpike.map.empty}
                </p>
              ) : visibleCount === 0 ? (
                <p className="wc-maps-spike__canvas-empty" aria-hidden="true">
                  {messages.mapsSpike.map.allHidden}
                </p>
              ) : null}
            </div>
            <p className="wc-maps-spike__help" id={MAP_CANVAS_HELP_ID}>
              <span>{messages.mapsSpike.map.helpMouse}</span>
              <span>{messages.mapsSpike.map.helpKeyboard}</span>
            </p>
          </section>

          <Panel
            className="wc-maps-spike__panel"
            title={messages.mapsSpike.panel.title}
            headingLevel={2}
            description={messages.mapsSpike.panel.summary(
              formats.plural(totalFeatures, messages.mapsSpike.layers.count),
              formats.formatNumber(visibleCount),
              formats.formatNumber(SPIKE_LAYERS.length),
            )}
          >
            <Tabs
              label={messages.mapsSpike.panel.tabsLabel}
              initialId="layers"
              items={[
                {
                  id: 'layers',
                  label: messages.mapsSpike.panel.tabs.layers,
                  content: (
                    <div className="wc-maps-spike__tab">
                      {totalFeatures === 0 ? (
                        <EmptyState
                          headingLevel={3}
                          title={messages.mapsSpike.layers.emptyTitle}
                          description={
                            messages.mapsSpike.layers.emptyDescription
                          }
                          action={
                            <Button
                              ref={loadButtonRef}
                              size="sm"
                              variant="secondary"
                              loading={state.busy === 'generating'}
                              disabled={!interactive}
                              onClick={() => {
                                void handleLoad500();
                              }}
                            >
                              {messages.mapsSpike.layers.emptyAction}
                            </Button>
                          }
                        />
                      ) : null}

                      <h3 className="wc-maps-spike__section-title">
                        {messages.mapsSpike.layers.dataTitle}
                      </h3>
                      <ul className="wc-maps-spike__layers">
                        {SPIKE_LAYERS.map((layer) => {
                          const name = messages.mapsSpike.layers[layer.id];
                          const visible = state.visibleLayers[layer.id];

                          return (
                            <li className="wc-maps-spike__layer" key={layer.id}>
                              <Checkbox
                                className="wc-maps-spike__layer-check"
                                label={messages.mapsSpike.layers.show(name)}
                                checked={visible}
                                disabled={!interactive}
                                describedBy={`wc-maps-spike-layer-count-${layer.id}`}
                                onChange={() => {
                                  actions.toggleLayer(layer.id);
                                }}
                              />
                              <span
                                className={cx(
                                  'wc-maps-spike__swatch',
                                  `wc-maps-spike__swatch--${layer.id}`,
                                )}
                                aria-hidden="true"
                              />
                              <span className="wc-maps-spike__layer-name">
                                {name}
                              </span>
                              <span
                                className="wc-maps-spike__layer-count"
                                id={`wc-maps-spike-layer-count-${layer.id}`}
                              >
                                {countLabel(state.counts[layer.id])}
                              </span>
                              {visible ? null : (
                                <span className="wc-maps-spike__layer-hidden">
                                  {messages.mapsSpike.layers.hidden}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      <div
                        className="wc-maps-spike__data-actions"
                        aria-busy={
                          state.busy === 'generating' ||
                          state.busy === 'importing'
                        }
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={state.busy === 'generating'}
                          disabled={!interactive}
                          onClick={() => {
                            void handleLoad500();
                          }}
                        >
                          {messages.mapsSpike.layers.load500}
                        </Button>
                        <Button
                          ref={importButtonRef}
                          size="sm"
                          variant="secondary"
                          loading={state.busy === 'importing'}
                          disabled={!interactive}
                          aria-describedby={
                            state.importError === null
                              ? importErrorId
                              : `${importErrorId} ${importAlertId}`
                          }
                          onClick={() => {
                            fileInputRef.current?.click();
                          }}
                        >
                          <ImportIcon />
                          <span>{messages.mapsSpike.layers.import}</span>
                        </Button>
                        <input
                          ref={fileInputRef}
                          className="wc-maps-spike__file"
                          type="file"
                          accept=".geojson,.json,application/geo+json,application/json"
                          tabIndex={-1}
                          aria-hidden="true"
                          onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (file !== undefined) {
                              void actions.importFeatures(file);
                              focusAfterRender(importButtonRef.current);
                            }

                            event.target.value = '';
                          }}
                        />
                      </div>
                      <p className="wc-maps-spike__hint" id={importErrorId}>
                        {messages.mapsSpike.layers.importHelp}
                      </p>
                      {state.importError !== null ? (
                        <p
                          className="wc-maps-spike__inline-error"
                          id={importAlertId}
                          role="alert"
                        >
                          {state.importError}
                        </p>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'selection',
                  label: messages.mapsSpike.panel.tabs.selection,
                  content: (
                    <div className="wc-maps-spike__tab">
                      {state.selected.length === 0 ? (
                        <EmptyState
                          headingLevel={3}
                          title={messages.mapsSpike.selection.emptyTitle}
                          description={
                            messages.mapsSpike.selection.emptyDescription
                          }
                          action={
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!interactive}
                              onClick={() => {
                                actions.setMode('select');
                              }}
                            >
                              {messages.mapsSpike.selection.emptyAction}
                            </Button>
                          }
                        />
                      ) : (
                        <>
                          <div className="wc-maps-spike__selection-head">
                            <h3 className="wc-maps-spike__section-title">
                              {formats.plural(
                                state.selected.length,
                                messages.mapsSpike.selection.count,
                              )}
                            </h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={actions.deselect}
                            >
                              {messages.mapsSpike.selection.deselect}
                            </Button>
                          </div>
                          {state.selected.length > 1 ? (
                            <div className="wc-maps-spike__selection-aggregate">
                              <p>
                                <strong>
                                  {messages.mapsSpike.selection.byLayer}:
                                </strong>{' '}
                                {formats.formatList(
                                  selectedByLayer.map((entry) =>
                                    messages.mapsSpike.selection.layerCount(
                                      messages.mapsSpike.layers[entry.layer.id],
                                      formats.formatNumber(entry.count),
                                    ),
                                  ),
                                )}
                              </p>
                              {selectedLength > 0 ? (
                                <p>
                                  <strong>
                                    {messages.mapsSpike.selection.totalLength}:
                                  </strong>{' '}
                                  {formatDistance(
                                    selectedLength,
                                    formats.formatNumber,
                                  )}
                                </p>
                              ) : null}
                              {selectedArea > 0 ? (
                                <p>
                                  <strong>
                                    {messages.mapsSpike.selection.totalArea}:
                                  </strong>{' '}
                                  {formatArea(
                                    selectedArea,
                                    formats.formatNumber,
                                  )}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          <ul className="wc-maps-spike__selection-list">
                            {state.selected.map((item) => (
                              <li
                                className="wc-maps-spike__selection-item"
                                key={item.id}
                              >
                                <p>
                                  <strong>
                                    {messages.mapsSpike.selection.layer}:
                                  </strong>{' '}
                                  {messages.mapsSpike.layers[item.layer]} ·{' '}
                                  <strong>
                                    {messages.mapsSpike.selection.mode}:
                                  </strong>{' '}
                                  {messages.mapsSpike.modes[item.mode]}
                                </p>
                                <p className="wc-maps-spike__mono">
                                  <strong>
                                    {messages.mapsSpike.selection.id}:
                                  </strong>{' '}
                                  {item.id}
                                </p>
                                <p>
                                  <strong>
                                    {messages.mapsSpike.selection.vertices}:
                                  </strong>{' '}
                                  {formats.formatNumber(item.vertices)}
                                </p>
                                {item.coordinates !== null ? (
                                  <p>
                                    <strong>
                                      {messages.mapsSpike.selection.coordinates}
                                      :
                                    </strong>{' '}
                                    {messages.mapsSpike.selection.latitude}{' '}
                                    {formatCoordinate(
                                      item.coordinates[1],
                                      formats.formatNumber,
                                    )}{' '}
                                    · {messages.mapsSpike.selection.longitude}{' '}
                                    {formatCoordinate(
                                      item.coordinates[0],
                                      formats.formatNumber,
                                    )}
                                  </p>
                                ) : null}
                                {item.lengthMeters !== null ? (
                                  <p>
                                    <strong>
                                      {messages.mapsSpike.selection.length}:
                                    </strong>{' '}
                                    {formatDistance(
                                      item.lengthMeters,
                                      formats.formatNumber,
                                    )}
                                  </p>
                                ) : null}
                                {item.areaSquareMeters !== null ? (
                                  <p>
                                    <strong>
                                      {messages.mapsSpike.selection.area}:
                                    </strong>{' '}
                                    {formatArea(
                                      item.areaSquareMeters,
                                      formats.formatNumber,
                                    )}
                                  </p>
                                ) : null}
                                {item.perimeterMeters !== null ? (
                                  <p>
                                    <strong>
                                      {messages.mapsSpike.selection.perimeter}:
                                    </strong>{' '}
                                    {formatDistance(
                                      item.perimeterMeters,
                                      formats.formatNumber,
                                    )}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <details className="wc-maps-spike__details">
                            <summary className="wc-maps-spike__details-summary">
                              {messages.mapsSpike.selection.geojsonSummary}
                            </summary>
                            <pre className="wc-maps-spike__pre">
                              {JSON.stringify(selectionCollection, null, 2)}
                            </pre>
                          </details>
                        </>
                      )}

                      <h3 className="wc-maps-spike__section-title">
                        {messages.mapsSpike.metrics.title}
                      </h3>
                      <dl className="wc-maps-spike__metrics">
                        <MetricRow
                          label={messages.mapsSpike.metrics.load}
                          value={
                            state.metrics.loadMs === null
                              ? messages.mapsSpike.metrics.unmeasured
                              : `${formats.formatNumber(state.metrics.loadMs, {
                                  maximumFractionDigits: 1,
                                })} ms`
                          }
                        />
                        <MetricRow
                          label={messages.mapsSpike.metrics.pan}
                          value={
                            state.metrics.report === null
                              ? messages.mapsSpike.metrics.unmeasured
                              : `${formats.formatNumber(
                                  state.metrics.report.medians.panP95Ms,
                                  { maximumFractionDigits: 1 },
                                )} ms`
                          }
                        />
                        <MetricRow
                          label={messages.mapsSpike.metrics.edit}
                          value={
                            state.metrics.report === null
                              ? messages.mapsSpike.metrics.unmeasured
                              : `${formats.formatNumber(
                                  state.metrics.report.medians.editMs,
                                  { maximumFractionDigits: 1 },
                                )} ms`
                          }
                        />
                        <MetricRow
                          label={messages.mapsSpike.metrics.longTasks}
                          value={
                            state.metrics.report === null
                              ? messages.mapsSpike.metrics.unmeasured
                              : formats.formatNumber(
                                  state.metrics.report.medians.longTasks,
                                )
                          }
                        />
                        <MetricRow
                          label={messages.mapsSpike.metrics.svg}
                          value={
                            state.metrics.report === null
                              ? messages.mapsSpike.metrics.unmeasured
                              : `${formats.formatNumber(
                                  state.metrics.report.medians.svgMs,
                                  { maximumFractionDigits: 1 },
                                )} ms · ${formats.formatBytes(
                                  state.metrics.report.medians.svgBytes,
                                )}`
                          }
                        />
                        <MetricRow
                          label={messages.mapsSpike.metrics.png}
                          value={
                            state.metrics.report === null
                              ? messages.mapsSpike.metrics.unmeasured
                              : `${formats.formatNumber(
                                  state.metrics.report.medians.pngMs,
                                  { maximumFractionDigits: 1 },
                                )} ms · ${formats.formatBytes(
                                  state.metrics.report.medians.pngBytes,
                                )}`
                          }
                        />
                      </dl>
                      <p className="wc-maps-spike__hint">
                        {messages.mapsSpike.metrics.note}
                      </p>
                      {state.metrics.environment.length > 0 ? (
                        <p className="wc-maps-spike__mono">
                          {messages.mapsSpike.metrics.environment}:{' '}
                          {state.metrics.environment}
                        </p>
                      ) : null}
                      {state.metrics.report !== null &&
                      state.metrics.loadMs === null ? (
                        <p className="wc-maps-spike__hint">
                          {messages.mapsSpike.metrics.partial}
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={state.metrics.phase === 'measuring'}
                        disabled={
                          !interactive ||
                          totalFeatures < 500 ||
                          state.metrics.loadMs === null
                        }
                        onClick={() => {
                          void actions.measurePerformance();
                        }}
                      >
                        {state.metrics.phase === 'measuring'
                          ? messages.mapsSpike.metrics.measuring
                          : messages.mapsSpike.metrics.measure}
                      </Button>
                      {state.metrics.loadMs === null || totalFeatures < 500 ? (
                        <p className="wc-maps-spike__hint">
                          {messages.mapsSpike.metrics.needDemo}
                        </p>
                      ) : null}
                      {state.metrics.report === null ? null : (
                        <div className="wc-maps-spike__data-actions">
                          {(['json', 'markdown'] as const).map((kind) => {
                            const file = state.exports[kind];
                            const error = state.exportErrors[kind];
                            const label =
                              kind === 'json'
                                ? messages.mapsSpike.metrics.reportJson
                                : messages.mapsSpike.metrics.reportMarkdown;
                            const action =
                              kind === 'json'
                                ? actions.exportReportJson
                                : actions.exportReportMarkdown;

                            return (
                              <div key={kind} className="wc-maps-spike__row">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={exportingKind === kind}
                                  disabled={state.busy !== 'idle'}
                                  aria-describedby={
                                    error === undefined
                                      ? undefined
                                      : `wc-maps-spike-report-error-${kind}`
                                  }
                                  onClick={() => {
                                    void handleExport(kind, action);
                                  }}
                                >
                                  {label}
                                </Button>
                                {file === undefined ? null : (
                                  <p className="wc-maps-spike__mono">
                                    {file.fileName} ·{' '}
                                    {formats.formatBytes(file.bytes)}
                                  </p>
                                )}
                                {error === undefined ? null : (
                                  <p
                                    className="wc-maps-spike__inline-error"
                                    id={`wc-maps-spike-report-error-${kind}`}
                                    role="alert"
                                  >
                                    {error}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'export',
                  label: messages.mapsSpike.panel.tabs.export,
                  content: (
                    <div className="wc-maps-spike__tab">
                      <p className="wc-page__note">
                        {messages.mapsSpike.export.intro}
                      </p>
                      <ul
                        className="wc-maps-spike__export-list"
                        aria-busy={
                          state.busy === 'exporting' || exportingKind !== null
                        }
                      >
                        {(['svg', 'png', 'geojson'] as const).map((kind) => {
                          const file = state.exports[kind];
                          const error = state.exportErrors[kind];
                          const disabled = !interactive || !hasVisibleFeatures;
                          const action =
                            kind === 'svg'
                              ? actions.exportSvg
                              : kind === 'png'
                                ? actions.exportPng
                                : actions.exportGeoJson;

                          return (
                            <li
                              className="wc-maps-spike__export-row"
                              key={kind}
                            >
                              <h3 className="wc-maps-spike__section-title">
                                {messages.mapsSpike.export.labels[kind]}
                              </h3>
                              <p className="wc-maps-spike__hint">
                                {messages.mapsSpike.export.descriptions[kind]}
                              </p>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={exportingKind === kind}
                                disabled={disabled && exportingKind !== kind}
                                aria-describedby={
                                  error === undefined
                                    ? undefined
                                    : `wc-maps-spike-export-error-${kind}`
                                }
                                onClick={() => {
                                  void handleExport(kind, action);
                                }}
                              >
                                {messages.mapsSpike.export.actions[kind]}
                              </Button>
                              {file === undefined ? null : (
                                <p className="wc-maps-spike__mono">
                                  {file.fileName} ·{' '}
                                  {formats.formatBytes(file.bytes)}
                                </p>
                              )}
                              {error === undefined ? null : (
                                <p
                                  className="wc-maps-spike__inline-error"
                                  id={`wc-maps-spike-export-error-${kind}`}
                                  role="alert"
                                >
                                  {error}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {!hasVisibleFeatures ? (
                        <p className="wc-maps-spike__hint">
                          {totalFeatures === 0
                            ? messages.mapsSpike.export.emptyHint
                            : messages.mapsSpike.export.hiddenHint}
                        </p>
                      ) : null}
                      <p className="wc-maps-spike__mono">
                        {messages.mapsSpike.export.folder}
                      </p>
                    </div>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      )}

      <footer className="wc-maps-spike__footer">
        <p
          className="wc-maps-spike__status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.status === 'loading'
            ? messages.mapsSpike.map.loading
            : state.status === 'error' || state.status === 'unsupported'
              ? ''
              : state.announcement.length > 0
                ? state.announcement
                : messages.mapsSpike.status.ready}
        </p>
        <p className="wc-maps-spike__mono wc-maps-spike__folder">
          {messages.mapsSpike.export.folder}
        </p>
      </footer>

      <Dialog
        open={dialog === 'clear'}
        title={messages.mapsSpike.dialog.clearTitle}
        dismissible={!dialogBusy}
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) {
            setDialog(null);
          }
        }}
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              disabled={dialogBusy}
              onClick={() => {
                setDialog(null);
              }}
            >
              {messages.mapsSpike.dialog.cancel}
            </Button>
            <Button
              variant="danger"
              loading={dialogBusy}
              onClick={() => {
                void handleClearConfirm();
              }}
            >
              {messages.mapsSpike.dialog.clearConfirm}
            </Button>
          </>
        }
      >
        <p>
          {messages.mapsSpike.dialog.clearBody(
            formats.plural(totalFeatures, messages.mapsSpike.layers.count),
          )}
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'replace'}
        title={messages.mapsSpike.dialog.replaceTitle}
        dismissible={!dialogBusy}
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) {
            setDialog(null);
          }
        }}
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              disabled={dialogBusy}
              onClick={() => {
                setDialog(null);
              }}
            >
              {messages.mapsSpike.dialog.cancel}
            </Button>
            <Button
              variant="danger"
              loading={dialogBusy}
              onClick={() => {
                void handleReplaceConfirm();
              }}
            >
              {messages.mapsSpike.dialog.replaceConfirm}
            </Button>
          </>
        }
      >
        <p>
          {messages.mapsSpike.dialog.replaceBody(
            formats.plural(totalFeatures, messages.mapsSpike.layers.count),
          )}
        </p>
      </Dialog>
    </div>
  );
}

function MetricRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="wc-maps-spike__metric-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
