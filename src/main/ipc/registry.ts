/**
 * Router único de IPC.
 *
 * Cada llamada del renderer pasa por aquí: se resuelve el canal contra la
 * allowlist, se valida el payload con Zod, se ejecuta el handler y se envuelve
 * todo en un `IpcResult`. Cualquier excepción se convierte en `INTERNAL_ERROR`
 * sin filtrar mensaje, stack, rutas ni valores recibidos (ADR 0004).
 */
import type { IpcMain } from 'electron';
import type { ZodType } from 'zod';

import {
  IPC_CHANNEL_LIST,
  isIpcChannel,
  type IpcChannel,
} from '../../shared/contracts/channels';
import { ipcErr, ipcOk, type IpcResult } from '../../shared/contracts/result';
import { isLoopbackUrl } from '../security/guards';
import { IpcInputError } from './errors';

/**
 * Definición de un canal: esquema de entrada y función que lo atiende.
 *
 * `TInput` es el tipo de salida del esquema, de modo que el handler recibe el
 * payload ya validado y tipado.
 */
export interface IpcHandlerDefinition<TInput = unknown> {
  readonly schema: ZodType<TInput>;
  readonly handle: (input: TInput) => unknown | Promise<unknown>;
}

/**
 * Declara un handler conservando la inferencia del esquema.
 *
 * El mapa de handlers se tipa con `IpcHandlerDefinition<unknown>`, y la
 * varianza de la función `handle` impediría asignar un handler más específico.
 * Este helper centraliza la conversión en un único punto y documenta por qué.
 */
export function defineIpcHandler<TInput>(
  definition: IpcHandlerDefinition<TInput>,
): IpcHandlerDefinition {
  return definition as IpcHandlerDefinition;
}

/**
 * Mapa de handlers.
 *
 * Es un `Record` sobre `IpcChannel`, así que TypeScript obliga a atender todos
 * los canales de la allowlist: añadir un canal sin handler no compila.
 */
export type IpcHandlers = {
  readonly [Channel in IpcChannel]: IpcHandlerDefinition;
};

/** Resuelve una llamada IPC ya validada por el preload. */
export type IpcRoute = (
  channel: unknown,
  payload: unknown,
) => Promise<IpcResult<unknown>>;

/** Marco remitente mínimo que necesita la comprobación de origen. */
interface SenderFrame {
  readonly url?: string;
}

/**
 * Indica si el remitente de una llamada es la propia aplicación.
 *
 * Se acepta el documento empaquetado (`file:`) y el servidor de desarrollo en
 * loopback. Cualquier otro origen, o un remitente sin URL, se rechaza.
 */
export function isTrustedSenderUrl(rawUrl: string): boolean {
  if (rawUrl.length === 0) {
    return false;
  }

  if (rawUrl.startsWith('file://')) {
    return true;
  }

  return isLoopbackUrl(rawUrl);
}

function isTrustedSenderFrame(frame: SenderFrame | null): boolean {
  const url = frame?.url;

  return typeof url === 'string' && isTrustedSenderUrl(url);
}

/** Construye el router a partir del mapa de handlers. */
export function createIpcRouter(handlers: IpcHandlers): IpcRoute {
  return async (channel, payload) => {
    if (!isIpcChannel(channel)) {
      return ipcErr('UNKNOWN_CHANNEL');
    }

    const handler: IpcHandlerDefinition | undefined = handlers[channel];

    if (handler === undefined) {
      return ipcErr('UNKNOWN_CHANNEL');
    }

    let parsed;

    try {
      parsed = handler.schema.safeParse(payload);
    } catch {
      // Un esquema roto es un fallo interno, no una entrada inválida.
      return ipcErr('INTERNAL_ERROR');
    }

    if (!parsed.success) {
      return ipcErr('INVALID_INPUT');
    }

    try {
      return ipcOk(await handler.handle(parsed.data));
    } catch (error) {
      if (error instanceof IpcInputError) {
        return ipcErr('INVALID_INPUT');
      }

      return ipcErr('INTERNAL_ERROR');
    }
  };
}

export interface RegisterIpcHandlersOptions {
  /**
   * Predicado de confianza del remitente. Se inyecta en los tests; por defecto
   * exige el documento empaquetado o el servidor de desarrollo en loopback.
   */
  readonly isTrustedSender?: (frame: SenderFrame | null) => boolean;
}

/**
 * Registra en `ipcMain` un handler por cada canal de la allowlist.
 *
 * No hay `ipcMain.on` genérico ni canales dinámicos: si un canal no está en la
 * lista, Electron no lo enruta y el renderer recibe `UNKNOWN_CHANNEL`.
 */
export function registerIpcHandlers(
  ipc: IpcMain,
  handlers: IpcHandlers,
  options: RegisterIpcHandlersOptions = {},
): void {
  const route = createIpcRouter(handlers);
  const isTrustedSender = options.isTrustedSender ?? isTrustedSenderFrame;

  for (const channel of IPC_CHANNEL_LIST) {
    ipc.handle(channel, async (event, payload: unknown) => {
      const frame = event.senderFrame as SenderFrame | null;

      if (!isTrustedSender(frame)) {
        return ipcErr('UNTRUSTED_SENDER');
      }

      return route(channel, payload);
    });
  }
}
