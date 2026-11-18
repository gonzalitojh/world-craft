/**
 * Puente mínimo entre el renderer y Electron.
 *
 * Solo publica `window.worldCraft` mediante `contextBridge`: la identidad de la
 * aplicación y funciones nominativas que hablan por la allowlist de canales. No
 * expone `ipcRenderer`, `require`, rutas del sistema ni ningún `invoke`
 * genérico (ADR 0004). El preload no valida reglas de dominio: eso ocurre en el
 * proceso principal.
 */
import { contextBridge, ipcRenderer } from 'electron';

import {
  createWorldCraftApi,
  WORLD_CRAFT_API_KEY,
  type IpcInvoke,
} from '../shared/contracts/world-craft-api';

const invoke: IpcInvoke = (channel, payload) =>
  ipcRenderer.invoke(channel, payload) as Promise<unknown>;

contextBridge.exposeInMainWorld(
  WORLD_CRAFT_API_KEY,
  createWorldCraftApi({ invoke }),
);
