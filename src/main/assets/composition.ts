/**
 * Composición Electron del protocolo de assets.
 *
 * Resuelve `userData`, la conexión compartida y el log de assets para construir
 * las dependencias del handler. El esquema se registra a nivel de módulo, antes
 * de `app.whenReady`; el handler solo se instala cuando la base está en estado
 * `ready`. En modo seguro no se registra ninguna vía de lectura.
 */
import { app, protocol } from 'electron';

import type { WorldCraftDatabase } from '../db/client';
import { resolveDataPaths } from '../db/paths';
import { getDatabase } from '../persistence';
import { createAssetLogger, type AssetLogger } from './logger';
import {
  registerAssetProtocol,
  registerAssetScheme,
  type AssetProtocolHost,
  type AssetRequestDependencies,
} from './protocol';
import { assertAssetRoot } from './paths';
import { createAssetRepository } from './store';

/** Adaptador estructural sobre el `protocol` de Electron. */
export function createAssetProtocolHost(): AssetProtocolHost {
  return {
    registerSchemesAsPrivileged(schemes) {
      protocol.registerSchemesAsPrivileged(
        schemes.map(({ scheme, privileges }) =>
          privileges === undefined
            ? { scheme }
            : { scheme, privileges: { ...privileges } },
        ),
      );
    },

    handle(scheme, handler) {
      protocol.handle(scheme, (request) => handler({ url: request.url }));
    },
  };
}

/** Construye las dependencias del handler con rutas ya validadas. */
export function createAssetRequestDependencies(options: {
  readonly userDataDir: string;
  readonly database: WorldCraftDatabase;
  readonly logger?: AssetLogger;
}): AssetRequestDependencies {
  const paths = resolveDataPaths(options.userDataDir);

  // La raíz de assets no puede ser un enlace que la saque de `userData`.
  assertAssetRoot(paths.userDataDir, paths.assetsDir);

  return {
    assetsDir: paths.assetsDir,
    repository: createAssetRepository(options.database),
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  };
}

/**
 * Registra el esquema `wc-asset`.
 *
 * Debe llamarse antes de `app.whenReady`; si se registra después, Electron no
 * lo aplica a la sesión.
 */
export function registerLocalAssetScheme(): void {
  registerAssetScheme(createAssetProtocolHost());
}

/**
 * Instala el handler del protocolo cuando la base está lista.
 *
 * Un fallo de composición no se propaga: la ventana sigue siendo utilizable sin
 * assets y el error no contiene rutas.
 */
export function registerLocalAssetProtocol(): void {
  try {
    const paths = resolveDataPaths(app.getPath('userData'));

    registerAssetProtocol(
      createAssetProtocolHost(),
      createAssetRequestDependencies({
        userDataDir: paths.userDataDir,
        database: getDatabase().orm,
        logger: createAssetLogger(paths.assetsLogFile),
      }),
    );
  } catch {
    console.error('No se pudo registrar el protocolo de assets locales.');
  }
}
