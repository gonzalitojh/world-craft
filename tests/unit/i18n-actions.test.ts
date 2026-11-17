import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  localeCookieOptions,
} from '@/lib/i18n/cookie';

/**
 * Server Action de idioma (M0-12).
 *
 * Una Server Action es un endpoint más: se comprueba que valida la entrada,
 * que rechaza idiomas sin catálogo, que escribe la cookie con las opciones
 * seguras y que revalida el layout para que el cambio se vea.
 */

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: mocks.cookieSet,
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

const { setLocale } = await import('@/lib/i18n/actions');

beforeEach(() => {
  mocks.cookieSet.mockClear();
  mocks.revalidatePath.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('setLocale', () => {
  it('guarda el idioma disponible y revalida el layout', async () => {
    const result = await setLocale('es');

    expect(result).toEqual({ ok: true, locale: 'es' });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      LOCALE_COOKIE_NAME,
      'es',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('marca como no segura la cookie fuera de producción', async () => {
    await setLocale('es');

    expect(mocks.cookieSet.mock.calls[0]?.[2]).toMatchObject({ secure: false });
  });

  it('marca como segura la cookie en producción', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await setLocale('es');

    expect(mocks.cookieSet.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });

  it('rechaza un idioma del producto sin catálogo', async () => {
    const result = await setLocale('en');

    expect(result).toEqual({ ok: false, error: 'unsupported' });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('rechaza idiomas desconocidos y entradas manipuladas', async () => {
    for (const input of ['fr', '', '  ', 'es; DROP TABLE', '<script>', 123]) {
      expect(await setLocale(input)).toEqual({ ok: false, error: 'invalid' });
    }

    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rechaza una etiqueta más larga que el límite BCP 47', async () => {
    const result = await setLocale('e'.repeat(40));

    expect(result).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('localeCookieOptions', () => {
  it('devuelve una cookie HttpOnly de un año y ámbito raíz', () => {
    expect(localeCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    });
    expect(LOCALE_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365);
  });
});
