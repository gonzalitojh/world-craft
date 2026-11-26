import { useMessages } from '../../i18n/provider';
import type { DeleteState } from '../../settings/use-data-settings';
import { Button } from '../button';
import { DataDeleteDialog } from './data-delete-dialog';

export interface DataDangerProps {
  readonly state: DeleteState;
  readonly busy: boolean;
  readonly unavailable: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onConfirm: (keepBackups: boolean) => void;
}

/** Zona de peligro y su diálogo de confirmación. */
export function DataDanger({
  state,
  busy,
  unavailable,
  onOpen,
  onClose,
  onConfirm,
}: DataDangerProps) {
  const messages = useMessages();
  const copy = messages.settings.data.danger;

  return (
    <div className="wc-settings__danger">
      <h3 className="wc-settings__danger-title">{copy.title}</h3>
      <p className="wc-settings__danger-body">{copy.lead}</p>
      <div className="wc-settings__actions">
        <Button
          variant="danger"
          disabled={unavailable || busy}
          onClick={onOpen}
        >
          {copy.action}
        </Button>
      </div>
      {state.status === 'closed' ? null : (
        <DataDeleteDialog
          state={state}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
}
