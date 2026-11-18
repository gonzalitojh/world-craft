/**
 * Contrato de la API que el preload expone al renderer.
 *
 * Es un módulo puro: no importa Electron, Node ni React, de modo que el
 * renderer puede declarar los tipos y los tests pueden construirlo sin abrir
 * una ventana. Cualquier canal IPC futuro debe ampliar este contrato y pasar
 * por el preload; el renderer nunca recibe `ipcRenderer` ni un `invoke`
 * genérico (ADR 0004).
 */
import { APP_NAME, APP_VERSION } from '../app-info';

/** Clave global donde el preload publica la API. */
export const WORLD_CRAFT_API_KEY = 'worldCraft' as const;

/** Identidad mínima y de solo lectura de la aplicación. */
export interface AppInfo {
  readonly name: string;
  readonly version: string;
}

/** API mínima disponible en `window.worldCraft`. */
export interface WorldCraftApi {
  readonly appInfo: AppInfo;
}

/**
 * Construye la API congelada del preload.
 *
 * Se congelan tanto el objeto raíz como `appInfo` para que el renderer no
 * pueda sustituir la identidad de la aplicación en tiempo de ejecución.
 */
export function createWorldCraftApi(): WorldCraftApi {
  const appInfo: AppInfo = Object.freeze({
    name: APP_NAME,
    version: APP_VERSION,
  });

  return Object.freeze({ appInfo });
}
