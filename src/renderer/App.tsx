import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type {
  WorldActivityEntry,
  WorldCreateInput,
  WorldDetail,
  WorldSummary,
  WorldUpdateInput,
} from '../shared/contracts/worlds';
import { ToastRegion, type Toast, type ToastTone } from './components';
import { WorldConfirmDialog } from './components/worlds/world-confirm-dialog';
import { WorldDuplicateDialog } from './components/worlds/world-duplicate-dialog';
import { WorldFormDialog } from './components/worlds/world-form-dialog';
import type { WorldActivityState } from './components/worlds/world-activity-list';
import type { WorldCardActions } from './components/worlds/world-card';
import { useMessages } from './i18n/provider';
import { HomePage, type WorldLibraryState } from './pages/home-page';
import { SamplesPage } from './pages/samples-page';
import { WorldPage } from './pages/world-page';
import { WorldsPage } from './pages/worlds-page';
import { AppShell, type AppNavView, type AppView } from './shell/app-shell';
import { applyTheme, DEFAULT_THEME, type ThemeMode } from './theme';

type DialogState =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly world: WorldDetail }
  | { readonly kind: 'duplicate'; readonly world: WorldSummary }
  | { readonly kind: 'archive'; readonly world: WorldSummary }
  | { readonly kind: 'restore'; readonly world: WorldSummary }
  | { readonly kind: 'delete'; readonly world: WorldSummary }
  | null;

/**
 * Raíz del renderer.
 *
 * Mantiene la vista, el tema, la biblioteca de mundos y los diálogos. La API de
 * mundos vive en el preload y devuelve `IpcResult`; aquí se traduce a estado de
 * interfaz, avisos y recargas. Todas las consultas de actividad llegan ya
 * filtradas por mundo desde el proceso principal.
 */
export function App() {
  const messages = useMessages();
  const { appInfo, worlds: api } = window.worldCraft;
  const [view, setView] = useState<AppView>('home');
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextToastId = useRef(0);

  const [worlds, setWorlds] = useState<readonly WorldSummary[]>([]);
  const [activity, setActivity] = useState<readonly WorldActivityEntry[]>([]);
  const [libraryState, setLibraryState] =
    useState<WorldLibraryState>('loading');

  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<WorldDetail | null>(null);
  const [selectedState, setSelectedState] =
    useState<WorldLibraryState>('ready');
  const [selectedActivity, setSelectedActivity] = useState<
    readonly WorldActivityEntry[]
  >([]);
  const [selectedActivityState, setSelectedActivityState] =
    useState<WorldActivityState>('ready');

  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, setPending] = useState(false);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const openRequest = useRef(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const firstRender = useRef(true);

  useEffect(() => {
    // No se roba el foco al arrancar: el primer Tab debe mostrar el enlace de
    // salto. Solo se enfoca el contenido cuando el usuario cambia de vista.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const main = document.getElementById('wc-main');
    main?.focus();
  }, [view]);

  const notify = useCallback((tone: ToastTone, message: string) => {
    nextToastId.current += 1;
    setToasts((current) => [
      ...current,
      { id: `wc-toast-${nextToastId.current}`, tone, message },
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const refreshLibrary = useCallback(async () => {
    const [worldList, activityList] = await Promise.all([
      api.list(),
      api.listActivity({ limit: 12 }),
    ]);

    if (!worldList.ok || !activityList.ok) {
      setLibraryState('error');
      return;
    }

    setWorlds(worldList.data);
    setActivity(activityList.data);
    setLibraryState('ready');
  }, [api]);

  useEffect(() => {
    let active = true;

    void Promise.all([api.list(), api.listActivity({ limit: 12 })]).then(
      ([worldList, activityList]) => {
        if (!active) {
          return;
        }

        if (!worldList.ok || !activityList.ok) {
          setLibraryState('error');
          return;
        }

        setWorlds(worldList.data);
        setActivity(activityList.data);
        setLibraryState('ready');
      },
    );

    return () => {
      active = false;
    };
  }, [api]);

  const retryLibrary = useCallback(() => {
    setLibraryState('loading');
    void refreshLibrary();
  }, [refreshLibrary]);

  const openWorld = useCallback(
    async (id: string) => {
      openRequest.current += 1;
      const request = openRequest.current;
      setSelectedWorldId(id);
      setSelectedWorld(null);
      setSelectedState('loading');
      setSelectedActivity([]);
      setSelectedActivityState('loading');
      setView('world');

      const [detail, activityList] = await Promise.all([
        api.get(id),
        api.listActivity({ worldId: id, limit: 12 }),
      ]);

      // Un clic posterior en otro mundo descarta esta respuesta obsoleta.
      if (request !== openRequest.current) {
        return;
      }

      if (detail.ok && detail.data !== null) {
        setSelectedWorld(detail.data);
        setSelectedState('ready');
      } else {
        setSelectedState('error');
      }

      if (activityList.ok) {
        setSelectedActivity(activityList.data);
        setSelectedActivityState('ready');
      } else {
        setSelectedActivityState('error');
      }
    },
    [api],
  );

  const refreshSelected = useCallback(async () => {
    if (selectedWorldId === null) {
      return;
    }

    const request = openRequest.current;
    const [detail, activityList] = await Promise.all([
      api.get(selectedWorldId),
      api.listActivity({ worldId: selectedWorldId, limit: 12 }),
    ]);

    if (request !== openRequest.current) {
      return;
    }

    if (detail.ok && detail.data !== null) {
      setSelectedWorld(detail.data);
      setSelectedState('ready');
    } else {
      setSelectedState('error');
    }

    if (activityList.ok) {
      setSelectedActivity(activityList.data);
      setSelectedActivityState('ready');
    } else {
      setSelectedActivityState('error');
    }
  }, [api, selectedWorldId]);

  const refreshSelectedActivity = useCallback(async () => {
    if (selectedWorldId === null) {
      return;
    }

    setSelectedActivityState('loading');
    const request = openRequest.current;
    const result = await api.listActivity({
      worldId: selectedWorldId,
      limit: 12,
    });

    if (request !== openRequest.current) {
      return;
    }

    if (result.ok) {
      setSelectedActivity(result.data);
      setSelectedActivityState('ready');
    } else {
      setSelectedActivityState('error');
    }
  }, [api, selectedWorldId]);

  const openDialog = useCallback((next: Exclude<DialogState, null>) => {
    const active = document.activeElement;
    dialogTrigger.current = active instanceof HTMLElement ? active : null;
    setDialog(next);
  }, []);

  const openEdit = useCallback(
    async (world: WorldSummary) => {
      const result = await api.get(world.id);

      if (result.ok && result.data !== null) {
        openDialog({ kind: 'edit', world: result.data });
        return;
      }

      notify('error', messages.worlds.notices.notFound);
    },
    [api, messages, notify, openDialog],
  );

  const restoreDialogFocus = useCallback(
    (mode: 'trigger' | 'main' = 'trigger') => {
      const trigger = dialogTrigger.current;
      dialogTrigger.current = null;

      if (
        mode === 'trigger' &&
        trigger !== null &&
        document.contains(trigger)
      ) {
        trigger.focus();
        return;
      }

      document.getElementById('wc-main')?.focus();
    },
    [],
  );

  /**
   * Desmonta el diálogo de forma síncrona y devuelve el foco.
   *
   * El `<dialog>` modal hace inerte el fondo mientras existe; si se enfoca el
   * disparador antes de que React lo desmonte, `focus()` no hace nada. Por eso
   * se fuerza el commit y solo después se mueve el foco.
   */
  const closeDialogNow = useCallback(
    (mode: 'trigger' | 'main' = 'trigger') => {
      flushSync(() => {
        setDialog(null);
      });
      restoreDialogFocus(mode);
    },
    [restoreDialogFocus],
  );

  const handleCloseDialog = useCallback(() => {
    if (!pending) {
      closeDialogNow();
    }
  }, [pending, closeDialogNow]);

  const closeDialogAfterSuccess = useCallback(
    (mode: 'trigger' | 'main' = 'trigger') => {
      closeDialogNow(mode);
    },
    [closeDialogNow],
  );

  const submitCreate = useCallback(
    async (input: WorldCreateInput | WorldUpdateInput): Promise<boolean> => {
      if (pending || 'id' in input) {
        return false;
      }

      setPending(true);
      const result = await api.create(input);
      setPending(false);

      if (!result.ok) {
        notify(
          'error',
          result.error.code === 'INVALID_INPUT'
            ? messages.worlds.notices.invalid
            : messages.worlds.notices.failed,
        );
        return false;
      }

      closeDialogAfterSuccess('main');
      notify('success', messages.worlds.notices.created(result.data.name));
      await refreshLibrary();
      await openWorld(result.data.id);
      return true;
    },
    [
      api,
      messages,
      notify,
      openWorld,
      pending,
      refreshLibrary,
      closeDialogAfterSuccess,
    ],
  );

  const submitEdit = useCallback(
    async (input: WorldCreateInput | WorldUpdateInput): Promise<boolean> => {
      if (pending || !('id' in input)) {
        return false;
      }

      setPending(true);
      const result = await api.update(input);
      setPending(false);

      if (!result.ok) {
        notify(
          'error',
          result.error.code === 'INVALID_INPUT'
            ? messages.worlds.notices.invalid
            : messages.worlds.notices.failed,
        );
        return false;
      }

      if (result.data === null) {
        notify('error', messages.worlds.notices.notFound);
        return false;
      }

      closeDialogAfterSuccess();
      notify('success', messages.worlds.notices.updated(result.data.name));
      await refreshLibrary();
      await refreshSelected();
      return true;
    },
    [
      api,
      messages,
      notify,
      pending,
      refreshLibrary,
      refreshSelected,
      closeDialogAfterSuccess,
    ],
  );

  const submitDuplicate = useCallback(
    async (name: string): Promise<boolean> => {
      if (pending || dialog?.kind !== 'duplicate') {
        return false;
      }

      setPending(true);
      const result = await api.duplicate({ id: dialog.world.id, name });
      setPending(false);

      if (!result.ok) {
        notify(
          'error',
          result.error.code === 'INVALID_INPUT'
            ? messages.worlds.notices.invalid
            : messages.worlds.notices.failed,
        );
        return false;
      }

      if (result.data === null) {
        notify('error', messages.worlds.notices.notFound);
        return false;
      }

      closeDialogAfterSuccess();
      notify('success', messages.worlds.notices.duplicated(result.data.name));
      await refreshLibrary();
      return true;
    },
    [
      api,
      dialog,
      messages,
      notify,
      pending,
      refreshLibrary,
      closeDialogAfterSuccess,
    ],
  );

  const confirmArchive = useCallback(
    async (archived: boolean) => {
      if (
        pending ||
        (dialog?.kind !== 'archive' && dialog?.kind !== 'restore')
      ) {
        return;
      }

      const world = dialog.world;
      setPending(true);
      const result = await api.setArchived({ id: world.id, archived });
      setPending(false);

      if (!result.ok) {
        notify(
          'error',
          result.error.code === 'INVALID_INPUT'
            ? messages.worlds.notices.notFound
            : messages.worlds.notices.failed,
        );
        return;
      }

      if (result.data === null) {
        notify('error', messages.worlds.notices.notFound);
        return;
      }

      closeDialogAfterSuccess('main');
      notify(
        'success',
        archived
          ? messages.worlds.notices.archived(world.name)
          : messages.worlds.notices.restored(world.name),
      );
      await refreshLibrary();
      await refreshSelected();
    },
    [
      api,
      dialog,
      messages,
      notify,
      pending,
      refreshLibrary,
      refreshSelected,
      closeDialogAfterSuccess,
    ],
  );

  const confirmDelete = useCallback(async () => {
    if (pending || dialog?.kind !== 'delete') {
      return;
    }

    const world = dialog.world;
    setPending(true);
    const result = await api.remove(world.id);
    setPending(false);

    if (!result.ok || !result.data.deleted) {
      notify('error', messages.worlds.notices.notFound);
      return;
    }

    closeDialogAfterSuccess('main');
    notify('success', messages.worlds.notices.deleted(world.name));
    await refreshLibrary();
    document.getElementById('wc-main')?.focus();

    if (selectedWorldId === world.id) {
      setSelectedWorld(null);
      setSelectedWorldId(null);
      setSelectedState('ready');
      setSelectedActivity([]);
      setSelectedActivityState('ready');
      setView('home');
    }
  }, [
    api,
    dialog,
    messages,
    notify,
    pending,
    refreshLibrary,
    selectedWorldId,
    closeDialogAfterSuccess,
  ]);

  const cardActions: WorldCardActions = {
    onOpen: (world) => {
      void openWorld(world.id);
    },
    onEdit: (world) => {
      void openEdit(world);
    },
    onDuplicate: (world) => {
      openDialog({ kind: 'duplicate', world });
    },
    onArchiveToggle: (world) => {
      openDialog({
        kind: world.status === 'archived' ? 'restore' : 'archive',
        world,
      });
    },
    onDelete: (world) => {
      openDialog({ kind: 'delete', world });
    },
  };

  const navigate = (next: AppNavView): void => {
    setView(next);
  };

  const title =
    view === 'world' && selectedWorld !== null
      ? selectedWorld.name
      : messages.shell.views[view];

  const confirmKind =
    dialog?.kind === 'archive' ||
    dialog?.kind === 'restore' ||
    dialog?.kind === 'delete'
      ? dialog.kind
      : null;
  const confirmWorld =
    dialog?.kind === 'archive' ||
    dialog?.kind === 'restore' ||
    dialog?.kind === 'delete'
      ? dialog.world
      : null;

  return (
    <>
      <AppShell
        view={view}
        title={title}
        onViewChange={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        version={appInfo.version}
      >
        {view === 'home' ? (
          <HomePage
            worlds={worlds}
            activity={activity}
            state={libraryState}
            actions={cardActions}
            onCreate={() => {
              openDialog({ kind: 'create' });
            }}
            onSeeAll={() => {
              setView('worlds');
            }}
            onRetry={retryLibrary}
          />
        ) : view === 'worlds' ? (
          <WorldsPage
            worlds={worlds}
            state={libraryState}
            actions={cardActions}
            onCreate={() => {
              openDialog({ kind: 'create' });
            }}
            onRetry={retryLibrary}
          />
        ) : view === 'world' ? (
          <WorldPage
            world={selectedWorld}
            state={selectedState}
            activity={selectedActivity}
            activityState={selectedActivityState}
            actions={cardActions}
            onBack={() => {
              setView('home');
            }}
            onRetry={() => {
              if (selectedWorldId !== null) {
                void openWorld(selectedWorldId);
              }
            }}
            onRetryActivity={() => {
              void refreshSelectedActivity();
            }}
          />
        ) : (
          <SamplesPage onNotify={notify} />
        )}
      </AppShell>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <WorldFormDialog
          open
          mode={dialog.kind === 'edit' ? 'edit' : 'create'}
          world={dialog.kind === 'edit' ? dialog.world : null}
          pending={pending}
          onClose={handleCloseDialog}
          onSubmit={dialog.kind === 'edit' ? submitEdit : submitCreate}
        />
      ) : null}

      {dialog?.kind === 'duplicate' ? (
        <WorldDuplicateDialog
          open
          world={dialog.world}
          pending={pending}
          onClose={handleCloseDialog}
          onSubmit={submitDuplicate}
        />
      ) : null}

      {confirmKind !== null ? (
        <WorldConfirmDialog
          open
          title={
            confirmKind === 'archive' && confirmWorld !== null
              ? messages.worlds.confirm.archiveTitle(confirmWorld.name)
              : confirmKind === 'restore' && confirmWorld !== null
                ? messages.worlds.confirm.restoreTitle(confirmWorld.name)
                : confirmKind === 'delete' && confirmWorld !== null
                  ? messages.worlds.confirm.deleteTitle(confirmWorld.name)
                  : ''
          }
          body={
            confirmKind === 'archive'
              ? messages.worlds.confirm.archiveBody
              : confirmKind === 'restore'
                ? messages.worlds.confirm.restoreBody
                : confirmKind === 'delete'
                  ? messages.worlds.confirm.deleteBody
                  : ''
          }
          confirmLabel={
            confirmKind === 'archive'
              ? messages.worlds.confirm.archiveSubmit
              : confirmKind === 'restore'
                ? messages.worlds.confirm.restoreSubmit
                : confirmKind === 'delete'
                  ? messages.worlds.confirm.deleteSubmit
                  : ''
          }
          tone={confirmKind === 'delete' ? 'danger' : 'primary'}
          pending={pending}
          onClose={handleCloseDialog}
          onConfirm={() => {
            if (confirmKind === 'archive') {
              void confirmArchive(true);
            } else if (confirmKind === 'restore') {
              void confirmArchive(false);
            } else if (confirmKind === 'delete') {
              void confirmDelete();
            }
          }}
        />
      ) : null}

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
