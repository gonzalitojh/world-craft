import { describe, expect, it } from 'vitest';

import { FALLBACK_SITE_URL, resolveSiteUrl } from '@/lib/site-url';

describe('resolveSiteUrl', () => {
  it('prefiere NEXT_PUBLIC_SITE_URL', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://world-craft.example',
        VERCEL_URL: 'world-craft.vercel.app',
      }),
    ).toBe('https://world-craft.example');
  });

  it('reduce la URL pública a su origen', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://world-craft.example/app',
      }),
    ).toBe('https://world-craft.example');
  });

  it('usa VERCEL_URL cuando no hay dominio propio', () => {
    expect(
      resolveSiteUrl({ VERCEL_URL: 'world-craft-git-dev.vercel.app' }),
    ).toBe('https://world-craft-git-dev.vercel.app');
  });

  it('cae a localhost cuando no hay ninguna variable', () => {
    expect(resolveSiteUrl({})).toBe(FALLBACK_SITE_URL);
    expect(FALLBACK_SITE_URL).toBe('http://localhost:3000');
  });

  it('ignora valores vacíos y los trata como ausentes', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '  ', VERCEL_URL: '' })).toBe(
      FALLBACK_SITE_URL,
    );
  });

  it('ignora una URL pública inválida y usa el respaldo', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'no-es-una-url',
        VERCEL_URL: 'world-craft.vercel.app',
      }),
    ).toBe('https://world-craft.vercel.app');
  });

  it('rechaza los protocolos que no son http ni https', () => {
    const rejected = [
      'javascript:alert(1)',
      'mailto:equipo@world-craft.example',
      'ftp://world-craft.example',
      'data:text/html,hola',
      'file:///C:/mundos',
    ];

    for (const value of rejected) {
      expect(
        resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: value }),
        `debería rechazar ${value}`,
      ).toBe(FALLBACK_SITE_URL);
    }
  });

  it('cae al respaldo de Vercel si el protocolo público no vale', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)',
        VERCEL_URL: 'world-craft.vercel.app',
      }),
    ).toBe('https://world-craft.vercel.app');
  });

  it('acepta http y https, también en local', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }),
    ).toBe('http://localhost:3000');
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'HTTPS://World-Craft.Example' }),
    ).toBe('https://world-craft.example');
  });

  it('nunca devuelve el origen opaco "null"', () => {
    const url = resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: 'javascript:void(0)',
      VERCEL_URL: '://',
    });

    expect(url).not.toBe('null');
    expect(url.startsWith('http')).toBe(true);
  });
});
