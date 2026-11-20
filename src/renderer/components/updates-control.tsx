import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createIdleUpdateSnapshot,
  type UpdateSnapshot,
} from '../../shared/contracts/updates';
import type { IpcResult } from '../../shared/contracts/result';
import { messages } from '../messages/es';
import { Button } from './button';
import { UpdatesDialog } from './updates-dialog';

/**
 * Control de actualizaciones de la barra superior.
 *
 * Mantiene el snapshot que llega del preload y abre el diálogo. No comprueba
 * automáticamente: la primera comprobación ocurre solo si el usuario pulsa
 * «Buscar actualizaciones». La suscripción se retira al desmontar. Si el
 * transporte IPC falla, el diálogo muestra un aviso genérico en lugar de
 * quedarse en silencio.
 */
export function UpdatesControl() {
  const updatesApi = window.worldCraft.updates;
  const { version } = window.worldCraft.appInfo;
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<UpdateSnapshot>(() =>
    createIdleUpdateSnapshot(version),
  );
  const [commandError, setCommandError] = useState<string | null>(null);
  const stateRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const requestRevision = stateRevision.current;
    const unsubscribe = updatesApi.onStateChanged((next) => {
      stateRevision.current += 1;
      setSnapshot(next);
    });

    void updatesApi.getState().then((result) => {
      // Si llegó un evento mientras la respuesta estaba en vuelo, el snapshot
      // del evento es más reciente y no debe sobrescribirse con el antiguo.
      if (active && result.ok && stateRevision.current === requestRevision) {
        setSnapshot(result.data);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [updatesApi]);

  const run = useCallback(
    async (
      command: () => Promise<IpcResult<UpdateSnapshot>>,
    ): Promise<void> => {
      setCommandError(null);

      const result = await command();

      if (result.ok) {
        setSnapshot(result.data);
        return;
      }

      setCommandError(messages.updates.errors.transport);
    },
    [],
  );

  const close = useCallback(() => {
    setOpen(false);
    setCommandError(null);
  }, []);

  const hasUpdate =
    snapshot.phase === 'available' || snapshot.phase === 'downloaded';

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...(hasUpdate && snapshot.availableVersion !== null
          ? {
              'aria-label': messages.updates.openWithUpdate(
                snapshot.availableVersion,
              ),
            }
          : {})}
        onClick={() => {
          setOpen(true);
        }}
      >
        {messages.updates.open}
        {hasUpdate ? (
          <span className="wc-updates__badge" aria-hidden="true" />
        ) : null}
      </Button>
      <UpdatesDialog
        open={open}
        snapshot={snapshot}
        commandError={commandError}
        onClose={close}
        onCheck={() => {
          void run(updatesApi.check);
        }}
        onCancel={() => {
          void run(updatesApi.cancel);
        }}
        onDownload={() => {
          void run(updatesApi.download);
        }}
        onInstall={() => {
          void run(updatesApi.install);
        }}
      />
    </>
  );
}
