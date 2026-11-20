/**
 * Bloqueo de instancia única.
 *
 * Se adquiere antes de `app.whenReady()` y antes de tocar la base, el IPC o la
 * ventana. Si otra instancia ya tiene el lock, el proceso que arranca no
 * inicializa nada y se cierra; la instancia existente recibe `second-instance`
 * y enfoca su ventana. El lock está activo también en desarrollo.
 *
 * El módulo recibe una interfaz mínima para poder probarse sin Electron.
 */

/** Parte de `app` que necesita el bloqueo. */
export interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  on(event: 'second-instance', listener: () => void): unknown;
}

export interface SingleInstanceOptions {
  /** Enfoca o restaura la ventana principal. */
  readonly focusMainWindow: () => void;
}

/**
 * Intenta adquirir el lock y registra el foco de la segunda instancia.
 *
 * @returns `true` si este proceso es la instancia principal; `false` si ya
 * había otra instancia y no se debe inicializar nada.
 */
export function acquireSingleInstance(
  app: SingleInstanceApp,
  options: SingleInstanceOptions,
): boolean {
  const acquired = app.requestSingleInstanceLock();

  if (!acquired) {
    return false;
  }

  app.on('second-instance', () => {
    options.focusMainWindow();
  });

  return true;
}
