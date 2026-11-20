import { describe, expect, it } from 'vitest';

import { createI18n } from '@/renderer/i18n/create';
import {
  getUpdatePrimaryAction,
  getUpdateStatusMessage,
} from '@/renderer/updates/status';
import { createIdleUpdateSnapshot } from '@/shared/contracts/updates';

const idle = createIdleUpdateSnapshot('0.1.0');
const i18n = createI18n('es');

describe('textos del panel de actualizaciones', () => {
  it('describe el estado y la acción de cada fase', () => {
    expect(getUpdateStatusMessage({ ...idle, phase: 'idle' }, i18n)).toBe(
      'Listo para buscar actualizaciones.',
    );
    expect(getUpdatePrimaryAction({ ...idle, phase: 'idle' }, i18n)).toBe(
      'Buscar actualizaciones',
    );

    expect(
      getUpdateStatusMessage({ ...idle, phase: 'checking' }, i18n),
    ).toContain('Buscando');
    expect(getUpdatePrimaryAction({ ...idle, phase: 'checking' }, i18n)).toBe(
      'Cancelar',
    );

    expect(
      getUpdateStatusMessage({ ...idle, phase: 'up-to-date' }, i18n),
    ).toContain('0.1.0');

    expect(
      getUpdateStatusMessage(
        {
          ...idle,
          phase: 'available',
          availableVersion: '0.2.0',
        },
        i18n,
      ),
    ).toContain('0.2.0');
    expect(
      getUpdatePrimaryAction(
        {
          ...idle,
          phase: 'available',
          availableVersion: '0.2.0',
        },
        i18n,
      ),
    ).toBe('Descargar actualización');

    expect(
      getUpdateStatusMessage(
        {
          ...idle,
          phase: 'downloading',
          availableVersion: '0.2.0',
          progressPercent: 42,
        },
        i18n,
      ).replace(/\u00a0/g, ' '),
    ).toContain('42 %');

    expect(
      getUpdateStatusMessage(
        {
          ...idle,
          phase: 'downloaded',
          availableVersion: '0.2.0',
        },
        i18n,
      ),
    ).toContain('descargada');
    expect(
      getUpdatePrimaryAction(
        {
          ...idle,
          phase: 'downloaded',
          availableVersion: '0.2.0',
        },
        i18n,
      ),
    ).toBe('Reiniciar e instalar');

    expect(
      getUpdateStatusMessage({ ...idle, phase: 'installing' }, i18n),
    ).toContain('reiniciará');
    expect(
      getUpdatePrimaryAction({ ...idle, phase: 'installing' }, i18n),
    ).toBeNull();
  });

  it('explica los motivos de indisponibilidad', () => {
    for (const [reason, expected] of [
      ['not-packaged', 'versión instalada'],
      ['safe-mode', 'modo seguro'],
      ['not-configured', 'configuración'],
      ['module-missing', 'componente'],
    ] as const) {
      expect(
        getUpdateStatusMessage(
          {
            ...idle,
            phase: 'unavailable',
            unavailableReason: reason,
          },
          i18n,
        ),
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
      const message = getUpdateStatusMessage(
        {
          ...idle,
          phase: 'error',
          errorCode,
        },
        i18n,
      );

      expect(message).toContain(expected);
      expect(message).not.toContain('UPDATE_');
    }

    expect(getUpdatePrimaryAction({ ...idle, phase: 'error' }, i18n)).toBe(
      'Volver a intentar',
    );
  });
});
