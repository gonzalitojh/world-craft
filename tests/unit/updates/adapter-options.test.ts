import { describe, expect, it } from 'vitest';

import { UPDATE_ADAPTER_OPTIONS } from '@/main/updates/adapter-options';

describe('opciones de electron-updater', () => {
  it('no descarga ni instala automáticamente y solo acepta la versión estable', () => {
    expect(UPDATE_ADAPTER_OPTIONS).toEqual({
      autoDownload: false,
      autoInstallOnAppQuit: false,
      allowPrerelease: false,
      allowDowngrade: false,
      fullChangelog: false,
      disableWebInstaller: true,
    });
    expect(Object.isFrozen(UPDATE_ADAPTER_OPTIONS)).toBe(true);
  });
});
