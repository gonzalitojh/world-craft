/**
 * Allowlist de canales IPC.
 *
 * Esta lista es la única fuente de verdad: el preload solo expone funciones
 * nominativas que hablan por estos canales, el proceso principal solo registra
 * handlers para ellos y los tests comprueban que las dos listas coinciden.
 *
 * Es un módulo puro: no importa Electron, Node ni Zod, porque el renderer
 * también lo compila para tipar `window.worldCraft` (ADR 0004).
 */

/** Canales IPC disponibles, con nombre estable en inglés. */
export const IPC_CHANNELS = {
  shellOpenExternal: 'shell:openExternal',
  updatesGetState: 'updates:getState',
  updatesCheck: 'updates:check',
  updatesCancel: 'updates:cancel',
  updatesDownload: 'updates:download',
  updatesInstall: 'updates:install',
} as const;

/** Unión de todos los canales admitidos. */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Los canales admitidos como array, para registrar y comparar. */
export const IPC_CHANNEL_LIST: readonly IpcChannel[] = Object.freeze(
  Object.values(IPC_CHANNELS),
);

const IPC_CHANNEL_SET: ReadonlySet<string> = new Set(IPC_CHANNEL_LIST);

/** Indica si un valor es un canal de la allowlist. */
export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === 'string' && IPC_CHANNEL_SET.has(value);
}
