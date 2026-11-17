import { describe, expect, it } from 'vitest';

import {
  assertR2Configured,
  DEFAULT_STORAGE_LOCAL_DIR,
  missingR2Variables,
  parseStorageEnv,
  resolveStorageBucketName,
  resolveStorageEnv,
  storageEnvSchema,
} from '@/lib/storage/env';
import { StorageError } from '@/lib/storage/types';

const R2_ENV = {
  R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_ACCESS_KEY_ID: 'b'.repeat(32),
  R2_SECRET_ACCESS_KEY: 'c'.repeat(64),
  R2_BUCKET_NAME: 'world-craft-dev',
} as const;

describe('esquema de entorno de almacenamiento', () => {
  it('trata las cadenas vacías como ausentes', () => {
    const env = parseStorageEnv({
      STORAGE_DRIVER: '',
      R2_BUCKET_NAME: '',
      STORAGE_LOCAL_DIR: '',
    });

    expect(env.STORAGE_DRIVER).toBeUndefined();
    expect(env.R2_BUCKET_NAME).toBeUndefined();
    expect(env.STORAGE_LOCAL_DIR).toBeUndefined();
    expect(env.NODE_ENV).toBe('development');
  });

  it('acepta un driver y un bucket válidos', () => {
    const env = parseStorageEnv({ ...R2_ENV, STORAGE_DRIVER: 'r2' });

    expect(env.STORAGE_DRIVER).toBe('r2');
    expect(env.R2_BUCKET_NAME).toBe('world-craft-dev');
  });

  it('rechaza un driver desconocido', () => {
    expect(() => parseStorageEnv({ STORAGE_DRIVER: 'ftp' })).toThrow();
  });

  it('rechaza un bucket con mayúsculas o demasiado corto', () => {
    expect(() =>
      parseStorageEnv({ ...R2_ENV, R2_BUCKET_NAME: 'World-Craft' }),
    ).toThrow();
    expect(() =>
      parseStorageEnv({ ...R2_ENV, R2_BUCKET_NAME: 'ab' }),
    ).toThrow();
  });

  it('rechaza un endpoint que no sea http(s)', () => {
    expect(() =>
      parseStorageEnv({ ...R2_ENV, R2_ENDPOINT: 'ftp://r2.example' }),
    ).toThrow();
  });

  it('rechaza un identificador de cuenta que no sea hexadecimal de 32', () => {
    expect(() =>
      parseStorageEnv({ ...R2_ENV, R2_ACCOUNT_ID: 'cuenta-de-prueba' }),
    ).toThrow();
    expect(
      parseStorageEnv({ ...R2_ENV, R2_ACCOUNT_ID: 'A'.repeat(32) })
        .R2_ACCOUNT_ID,
    ).toBe('A'.repeat(32));
  });

  it('ignora claves ajenas al almacenamiento', () => {
    const env = parseStorageEnv({
      ...R2_ENV,
      DATABASE_URL: 'postgres://user:pass@example.test/db',
    });

    expect(env).not.toHaveProperty('DATABASE_URL');
    expect(storageEnvSchema.safeParse({ SECRET: 'x' }).success).toBe(false);
  });

  it('valida VERCEL_ENV y trata la cadena vacía como ausente', () => {
    expect(parseStorageEnv({ VERCEL_ENV: 'preview' }).VERCEL_ENV).toBe(
      'preview',
    );
    expect(parseStorageEnv({ VERCEL_ENV: '' }).VERCEL_ENV).toBeUndefined();
    expect(() => parseStorageEnv({ VERCEL_ENV: 'qa' })).toThrow();
  });

  it('valida el origen de las URLs locales', () => {
    expect(
      parseStorageEnv({ STORAGE_LOCAL_BASE_URL: 'http://localhost:4000' })
        .STORAGE_LOCAL_BASE_URL,
    ).toBe('http://localhost:4000');
    expect(() =>
      parseStorageEnv({ STORAGE_LOCAL_BASE_URL: 'ftp://localhost:4000' }),
    ).toThrow();
  });

  it('aplica el directorio local por defecto', () => {
    const env = resolveStorageEnv({});

    expect(env.STORAGE_LOCAL_DIR).toBe(DEFAULT_STORAGE_LOCAL_DIR);
  });

  it('no exige credenciales para parsear', () => {
    expect(() => parseStorageEnv({})).not.toThrow();
  });
});

describe('configuración de R2', () => {
  it('enumera las variables que faltan sin exponer valores', () => {
    const env = parseStorageEnv({ R2_BUCKET_NAME: 'world-craft-dev' });

    expect(missingR2Variables(env)).toEqual([
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ]);
  });

  it('deriva el endpoint de la cuenta', () => {
    const config = assertR2Configured(parseStorageEnv(R2_ENV));

    expect(config.endpoint).toBe(
      `https://${R2_ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    );
    expect(config.bucket).toBe('world-craft-dev');
  });

  it('respeta un endpoint explícito', () => {
    const config = assertR2Configured(
      parseStorageEnv({
        ...R2_ENV,
        R2_ENDPOINT: 'https://r2.example.test',
      }),
    );

    expect(config.endpoint).toBe('https://r2.example.test');
  });

  it('permite endpoint sin cuenta: el accountId queda vacío', () => {
    const env = parseStorageEnv({
      R2_ACCESS_KEY_ID: 'b'.repeat(32),
      R2_SECRET_ACCESS_KEY: 'c'.repeat(64),
      R2_BUCKET_NAME: 'world-craft-dev',
      R2_ENDPOINT: 'https://r2.example.test',
    });

    expect(missingR2Variables(env)).toEqual([]);

    const config = assertR2Configured(env);
    expect(config.accountId).toBe('');
    expect(config.endpoint).toBe('https://r2.example.test');
  });

  it('falla cerrado sin credenciales', () => {
    const env = parseStorageEnv({});

    expect(() => assertR2Configured(env)).toThrow(StorageError);
    expect(() => assertR2Configured(env)).toThrow(/R2_ACCOUNT_ID/);
  });

  it('usa el bucket de R2 en los metadatos y uno local si no hay R2', () => {
    expect(resolveStorageBucketName(parseStorageEnv(R2_ENV))).toBe(
      'world-craft-dev',
    );
    expect(resolveStorageBucketName(parseStorageEnv({}))).toBe(
      'world-craft-local',
    );
  });
});
