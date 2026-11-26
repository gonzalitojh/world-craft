import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type {
  WorldActivityEntry,
  WorldCreateInput,
  WorldDetail,
  WorldSummary,
  WorldUpdateInput,
} from '../shared/contracts/worlds';
import type { EntityTypeSummary } from '../shared/contracts/entity-types';
import type { UiPreferences } from '../shared/contracts/preferences';
import type { SearchHit } from '../shared/contracts/search';
import { ToastRegion, type Toast, type ToastTone } from './components';
import { CommandPalette } from './components/command-palette';
import { EntityQuickCreateDialog } from './components/entities/entity-quick-create-dialog';
import type { MenuItem } from './components/menu';
import { WorldConfirmDialog } from './components/worlds/world-confirm-dialog';
import { WorldDuplicateDialog } from './components/worlds/world-duplicate-dialog';
import { WorldFormDialog } from './components/worlds/world-form-dialog';
import { WorldTransferDialog } from './components/transfer/world-transfer-dialog';
import type { WorldActivityState } from './components/worlds/world-activity-list';
import type { WorldCardActions } from './components/worlds/world-card';
import { useMessages } from './i18n/provider';
import {
  resolveContinueTarget,
  type ContinueTarget,
} from './lib/recent-location';
import { EntitiesPage } from './pages/entities-page';
import { EntityDetailPage } from './pages/entity-detail-page';
import { HomePage, type WorldLibraryState } from './pages/home-page';
import { SamplesPage } from './pages/samples-page';
import { SearchPage } from './pages/search-page';
import { SettingsPage } from './pages/settings-page';
import { TrashPage } from './pages/trash-page';
import { WorldPage } from './pages/world-page';
import { WorldsPage } from './pages/worlds-page';
import {
  AppShell,
  type AppNavView,
  type AppView,
  type ShellPrimaryAction,
} from './shell/app-shell';
import { useUiPreferences } from './preferences/use-ui-preferences';
import { SETTINGS_HASH, resolveAppView } from './shell/routes';
import { useWorldTransfer } from './transfer/use-world-transfer';

type DialogState =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly world: WorldDetail }
  | { readonly kind: 'duplicate'; readonly world: WorldSummary }
  | { readonly kind: 'archive'; readonly world: WorldSummary }
  | { readonly kind: 'restore'; readonly world: WorldSummary }
  | { readonly kind: 'delete'; readonly world: WorldSummary }
  | null;

export interface AppProps {
  /** Snapshot leído antes del primer render (Claro si falló el bootstrap). */
  readonly initialPreferences: UiPreferences;
}

/**
 * Raíz del renderer.
 *
 * Mantiene la vista, la biblioteca de mundos y los diálogos. El tema, el rail,
 * la vista de ficha y el destino «Continuar» viven en el hook de preferencias
 * persistidas. La API de mundos vive en el preload y devuelve `IpcResult`; aquí
 * se traduce a estado de interfaz, avisos y recargas. Todas las consultas de
 * actividad llegan ya filtradas por mundo desde el proceso principal.
 */
export function App({ initialPreferences }: AppProps) {
  const messages = useMessages();
  const { worlds: api, entities: entitiesApi } = window.worldCraft;
  const {
    preferences,
    update: updatePreferences,
    toggleTheme,
    reset: resetPreferences,
  } = useUiPreferences(initialPreferences);
  const [view, setView] = useState<AppView>(
    () => resolveAppView(window.location.hash) ?? 'home',
  );
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextToastId = useRef(0);

  const [worlds, setWorlds] = useState<readonly WorldSummary[]>([]);
  const [activity, setActivity] = useState<readonly WorldActivityEntry[]>([]);
  const [libraryState, setLibraryState] =
    useState<WorldLibraryState>('loading');

  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const selectedWorldIdRef = useRef<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<WorldDetail | null>(null);
  const [selectedState, setSelectedState] =
    useState<WorldLibraryState>('ready');
  const [selectedActivity, setSelectedActivity] = useState<
    readonly WorldActivityEntry[]
  >([]);
  const [selectedActivityState, setSelectedActivityState] =
    useState<WorldActivityState>('ready');

  const [entityId, setEntityId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteKey, setPaletteKey] = useState(0);
  const [searchSeed, setSearchSeed] = useState('');
  const [searchKey, setSearchKey] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickKey, setQuickKey] = useState(0);
  const [quickWorldId, setQuickWorldId] = useState<string | null>(null);
  const [quickTypes, setQuickTypes] = useState<readonly EntityTypeSummary[]>(
    [],
  );
  const [quickTypesLoading, setQuickTypesLoading] = useState(false);
  const [quickPending, setQuickPending] = useState(false);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, setPending] = useState(false);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const openRequest = useRef(0);

  const firstRender = useRef(true);

  useEffect(() => {
    // No se roba el foco al arrancar: el primer Tab debe mostrar el enlace de
    // salto. Solo se enfoca el contenido cuando el usuario cambia de vista.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const main = document.getElementById('wc-main');

    if (view === 'search') {
      main?.querySelector<HTMLElement>('input[type="search"]')?.focus();
      return;
    }

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

  /**
   * Cambia de vista y ajusta el hash de la URL.
   *
   * Ajustes usa `history.replaceState` con `#/settings` para poder recargar o
   * restaurar la ventana en esa página; el resto de vistas retira el hash
   * interno de Muestras al salir. `samples` nunca se persiste. `lastView` no
   * se usa para navegar: solo alimenta la memoria de la interfaz.
   */
  const goToView = useCallback(
    (next: AppView) => {
      setView(next);

      if (next !== 'samples') {
        updatePreferences({ lastView: next });
      }

      const base = `${window.location.pathname}${window.location.search}`;

      if (next === 'settings') {
        window.history.replaceState(
          window.history.state,
          '',
          `${base}${SETTINGS_HASH}`,
        );
        return;
      }

      if (next !== 'samples' && window.location.hash.length > 0) {
        window.history.replaceState(window.history.state, '', base);
      }
    },
    [updatePreferences],
  );

  useEffect(() => {
    const handleHashChange = (): void => {
      const routed = resolveAppView(window.location.hash);

      if (routed !== null) {
        setView(routed);

        // Ajustes es una vista persistible; Muestras sigue siendo interno.
        if (routed !== 'samples') {
          updatePreferences({ lastView: routed });
        }
        return;
      }

      // Cualquier hash desconocido vuelve a Inicio; nunca a Muestras.
      goToView('home');
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [goToView, updatePreferences]);

  const openPalette = useCallback(() => {
    // La clave remonta la paleta para que cada apertura empiece con la
    // consulta y la selección limpias, sin estado que se arrastre.
    setPaletteKey((current) => current + 1);
    setPaletteOpen(true);
  }, []);

  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      );
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k';

      if (!isShortcut || paletteOpen) {
        return;
      }

      // No se secuestra el atajo mientras el usuario escribe ni dentro de un
      // diálogo modal: ahí Ctrl+K puede pertenecer al editor o al formulario.
      if (isEditable(event.target) || document.querySelector('dialog[open]')) {
        return;
      }

      event.preventDefault();
      openPalette();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [paletteOpen, openPalette]);

  const refreshLibrary = useCallback(async (): Promise<
    readonly WorldSummary[] | null
  > => {
    const [worldList, activityList] = await Promise.all([
      api.list(),
      api.listActivity({ limit: 12 }),
    ]);

    if (!worldList.ok || !activityList.ok) {
      setLibraryState('error');
      return null;
    }

    setWorlds(worldList.data);
    setActivity(activityList.data);
    setLibraryState('ready');
    return worldList.data;
  }, [api]);

  const transfer = useWorldTransfer({
    onNotify: notify,
    onImported: () => {
      void refreshLibrary();
    },
  });

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

  /**
   * Revalida la biblioteca y el destino recordado tras una purga o restauración.
   *
   * Nunca navega ni rompe la vista activa: si el mundo seleccionado desaparece,
   * se limpia; si la ficha recordada ya no existe, el destino baja al mundo.
   */
  const handleLibraryChanged = useCallback(async () => {
    const list = await refreshLibrary();

    if (list === null) {
      return;
    }

    const location = preferences.recentLocation;

    if (
      location !== null &&
      !list.some((world) => world.id === location.worldId)
    ) {
      updatePreferences({ recentLocation: null });
    } else if (location?.kind === 'entity') {
      const detail = await entitiesApi.get({
        worldId: location.worldId,
        id: location.entityId,
      });

      if (detail.ok && detail.data === null) {
        updatePreferences({
          recentLocation: { kind: 'world', worldId: location.worldId },
        });
      }
    }

    if (
      selectedWorldId !== null &&
      !list.some((world) => world.id === selectedWorldId)
    ) {
      selectedWorldIdRef.current = null;
      setSelectedWorldId(null);
      setSelectedWorld(null);
      setSelectedState('ready');
      setSelectedActivity([]);
      setSelectedActivityState('ready');
      setEntityId(null);
    }
  }, [
    entitiesApi,
    preferences.recentLocation,
    refreshLibrary,
    selectedWorldId,
    updatePreferences,
  ]);

  useEffect(() => {
    if (!quickOpen) {
      return;
    }

    const targetWorldId =
      quickWorldId ?? selectedWorldId ?? worlds[0]?.id ?? null;

    if (targetWorldId === null) {
      return;
    }

    let active = true;

    void window.worldCraft.entityTypes.list(targetWorldId).then((result) => {
      if (!active) {
        return;
      }

      setQuickTypes(result.ok ? result.data : []);
      setQuickTypesLoading(false);
    });

    return () => {
      active = false;
    };
  }, [quickOpen, quickWorldId, selectedWorldId, worlds]);

  const openWorld = useCallback(
    async (id: string) => {
      openRequest.current += 1;
      const request = openRequest.current;
      selectedWorldIdRef.current = id;
      setSelectedWorldId(id);
      updatePreferences({ recentLocation: { kind: 'world', worldId: id } });
      setSelectedWorld(null);
      setSelectedState('loading');
      setSelectedActivity([]);
      setSelectedActivityState('loading');
      setEntityId(null);
      goToView('world');

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
    [api, goToView, updatePreferences],
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

  const openEntities = useCallback(() => {
    goToView('entities');
  }, [goToView]);

  const openEntity = useCallback(
    (id: string) => {
      setEntityId(id);

      const worldId = selectedWorldIdRef.current;

      if (worldId !== null) {
        updatePreferences({
          recentLocation: {
            kind: 'entity',
            worldId,
            entityId: id,
            entityName: null,
          },
        });
      }

      goToView('entity');
    },
    [goToView, updatePreferences],
  );

  /** Completa el nombre de la ficha recordada cuando su página termina de cargarla. */
  const handleEntityLoaded = useCallback(
    (entity: { readonly id: string; readonly name: string }) => {
      const location = preferences.recentLocation;

      if (
        location?.kind === 'entity' &&
        location.entityId === entity.id &&
        location.entityName !== entity.name
      ) {
        updatePreferences({
          recentLocation: { ...location, entityName: entity.name },
        });
      }
    },
    [preferences.recentLocation, updatePreferences],
  );

  /** Limpia o degrada el destino al borrar una ficha desde su página. */
  const handleEntityRemoved = useCallback(
    (removedId: string) => {
      const location = preferences.recentLocation;

      if (location?.kind === 'entity' && location.entityId === removedId) {
        updatePreferences({ recentLocation: null });
      }
    },
    [preferences.recentLocation, updatePreferences],
  );

  const continueTarget = useMemo(
    () => resolveContinueTarget(preferences.recentLocation, worlds),
    [preferences.recentLocation, worlds],
  );

  // Con la biblioteca lista se valida el destino persistido: se refresca el
  // nombre de la ficha y se limpia o degrada si ya no existe. Mientras carga no
  // se toca nada y `lastView` nunca dispara navegación.
  useEffect(() => {
    if (libraryState !== 'ready') {
      return;
    }

    const location = preferences.recentLocation;

    if (location === null) {
      return;
    }

    if (!worlds.some((world) => world.id === location.worldId)) {
      updatePreferences({ recentLocation: null });
      return;
    }

    if (location.kind !== 'entity') {
      return;
    }

    let active = true;

    void entitiesApi
      .get({ worldId: location.worldId, id: location.entityId })
      .then((result) => {
        if (!active) {
          return;
        }

        // Un error de transporte no demuestra que la ficha haya desaparecido:
        // solo se degrada cuando el proceso principal confirma que no existe.
        if (!result.ok) {
          return;
        }

        if (result.data === null) {
          updatePreferences({
            recentLocation: { kind: 'world', worldId: location.worldId },
          });
          return;
        }

        if (result.data.name !== location.entityName) {
          updatePreferences({
            recentLocation: { ...location, entityName: result.data.name },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    entitiesApi,
    libraryState,
    preferences.recentLocation,
    updatePreferences,
    worlds,
  ]);

  /**
   * Reanuda el destino recordado. Primero se abre el mundo (mantiene su
   * esqueleto y fija el mundo seleccionado) y después la ficha, para no caer en
   * una ficha sin mundo.
   */
  const handleContinue = useCallback(
    async (target: ContinueTarget) => {
      await openWorld(target.worldId);

      if (target.kind !== 'entity' || target.entityId === null) {
        return;
      }

      // La ficha pudo borrarse en otra sesión: se valida antes de abrirla. Si
      // ya no existe, se permanece en el mundo y se avisa con el texto
      // existente; `openWorld` ya dejó el destino degradado a mundo.
      const detail = await entitiesApi.get({
        worldId: target.worldId,
        id: target.entityId,
      });

      if (!detail.ok) {
        notify('error', messages.entities.notices.failed);
        return;
      }

      if (detail.data === null) {
        notify('error', messages.entities.notices.notFound);
        return;
      }

      openEntity(target.entityId);
    },
    [entitiesApi, messages, notify, openEntity, openWorld],
  );

  const openSearchPage = useCallback(
    (query: string) => {
      setSearchSeed(query);
      setSearchKey((current) => current + 1);
      goToView('search');
    },
    [goToView],
  );

  const openSearchHit = useCallback(
    async (hit: SearchHit) => {
      if (hit.kind === 'world') {
        await openWorld(hit.sourceId);
        return;
      }

      await openWorld(hit.worldId);

      const entityTargetId =
        hit.kind === 'entity' ? hit.sourceId : hit.contextId;

      if (entityTargetId !== null) {
        openEntity(entityTargetId);
      }
    },
    [openEntity, openWorld],
  );

  const openQuickCreate = useCallback(() => {
    setQuickWorldId(selectedWorldId);
    setQuickTypes([]);
    setQuickTypesLoading(true);
    setQuickKey((current) => current + 1);
    setQuickOpen(true);
  }, [selectedWorldId]);

  const rebuildSearchIndex = useCallback(async () => {
    const result = await window.worldCraft.search.rebuild();

    if (result.ok) {
      notify('success', messages.search.rebuilt(result.data.documents));
    } else {
      notify('error', messages.search.rebuildError);
    }
  }, [messages, notify]);

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

    if (preferences.recentLocation?.worldId === world.id) {
      const clearsLastView =
        preferences.lastView === 'world' ||
        preferences.lastView === 'entities' ||
        preferences.lastView === 'entity';

      // Borrar el mundo recordado limpia el destino y, si la última vista era
      // suya, vuelve a Inicio como metadato. `lastView` nunca navega.
      updatePreferences(
        clearsLastView
          ? { recentLocation: null, lastView: 'home' }
          : { recentLocation: null },
      );
    }

    await refreshLibrary();
    document.getElementById('wc-main')?.focus();

    if (selectedWorldId === world.id) {
      selectedWorldIdRef.current = null;
      setSelectedWorld(null);
      setSelectedWorldId(null);
      setSelectedState('ready');
      setSelectedActivity([]);
      setSelectedActivityState('ready');
      setEntityId(null);
      goToView('home');
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
    goToView,
    preferences.lastView,
    preferences.recentLocation,
    updatePreferences,
  ]);

  const submitQuickCreate = useCallback(
    async (input: {
      readonly worldId: string;
      readonly typeId: string;
      readonly name: string;
    }): Promise<boolean> => {
      if (quickPending) {
        return false;
      }

      setQuickPending(true);
      const result = await entitiesApi.create(input);
      setQuickPending(false);

      if (!result.ok) {
        notify('error', messages.entities.quick.error);
        return false;
      }

      setQuickOpen(false);
      notify('success', messages.entities.notices.created(result.data.name));
      await refreshLibrary();
      await openWorld(result.data.worldId);
      openEntity(result.data.id);
      return true;
    },
    [
      entitiesApi,
      messages,
      notify,
      openEntity,
      openWorld,
      quickPending,
      refreshLibrary,
    ],
  );

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
    goToView(next);
  };

  const openCreateWorldDialog = useCallback(() => {
    openDialog({ kind: 'create' });
  }, [openDialog]);

  const title =
    (view === 'world' || view === 'entities' || view === 'entity') &&
    selectedWorld !== null
      ? selectedWorld.name
      : messages.shell.views[view];

  // Una sola acción primaria por vista. Las secundarias viven en el menú «⋯»
  // de la barra; Fichas y Ficha conservan las suyas en la cabecera de página.
  const canCreateWorld = libraryState === 'ready' && worlds.length > 0;
  let primaryAction: ShellPrimaryAction | undefined;
  let secondaryActions: readonly MenuItem[] = [];

  if (view === 'home' || view === 'worlds') {
    if (canCreateWorld) {
      primaryAction = {
        label: messages.worlds.actions.create,
        onSelect: openCreateWorldDialog,
      };
    }

    secondaryActions = [
      ...(worlds.length > 0
        ? [
            {
              id: 'create-entity',
              label: messages.shell.quickCreate,
              onSelect: openQuickCreate,
            },
          ]
        : []),
      {
        id: 'import-world',
        label: messages.transfer.actions.import,
        separatorBefore: worlds.length > 0,
        onSelect: transfer.startImport,
      },
    ];
  } else if (view === 'world' && selectedWorld !== null) {
    const archived = selectedWorld.status === 'archived';

    primaryAction = {
      label: messages.entities.list.create,
      onSelect: openQuickCreate,
    };
    secondaryActions = [
      {
        id: 'edit-world',
        label: messages.worlds.card.edit,
        onSelect: () => {
          void openEdit(selectedWorld);
        },
      },
      {
        id: 'duplicate-world',
        label: messages.worlds.card.duplicate,
        onSelect: () => {
          openDialog({ kind: 'duplicate', world: selectedWorld });
        },
      },
      {
        id: 'export-world',
        label: messages.transfer.actions.export,
        separatorBefore: true,
        onSelect: () => {
          transfer.startExport(selectedWorld);
        },
      },
      {
        id: archived ? 'restore-world' : 'archive-world',
        label: archived
          ? messages.worlds.card.restore
          : messages.worlds.card.archive,
        onSelect: () => {
          openDialog({
            kind: archived ? 'restore' : 'archive',
            world: selectedWorld,
          });
        },
      },
      {
        id: 'delete-world',
        label: messages.worlds.card.delete,
        tone: 'danger',
        onSelect: () => {
          openDialog({ kind: 'delete', world: selectedWorld });
        },
      },
    ];
  } else if (view === 'search') {
    secondaryActions = [
      {
        id: 'rebuild-search',
        label: messages.palette.commands.rebuild,
        onSelect: () => {
          void rebuildSearchIndex();
        },
      },
    ];
  }

  const homePage = (
    <HomePage
      worlds={worlds}
      activity={activity}
      state={libraryState}
      actions={cardActions}
      continueTarget={continueTarget}
      onCreate={openCreateWorldDialog}
      onContinue={(target) => {
        void handleContinue(target);
      }}
      onSeeAll={() => {
        goToView('worlds');
      }}
      onRetry={retryLibrary}
    />
  );

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
        onNavigate={navigate}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        onOpenPalette={openPalette}
        theme={preferences.theme}
        onToggleTheme={toggleTheme}
        collapsed={preferences.railCollapsed}
        onCollapsedChange={(collapsed) => {
          updatePreferences({ railCollapsed: collapsed });
        }}
      >
        {view === 'home' ? (
          homePage
        ) : view === 'search' ? (
          <SearchPage
            key={searchKey}
            worlds={worlds}
            initialQuery={searchSeed}
            onOpenHit={(hit) => {
              void openSearchHit(hit);
            }}
          />
        ) : view === 'worlds' ? (
          <WorldsPage
            worlds={worlds}
            state={libraryState}
            actions={cardActions}
            onCreate={openCreateWorldDialog}
            onRetry={retryLibrary}
          />
        ) : view === 'trash' ? (
          <TrashPage
            onNotify={notify}
            onLibraryChanged={handleLibraryChanged}
          />
        ) : view === 'world' ? (
          <WorldPage
            world={selectedWorld}
            state={selectedState}
            activity={selectedActivity}
            activityState={selectedActivityState}
            onBack={() => {
              goToView('home');
            }}
            onRetry={() => {
              if (selectedWorldId !== null) {
                void openWorld(selectedWorldId);
              }
            }}
            onRetryActivity={() => {
              void refreshSelectedActivity();
            }}
            onOpenEntities={openEntities}
          />
        ) : view === 'entities' && selectedWorld !== null ? (
          <EntitiesPage
            world={selectedWorld}
            onBack={() => {
              goToView('world');
            }}
            onOpenEntity={openEntity}
            onNotify={notify}
          />
        ) : view === 'entity' && selectedWorld !== null && entityId !== null ? (
          <EntityDetailPage
            key={entityId}
            world={selectedWorld}
            entityId={entityId}
            onBack={() => {
              goToView('entities');
            }}
            onOpenEntity={openEntity}
            onEntityLoaded={handleEntityLoaded}
            onEntityRemoved={handleEntityRemoved}
            entityView={preferences.entityView}
            onEntityViewChange={(patch) => {
              updatePreferences({ entityView: patch });
            }}
            onNotify={notify}
          />
        ) : view === 'settings' ? (
          <SettingsPage
            preferences={preferences}
            onUpdate={updatePreferences}
            onReset={resetPreferences}
            onNotify={notify}
          />
        ) : view === 'samples' ? (
          <SamplesPage onNotify={notify} />
        ) : (
          // Vista incoherente (por ejemplo, una ficha sin mundo): Inicio.
          homePage
        )}
      </AppShell>

      <EntityQuickCreateDialog
        key={quickKey}
        open={quickOpen}
        worlds={worlds}
        defaultWorldId={quickWorldId ?? selectedWorldId}
        pending={quickPending}
        types={quickTypes}
        typesLoading={quickTypesLoading}
        onWorldChange={(worldId) => {
          setQuickWorldId(worldId);
          setQuickTypes([]);
          setQuickTypesLoading(true);
        }}
        onClose={() => {
          setQuickOpen(false);
        }}
        onSubmit={submitQuickCreate}
      />

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

      <CommandPalette
        key={paletteKey}
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
        }}
        onNavigate={(next) => {
          navigate(next);
        }}
        onOpenSearch={(query) => {
          openSearchPage(query);
        }}
        onOpenHit={(hit) => {
          void openSearchHit(hit);
        }}
        onCreateWorld={() => {
          openDialog({ kind: 'create' });
        }}
        onCreateEntity={openQuickCreate}
        onToggleTheme={toggleTheme}
        onRebuild={() => {
          void rebuildSearchIndex();
        }}
      />

      <WorldTransferDialog
        state={transfer.state}
        onClose={transfer.close}
        onCancel={transfer.cancel}
        onRetry={transfer.retry}
        onOpenWorld={(worldId) => {
          transfer.close();
          void openWorld(worldId);
        }}
      />

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
