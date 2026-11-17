import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupErrorCode, logCleanupError } from '@/lib/assets/cleanup';
import { StorageError } from '@/lib/storage';

describe('registro de fallos de limpieza', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('traduce errores de dominio, códigos de Node y estados HTTP', () => {
    expect(cleanupErrorCode(new StorageError('unavailable', 'fallo'))).toBe(
      'unavailable',
    );
    expect(cleanupErrorCode({ code: 'ENOENT' })).toBe('ENOENT');
    expect(cleanupErrorCode({ $metadata: { httpStatusCode: 403 } })).toBe(
      'http_403',
    );
    expect(cleanupErrorCode(new Error('respuesta cruda del proveedor'))).toBe(
      'unknown',
    );
  });

  it('registra solo la clave y un código seguro', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logCleanupError({
      key: 'world/1111/2222.webp',
      error: new StorageError('unavailable', 'secreto interno'),
    });

    expect(warn).toHaveBeenCalledWith('storage.cleanup_failed', {
      key: 'world/1111/2222.webp',
      code: 'unavailable',
    });
  });
});
