/**
 * Identidad y límites de la aplicación de escritorio.
 *
 * Este módulo es compartido por el proceso principal, el preload y el renderer,
 * así que no puede importar Electron, Node ni React.
 */

/** Nombre visible de la aplicación. */
export const APP_NAME = 'World Craft';

/** Identificador estable para el instalador y `app.setAppUserModelId`. */
export const APP_ID = 'com.gonzalitojh.worldcraft';

/**
 * Versión visible y empaquetada. Debe coincidir con `package.json`; el test
 * `app-info.test.ts` lo comprueba para que `latest.yml`, ProductVersion y la
 * interfaz no diverjan.
 */
export const APP_VERSION = '0.1.0';

/** Ventana mínima admitida, en píxeles. */
export const MIN_WINDOW_WIDTH = 1024;
export const MIN_WINDOW_HEIGHT = 700;

/** Anchos de referencia para las comprobaciones de escritorio. */
export const WINDOW_WIDTHS = [1024, 1280, 1600] as const;
