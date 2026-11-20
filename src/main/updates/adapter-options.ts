/**
 * Opciones fijas de electron-updater.
 *
 * La comprobación y la descarga las ordena el usuario desde la interfaz: no
 * hay auto-check, ni descarga automática, ni instalación al cerrar. Los
 * prereleases y las versiones anteriores no se aceptan.
 */
export const UPDATE_ADAPTER_OPTIONS = Object.freeze({
  autoDownload: false,
  autoInstallOnAppQuit: false,
  allowPrerelease: false,
  allowDowngrade: false,
  fullChangelog: false,
  disableWebInstaller: true,
});

/** Ruta del manifiesto que electron-updater espera junto a los recursos. */
export const APP_UPDATE_CONFIG_FILE_NAME = 'app-update.yml';
