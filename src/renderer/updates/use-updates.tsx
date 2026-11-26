/**
 * Estado compartido de actualizaciones.
 *
 * El proveedor abre una sola suscripción al servicio y monta un único
 * `UpdatesDialog`; la barra superior y la página de Ajustes consumen el mismo
 * contexto para abrirlo, sin duplicar eventos ni órdenes (C7 de #79).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  createIdleUpdateSnapshot,
  type UpdateSnapshot,
} from '../../shared/contracts/updates';
import type { IpcResult } from '../../shared/contracts/result';
import { UpdatesDialog } from '../components/updates-dialog';
import { useMessages } from '../i18n/provider';

/** Estado y comandos que comparten todos los consumidores. */
export interface UpdatesContextValue {
  readonly snapshot: UpdateSnapshot;
  readonly commandError: string | null;
  readonly open: boolean;
  readonly openDialog: () => void;
  readonly closeDialog: () => void;
  readonly check: () => void;
  readonly cancel: () => void;
  readonly download: () => void;
  readonly install: () => void;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

export interface UpdatesProviderProps {
  readonly children: ReactNode;
}

/** Proveedor único de actualizaciones del renderer. */
export function UpdatesProvider({ children }: UpdatesProviderProps) {
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

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setCommandError(null);
  }, []);

  const check = useCallback(() => {
    void run(updatesApi.check);
  }, [run, updatesApi]);

  const cancel = useCallback(() => {
    void run(updatesApi.cancel);
  }, [run, updatesApi]);

  const download = useCallback(() => {
    void run(updatesApi.download);
  }, [run, updatesApi]);

  const install = useCallback(() => {
    void run(updatesApi.install);
  }, [run, updatesApi]);

  const value = useMemo<UpdatesContextValue>(
    () => ({
      snapshot,
      commandError,
      open,
      openDialog,
      closeDialog,
      check,
      cancel,
      download,
      install,
    }),
    [
      cancel,
      check,
      closeDialog,
      commandError,
      download,
      install,
      open,
      openDialog,
      snapshot,
    ],
  );

  return (
    <UpdatesContext.Provider value={value}>
      {children}
      <UpdatesDialog
        open={open}
        snapshot={snapshot}
        commandError={commandError}
        onClose={closeDialog}
        onCheck={check}
        onCancel={cancel}
        onDownload={download}
        onInstall={install}
      />
    </UpdatesContext.Provider>
  );
}

/** Acceso al estado compartido; falla fuera del proveedor. */
export function useUpdates(): UpdatesContextValue {
  const value = useContext(UpdatesContext);

  if (value === null) {
    throw new Error('useUpdates debe usarse dentro de UpdatesProvider.');
  }

  return value;
}
