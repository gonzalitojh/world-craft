import { useEffect, useRef } from 'react';

import type { AssetSummary } from '../../../shared/contracts/assets';
import { useMessages } from '../../i18n/provider';
import { assetUrl } from '../../lib/asset-url';
import { Button } from '../button';
import { Dialog } from '../dialog';

/** Estado de carga de la lista de imágenes del mundo. */
export type AssetPickerState = 'loading' | 'ready' | 'error';

export interface AssetPickerDialogProps {
  readonly open: boolean;
  readonly assets: readonly AssetSummary[];
  readonly state: AssetPickerState;
  /** Asset que ya es la portada; `null` si no hay. */
  readonly selectedAssetId: string | null;
  /** Escritura de la portada en curso: el selector no se puede descartar. */
  readonly pending?: boolean;
  /** Fallo al persistir la portada; solo lo usa la página del mundo. */
  readonly saveError?: string | null;
  readonly onSelect: (assetId: string) => void;
  /** Si falta, no se ofrece «Quitar portada». */
  readonly onClear?: (() => void) | undefined;
  /** Si falta, el vacío no ofrece «Añadir imagen». */
  readonly onImport?: (() => void) | undefined;
  readonly importing?: boolean;
  readonly importError?: string | null;
  readonly onRetry?: (() => void) | undefined;
  readonly onClose: () => void;
  /**
   * Asset que debe recibir el foco después de importarlo. El selector lo mueve
   * una sola vez y avisa para que el poseedor lo limpie.
   */
  readonly focusAssetId?: string | null;
  readonly onFocusHandled?: (() => void) | undefined;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m3.5 8 3 3 6-6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="7" cy="8" r="1.3" fill="currentColor" />
      <path
        d="m4.5 14 4-4 3 3 2.5-2.5 2.5 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Selector compartido de portada.
 *
 * La ficha y el mundo eligen entre las imágenes ya importadas del mundo; no
 * hay un canal nuevo. El poseedor carga la lista al abrir y decide si hay
 * importación (`onImport`) y si se puede quitar la portada (`onClear`). El
 * selector nunca persiste: elegir es la acción y el poseedor decide cuándo
 * escribe.
 */
export function AssetPickerDialog({
  open,
  assets,
  state,
  selectedAssetId,
  pending = false,
  saveError = null,
  onSelect,
  onClear,
  onImport,
  importing = false,
  importError = null,
  onRetry,
  onClose,
  focusAssetId = null,
  onFocusHandled,
}: AssetPickerDialogProps) {
  const messages = useMessages();
  const listRef = useRef<HTMLUListElement | null>(null);
  const addRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const focusedForOpen = useRef(false);
  const lastState = useRef<AssetPickerState>(state);

  useEffect(() => {
    if (!open) {
      focusedForOpen.current = false;
    }
  }, [open]);

  // Foco inicial una sola vez: la portada actual, la primera imagen, «Añadir
  // imagen» o el cuerpo del diálogo. Los reintentos e importaciones no roban el
  // foco salvo el caso explícito de `focusAssetId`.
  useEffect(() => {
    const previous = lastState.current;
    lastState.current = state;

    if (!open || state === 'loading' || focusedForOpen.current) {
      return;
    }

    focusedForOpen.current = true;

    if (state === 'error') {
      // Los reintentos y los errores no roban el foco: se queda en el selector.
      return;
    }

    // Si el usuario ya movió el foco fuera del cuerpo mientras cargaba, no se
    // le roba al terminar. El contenedor de carga desaparece y el foco vuelve
    // al documento, que sí es un caso de foco perdido.
    if (previous === 'loading') {
      const active = document.activeElement;

      if (
        active instanceof HTMLElement &&
        active !== document.body &&
        bodyRef.current?.contains(active) !== true
      ) {
        return;
      }
    }

    const selected =
      selectedAssetId === null
        ? null
        : listRef.current?.querySelector<HTMLElement>(
            `[data-asset-id="${selectedAssetId}"]`,
          );
    const first = listRef.current?.querySelector<HTMLElement>('button');

    if (selected !== null && selected !== undefined) {
      selected.focus();
      return;
    }

    if (first !== null && first !== undefined) {
      first.focus();
      return;
    }

    if (assets.length === 0 && onImport !== undefined) {
      addRef.current?.focus();
      return;
    }

    bodyRef.current?.focus();
  }, [open, state, selectedAssetId, assets.length, onImport]);

  useEffect(() => {
    if (!open || focusAssetId === null || listRef.current === null) {
      return;
    }

    const target = listRef.current.querySelector<HTMLElement>(
      `[data-asset-id="${focusAssetId}"]`,
    );

    if (target !== null) {
      target.focus();
      onFocusHandled?.();
    }
  }, [open, focusAssetId, assets, onFocusHandled]);

  const showEmpty = state === 'ready' && assets.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.components.assetPicker.title}
      dismissible={!pending && !importing}
      actions={
        <>
          {onClear !== undefined && selectedAssetId !== null ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={importing || pending}
              onClick={onClear}
            >
              {messages.components.assetPicker.clear}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={importing || pending}
            onClick={onClose}
          >
            {messages.components.assetPicker.close}
          </Button>
        </>
      }
    >
      <p className="wc-dialog__lead">{messages.components.assetPicker.lead}</p>

      {state === 'loading' ? (
        <div
          className="wc-image-picker__state"
          aria-busy="true"
          ref={bodyRef}
          data-autofocus
          tabIndex={-1}
        >
          <ul className="wc-image-picker" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index}>
                <span className="wc-image-picker__skeleton wc-skeleton" />
              </li>
            ))}
          </ul>
          <p className="wc-visually-hidden" role="status" aria-live="polite">
            {messages.components.assetPicker.loading}
          </p>
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="wc-image-picker__state">
          <div className="wc-alert wc-alert--inline" role="alert">
            <p>{messages.components.assetPicker.loadError}</p>
            {onRetry !== undefined ? (
              <div className="wc-alert__actions">
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  {messages.components.assetPicker.retry}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="wc-empty wc-image-picker__state">
          <span className="wc-empty__icon">
            <ImageIcon />
          </span>
          <p className="wc-empty__description">
            {messages.components.assetPicker.empty}
          </p>
          {onImport !== undefined ? (
            <div className="wc-empty__actions">
              <Button
                ref={addRef}
                variant="primary"
                size="sm"
                loading={importing}
                onClick={onImport}
              >
                {importing
                  ? messages.components.assetPicker.importing
                  : messages.components.assetPicker.addImage}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {state === 'ready' && assets.length > 0 ? (
        <ul
          className="wc-image-picker"
          ref={listRef}
          aria-busy={importing ? true : undefined}
        >
          {assets.map((asset, index) => {
            const selected = selectedAssetId === asset.id;

            return (
              <li key={asset.id}>
                <button
                  type="button"
                  className="wc-image-picker__item"
                  data-asset-id={asset.id}
                  aria-pressed={selected}
                  aria-label={messages.components.assetPicker.option(index + 1)}
                  disabled={importing}
                  onClick={() => {
                    onSelect(asset.id);
                  }}
                >
                  <img
                    className="wc-image-picker__thumb"
                    src={assetUrl(asset.id, 'thumb')}
                    alt=""
                    loading="lazy"
                  />
                  {selected ? (
                    <span className="wc-image-picker__badge">
                      <CheckIcon />
                      {messages.components.assetPicker.selected}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {onImport !== undefined && state === 'ready' && assets.length > 0 ? (
        <div className="wc-image-picker__actions">
          <Button
            ref={addRef}
            variant="secondary"
            size="sm"
            loading={importing}
            onClick={onImport}
          >
            {importing
              ? messages.components.assetPicker.importing
              : messages.components.assetPicker.addImage}
          </Button>
        </div>
      ) : null}

      {importError !== null ? (
        <p className="wc-form__error" role="alert">
          {importError}
        </p>
      ) : null}

      {saveError !== null ? (
        <p className="wc-form__error" role="alert">
          {saveError}
        </p>
      ) : null}

      {pending ? (
        <p className="wc-visually-hidden" role="status" aria-live="polite">
          {messages.components.assetPicker.saving}
        </p>
      ) : null}
    </Dialog>
  );
}
