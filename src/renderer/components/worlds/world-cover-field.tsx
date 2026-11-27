import { useEffect, useId, useRef, useState } from 'react';

import { useWorldAssets } from '../../hooks/use-world-assets';
import { useMessages } from '../../i18n/provider';
import { AssetPickerDialog } from '../assets/asset-picker-dialog';
import { Button } from '../button';
import { WorldMark } from './world-mark';

export interface WorldCoverFieldProps {
  readonly mode: 'create' | 'edit';
  readonly worldId: string | null;
  readonly value: string | null;
  readonly onChange: (assetId: string | null) => void;
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
 * Bloque de portada del formulario de mundo.
 *
 * En creación no hay mundo ni assets: solo se explica que se elige después, sin
 * controles enfocables. En edición la portada es parte del formulario: elegir o
 * quitar cambia la vista previa y solo se persiste con «Guardar cambios». Las
 * imágenes importadas desde el selector sí quedan guardadas en el mundo, porque
 * `assets:import` es inmediato.
 */
export function WorldCoverField({
  mode,
  worldId,
  value,
  onChange,
}: WorldCoverFieldProps) {
  const messages = useMessages();
  const labelId = useId();
  const chooseRef = useRef<HTMLButtonElement | null>(null);
  const focusChooseAfterClear = useRef(false);
  const [open, setOpen] = useState(false);
  const [focusAssetId, setFocusAssetId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const assets = useWorldAssets(worldId, open && mode === 'edit');

  // Al quitar la portada desaparece el botón «Quitar portada»; el foco pasa al
  // botón que queda, «Elegir portada», sin depender del diálogo.
  useEffect(() => {
    if (focusChooseAfterClear.current && value === null) {
      focusChooseAfterClear.current = false;
      chooseRef.current?.focus();
    }
  }, [value]);

  if (mode === 'create') {
    return (
      <section
        className="wc-world-cover-field"
        role="group"
        aria-labelledby={labelId}
      >
        <h3
          className="wc-field__label wc-world-cover-field__label"
          id={labelId}
        >
          {messages.worlds.cover.label}
        </h3>
        <span className="wc-world-cover-field__preview wc-world-cover-field__preview--empty">
          <ImageIcon />
        </span>
        <div className="wc-world-cover-field__body">
          <p className="wc-field__hint">{messages.worlds.cover.createHint}</p>
        </div>
      </section>
    );
  }

  const chooseLabel =
    value === null
      ? messages.worlds.cover.choose
      : messages.worlds.cover.change;

  const handleSelect = (assetId: string): void => {
    setOpen(false);
    setStatus(messages.worlds.cover.selected);
    onChange(assetId);
  };

  const handleClear = (): void => {
    setOpen(false);
    setStatus(messages.worlds.cover.cleared);
    focusChooseAfterClear.current = true;
    onChange(null);
  };

  return (
    <section
      className="wc-world-cover-field"
      role="group"
      aria-labelledby={labelId}
    >
      <h3 className="wc-field__label wc-world-cover-field__label" id={labelId}>
        {messages.worlds.cover.label}
      </h3>

      {value === null || worldId === null ? (
        <span className="wc-world-cover-field__preview wc-world-cover-field__preview--empty">
          <ImageIcon />
          <span className="wc-world-cover-field__empty">
            {messages.worlds.cover.empty}
          </span>
        </span>
      ) : (
        <span className="wc-world-cover-field__preview" aria-hidden="true">
          <WorldMark worldId={worldId} coverAssetId={value} />
        </span>
      )}

      <div className="wc-world-cover-field__body">
        <p className="wc-field__hint">{messages.worlds.cover.hint}</p>
        <div className="wc-world-cover-field__actions">
          <Button
            ref={chooseRef}
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpen(true);
            }}
          >
            {chooseLabel}
          </Button>
          {value !== null ? (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              {messages.worlds.cover.remove}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="wc-visually-hidden" role="status" aria-live="polite">
        {status}
      </p>

      <AssetPickerDialog
        open={open}
        assets={assets.assets}
        state={assets.state}
        selectedAssetId={value}
        onSelect={handleSelect}
        onClear={value === null ? undefined : handleClear}
        onImport={() => {
          void (async () => {
            const imported = await assets.importAssets(
              messages.components.assetPicker.importError,
            );
            setFocusAssetId(imported[0] ?? null);
          })();
        }}
        importing={assets.importing}
        importError={assets.importError}
        onRetry={assets.retry}
        onClose={() => {
          setOpen(false);
        }}
        focusAssetId={focusAssetId}
        onFocusHandled={() => {
          setFocusAssetId(null);
        }}
      />
    </section>
  );
}
