import { describe, expect, it } from 'vitest';

import {
  createLocalRouteAdapter,
  createStorageAdapter,
  localStorageConfig,
  resolveStorageDriverName,
} from '@/lib/storage/driver';
import { resolveStorageEnv } from '@/lib/storage/env';
import { LocalStorageAdapter } from '@/lib/storage/local-adapter';
import { R2StorageAdapter } from '@/lib/storage/r2-adapter';
import { StorageError } from '@/lib/storage/types';

const R2_ENV = {
  R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_ACCESS_KEY_ID: 'b'.repeat(32),
  R2_SECRET_ACCESS_KEY: 'c'.repeat(64),
  R2_BUCKET_NAME: 'world-craft-dev',
} as const;

const fakeClient = { send: async () => ({}) };

describe('selección de driver', () => {
  it('usa local en desarrollo sin credenciales de R2', () => {
    const env = resolveStorageEnv({ NODE_ENV: 'development' });

    expect(resolveStorageDriverName(env)).toBe('local');
  });

  it('usa R2 en desarrollo cuando hay credenciales completas', () => {
    const env = resolveStorageEnv({ ...R2_ENV, NODE_ENV: 'development' });

    expect(resolveStorageDriverName(env)).toBe('r2');
  });

  it('usa R2 con endpoint aunque no haya cuenta', () => {
    const env = resolveStorageEnv({
      NODE_ENV: 'development',
      R2_ACCESS_KEY_ID: 'b'.repeat(32),
      R2_SECRET_ACCESS_KEY: 'c'.repeat(64),
      R2_BUCKET_NAME: 'world-craft-dev',
      R2_ENDPOINT: 'https://r2.example.test',
    });

    expect(resolveStorageDriverName(env)).toBe('r2');
    expect(createStorageAdapter(env, { r2Client: fakeClient })).toBeInstanceOf(
      R2StorageAdapter,
    );
  });

  it('respeta el driver explícito', () => {
    expect(
      resolveStorageDriverName(
        resolveStorageEnv({ ...R2_ENV, STORAGE_DRIVER: 'local' }),
      ),
    ).toBe('local');
    expect(
      resolveStorageDriverName(
        resolveStorageEnv({ NODE_ENV: 'development', STORAGE_DRIVER: 'r2' }),
      ),
    ).toBe('r2');
  });

  it('usa R2 en producción aunque no haya credenciales', () => {
    const env = resolveStorageEnv({ NODE_ENV: 'production' });

    expect(resolveStorageDriverName(env)).toBe('r2');
  });
});

describe('createStorageAdapter', () => {
  it('devuelve el adaptador local en desarrollo', () => {
    const adapter = createStorageAdapter(
      resolveStorageEnv({ NODE_ENV: 'development' }),
    );

    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('devuelve el adaptador R2 cuando hay credenciales', () => {
    const adapter = createStorageAdapter(
      resolveStorageEnv({ ...R2_ENV, NODE_ENV: 'development' }),
      { r2Client: fakeClient },
    );

    expect(adapter).toBeInstanceOf(R2StorageAdapter);
  });

  it('falla cerrado si el driver explícito es R2 y faltan credenciales', () => {
    const env = resolveStorageEnv({
      NODE_ENV: 'development',
      STORAGE_DRIVER: 'r2',
    });

    expect(() => createStorageAdapter(env)).toThrow(StorageError);
    expect(() => createStorageAdapter(env)).toThrow(/R2_ACCOUNT_ID/);
  });

  it('prohíbe el driver local en producción', () => {
    const env = resolveStorageEnv({
      NODE_ENV: 'production',
      STORAGE_DRIVER: 'local',
    });

    expect(() => createStorageAdapter(env)).toThrow(/prohibido en producción/);
  });

  it('falla cerrado en producción sin credenciales de R2', () => {
    const env = resolveStorageEnv({ NODE_ENV: 'production' });

    expect(() => createStorageAdapter(env)).toThrow(StorageError);
  });

  it('aplica el directorio local configurado', () => {
    const env = resolveStorageEnv({
      NODE_ENV: 'development',
      STORAGE_LOCAL_DIR: '.local/otro',
    });
    const adapter = createStorageAdapter(env);

    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    expect((adapter as LocalStorageAdapter).rootDirectory).toContain('otro');
  });

  it('el secreto explícito manda sobre el archivo', () => {
    const config = localStorageConfig(
      resolveStorageEnv({
        NODE_ENV: 'development',
        STORAGE_LOCAL_SECRET: 'x'.repeat(32),
      }),
    );

    expect(config.secret).toBe('x'.repeat(32));
  });

  it('permite cambiar el origen de las URLs locales', () => {
    const config = localStorageConfig(
      resolveStorageEnv({
        NODE_ENV: 'development',
        STORAGE_LOCAL_BASE_URL: 'http://localhost:4000',
      }),
    );

    expect(config.baseUrl).toBe('http://localhost:4000');
  });
});

describe('createLocalRouteAdapter', () => {
  it('existe en desarrollo con driver local', () => {
    const adapter = createLocalRouteAdapter(
      resolveStorageEnv({ NODE_ENV: 'development' }),
    );

    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('no existe en producción', () => {
    const adapter = createLocalRouteAdapter(
      resolveStorageEnv({ ...R2_ENV, NODE_ENV: 'production' }),
    );

    expect(adapter).toBeUndefined();
  });

  it('no existe si el driver efectivo es R2', () => {
    const adapter = createLocalRouteAdapter(
      resolveStorageEnv({ ...R2_ENV, NODE_ENV: 'development' }),
    );

    expect(adapter).toBeUndefined();
  });
});
