import { describe, expect, it } from 'vitest';

import { parsePublicEnv, publicEnvSchema } from '@/lib/env/public-schema';

describe('parsePublicEnv', () => {
  it('deja la URL sin definir cuando falta', () => {
    const env = parsePublicEnv({});

    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it('trata una URL vacía o con espacios como ausente', () => {
    expect(
      parsePublicEnv({ NEXT_PUBLIC_SITE_URL: '' }).NEXT_PUBLIC_SITE_URL,
    ).toBeUndefined();
    expect(
      parsePublicEnv({ NEXT_PUBLIC_SITE_URL: '   ' }).NEXT_PUBLIC_SITE_URL,
    ).toBeUndefined();
  });

  it('conserva una URL pública válida', () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: 'https://world-craft.example',
    });

    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://world-craft.example');
  });

  it('descarta las claves de servidor aunque reciba process.env completo', () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: 'https://world-craft.example',
      SUPABASE_SERVICE_ROLE_KEY: 'no-deberia-salir',
      DATABASE_URL: 'postgres://usuario:clave@ejemplo.test:5432/db',
      R2_SECRET_ACCESS_KEY: 'no-deberia-salir',
      R2_BUCKET_NAME: 'bucket-privado',
    });

    expect(Object.keys(env)).toEqual(['NEXT_PUBLIC_SITE_URL']);
    expect('SUPABASE_SERVICE_ROLE_KEY' in env).toBe(false);
    expect('DATABASE_URL' in env).toBe(false);
    expect('R2_SECRET_ACCESS_KEY' in env).toBe(false);
    expect(JSON.stringify(env)).not.toContain('no-deberia-salir');
    expect(JSON.stringify(env)).not.toContain('bucket-privado');
  });

  it('rechaza una URL con formato inválido', () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_SITE_URL: 'no-es-una-url' }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it('solo acepta http y https', () => {
    const rejected = [
      'javascript:alert(1)',
      'mailto:equipo@world-craft.example',
      'ftp://world-craft.example',
      'data:text/html,hola',
    ];

    for (const value of rejected) {
      expect(
        () => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: value }),
        `debería rechazar ${value}`,
      ).toThrow(/NEXT_PUBLIC_SITE_URL/);
    }

    expect(
      parsePublicEnv({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' })
        .NEXT_PUBLIC_SITE_URL,
    ).toBe('http://localhost:3000');
  });

  it('expone solo una clave en el esquema público', () => {
    expect(Object.keys(publicEnvSchema.shape)).toEqual([
      'NEXT_PUBLIC_SITE_URL',
    ]);
  });
});
