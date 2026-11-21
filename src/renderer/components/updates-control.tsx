import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createIdleUpdateSnapshot,
  type UpdateSnapshot,
} from '../../shared/contracts/updates';
import type { IpcResult } from '../../shared/contracts/result';
import { useMessages } from '../i18n/provider';
import { IconButton } from './icon-button';
import { UpdatesDialog } from './updates-dialog';

function UpdatesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4v10" />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
      <path d="M5 18.5h14" />
    </svg>
  );
}

/**
 * Control de actualizaciones de la barra superior.
 *
 * En v2 es un icono discreto: el nombre accesible y el tooltip cambian cuando
 * hay una versión disponible y un punto de acento lo señala visualmente. La
 * versión instalada se consulta en el propio diálogo. No comprueba
 * automáticamente: la primera comprobación ocurre solo si el usuario la pide.
 * La suscripción se retira al desmontar. Si el transporte IPC falla, el diálogo
 * muestra un aviso genérico en lugar de quedarse en silencio.
 */
export function UpdatesControl() {
  const messages = useMessages();
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
    [messages],
  );

  const close = useCallback(() => {
    setOpen(false);
    setCommandError(null);
  }, []);

  const hasUpdate =
    snapshot.phase === 'available' || snapshot.phase === 'downloaded';
  const announcement =
    hasUpdate && snapshot.availableVersion !== null
      ? messages.updates.openWithUpdate(snapshot.availableVersion)
      : null;
  const label = announcement ?? messages.updates.open;

  return (
    <>
      <IconButton
        label={label}
        tooltip={label}
        icon={
          <span className="wc-updates__icon">
            <UpdatesIcon />
            {hasUpdate ? (
              <span className="wc-updates__dot" aria-hidden="true" />
            ) : null}
          </span>
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      />
      <span className="wc-visually-hidden" aria-live="polite">
        {announcement ?? ''}
      </span>
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
