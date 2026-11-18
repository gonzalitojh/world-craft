/**
 * Puente mínimo entre el renderer y Electron.
 *
 * Solo publica `window.worldCraft.appInfo` mediante `contextBridge`. No expone
 * `ipcRenderer`, `require`, rutas del sistema ni ningún `invoke` genérico
 * (ADR 0004). Cuando exista IPC real, cada canal tendrá su función tipada aquí
 * y su validación en el proceso principal.
 */
import { contextBridge } from 'electron';

import {
  createWorldCraftApi,
  WORLD_CRAFT_API_KEY,
} from '../shared/contracts/world-craft-api';

contextBridge.exposeInMainWorld(WORLD_CRAFT_API_KEY, createWorldCraftApi());
