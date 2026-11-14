import { describe, expect, it } from 'vitest';

import { parseServerEnv } from '@/lib/env/server-schema';

describe('parseServerEnv', () => {
  it('aplica valores por defecto cuando la fuente está vacía', () => {
    const env = parseServerEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.R2_BUCKET_NAME).toBeUndefined();
    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it('trata una clave opcional vacía como ausente', () => {
    const env = parseServerEnv({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '   ' });

    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_ANON_KEY).toBeUndefined();
  });

  it('conserva los valores válidos y usa NODE_ENV cuando se indica', () => {
    const env = parseServerEnv({
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      R2_BUCKET_NAME: 'world-craft-dev',
      VERCEL_URL: 'world-craft-git-dev.vercel.app',
      VERCEL_GIT_COMMIT_SHA: 'abc1234def5678',
      NEXT_PUBLIC_SITE_URL: 'https://world-craft.example',
    });

    expect(env.NODE_ENV).toBe('test');
    expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.R2_BUCKET_NAME).toBe('world-craft-dev');
    expect(env.VERCEL_URL).toBe('world-craft-git-dev.vercel.app');
    expect(env.VERCEL_GIT_COMMIT_SHA).toBe('abc1234def5678');
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://world-craft.example');
  });

  it('trata el commit de Vercel vacío como ausente', () => {
    expect(
      parseServerEnv({ VERCEL_GIT_COMMIT_SHA: '' }).VERCEL_GIT_COMMIT_SHA,
    ).toBeUndefined();
    expect(
      parseServerEnv({ VERCEL_GIT_COMMIT_SHA: '   ' }).VERCEL_GIT_COMMIT_SHA,
    ).toBeUndefined();
  });

  it('rechaza un NODE_ENV fuera del enum', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rechaza una URL opcional con formato inválido', () => {
    expect(() => parseServerEnv({ SUPABASE_URL: 'no-es-una-url' })).toThrow(
      /SUPABASE_URL/,
    );
    expect(() =>
      parseServerEnv({ NEXT_PUBLIC_SITE_URL: 'no-es-una-url' }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it('valida también las claves públicas que hereda', () => {
    const env = parseServerEnv({ NEXT_PUBLIC_SITE_URL: '' });

    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });
});
