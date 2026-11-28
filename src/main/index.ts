/**
 * Punto de entrada del proceso principal.
 *
 * Adquiere el lock de instancia única antes de `whenReady`, fija el nombre de
 * la aplicación antes de resolver `userData`, activa el sandbox antes de crear
 * ninguna ventana, registra los guards de navegación y de sesión, arranca la
 * base local, compone el actualizador solo tras la persistencia y fuera del
 * modo seguro, y abre la ventana única. Sin el lock no se inicializa nada.
 */
import { app, BrowserWindow, ipcMain, session, shell } from 'electron';

import { APP_ID, APP_NAME } from '../shared/app-info';
import {
  DEFAULT_UI_PREFERENCES,
  type ThemePreference,
} from '../shared/contracts/preferences';
import { TRANSFER_EVENT_CHANNEL } from '../shared/contracts/transfer';
import { UPDATE_STATE_CHANGED_CHANNEL } from '../shared/contracts/updates';
import {
  registerLocalAssetProtocol,
  registerLocalAssetScheme,
} from './assets/composition';
import { pickImageFiles } from './assets/dialog';
import {
  createAssetsLogger,
  createAssetsService,
  createUnavailableAssetsService,
} from './assets/service';
import { createAssetRepository } from './assets/store';
import { createPrePurgeBackup } from './backup/create';
import { createDataComposition } from './data/composition';
import { createUnavailableDataService } from './data/unavailable';
import { readUserVersion } from './db/connection';
import { resolveDataPaths, type DataPaths } from './db/paths';
import {
  createEntitiesService,
  createUnavailableEntitiesService,
} from './entities/service';
import {
  createEntityTypesService,
  createUnavailableEntityTypesService,
} from './entity-types/service';
import { createIpcHandlers } from './ipc/handlers';
import { registerIpcHandlers } from './ipc/registry';
import {
  createPreferencesService,
  createUnavailablePreferencesService,
} from './preferences/service';
import {
  createRelationsService,
  createUnavailableRelationsService,
} from './relations/service';
import {
  createSearchService,
  createUnavailableSearchService,
} from './search/service';
import {
  createSpikeExportStore,
  createUnavailableSpikeExportStore,
} from './spike-maps/export-store';
import {
  createTrashService,
  createUnavailableTrashService,
} from './trash/service';
import {
  createUnavailableVersionsService,
  createVersionRecorder,
  createVersionsService,
} from './versions/service';
import {
  closePersistence,
  getDatabase,
  initializePersistence,
} from './persistence';
import { registerNavigationGuards } from './security/navigation';
import { registerSessionGuards } from './security/session';
import { acquireSingleInstance } from './single-instance';
import { composeUpdates, type UpdatesComposition } from './updates/composition';
import { createUnavailableUpdatesService } from './updates/service';
import { createTransferCoordinator } from './transfer/composition';
import type { TransferCoordinator } from './transfer/coordinator';
import { createTransferLogger } from './transfer/logger';
import { createUnavailableTransferCoordinator } from './transfer/unavailable-coordinator';
import {
  createUnavailableWorldsService,
  createWorldsService,
} from './worlds/service';
import {
  applyAppTheme,
  createMainWindow,
  focusMainWindow,
  getCurrentTheme,
  getMainWindow,
} from './window';

// El nombre debe fijarse antes de llamar a `app.getPath('userData')`: define la
// carpeta de datos que el instalador y el desinstalador nunca tocan.
app.setName(APP_NAME);
app.enableSandbox();
app.setAppUserModelId(APP_ID);

const hasSingleInstanceLock = acquireSingleInstance(
  {
    requestSingleInstanceLock: () => app.requestSingleInstanceLock(),
    on: (event, listener) => {
      app.on(event, listener);
    },
  },
  { focusMainWindow },
);

if (!hasSingleInstanceLock) {
  // Otra instancia ya está en marcha: este proceso no toca la base, el IPC ni
  // la ventana. `second-instance` enfocará la ventana existente.
  app.quit();
} else {
  // El esquema debe registrarse antes de `whenReady`; el handler del protocolo
  // se instala más abajo, solo si la base arranca en estado `ready`.
  registerLocalAssetScheme();

  /**
   * Único punto que abre enlaces en el navegador del sistema. Los destinos ya
   * vienen validados por `resolveExternalUrl`.
   */
  const openExternal = (url: string): Promise<void> => shell.openExternal(url);

  app.on('web-contents-created', (_event, contents) => {
    // Electron identifica los DevTools con el tipo `remote`. Al resto de
    // webContents (ventanas, webviews, browser views y procesos auxiliares) se
    // les aplican los guards como defensa en profundidad.
    if (contents.getType() !== 'remote') {
      registerNavigationGuards(contents, { openExternal });
    }
  });

  let updates: UpdatesComposition | null = null;
  let transfer: TransferCoordinator | null = null;

  void app
    .whenReady()
    .then(async () => {
      registerSessionGuards(session.defaultSession, {
        development: !app.isPackaged,
      });

      // La ventana no se crea hasta terminar la comprobación y las migraciones.
      const startup = await initializePersistence();

      if (startup.status === 'safe-mode' && startup.decision === 'exit') {
        // La decisión de salir no abre ventana ni registra IPC: no debe quedar
        // ninguna vía de escritura activa.
        app.quit();
        return;
      }

      if (startup.status === 'ready') {
        // Sin base no hay rutas de asset que resolver: en modo seguro el
        // protocolo no se registra.
        registerLocalAssetProtocol();
      }

      // El updater se compone después de la persistencia y nunca en modo
      // seguro. Un fallo de composición deja un servicio deshabilitado y no
      // impide abrir la aplicación.
      try {
        updates = await composeUpdates({
          isPackaged: app.isPackaged,
          safeMode: startup.status !== 'ready',
          userDataDir: app.getPath('userData'),
          resourcesPath: process.resourcesPath,
          currentVersion: app.getVersion(),
        });
      } catch {
        updates = {
          service: createUnavailableUpdatesService({
            reason: 'module-missing',
            currentVersion: app.getVersion(),
          }),
          dispose: () => {},
        };
      }

      const updatesService = updates.service;

      updatesService.subscribe((snapshot) => {
        const window = getMainWindow();

        if (window !== null) {
          window.webContents.send(UPDATE_STATE_CHANGED_CHANNEL, snapshot);
        }
      });

      const database = startup.status === 'ready' ? getDatabase() : null;
      // Incluso en modo seguro se pueden abrir carpetas si la ruta de
      // `userData` es válida; no se toca la base.
      const dataPaths: DataPaths | null = (() => {
        try {
          return resolveDataPaths(app.getPath('userData'));
        } catch {
          return null;
        }
      })();

      const transferCoordinator =
        database === null || dataPaths === null
          ? createUnavailableTransferCoordinator()
          : createTransferCoordinator({
              database: database.orm,
              sqlite: database.sqlite,
              databaseFile: dataPaths.databaseFile,
              assetsDir: dataPaths.assetsDir,
              importsDir: dataPaths.importsDir,
              assetsTempDir: dataPaths.assetsTempDir,
              assetsWorldsDir: dataPaths.assetsWorldsDir,
              appVersion: app.getVersion(),
              schemaVersion: readUserVersion(database.sqlite),
              logger: createTransferLogger(dataPaths.transferLogFile),
            });

      // El laboratorio de mapas no toca la base: el store solo necesita una
      // ruta userData válida y no se compone en modo seguro.
      const mapsSpikeExports = (() => {
        if (database === null || dataPaths === null) {
          return createUnavailableSpikeExportStore();
        }

        try {
          return createSpikeExportStore({
            userDataDir: dataPaths.userDataDir,
          });
        } catch {
          return createUnavailableSpikeExportStore();
        }
      })();

      transfer = transferCoordinator;
      transferCoordinator.subscribe((event) => {
        const window = getMainWindow();

        if (window !== null) {
          window.webContents.send(TRANSFER_EVENT_CHANNEL, event);
        }
      });

      const entityTypes =
        database === null
          ? createUnavailableEntityTypesService()
          : createEntityTypesService({
              database: database.orm,
              sqlite: database.sqlite,
            });
      const versions =
        database === null
          ? createUnavailableVersionsService()
          : createVersionsService({
              database: database.orm,
              sqlite: database.sqlite,
            });
      const versionRecorder =
        database === null
          ? null
          : createVersionRecorder({
              database: database.orm,
              sqlite: database.sqlite,
            });
      const entities =
        database === null
          ? createUnavailableEntitiesService()
          : createEntitiesService({
              database: database.orm,
              sqlite: database.sqlite,
              ...(versionRecorder === null
                ? {}
                : { versions: versionRecorder }),
            });
      const trash =
        database === null
          ? createUnavailableTrashService()
          : createTrashService({
              database: database.orm,
              sqlite: database.sqlite,
              createSafetyCopy: async (timestamp) => {
                try {
                  const paths = resolveDataPaths(app.getPath('userData'));

                  await createPrePurgeBackup({
                    database: database.sqlite,
                    backupRootDir: paths.prePurgeBackupsDir,
                    timestamp,
                    schemaVersion: readUserVersion(database.sqlite),
                  });

                  return true;
                } catch {
                  return false;
                }
              },
            });
      const assets =
        database === null
          ? createUnavailableAssetsService()
          : createAssetsService({
              userDataDir: app.getPath('userData'),
              repository: createAssetRepository(database.orm),
              logger: createAssetsLogger(app.getPath('userData')),
            });
      const relations =
        database === null
          ? createUnavailableRelationsService()
          : createRelationsService({
              database: database.orm,
              sqlite: database.sqlite,
            });
      const search =
        database === null
          ? createUnavailableSearchService()
          : createSearchService({ sqlite: database.sqlite });
      const preferences =
        database === null
          ? createUnavailablePreferencesService({
              onThemeChanged: applyAppTheme,
            })
          : createPreferencesService({
              database: database.orm,
              sqlite: database.sqlite,
              onThemeChanged: applyAppTheme,
            });
      const worlds =
        database === null
          ? createUnavailableWorldsService()
          : createWorldsService({
              database: database.orm,
              sqlite: database.sqlite,
              onDuplicate: (sourceWorldId, targetWorldId, at) =>
                entityTypes.copyFromWorld(sourceWorldId, targetWorldId, at),
            });

      const data =
        database === null || dataPaths === null
          ? createUnavailableDataService({
              paths: dataPaths,
              openPath: (path) => shell.openPath(path),
            })
          : createDataComposition({
              database: database.orm,
              sqlite: database.sqlite,
              paths: dataPaths,
              assets: createAssetRepository(database.orm),
              preferences,
              worlds,
              transfer: transferCoordinator,
              updates,
              closePersistence,
              openPath: (path) => shell.openPath(path),
              appVersion: app.getVersion(),
              schemaVersion: readUserVersion(database.sqlite),
            });

      registerIpcHandlers(
        ipcMain,
        createIpcHandlers({
          openExternal,
          updates: updatesService,
          preferences,
          worlds,
          entityTypes,
          entities,
          relations,
          search,
          assets,
          trash,
          versions,
          transfer: transferCoordinator,
          mapsSpikeExports,
          data,
          pickImages: pickImageFiles,
        }),
      );

      // El tema se lee antes de crear la ventana. `get()` lanza si la consulta
      // falla; el `catch` aporta Claro sin bloquear el arranque ni ocultar el
      // error con datos inventados. En modo seguro `get()` ya devuelve Claro.
      let startupTheme: ThemePreference = DEFAULT_UI_PREFERENCES.theme;

      try {
        startupTheme = preferences.get().theme;
      } catch {
        // La base no respondió: se mantiene Claro sin bloquear el arranque.
      }

      createMainWindow(startupTheme);

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          // Una ventana recreada conserva el tema vivo de la sesión.
          createMainWindow(getCurrentTheme());
        }
      });
    })
    .catch(() => {
      // Un fallo inesperado de composición no debe dejar la app a medias ni
      // filtrar detalles: se cierra sin abrir la ventana.
      console.error('No se pudo inicializar la aplicación.');
      app.quit();
    });

  app.on('before-quit', () => {
    updates?.dispose();
    updates = null;
    transfer?.dispose();
    transfer = null;
    closePersistence();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
