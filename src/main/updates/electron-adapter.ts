/**
 * Adaptador real de electron-updater.
 *
 * Se importa de forma dinámica desde la composición: si el módulo no está
 * disponible o la configuración de actualización no existe, la aplicación
 * arranca igualmente y el servicio queda deshabilitado sin abrir red.
 *
 * electron-updater usa la partición `electron-updater` con `cache: false`.
 * Antes de permitir ninguna petición se comprueba que `autoUpdater.netSession`
 * es exactamente esa sesión y se instalan los guards de host y cabeceras.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { session } from 'electron';
import { autoUpdater, type ProgressInfo } from 'electron-updater';

import type { UpdateUnavailableReason } from '../../shared/contracts/updates';
import {
  APP_UPDATE_CONFIG_FILE_NAME,
  UPDATE_ADAPTER_OPTIONS,
} from './adapter-options';
import {
  installUpdateSessionGuards,
  UPDATE_SESSION_PARTITION,
} from './network';
import type {
  UpdateAdapter,
  UpdateCheckOutcome,
  UpdateDownloadRequest,
} from './service';

/** Resultado de intentar construir el adaptador. */
export type ElectronUpdateAdapterResult =
  | { readonly kind: 'ready'; readonly adapter: UpdateAdapter }
  | {
      readonly kind: 'disabled';
      readonly reason: UpdateUnavailableReason;
    };

export interface ElectronUpdateAdapterOptions {
  /** Carpeta `resources` de la aplicación empaquetada. */
  readonly resourcesPath: string;
}

function isDownloadedResult(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Construye el adaptador o indica por qué no puede usarse.
 *
 * No lanza: cualquier fallo de importación, configuración o sesión se traduce
 * en un motivo estable para que la aplicación siga arrancando.
 */
export async function createElectronUpdateAdapter(
  options: ElectronUpdateAdapterOptions,
): Promise<ElectronUpdateAdapterResult> {
  if (!existsSync(join(options.resourcesPath, APP_UPDATE_CONFIG_FILE_NAME))) {
    return { kind: 'disabled', reason: 'not-configured' };
  }

  const updateSession = session.fromPartition(UPDATE_SESSION_PARTITION, {
    cache: false,
  });

  installUpdateSessionGuards(updateSession);

  autoUpdater.autoDownload = UPDATE_ADAPTER_OPTIONS.autoDownload;
  autoUpdater.autoInstallOnAppQuit =
    UPDATE_ADAPTER_OPTIONS.autoInstallOnAppQuit;
  autoUpdater.allowPrerelease = UPDATE_ADAPTER_OPTIONS.allowPrerelease;
  autoUpdater.allowDowngrade = UPDATE_ADAPTER_OPTIONS.allowDowngrade;
  autoUpdater.fullChangelog = UPDATE_ADAPTER_OPTIONS.fullChangelog;
  autoUpdater.disableWebInstaller = UPDATE_ADAPTER_OPTIONS.disableWebInstaller;
  autoUpdater.logger = null;

  // electron-updater emite `error` antes de rechazar la promesa. Sin un
  // listener, el EventEmitter de Node tumbaría el proceso principal.
  const swallowError = (): void => {};
  autoUpdater.on('error', swallowError);

  if (autoUpdater.netSession !== updateSession) {
    autoUpdater.removeListener('error', swallowError);
    return { kind: 'disabled', reason: 'not-configured' };
  }

  const adapter: UpdateAdapter = {
    async check(): Promise<UpdateCheckOutcome> {
      const result = await autoUpdater.checkForUpdates();

      if (result === null) {
        throw new Error('El actualizador no está activo.');
      }

      return result.isUpdateAvailable
        ? { available: true, version: result.updateInfo.version }
        : { available: false, version: null };
    },

    async download(
      request: UpdateDownloadRequest,
    ): Promise<'downloaded' | 'cancelled'> {
      const onProgress = (progress: ProgressInfo): void => {
        request.onProgress(progress.percent);
      };

      autoUpdater.on('download-progress', onProgress);

      try {
        const result: unknown = await autoUpdater.downloadUpdate(request.token);

        if (request.token.cancelled) {
          return 'cancelled';
        }

        if (!isDownloadedResult(result)) {
          throw new Error('La descarga no devolvió archivos.');
        }

        return 'downloaded';
      } catch (error) {
        if (request.token.cancelled) {
          return 'cancelled';
        }

        throw error;
      } finally {
        autoUpdater.removeListener('download-progress', onProgress);
      }
    },

    install(): void {
      autoUpdater.quitAndInstall(true, true);
    },

    dispose(): void {
      // El listener de `error` se conserva hasta que termine el proceso: una
      // comprobación o descarga en vuelo puede emitir un error después de
      // `before-quit`; sin listener, el EventEmitter de Node lo trataría como
      // una excepción no controlada en el proceso principal.
    },
  };

  return { kind: 'ready', adapter };
}
