/**
 * Punto de entrada del proceso principal.
 *
 * Fija el nombre de la aplicación antes de resolver `userData`, activa el
 * sandbox antes de crear ninguna ventana, registra los guards de navegación y
 * de sesión, arranca la base local, el router IPC y la ventana única.
 */
import { app, BrowserWindow, ipcMain, session, shell } from 'electron';

import { APP_ID, APP_NAME } from '../shared/app-info';
import { createIpcHandlers } from './ipc/handlers';
import { registerIpcHandlers } from './ipc/registry';
import { closePersistence, initializePersistence } from './persistence';
import { registerNavigationGuards } from './security/navigation';
import { registerSessionGuards } from './security/session';
import { createMainWindow } from './window';

// El nombre debe fijarse antes de llamar a `app.getPath('userData')`: define la
// carpeta de datos que el instalador y el desinstalador nunca tocan.
app.setName(APP_NAME);
app.enableSandbox();
app.setAppUserModelId(APP_ID);

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

    registerIpcHandlers(ipcMain, createIpcHandlers({ openExternal }));

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
  closePersistence();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
