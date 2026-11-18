import { describe, expect, it } from 'vitest';

import {
  MAX_EXTERNAL_URL_LENGTH,
  resolveExternalUrl,
} from '@/main/security/external-links';

describe('resolveExternalUrl', () => {
  it('permite un enlace https válido y lo normaliza', () => {
    expect(resolveExternalUrl('https://example.com/docs?page=1#top')).toEqual({
      kind: 'allow',
      url: 'https://example.com/docs?page=1#top',
    });
    expect(resolveExternalUrl('HTTPS://EXAMPLE.COM')).toEqual({
      kind: 'allow',
      url: 'https://example.com/',
    });
  });

  it('acepta una URL de exactamente la longitud máxima', () => {
    const prefix = 'https://example.com/';
    const url = prefix + 'a'.repeat(MAX_EXTERNAL_URL_LENGTH - prefix.length);

    expect(url).toHaveLength(MAX_EXTERNAL_URL_LENGTH);
    expect(resolveExternalUrl(url).kind).toBe('allow');
  });

  it('rechaza esquemas que no son https', () => {
    for (const url of [
      'http://example.com',
      'javascript:alert(1)',
      'file:///C:/Windows/System32/calc.exe',
      'data:text/html,<script>alert(1)</script>',
      'mailto:hola@example.com',
      'wc-asset://mundo/a.png',
    ]) {
      expect(resolveExternalUrl(url), url).toEqual({
        kind: 'deny',
        reason: 'UNSUPPORTED_SCHEME',
      });
    }
  });

  it('rechaza cadenas vacías, URLs inválidas y demasiado largas', () => {
    expect(resolveExternalUrl('')).toEqual({ kind: 'deny', reason: 'EMPTY' });
    expect(resolveExternalUrl('https://')).toEqual({
      kind: 'deny',
      reason: 'INVALID_URL',
    });
    expect(
      resolveExternalUrl(
        'https://example.com/' + 'a'.repeat(MAX_EXTERNAL_URL_LENGTH),
      ),
    ).toEqual({ kind: 'deny', reason: 'TOO_LONG' });
  });

  it('rechaza espacios y caracteres de control', () => {
    for (const url of [
      'https://example.com/a b',
      ' https://example.com',
      'https://example.com ',
      'https://exa\nmple.com',
      'https://example.com/\u0000',
    ]) {
      expect(resolveExternalUrl(url), JSON.stringify(url)).toEqual({
        kind: 'deny',
        reason: 'WHITESPACE',
      });
    }
  });

  it('rechaza credenciales embebidas', () => {
    expect(resolveExternalUrl('https://user:pass@example.com')).toEqual({
      kind: 'deny',
      reason: 'CREDENTIALS',
    });
    expect(resolveExternalUrl('https://user@example.com')).toEqual({
      kind: 'deny',
      reason: 'CREDENTIALS',
    });
    // Credenciales con caracteres codificados: el parser no las decodifica,
    // pero siguen siendo credenciales y no deben abrirse.
    expect(resolveExternalUrl('https://user%40evil@example.com')).toEqual({
      kind: 'deny',
      reason: 'CREDENTIALS',
    });
  });

  it('rechaza loopback, redes privadas y nombres locales', () => {
    for (const url of [
      'https://localhost/',
      'https://api.localhost/',
      'https://localhost./',
      'https://127.0.0.1/',
      'https://127.10.0.1/',
      'https://0.0.0.0/',
      'https://10.0.0.5/',
      'https://172.16.0.1/',
      'https://172.31.255.254/',
      'https://192.168.1.10/',
      'https://169.254.169.254/latest/meta-data',
      'https://100.64.0.1/',
      'https://[::1]/',
      'https://[::]/',
      'https://[fe80::1]/',
      'https://[fd00::1]/',
    ]) {
      expect(resolveExternalUrl(url), url).toEqual({
        kind: 'deny',
        reason: 'PRIVATE_HOST',
      });
    }
  });

  it('rechaza IPv4 ofuscadas que el parser canonicaliza a loopback', () => {
    for (const url of [
      'https://2130706433/',
      'https://0x7f.1/',
      'https://127.1/',
      'https://%31%32%37.0.0.1/',
    ]) {
      expect(resolveExternalUrl(url), url).toEqual({
        kind: 'deny',
        reason: 'PRIVATE_HOST',
      });
    }
  });

  it('rechaza IPv6 con IPv4 mapeada, incluidas las públicas', () => {
    expect(resolveExternalUrl('https://[::ffff:127.0.0.1]/')).toEqual({
      kind: 'deny',
      reason: 'PRIVATE_HOST',
    });

    // El parser normaliza la IPv4 mapeada a hexadecimal (`::ffff:808:808`), que
    // esta capa no interpreta. Se prefiere sobre-bloquear antes que abrir un
    // destino que podría resolverse a una dirección interna.
    expect(resolveExternalUrl('https://[::ffff:8.8.8.8]/')).toEqual({
      kind: 'deny',
      reason: 'PRIVATE_HOST',
    });
  });

  it('no confunde direcciones públicas con rangos privados', () => {
    for (const url of [
      'https://8.8.8.8/',
      'https://172.32.0.1/',
      'https://[2001:4860:4860::8888]/',
    ]) {
      expect(resolveExternalUrl(url), url).toMatchObject({ kind: 'allow' });
    }
  });
});
