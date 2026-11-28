/**
 * Contrato de la API que el preload expone al renderer.
 *
 * Es un módulo puro: no importa Electron, Node ni React, de modo que el
 * renderer puede declarar los tipos y los tests pueden construirlo sin abrir
 * una ventana. Cualquier canal IPC futuro debe ampliar este contrato y pasar
 * por el preload; el renderer nunca recibe `ipcRenderer` ni un `invoke`
 * genérico (ADR 0004).
 *
 * El preload es un transporte tonto: no valida reglas de dominio, solo
 * comprueba que la respuesta del proceso principal tiene la forma del contrato.
 * El proceso principal es la frontera de confianza y valida con Zod.
 */
import { APP_NAME, APP_VERSION } from '../app-info';
import {
  isAssetImportResult,
  isAssetList,
  type AssetImportInput,
  type WorldCraftAssetsApi,
} from './assets';
import { IPC_CHANNELS, type IpcChannel } from './channels';
import {
  DATA_DELETE_ALL_CONFIRMATION,
  DATA_ORPHAN_PURGE_CONFIRMATION,
  isDataCounts,
  isDataDeleteResult,
  isDataLibraryResult,
  isDataOpenFolderResult,
  isDataOrphanPurgeResult,
  isDataOrphanSummary,
  isDataResult,
  isDataUsage,
  type DataCounts,
  type DataDeleteRequest,
  type DataDeleteResult,
  type DataFolder,
  type DataLibraryResult,
  type DataOpenFolderResult,
  type DataOrphanPurgeResult,
  type DataOrphanSummary,
  type DataResult,
  type DataUsage,
} from './data';
import {
  isEntityDeleteResult,
  isEntityDetail,
  isEntityList,
  isEntityTag,
  isEntityTagList,
  type EntityCreateInput,
  type EntityDetail,
  type EntityGetInput,
  type EntityListInput,
  type EntityRemoveInput,
  type EntitySetFavoriteInput,
  type EntityTagCreateInput,
  type EntityUpdateInput,
  type WorldCraftEntitiesApi,
  type WorldCraftTagsApi,
} from './entities';
import {
  isEntityTypeDeleteResult,
  isEntityTypeList,
  isEntityTypeSummary,
  type EntityTypeCreateInput,
  type EntityTypeDuplicateInput,
  type EntityTypeRemoveInput,
  type EntityTypeSummary,
  type EntityTypeUpdateInput,
  type WorldCraftEntityTypesApi,
} from './entity-types';
import {
  isSpikeExportResult,
  type SpikeExportInput,
  type SpikeExportResult,
} from './maps-spike';
import {
  isUiPreferences,
  type UiPreferences,
  type UiPreferencesPatch,
} from './preferences';
import { ipcErr, isIpcResult, type IpcResult } from './result';
import {
  isRelationDeleteResult,
  isRelationEdge,
  isRelationEdgeList,
  isRelationType,
  isRelationTypeDeleteResult,
  isRelationTypeList,
  type RelationCreateInput,
  type RelationDeleteInput,
  type RelationEdge,
  type RelationListInput,
  type RelationType,
  type RelationTypeCreateInput,
  type RelationTypeRemoveInput,
  type RelationTypeUpdateInput,
  type RelationUpdateInput,
  type WorldCraftRelationsApi,
  type WorldCraftRelationTypesApi,
} from './relations';
import {
  isUpdateSnapshot,
  UPDATE_STATE_CHANGED_CHANNEL,
  type UpdateSnapshot,
} from './updates';
import {
  isSearchRebuildResult,
  isSearchResponse,
  isSearchSuggestions,
  type SearchQueryInput,
  type SearchSuggestionsInput,
  type WorldCraftSearchApi,
} from './search';
import {
  isTrashEmptyResult,
  isTrashPage,
  isTrashPurgeResult,
  isTrashRestoreResult,
  type TrashEmptyInput,
  type TrashListInput,
  type TrashPurgeInput,
  type TrashRestoreInput,
  type WorldCraftTrashApi,
} from './trash';
import {
  isTransferCancelResult,
  isTransferExportRunResult,
  isTransferImportRunResult,
  isTransferProgressEvent,
  TRANSFER_EVENT_CHANNEL,
  type TransferProgressEvent,
  type WorldCraftTransferApi,
} from './transfer';
import {
  isEntityVersionList,
  isVersionCreateResult,
  isVersionRestoreResult,
  type VersionCreateInput,
  type VersionListInput,
  type VersionRestoreInput,
  type WorldCraftVersionsApi,
} from './versions';
import {
  isWorldActivityList,
  isWorldDeleteResult,
  isWorldDetail,
  isWorldSummaryList,
  type WorldActivityFilter,
  type WorldCraftWorldsApi,
  type WorldCreateInput,
  type WorldDetail,
  type WorldDuplicateInput,
  type WorldSetArchivedInput,
  type WorldSetCoverInput,
  type WorldUpdateInput,
} from './worlds';

/** Clave global donde el preload publica la API. */
export const WORLD_CRAFT_API_KEY = 'worldCraft' as const;

/** Identidad mínima y de solo lectura de la aplicación. */
export interface AppInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Transporte inyectable hacia el proceso principal.
 *
 * En producción lo implementa el preload con `ipcRenderer.invoke`; en los tests
 * se sustituye por un doble.
 */
export type IpcInvoke = (
  channel: IpcChannel,
  payload: unknown,
) => Promise<unknown>;

/**
 * Suscripción inyectable a eventos del proceso principal.
 *
 * En producción la implementa el preload con `ipcRenderer.on`; devuelve una
 * función para retirar el listener. En los tests se sustituye por un doble.
 */
export type IpcSubscribe = (
  channel: string,
  listener: (payload: unknown) => void,
) => () => void;

/** Resultado de abrir un enlace en el navegador del sistema. */
export interface ShellOpenExternalResult {
  readonly opened: true;
}

/** Puente nominativo para acciones del sistema. */
export interface WorldCraftShellApi {
  readonly openExternal: (
    url: string,
  ) => Promise<IpcResult<ShellOpenExternalResult>>;
}

/** Puente nominativo del actualizador. */
export interface WorldCraftUpdatesApi {
  readonly getState: () => Promise<IpcResult<UpdateSnapshot>>;
  readonly check: () => Promise<IpcResult<UpdateSnapshot>>;
  readonly cancel: () => Promise<IpcResult<UpdateSnapshot>>;
  readonly download: () => Promise<IpcResult<UpdateSnapshot>>;
  readonly install: () => Promise<IpcResult<UpdateSnapshot>>;
  /**
   * Escucha los cambios de estado. El listener solo recibe snapshots que
   * superan `isUpdateSnapshot`. Devuelve la función para desuscribirse.
   */
  readonly onStateChanged: (
    listener: (snapshot: UpdateSnapshot) => void,
  ) => () => void;
}

/** Puente nominativo de preferencias de interfaz (#132). */
export interface WorldCraftPreferencesApi {
  readonly get: () => Promise<IpcResult<UiPreferences>>;
  readonly update: (
    patch: UiPreferencesPatch,
  ) => Promise<IpcResult<UiPreferences>>;
  readonly reset: () => Promise<IpcResult<UiPreferences>>;
}

/** Puente nominativo de datos, ajustes y mantenimiento (#79). */
export interface WorldCraftDataApi {
  readonly getSummary: () => Promise<IpcResult<DataResult<DataCounts>>>;
  readonly getUsage: () => Promise<IpcResult<DataResult<DataUsage>>>;
  readonly openFolder: (
    folder: DataFolder,
  ) => Promise<IpcResult<DataResult<DataOpenFolderResult>>>;
  readonly exportAll: () => Promise<IpcResult<DataLibraryResult>>;
  readonly deleteAll: (
    input: DataDeleteRequest,
  ) => Promise<IpcResult<DataDeleteResult>>;
  readonly planOrphans: () => Promise<IpcResult<DataResult<DataOrphanSummary>>>;
  readonly purgeOrphans: () => Promise<
    IpcResult<DataResult<DataOrphanPurgeResult>>
  >;
}

/**
 * Puente de exportación del laboratorio de mapas (#80).
 *
 * El renderer aporta el tipo y los bytes; el proceso principal decide carpeta,
 * nombre y extensión. No existe un canal para elegir rutas.
 */
export interface WorldCraftMapsSpikeApi {
  readonly saveExport: (
    input: SpikeExportInput,
  ) => Promise<IpcResult<SpikeExportResult>>;
}

/** API mínima disponible en `window.worldCraft`. */
export interface WorldCraftApi {
  readonly appInfo: AppInfo;
  readonly shell: WorldCraftShellApi;
  readonly updates: WorldCraftUpdatesApi;
  readonly preferences: WorldCraftPreferencesApi;
  readonly worlds: WorldCraftWorldsApi;
  readonly entityTypes: WorldCraftEntityTypesApi;
  readonly entities: WorldCraftEntitiesApi;
  readonly tags: WorldCraftTagsApi;
  readonly relationTypes: WorldCraftRelationTypesApi;
  readonly relations: WorldCraftRelationsApi;
  readonly search: WorldCraftSearchApi;
  readonly assets: WorldCraftAssetsApi;
  readonly trash: WorldCraftTrashApi;
  readonly versions: WorldCraftVersionsApi;
  readonly transfer: WorldCraftTransferApi;
  readonly data: WorldCraftDataApi;
  readonly mapsSpike: WorldCraftMapsSpikeApi;
}

export interface WorldCraftApiOptions {
  readonly invoke: IpcInvoke;
  readonly subscribe?: IpcSubscribe;
}

/**
 * Normaliza la respuesta del canal de apertura de enlaces.
 *
 * El proceso principal devuelve `{ ok: true, data: { opened: true } }` o un
 * error tipado. Cualquier otra forma (transporte roto, respuesta manipulada) se
 * degrada a `INTERNAL_ERROR`.
 */
function toShellOpenExternalResult(
  value: unknown,
): IpcResult<ShellOpenExternalResult> {
  if (!isIpcResult(value)) {
    return ipcErr('INTERNAL_ERROR');
  }

  if (!value.ok) {
    return value;
  }

  const data: unknown = value.data;

  if (
    typeof data === 'object' &&
    data !== null &&
    (data as { readonly opened?: unknown }).opened === true
  ) {
    return { ok: true, data: { opened: true } };
  }

  return ipcErr('INTERNAL_ERROR');
}

/**
 * Normaliza la respuesta de un canal de actualizaciones.
 *
 * Cualquier forma distinta de `{ ok: true, data: UpdateSnapshot }` se degrada
 * a `INTERNAL_ERROR`; un snapshot incoherente nunca llega al renderer.
 */
function toUpdateSnapshotResult(value: unknown): IpcResult<UpdateSnapshot> {
  if (!isIpcResult(value)) {
    return ipcErr('INTERNAL_ERROR');
  }

  if (!value.ok) {
    return value;
  }

  if (!isUpdateSnapshot(value.data)) {
    return ipcErr('INTERNAL_ERROR');
  }

  return { ok: true, data: value.data };
}

/**
 * Normaliza la respuesta de un canal de mundos con su guarda de forma.
 *
 * El proceso principal es de confianza, pero el preload no reenvía una
 * respuesta manipulada o de otra versión: si no encaja, se degrada a
 * `INTERNAL_ERROR`.
 */
function toGuardedResult<T>(
  value: unknown,
  guard: (data: unknown) => data is T,
): IpcResult<T> {
  if (!isIpcResult(value)) {
    return ipcErr('INTERNAL_ERROR');
  }

  if (!value.ok) {
    return value;
  }

  if (!guard(value.data)) {
    return ipcErr('INTERNAL_ERROR');
  }

  return { ok: true, data: value.data };
}

function isNullableWorldDetail(value: unknown): value is WorldDetail | null {
  return value === null || isWorldDetail(value);
}

function isNullableEntityTypeSummary(
  value: unknown,
): value is EntityTypeSummary | null {
  return value === null || isEntityTypeSummary(value);
}

function isNullableEntityDetail(value: unknown): value is EntityDetail | null {
  return value === null || isEntityDetail(value);
}

function isNullableRelationType(value: unknown): value is RelationType | null {
  return value === null || isRelationType(value);
}

function isNullableRelationEdge(value: unknown): value is RelationEdge | null {
  return value === null || isRelationEdge(value);
}

/**
 * Construye la API congelada del preload.
 *
 * Se congelan el objeto raíz, `appInfo`, `shell`, `updates`, `preferences`,
 * `worlds`, `entityTypes`, `entities`, `tags`, `relationTypes`, `relations`,
 * `search`, `assets`, `trash`, `versions`, `transfer`, `data` y `mapsSpike`
 * para que el renderer no pueda sustituirlos en tiempo de ejecución.
 */
export function createWorldCraftApi(
  options: WorldCraftApiOptions,
): WorldCraftApi {
  const appInfo: AppInfo = Object.freeze({
    name: APP_NAME,
    version: APP_VERSION,
  });

  const shell: WorldCraftShellApi = Object.freeze({
    openExternal: async (
      url: string,
    ): Promise<IpcResult<ShellOpenExternalResult>> => {
      try {
        const response = await options.invoke(IPC_CHANNELS.shellOpenExternal, {
          url,
        });

        return toShellOpenExternalResult(response);
      } catch {
        // Un fallo del transporte nunca se propaga con detalles internos.
        return ipcErr('INTERNAL_ERROR');
      }
    },
  });

  const invokeUpdateCommand = async (
    channel:
      | typeof IPC_CHANNELS.updatesGetState
      | typeof IPC_CHANNELS.updatesCheck
      | typeof IPC_CHANNELS.updatesCancel
      | typeof IPC_CHANNELS.updatesDownload
      | typeof IPC_CHANNELS.updatesInstall,
  ): Promise<IpcResult<UpdateSnapshot>> => {
    try {
      const response = await options.invoke(channel, {});

      return toUpdateSnapshotResult(response);
    } catch {
      return ipcErr('INTERNAL_ERROR');
    }
  };

  const updates: WorldCraftUpdatesApi = Object.freeze({
    getState: () => invokeUpdateCommand(IPC_CHANNELS.updatesGetState),
    check: () => invokeUpdateCommand(IPC_CHANNELS.updatesCheck),
    cancel: () => invokeUpdateCommand(IPC_CHANNELS.updatesCancel),
    download: () => invokeUpdateCommand(IPC_CHANNELS.updatesDownload),
    install: () => invokeUpdateCommand(IPC_CHANNELS.updatesInstall),
    onStateChanged: (
      listener: (snapshot: UpdateSnapshot) => void,
    ): (() => void) => {
      if (typeof listener !== 'function' || options.subscribe === undefined) {
        return () => {};
      }

      const unsubscribe = options.subscribe(
        UPDATE_STATE_CHANGED_CHANNEL,
        (payload) => {
          if (isUpdateSnapshot(payload)) {
            listener(payload);
          }
        },
      );

      return typeof unsubscribe === 'function' ? unsubscribe : () => {};
    },
  });

  const invokeWorldCommand = async <T>(
    channel: IpcChannel,
    payload: unknown,
    guard: (data: unknown) => data is T,
  ): Promise<IpcResult<T>> => {
    try {
      return toGuardedResult(await options.invoke(channel, payload), guard);
    } catch {
      return ipcErr('INTERNAL_ERROR');
    }
  };

  const preferences: WorldCraftPreferencesApi = Object.freeze({
    get: () =>
      invokeWorldCommand(IPC_CHANNELS.preferencesGet, {}, isUiPreferences),
    update: (patch: UiPreferencesPatch) =>
      invokeWorldCommand(
        IPC_CHANNELS.preferencesUpdate,
        patch,
        isUiPreferences,
      ),
    reset: () =>
      invokeWorldCommand(IPC_CHANNELS.preferencesReset, {}, isUiPreferences),
  });

  const worlds: WorldCraftWorldsApi = Object.freeze({
    list: () =>
      invokeWorldCommand(IPC_CHANNELS.worldsList, {}, isWorldSummaryList),
    get: (id: string) =>
      invokeWorldCommand(IPC_CHANNELS.worldsGet, { id }, isNullableWorldDetail),
    create: (input: WorldCreateInput) =>
      invokeWorldCommand(IPC_CHANNELS.worldsCreate, input, isWorldDetail),
    update: (input: WorldUpdateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.worldsUpdate,
        input,
        isNullableWorldDetail,
      ),
    duplicate: (input: WorldDuplicateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.worldsDuplicate,
        input,
        isNullableWorldDetail,
      ),
    setArchived: (input: WorldSetArchivedInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.worldsSetArchived,
        input,
        isNullableWorldDetail,
      ),
    setCover: (input: WorldSetCoverInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.worldsSetCover,
        input,
        isNullableWorldDetail,
      ),
    remove: (id: string) =>
      invokeWorldCommand(
        IPC_CHANNELS.worldsRemove,
        { id },
        isWorldDeleteResult,
      ),
    listActivity: (filter?: WorldActivityFilter) =>
      invokeWorldCommand(
        IPC_CHANNELS.worldsListActivity,
        filter ?? {},
        isWorldActivityList,
      ),
  });

  const entityTypes: WorldCraftEntityTypesApi = Object.freeze({
    list: (worldId: string) =>
      invokeWorldCommand(
        IPC_CHANNELS.entityTypesList,
        { worldId },
        isEntityTypeList,
      ),
    create: (input: EntityTypeCreateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entityTypesCreate,
        input,
        isEntityTypeSummary,
      ),
    update: (input: EntityTypeUpdateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entityTypesUpdate,
        input,
        isNullableEntityTypeSummary,
      ),
    duplicate: (input: EntityTypeDuplicateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entityTypesDuplicate,
        input,
        isNullableEntityTypeSummary,
      ),
    remove: (input: EntityTypeRemoveInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entityTypesRemove,
        input,
        isEntityTypeDeleteResult,
      ),
  });

  const entities: WorldCraftEntitiesApi = Object.freeze({
    list: (input: EntityListInput) =>
      invokeWorldCommand(IPC_CHANNELS.entitiesList, input, isEntityList),
    get: (input: EntityGetInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entitiesGet,
        input,
        isNullableEntityDetail,
      ),
    create: (input: EntityCreateInput) =>
      invokeWorldCommand(IPC_CHANNELS.entitiesCreate, input, isEntityDetail),
    update: (input: EntityUpdateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entitiesUpdate,
        input,
        isNullableEntityDetail,
      ),
    setFavorite: (input: EntitySetFavoriteInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entitiesSetFavorite,
        input,
        isNullableEntityDetail,
      ),
    remove: (input: EntityRemoveInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.entitiesRemove,
        input,
        isEntityDeleteResult,
      ),
  });

  const tags: WorldCraftTagsApi = Object.freeze({
    list: (worldId: string) =>
      invokeWorldCommand(IPC_CHANNELS.tagsList, { worldId }, isEntityTagList),
    create: (input: EntityTagCreateInput) =>
      invokeWorldCommand(IPC_CHANNELS.tagsCreate, input, isEntityTag),
  });

  const assets: WorldCraftAssetsApi = Object.freeze({
    list: (worldId: string) =>
      invokeWorldCommand(IPC_CHANNELS.assetsList, { worldId }, isAssetList),
    import: (input: AssetImportInput) =>
      invokeWorldCommand(IPC_CHANNELS.assetsImport, input, isAssetImportResult),
  });

  const relationTypes: WorldCraftRelationTypesApi = Object.freeze({
    list: (worldId: string) =>
      invokeWorldCommand(
        IPC_CHANNELS.relationTypesList,
        { worldId },
        isRelationTypeList,
      ),
    create: (input: RelationTypeCreateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.relationTypesCreate,
        input,
        isRelationType,
      ),
    update: (input: RelationTypeUpdateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.relationTypesUpdate,
        input,
        isNullableRelationType,
      ),
    remove: (input: RelationTypeRemoveInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.relationTypesRemove,
        input,
        isRelationTypeDeleteResult,
      ),
  });

  const relations: WorldCraftRelationsApi = Object.freeze({
    list: (input: RelationListInput) =>
      invokeWorldCommand(IPC_CHANNELS.relationsList, input, isRelationEdgeList),
    create: (input: RelationCreateInput) =>
      invokeWorldCommand(IPC_CHANNELS.relationsCreate, input, isRelationEdge),
    update: (input: RelationUpdateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.relationsUpdate,
        input,
        isNullableRelationEdge,
      ),
    remove: (input: RelationDeleteInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.relationsRemove,
        input,
        isRelationDeleteResult,
      ),
  });

  const search: WorldCraftSearchApi = Object.freeze({
    query: (input: SearchQueryInput) =>
      invokeWorldCommand(IPC_CHANNELS.searchQuery, input, isSearchResponse),
    suggestions: (input?: SearchSuggestionsInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.searchSuggestions,
        input ?? {},
        isSearchSuggestions,
      ),
    rebuild: () =>
      invokeWorldCommand(IPC_CHANNELS.searchRebuild, {}, isSearchRebuildResult),
  });

  const trash: WorldCraftTrashApi = Object.freeze({
    list: (input: TrashListInput) =>
      invokeWorldCommand(IPC_CHANNELS.trashList, input, isTrashPage),
    restore: (input: TrashRestoreInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.trashRestore,
        input,
        isTrashRestoreResult,
      ),
    purge: (input: TrashPurgeInput) =>
      invokeWorldCommand(IPC_CHANNELS.trashPurge, input, isTrashPurgeResult),
    empty: (input: TrashEmptyInput) =>
      invokeWorldCommand(IPC_CHANNELS.trashEmpty, input, isTrashEmptyResult),
  });

  const versions: WorldCraftVersionsApi = Object.freeze({
    list: (input: VersionListInput) =>
      invokeWorldCommand(IPC_CHANNELS.versionsList, input, isEntityVersionList),
    create: (input: VersionCreateInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.versionsCreate,
        input,
        isVersionCreateResult,
      ),
    restore: (input: VersionRestoreInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.versionsRestore,
        input,
        isVersionRestoreResult,
      ),
  });

  const transfer: WorldCraftTransferApi = Object.freeze({
    exportWorld: (worldId: string) =>
      invokeWorldCommand(
        IPC_CHANNELS.transferExportWorld,
        { worldId },
        isTransferExportRunResult,
      ),
    importWorld: () =>
      invokeWorldCommand(
        IPC_CHANNELS.transferImportWorld,
        {},
        isTransferImportRunResult,
      ),
    cancel: () =>
      invokeWorldCommand(
        IPC_CHANNELS.transferCancel,
        {},
        isTransferCancelResult,
      ),
    onEvent: (
      listener: (event: TransferProgressEvent) => void,
    ): (() => void) => {
      if (typeof listener !== 'function' || options.subscribe === undefined) {
        return () => {};
      }

      const unsubscribe = options.subscribe(
        TRANSFER_EVENT_CHANNEL,
        (payload) => {
          if (isTransferProgressEvent(payload)) {
            listener(payload);
          }
        },
      );

      return typeof unsubscribe === 'function' ? unsubscribe : () => {};
    },
  });

  const data: WorldCraftDataApi = Object.freeze({
    getSummary: () =>
      invokeWorldCommand(
        IPC_CHANNELS.dataGetSummary,
        {},
        (value): value is DataResult<DataCounts> =>
          isDataResult(value, isDataCounts),
      ),
    getUsage: () =>
      invokeWorldCommand(
        IPC_CHANNELS.dataGetUsage,
        {},
        (value): value is DataResult<DataUsage> =>
          isDataResult(value, isDataUsage),
      ),
    openFolder: (folder: DataFolder) =>
      invokeWorldCommand(
        IPC_CHANNELS.dataOpenFolder,
        { folder },
        (value): value is DataResult<DataOpenFolderResult> =>
          isDataResult(value, isDataOpenFolderResult),
      ),
    exportAll: () =>
      invokeWorldCommand(IPC_CHANNELS.dataExportAll, {}, isDataLibraryResult),
    deleteAll: (input: DataDeleteRequest) =>
      invokeWorldCommand(
        IPC_CHANNELS.dataDeleteAll,
        {
          confirmation: DATA_DELETE_ALL_CONFIRMATION,
          keepBackups: input.keepBackups,
        },
        isDataDeleteResult,
      ),
    planOrphans: () =>
      invokeWorldCommand(
        IPC_CHANNELS.dataPlanOrphans,
        {},
        (value): value is DataResult<DataOrphanSummary> =>
          isDataResult(value, isDataOrphanSummary),
      ),
    purgeOrphans: () =>
      invokeWorldCommand(
        IPC_CHANNELS.dataPurgeOrphans,
        { confirmation: DATA_ORPHAN_PURGE_CONFIRMATION },
        (value): value is DataResult<DataOrphanPurgeResult> =>
          isDataResult(value, isDataOrphanPurgeResult),
      ),
  });

  const mapsSpike: WorldCraftMapsSpikeApi = Object.freeze({
    saveExport: (input: SpikeExportInput) =>
      invokeWorldCommand(
        IPC_CHANNELS.mapsSpikeSaveExport,
        input,
        isSpikeExportResult,
      ),
  });

  return Object.freeze({
    appInfo,
    shell,
    updates,
    preferences,
    worlds,
    entityTypes,
    entities,
    tags,
    relationTypes,
    relations,
    search,
    assets,
    trash,
    versions,
    transfer,
    data,
    mapsSpike,
  });
}
