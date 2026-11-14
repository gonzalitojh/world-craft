import { describe, expect, it } from 'vitest';

import { defaultLocale, getMessages, t, type MessageKey } from '@/messages';
import { es } from '@/messages/es';

/** Recorre el catálogo y devuelve todos los textos con su ruta. */
function collectTexts(
  node: unknown,
  path: string[] = [],
): Array<{ path: string; value: string }> {
  if (typeof node === 'string') {
    return [{ path: path.join('.'), value: node }];
  }

  if (typeof node !== 'object' || node === null) {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) =>
    collectTexts(value, [...path, key]),
  );
}

describe('mensajes', () => {
  it('usa español como idioma por defecto', () => {
    expect(defaultLocale).toBe('es');
    expect(getMessages()).toBe(es);
  });

  it('devuelve el texto de una clave con punto', () => {
    expect(t('home.title')).toBe(es.home.title);
    expect(t('notFound.title')).toBe(es.notFound.title);
    expect(t('a11y.skipToContent')).toBe(es.a11y.skipToContent);
  });

  it('permite elegir idioma de forma explícita', () => {
    expect(t('nav.home', 'es')).toBe(es.nav.home);
  });

  it('todas las hojas del catálogo son textos no vacíos', () => {
    const texts = collectTexts(es);

    expect(texts.length).toBeGreaterThan(20);

    for (const { path, value } of texts) {
      expect(value.trim(), `texto vacío en ${path}`).not.toBe('');
    }
  });

  it('devuelve la clave si el texto no existe en tiempo de ejecución', () => {
    expect(t('home.inexistente' as MessageKey)).toBe('home.inexistente');
  });

  it('cubre las secciones visibles del scaffold', () => {
    expect(Object.keys(es)).toEqual(
      expect.arrayContaining([
        'meta',
        'a11y',
        'nav',
        'footer',
        'home',
        'login',
        'health',
        'error',
        'loading',
        'notFound',
      ]),
    );
  });
});
