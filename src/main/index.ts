/**
 * Punto de entrada del proceso principal.
 *
 * Activa el sandbox antes de crear ninguna ventana, registra los guards de
 * navegación y de sesión, y arranca la ventana única de la aplicación.
 */
import { app, BrowserWindow, session } from 'electron';

import { APP_ID } from '../shared/app-info';
import { registerNavigationGuards } from './security/navigation';
import { registerSessionGuards } from './security/session';
import { createMainWindow } from './window';

app.enableSandbox();
app.setAppUserModelId(APP_ID);

app.on('web-contents-created', (_event, contents) => {
  // Electron identifica los DevTools con el tipo `remote`. Al resto de
  // webContents (ventanas, webviews, browser views y procesos auxiliares) se
  // les aplican los guards como defensa en profundidad.
  if (contents.getType() !== 'remote') {
    registerNavigationGuards(contents);
  }
});

void app.whenReady().then(() => {
  registerSessionGuards(session.defaultSession, {
    development: !app.isPackaged,
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
