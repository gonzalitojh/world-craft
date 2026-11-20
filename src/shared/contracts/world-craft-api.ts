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
import { IPC_CHANNELS, type IpcChannel } from './channels';
import { ipcErr, isIpcResult, type IpcResult } from './result';
import {
  isUpdateSnapshot,
  UPDATE_STATE_CHANGED_CHANNEL,
  type UpdateSnapshot,
} from './updates';

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

/** API mínima disponible en `window.worldCraft`. */
export interface WorldCraftApi {
  readonly appInfo: AppInfo;
  readonly shell: WorldCraftShellApi;
  readonly updates: WorldCraftUpdatesApi;
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
 * Construye la API congelada del preload.
 *
 * Se congelan el objeto raíz, `appInfo`, `shell` y `updates` para que el
 * renderer no pueda sustituirlos en tiempo de ejecución.
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

  return Object.freeze({ appInfo, shell, updates });
}
