import { describe, expect, it } from 'vitest';

import { createWindowOptions } from '@/main/window-options';

describe('window-options', () => {
  it('abre una ventana de escritorio de 1280x800 con mínimo 1024x700', () => {
    const options = createWindowOptions({
      preloadPath: 'C:\\datos\\preload.cjs',
      isPackaged: false,
      backgroundColor: '#f7f3ea',
    });

    expect(options.width).toBe(1280);
    expect(options.height).toBe(800);
    expect(options.minWidth).toBe(1024);
    expect(options.minHeight).toBe(700);
    expect(options.show).toBe(false);
  });

  it('aplica el aislamiento de seguridad del ADR 0004', () => {
    const options = createWindowOptions({
      preloadPath: 'C:\\datos\\preload.cjs',
      isPackaged: false,
      backgroundColor: '#f7f3ea',
    });

    expect(options.webPreferences).toMatchObject({
      preload: 'C:\\datos\\preload.cjs',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      spellcheck: false,
    });
  });

  it('solo habilita DevTools fuera de la versión empaquetada', () => {
    const base = {
      preloadPath: 'C:\\datos\\preload.cjs',
      backgroundColor: '#f7f3ea',
    };

    expect(
      createWindowOptions({ ...base, isPackaged: false }).webPreferences
        ?.devTools,
    ).toBe(true);
    expect(
      createWindowOptions({ ...base, isPackaged: true }).webPreferences
        ?.devTools,
    ).toBe(false);
  });
});
