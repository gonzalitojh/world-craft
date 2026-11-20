import { describe, expect, it } from 'vitest';

import {
  isAllowedUpdateRequestUrl,
  sanitizeUpdateRequestHeaders,
  UPDATE_FORBIDDEN_HEADERS,
} from '@/main/updates/network';

describe('política de red del actualizador', () => {
  it.each([
    'https://github.com/gonzalitojh/world-craft/releases/latest/download/latest.yml',
    'https://api.github.com/repos/gonzalitojh/world-craft/releases',
    'https://objects.githubusercontent.com/github-production-release-asset/file',
    'https://githubusercontent.com/file',
    'https://github.com:443/gonzalitojh/world-craft',
  ])('acepta %s', (url) => {
    expect(isAllowedUpdateRequestUrl(url)).toBe(true);
  });

  it.each([
    'http://github.com/gonzalitojh/world-craft',
    'https://github.com:8443/file',
    'https://user:password@github.com/file',
    'https://evil.example.com/github.com',
    'https://github.com.evil.example.com/file',
    'https://api.github.com.evil.example.com/file',
    'ftp://github.com/file',
    'not-a-url',
    '',
  ])('rechaza %s', (url) => {
    expect(isAllowedUpdateRequestUrl(url)).toBe(false);
  });

  it('elimina las cabeceras sensibles sin depender de mayúsculas', () => {
    const sanitized = sanitizeUpdateRequestHeaders({
      Accept: 'application/octet-stream',
      Authorization: 'Bearer abc1234',
      'X-User-Staging-Id': 'staging',
      'Private-Token': 'token',
      Cookie: 'session=1',
      'User-Agent': 'World Craft',
    });

    expect(sanitized).toEqual({
      Accept: 'application/octet-stream',
      'User-Agent': 'World Craft',
    });

    for (const header of UPDATE_FORBIDDEN_HEADERS) {
      expect(
        Object.keys(sanitized).some((name) => name.toLowerCase() === header),
      ).toBe(false);
    }
  });
});
