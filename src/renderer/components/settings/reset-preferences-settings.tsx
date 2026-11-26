import { useState } from 'react';

import { useMessages } from '../../i18n/provider';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SettingsSection } from './settings-section';

export interface ResetPreferencesSettingsProps {
  readonly onReset: () => void;
}

/**
 * Restablecer preferencias con confirmación.
 *
 * Es la única acción de esta fase que usa `reset`; vuelve a los defectos de la
 * interfaz y no toca mundos, fichas, imágenes, copias ni registros.
 */
export function ResetPreferencesSettings({
  onReset,
}: ResetPreferencesSettingsProps) {
  const messages = useMessages();
  const [open, setOpen] = useState(false);
  const copy = messages.settings.resetPreferences;

  return (
    <SettingsSection id="restablecer" title={copy.title} lead={copy.lead}>
      <div className="wc-settings__footer">
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(true);
          }}
        >
          {copy.action}
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={copy.dialogTitle}
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setOpen(false);
              }}
            >
              {copy.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              {copy.confirm}
            </Button>
          </>
        }
      >
        <p>{copy.dialogBody}</p>
      </Dialog>
    </SettingsSection>
  );
}
