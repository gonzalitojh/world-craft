/**
 * Composición Electron del actualizador.
 *
 * Solo se intenta activar en la versión instalada y fuera del modo seguro. Un
 * fallo al importar electron-updater, una configuración ausente o una sesión
 * de red inesperada dejan el servicio deshabilitado con un motivo estable; el
 * arranque de la aplicación nunca depende de que el updater funcione.
 */
import { join } from 'node:path';

import type { UpdateUnavailableReason } from '../../shared/contracts/updates';
import { createUpdateLogger } from './logger';
import {
  createUnavailableUpdatesService,
  createUpdatesService,
  type UpdatesService,
} from './service';

export interface UpdatesCompositionOptions {
  readonly isPackaged: boolean;
  readonly safeMode: boolean;
  readonly userDataDir: string;
  /** Carpeta `resources` de la app empaquetada (`process.resourcesPath`). */
  readonly resourcesPath: string;
  readonly currentVersion: string;
  readonly now?: () => number;
}

/** Servicio compuesto y su liberación ordenada. */
export interface UpdatesComposition {
  readonly service: UpdatesService;
  dispose(): void;
}

function createDisabledComposition(
  reason: UpdateUnavailableReason,
  options: UpdatesCompositionOptions,
): UpdatesComposition {
  const logger = createUpdateLogger(
    join(options.userDataDir, 'logs', 'updates.log'),
    options.now,
  );

  logger.log({ event: 'update.composition', outcome: 'disabled', reason });

  return {
    service: createUnavailableUpdatesService({
      reason,
      currentVersion: options.currentVersion,
    }),
    dispose: () => {},
  };
}

/**
 * Construye el servicio, habilitado o no, sin lanzar.
 */
export async function composeUpdates(
  options: UpdatesCompositionOptions,
): Promise<UpdatesComposition> {
  if (!options.isPackaged) {
    return createDisabledComposition('not-packaged', options);
  }

  if (options.safeMode) {
    return createDisabledComposition('safe-mode', options);
  }

  const logger = createUpdateLogger(
    join(options.userDataDir, 'logs', 'updates.log'),
    options.now,
  );

  try {
    const { createElectronUpdateAdapter } = await import('./electron-adapter');
    const result = await createElectronUpdateAdapter({
      resourcesPath: options.resourcesPath,
    });

    if (result.kind === 'disabled') {
      logger.log({
        event: 'update.composition',
        outcome: 'disabled',
        reason: result.reason,
      });

      return {
        service: createUnavailableUpdatesService({
          reason: result.reason,
          currentVersion: options.currentVersion,
        }),
        dispose: () => {},
      };
    }

    logger.log({ event: 'update.composition', outcome: 'enabled' });

    const service = createUpdatesService({
      adapter: result.adapter,
      currentVersion: options.currentVersion,
      logger,
      ...(options.now === undefined ? {} : { now: options.now }),
    });

    return {
      service,
      dispose: () => {
        service.dispose();
      },
    };
  } catch {
    logger.log({
      event: 'update.composition',
      outcome: 'disabled',
      reason: 'module-missing',
    });

    return {
      service: createUnavailableUpdatesService({
        reason: 'module-missing',
        currentVersion: options.currentVersion,
      }),
      dispose: () => {},
    };
  }
}
