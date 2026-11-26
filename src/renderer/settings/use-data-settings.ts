/**
 * Estado y comandos de la sección Datos de Ajustes (#79).
 *
 * Cada recurso tiene su propia secuencia monotónica: una respuesta vieja o un
 * cambio posterior a un desmontaje nunca pisa el estado actual. Las mutaciones
 * comparten un bloqueo de UI y no reintentan en bucle; `DATA_BUSY` se anuncia
 * una sola vez.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DataCounts,
  DataDeleteResult,
  DataErrorCode,
  DataFolder,
  DataLibraryResult,
  DataOrphanPurgeResult,
  DataOrphanSummary,
  DataResult,
  DataUsage,
} from '../../shared/contracts/data';
import { DATA_FOLDERS } from '../../shared/contracts/data';
import type { ToastTone } from '../components/toast';
import { useMessages } from '../i18n/provider';
import { dataErrorMessage } from './data-errors';

export type DataUiErrorCode = DataErrorCode | 'TRANSPORT' | 'UNKNOWN';

export type ResourceState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly code: DataUiErrorCode }
  | { readonly status: 'unavailable'; readonly code: 'DATA_UNAVAILABLE' };

export type FolderState =
  | { readonly status: 'idle' }
  | { readonly status: 'opening' }
  | { readonly status: 'error'; readonly code: DataUiErrorCode };

export type OrphansState =
  | { readonly status: 'idle' }
  | { readonly status: 'planning' }
  | { readonly status: 'ready'; readonly summary: DataOrphanSummary }
  | {
      readonly status: 'purging';
      readonly summary: DataOrphanSummary;
    }
  | { readonly status: 'done'; readonly result: DataOrphanPurgeResult }
  | { readonly status: 'error'; readonly code: DataUiErrorCode }
  | { readonly status: 'unavailable'; readonly code: 'DATA_UNAVAILABLE' };

export type ExportState =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  | {
      readonly status: 'done';
      readonly result: Extract<DataLibraryResult, { status: 'completed' }>;
    }
  | { readonly status: 'cancelled' }
  | { readonly status: 'error'; readonly code: DataUiErrorCode };

export type DeleteState =
  | { readonly status: 'closed' }
  | { readonly status: 'confirming' }
  | { readonly status: 'deleting' }
  | { readonly status: 'done'; readonly result: DataDeleteResult }
  | { readonly status: 'error'; readonly code: DataUiErrorCode };

export interface DataSettingsState {
  readonly summary: ResourceState<DataCounts>;
  readonly usage: ResourceState<DataUsage>;
  readonly folders: Readonly<Record<DataFolder, FolderState>>;
  readonly orphans: OrphansState;
  readonly exportState: ExportState;
  readonly deleteState: DeleteState;
  readonly busy: boolean;
}

export interface UseDataSettingsOptions {
  readonly onNotify?: (tone: ToastTone, message: string) => void;
}

export interface UseDataSettingsResult extends DataSettingsState {
  readonly reloadSummary: () => void;
  readonly reloadUsage: () => void;
  readonly openFolder: (folder: DataFolder) => Promise<void>;
  readonly analyzeOrphans: () => Promise<void>;
  readonly purgeOrphans: () => Promise<boolean>;
  readonly exportAll: () => Promise<void>;
  readonly dismissExport: () => void;
  readonly openDeleteDialog: () => void;
  readonly closeDeleteDialog: () => void;
  readonly confirmDelete: (keepBackups: boolean) => Promise<void>;
}

const IDLE_FOLDERS: Readonly<Record<DataFolder, FolderState>> = Object.freeze({
  data: { status: 'idle' },
  assets: { status: 'idle' },
  backups: { status: 'idle' },
  logs: { status: 'idle' },
  imports: { status: 'idle' },
  exports: { status: 'idle' },
});

function createFolders(): Record<DataFolder, FolderState> {
  return { ...IDLE_FOLDERS };
}

function createFolderSequences(): Record<DataFolder, number> {
  return {
    data: 0,
    assets: 0,
    backups: 0,
    logs: 0,
    imports: 0,
    exports: 0,
  };
}

function fromDataResult<T>(
  result: DataResult<T>,
): { status: 'ok'; data: T } | { status: 'error'; code: DataUiErrorCode } {
  if (result.status === 'completed') {
    return { status: 'ok', data: result.data };
  }

  if (result.status === 'failed') {
    return { status: 'error', code: result.code };
  }

  return { status: 'error', code: 'UNKNOWN' };
}

function fromLibraryResult(result: DataLibraryResult):
  | { status: 'ok'; data: Extract<DataLibraryResult, { status: 'completed' }> }
  | {
      status: 'error';
      code: DataUiErrorCode;
    } {
  if (result.status === 'completed') {
    return { status: 'ok', data: result };
  }

  if (result.status === 'failed') {
    return { status: 'error', code: result.code };
  }

  return { status: 'error', code: 'UNKNOWN' };
}

function fromDeleteResult(
  result: DataDeleteResult,
):
  | { status: 'ok'; data: DataDeleteResult }
  | { status: 'error'; code: DataUiErrorCode } {
  if (result.status === 'failed') {
    return { status: 'error', code: result.code };
  }

  return { status: 'ok', data: result };
}

/** Hook de la sección Datos. */
export function useDataSettings(
  options: UseDataSettingsOptions = {},
): UseDataSettingsResult {
  const messages = useMessages();
  const onNotify = options.onNotify;
  const [summary, setSummary] = useState<ResourceState<DataCounts>>({
    status: 'loading',
  });
  const [usage, setUsage] = useState<ResourceState<DataUsage>>({
    status: 'loading',
  });
  const [folders, setFolders] =
    useState<Readonly<Record<DataFolder, FolderState>>>(createFolders);
  const [orphans, setOrphans] = useState<OrphansState>({ status: 'idle' });
  const [exportState, setExportState] = useState<ExportState>({
    status: 'idle',
  });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    status: 'closed',
  });
  const [busy, setBusy] = useState(false);

  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const summarySeq = useRef(0);
  const usageSeq = useRef(0);
  const orphanSeq = useRef(0);
  const exportSeq = useRef(0);
  const deleteSeq = useRef(0);
  const folderSeq = useRef(createFolderSequences());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const errorText = useCallback(
    (code: DataUiErrorCode): string => dataErrorMessage(messages, code),
    [messages],
  );

  const notifyBusy = useCallback(
    (code: DataUiErrorCode): void => {
      if (code === 'DATA_BUSY') {
        onNotify?.('error', errorText(code));
      }
    },
    [errorText, onNotify],
  );

  const fetchSummary = useCallback(async (): Promise<void> => {
    const sequence = (summarySeq.current += 1);

    try {
      const result = await window.worldCraft.data.getSummary();

      if (!mountedRef.current || sequence !== summarySeq.current) {
        return;
      }

      if (!result.ok) {
        setSummary({ status: 'error', code: 'TRANSPORT' });
        return;
      }

      const value = fromDataResult(result.data);

      if (value.status === 'error') {
        setSummary(
          value.code === 'DATA_UNAVAILABLE'
            ? { status: 'unavailable', code: 'DATA_UNAVAILABLE' }
            : { status: 'error', code: value.code },
        );
        return;
      }

      setSummary({ status: 'ready', data: value.data });
    } catch {
      if (mountedRef.current && sequence === summarySeq.current) {
        setSummary({ status: 'error', code: 'UNKNOWN' });
      }
    }
  }, []);

  const fetchUsage = useCallback(async (): Promise<void> => {
    const sequence = (usageSeq.current += 1);

    try {
      const result = await window.worldCraft.data.getUsage();

      if (!mountedRef.current || sequence !== usageSeq.current) {
        return;
      }

      if (!result.ok) {
        setUsage({ status: 'error', code: 'TRANSPORT' });
        return;
      }

      const value = fromDataResult(result.data);

      if (value.status === 'error') {
        setUsage(
          value.code === 'DATA_UNAVAILABLE'
            ? { status: 'unavailable', code: 'DATA_UNAVAILABLE' }
            : { status: 'error', code: value.code },
        );
        return;
      }

      setUsage({ status: 'ready', data: value.data });
    } catch {
      if (mountedRef.current && sequence === usageSeq.current) {
        setUsage({ status: 'error', code: 'UNKNOWN' });
      }
    }
  }, []);

  const loadSummary = useCallback((): void => {
    setSummary({ status: 'loading' });
    void fetchSummary();
  }, [fetchSummary]);

  const loadUsage = useCallback((): void => {
    setUsage({ status: 'loading' });
    void fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    // El primer fetch se difiere un tick para no encadenar renders dentro del
    // efecto de montaje; las secuencias descartan respuestas de un desmontaje.
    const timer = window.setTimeout(() => {
      void fetchSummary();
      void fetchUsage();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchSummary, fetchUsage]);

  const openFolder = useCallback(async (folder: DataFolder): Promise<void> => {
    const sequence = (folderSeq.current[folder] += 1);
    setFolders((current) => ({
      ...current,
      [folder]: { status: 'opening' },
    }));

    try {
      const result = await window.worldCraft.data.openFolder(folder);

      if (!mountedRef.current || sequence !== folderSeq.current[folder]) {
        return;
      }

      if (!result.ok) {
        setFolders((current) => ({
          ...current,
          [folder]: { status: 'error', code: 'TRANSPORT' },
        }));
        return;
      }

      const value = fromDataResult(result.data);

      setFolders((current) => ({
        ...current,
        [folder]:
          value.status === 'ok'
            ? { status: 'idle' }
            : { status: 'error', code: value.code },
      }));
    } catch {
      if (mountedRef.current && sequence === folderSeq.current[folder]) {
        setFolders((current) => ({
          ...current,
          [folder]: { status: 'error', code: 'UNKNOWN' },
        }));
      }
    }
  }, []);

  const analyzeOrphans = useCallback(async (): Promise<void> => {
    const sequence = (orphanSeq.current += 1);
    setOrphans({ status: 'planning' });

    try {
      const result = await window.worldCraft.data.planOrphans();

      if (!mountedRef.current || sequence !== orphanSeq.current) {
        return;
      }

      if (!result.ok) {
        setOrphans({ status: 'error', code: 'TRANSPORT' });
        return;
      }

      const value = fromDataResult(result.data);

      if (value.status === 'error') {
        setOrphans(
          value.code === 'DATA_UNAVAILABLE'
            ? { status: 'unavailable', code: 'DATA_UNAVAILABLE' }
            : { status: 'error', code: value.code },
        );
        return;
      }

      setOrphans({ status: 'ready', summary: value.data });
    } catch {
      if (mountedRef.current && sequence === orphanSeq.current) {
        setOrphans({ status: 'error', code: 'UNKNOWN' });
      }
    }
  }, []);

  const beginMutation = useCallback((): boolean => {
    if (busyRef.current) {
      return false;
    }

    busyRef.current = true;
    setBusy(true);
    return true;
  }, []);

  const endMutation = useCallback((): void => {
    busyRef.current = false;

    if (mountedRef.current) {
      setBusy(false);
    }
  }, []);

  const purgeOrphans = useCallback(async (): Promise<boolean> => {
    if (orphans.status !== 'ready' || !beginMutation()) {
      return false;
    }

    const currentSummary = orphans.summary;
    const sequence = (orphanSeq.current += 1);

    setOrphans({ status: 'purging', summary: currentSummary });

    try {
      const result = await window.worldCraft.data.purgeOrphans();

      if (!mountedRef.current || sequence !== orphanSeq.current) {
        return false;
      }

      if (!result.ok) {
        setOrphans({ status: 'error', code: 'TRANSPORT' });
        return false;
      }

      const value = fromDataResult(result.data);

      if (value.status === 'error') {
        notifyBusy(value.code);
        setOrphans(
          value.code === 'DATA_UNAVAILABLE'
            ? { status: 'unavailable', code: 'DATA_UNAVAILABLE' }
            : { status: 'error', code: value.code },
        );
        return false;
      }

      setOrphans({ status: 'done', result: value.data });
      void loadSummary();
      void loadUsage();
      return true;
    } catch {
      if (mountedRef.current && sequence === orphanSeq.current) {
        setOrphans({ status: 'error', code: 'UNKNOWN' });
      }
      return false;
    } finally {
      endMutation();
    }
  }, [beginMutation, endMutation, loadSummary, loadUsage, notifyBusy, orphans]);

  const exportAll = useCallback(async (): Promise<void> => {
    if (!beginMutation()) {
      return;
    }

    const sequence = (exportSeq.current += 1);
    setExportState({ status: 'running' });

    try {
      const result = await window.worldCraft.data.exportAll();

      if (!mountedRef.current || sequence !== exportSeq.current) {
        return;
      }

      if (!result.ok) {
        setExportState({ status: 'error', code: 'TRANSPORT' });
        return;
      }

      if (result.data.status === 'cancelled') {
        setExportState({ status: 'cancelled' });
        return;
      }

      const value = fromLibraryResult(result.data);

      if (value.status === 'error') {
        notifyBusy(value.code);
        setExportState({ status: 'error', code: value.code });
        return;
      }

      setExportState({ status: 'done', result: value.data });
    } catch {
      if (mountedRef.current && sequence === exportSeq.current) {
        setExportState({ status: 'error', code: 'UNKNOWN' });
      }
    } finally {
      endMutation();
    }
  }, [beginMutation, endMutation, notifyBusy]);

  const dismissExport = useCallback((): void => {
    setExportState((current) =>
      current.status === 'error' ? { status: 'idle' } : current,
    );
  }, []);

  const openDeleteDialog = useCallback((): void => {
    if (busyRef.current) {
      return;
    }

    setDeleteState({ status: 'confirming' });
  }, []);

  const closeDeleteDialog = useCallback((): void => {
    setDeleteState((current) => {
      if (current.status === 'confirming' || current.status === 'error') {
        return { status: 'closed' };
      }

      if (
        current.status === 'done' &&
        current.result.status === 'partial' &&
        !current.result.restartRequired
      ) {
        return { status: 'closed' };
      }

      return current;
    });
  }, []);

  const confirmDelete = useCallback(
    async (keepBackups: boolean): Promise<void> => {
      if (
        (deleteState.status !== 'confirming' &&
          deleteState.status !== 'error') ||
        !beginMutation()
      ) {
        return;
      }

      const sequence = (deleteSeq.current += 1);
      setDeleteState({ status: 'deleting' });

      try {
        const result = await window.worldCraft.data.deleteAll({ keepBackups });

        if (!mountedRef.current || sequence !== deleteSeq.current) {
          return;
        }

        if (!result.ok) {
          setDeleteState({ status: 'error', code: 'TRANSPORT' });
          return;
        }

        const value = fromDeleteResult(result.data);

        if (value.status === 'error') {
          notifyBusy(value.code);
          setDeleteState({ status: 'error', code: value.code });
          return;
        }

        setDeleteState({ status: 'done', result: value.data });
      } catch {
        if (mountedRef.current && sequence === deleteSeq.current) {
          setDeleteState({ status: 'error', code: 'UNKNOWN' });
        }
      } finally {
        endMutation();
      }
    },
    [beginMutation, deleteState.status, endMutation, notifyBusy],
  );

  return {
    summary,
    usage,
    folders,
    orphans,
    exportState,
    deleteState,
    busy,
    reloadSummary: () => {
      void loadSummary();
    },
    reloadUsage: () => {
      void loadUsage();
    },
    openFolder,
    analyzeOrphans,
    purgeOrphans,
    exportAll,
    dismissExport,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  };
}

/** Lista estable usada por las vistas de carpetas. */
export const DATA_SETTINGS_FOLDERS = DATA_FOLDERS;
