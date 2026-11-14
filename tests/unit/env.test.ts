import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/lib/env.js';

describe('parseEnv', () => {
  it('aplica valores por defecto cuando la fuente está vacía', () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.R2_BUCKET_NAME).toBeUndefined();
  });

  it('trata una clave opcional vacía como ausente', () => {
    const env = parseEnv({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '   ' });

    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_ANON_KEY).toBeUndefined();
  });

  it('conserva los valores válidos y usa NODE_ENV cuando se indica', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      R2_BUCKET_NAME: 'world-craft-dev',
    });

    expect(env.NODE_ENV).toBe('test');
    expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.R2_BUCKET_NAME).toBe('world-craft-dev');
  });

  it('rechaza un NODE_ENV fuera del enum', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rechaza una URL opcional con formato inválido', () => {
    expect(() => parseEnv({ SUPABASE_URL: 'no-es-una-url' })).toThrow(
      /SUPABASE_URL/,
    );
  });
});
