import { useMessages } from '../../i18n/provider';
import { dataErrorMessage } from '../../settings/data-errors';
import type { ExportState } from '../../settings/use-data-settings';
import { Button } from '../button';
import { Dialog } from '../dialog';

export interface DataExportDialogProps {
  readonly state: ExportState;
  readonly onDismiss: () => void;
}

/**
 * Diálogo de progreso y error de la exportación total.
 *
 * Mientras exporta no se puede cerrar ni cancelar, porque el servicio no
 * expone cancelación. El estado de progreso recibe el foco y no usa una región
 * viva propia: el anunciador de Ajustes solo cubre mensajes sin foco. Al
 * terminar correctamente el diálogo desaparece y el foco pasa al resultado; un
 * error se anuncia con `role="alert"` sin cerrar.
 */
export function DataExportDialog({ state, onDismiss }: DataExportDialogProps) {
  const messages = useMessages();
  const copy = messages.settings.data.export;
  const running = state.status === 'running';

  return (
    <Dialog
      open
      onClose={onDismiss}
      title={running ? copy.running : copy.errorTitle}
      dismissible={!running}
      focusKey={running ? 'running' : 'error'}
      actions={
        running ? undefined : (
          <Button variant="secondary" data-autofocus onClick={onDismiss}>
            {messages.components.dialog.close}
          </Button>
        )
      }
    >
      {running ? (
        <div className="wc-settings__progress-block" aria-busy="true">
          <p className="wc-settings__status" data-autofocus tabIndex={-1}>
            {copy.running}
          </p>
          <progress
            className="wc-settings__progress"
            aria-label={copy.running}
          />
        </div>
      ) : state.status === 'error' ? (
        <div className="wc-settings__error" role="alert">
          <p>{copy.errorTitle}</p>
          <p>{dataErrorMessage(messages, state.code)}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
