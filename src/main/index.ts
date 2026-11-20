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
  closePersistence,
  getDatabase,
  initializePersistence,
} from './persistence';
import { registerNavigationGuards } from './security/navigation';
import { registerSessionGuards } from './security/session';
import { acquireSingleInstance } from './single-instance';
import { composeUpdates, type UpdatesComposition } from './updates/composition';
import { createUnavailableUpdatesService } from './updates/service';
import {
  createUnavailableWorldsService,
  createWorldsService,
} from './worlds/service';
import { createMainWindow, focusMainWindow, getMainWindow } from './window';

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
      const entityTypes =
        database === null
          ? createUnavailableEntityTypesService()
          : createEntityTypesService({
              database: database.orm,
              sqlite: database.sqlite,
            });
      const entities =
        database === null
          ? createUnavailableEntitiesService()
          : createEntitiesService({
              database: database.orm,
              sqlite: database.sqlite,
            });
      const assets =
        database === null
          ? createUnavailableAssetsService()
          : createAssetsService({
              userDataDir: app.getPath('userData'),
              repository: createAssetRepository(database.orm),
              logger: createAssetsLogger(app.getPath('userData')),
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

      registerIpcHandlers(
        ipcMain,
        createIpcHandlers({
          openExternal,
          updates: updatesService,
          worlds,
          entityTypes,
          entities,
          assets,
          pickImages: pickImageFiles,
        }),
      );

      createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createMainWindow();
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
    closePersistence();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
