import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n/provider';
import type { ExportState } from '../../settings/use-data-settings';
import { Button } from '../button';
import { DataExportDialog } from './data-export-dialog';

export interface DataExportProps {
  readonly state: ExportState;
  readonly busy: boolean;
  readonly unavailable: boolean;
  /** `null` si el resumen aún no está listo. */
  readonly worldCount: number | null;
  readonly onExport: () => void;
  readonly onDismiss: () => void;
}

/** Exportación de la biblioteca total con estados y resultado enfocable. */
export function DataExport({
  state,
  busy,
  unavailable,
  worldCount,
  onExport,
  onDismiss,
}: DataExportProps) {
  const i18n = useI18n();
  const copy = i18n.messages.settings.data.export;
  const resultRef = useRef<HTMLHeadingElement | null>(null);
  const running = state.status === 'running';

  useEffect(() => {
    if (state.status === 'done') {
      // El resultado recibe foco: el lector de pantalla ya lo anuncia. No se
      // envía también al anunciador para no duplicar el mensaje.
      resultRef.current?.focus();
    }
  }, [state.status]);

  return (
    <div className="wc-settings__subsection">
      <h3 className="wc-settings__subheading">{copy.title}</h3>
      <p className="wc-settings__note">{copy.lead}</p>
      <ul className="wc-settings__list">
        <li>{copy.includes}</li>
        <li>{copy.database}</li>
        <li>{copy.packages}</li>
        <li>{copy.excludes}</li>
        <li>{copy.import}</li>
      </ul>
      {worldCount === 0 ? (
        <p className="wc-settings__empty">{copy.empty}</p>
      ) : null}

      <div className="wc-settings__actions">
        <Button
          variant="primary"
          loading={running}
          disabled={unavailable || (busy && !running)}
          onClick={onExport}
        >
          {copy.action}
        </Button>
      </div>

      {running || state.status === 'error' ? (
        <DataExportDialog state={state} onDismiss={onDismiss} />
      ) : null}

      {state.status === 'done' ? (
        <div className="wc-settings__result">
          <h3
            className="wc-settings__result-title"
            tabIndex={-1}
            ref={resultRef}
          >
            {copy.resultTitle}
          </h3>
          <dl className="wc-settings__meta">
            <div className="wc-settings__meta-row">
              <dt className="wc-settings__meta-label">{copy.resultFile}</dt>
              <dd className="wc-settings__meta-value">
                {state.result.fileName}
              </dd>
            </div>
            <div className="wc-settings__meta-row">
              <dt className="wc-settings__meta-label">{copy.resultSize}</dt>
              <dd className="wc-settings__meta-value">
                {i18n.formats.formatBytes(state.result.size)}
              </dd>
            </div>
            <div className="wc-settings__meta-row">
              <dt className="wc-settings__meta-label">{copy.resultWorlds}</dt>
              <dd className="wc-settings__meta-value">
                {i18n.formats.plural(state.result.worlds, copy.worldsCount)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
