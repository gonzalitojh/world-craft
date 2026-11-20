import { describe, expect, it } from 'vitest';

import {
  getUpdatePrimaryAction,
  getUpdateStatusMessage,
} from '@/renderer/updates/status';
import { createIdleUpdateSnapshot } from '@/shared/contracts/updates';

const idle = createIdleUpdateSnapshot('0.1.0');

describe('textos del panel de actualizaciones', () => {
  it('describe el estado y la acción de cada fase', () => {
    expect(getUpdateStatusMessage({ ...idle, phase: 'idle' })).toBe(
      'Listo para buscar actualizaciones.',
    );
    expect(getUpdatePrimaryAction({ ...idle, phase: 'idle' })).toBe(
      'Buscar actualizaciones',
    );

    expect(getUpdateStatusMessage({ ...idle, phase: 'checking' })).toContain(
      'Buscando',
    );
    expect(getUpdatePrimaryAction({ ...idle, phase: 'checking' })).toBe(
      'Cancelar',
    );

    expect(getUpdateStatusMessage({ ...idle, phase: 'up-to-date' })).toContain(
      '0.1.0',
    );

    expect(
      getUpdateStatusMessage({
        ...idle,
        phase: 'available',
        availableVersion: '0.2.0',
      }),
    ).toContain('0.2.0');
    expect(
      getUpdatePrimaryAction({
        ...idle,
        phase: 'available',
        availableVersion: '0.2.0',
      }),
    ).toBe('Descargar actualización');

    expect(
      getUpdateStatusMessage({
        ...idle,
        phase: 'downloading',
        availableVersion: '0.2.0',
        progressPercent: 42,
      }),
    ).toContain('42 %');

    expect(
      getUpdateStatusMessage({
        ...idle,
        phase: 'downloaded',
        availableVersion: '0.2.0',
      }),
    ).toContain('descargada');
    expect(
      getUpdatePrimaryAction({
        ...idle,
        phase: 'downloaded',
        availableVersion: '0.2.0',
      }),
    ).toBe('Reiniciar e instalar');

    expect(getUpdateStatusMessage({ ...idle, phase: 'installing' })).toContain(
      'reiniciará',
    );
    expect(getUpdatePrimaryAction({ ...idle, phase: 'installing' })).toBeNull();
  });

  it('explica los motivos de indisponibilidad', () => {
    for (const [reason, expected] of [
      ['not-packaged', 'versión instalada'],
      ['safe-mode', 'modo seguro'],
      ['not-configured', 'configuración'],
      ['module-missing', 'componente'],
    ] as const) {
      expect(
        getUpdateStatusMessage({
          ...idle,
          phase: 'unavailable',
          unavailableReason: reason,
        }),
      ).toContain(expected);
    }
  });

  it('traduce los errores por código y oculta el código interno', () => {
    for (const [errorCode, expected] of [
      ['UPDATE_CHECK_FAILED', 'No se pudo comprobar'],
      ['UPDATE_DOWNLOAD_FAILED', 'No se pudo descargar'],
      ['UPDATE_INSTALL_FAILED', 'No se pudo iniciar la instalación'],
      ['UPDATE_INVALID_STATE', 'no está disponible'],
    ] as const) {
      const message = getUpdateStatusMessage({
        ...idle,
        phase: 'error',
        errorCode,
      });

      expect(message).toContain(expected);
      expect(message).not.toContain('UPDATE_');
    }

    expect(getUpdatePrimaryAction({ ...idle, phase: 'error' })).toBe(
      'Volver a intentar',
    );
  });
});
