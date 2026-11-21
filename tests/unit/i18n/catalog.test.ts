import { describe, expect, it } from 'vitest';

import { createI18n, type I18n } from '@/renderer/i18n/create';
import {
  CATALOGS,
  getCatalog,
  isLocale,
  resolveLocale,
  type MessageCatalog,
} from '@/renderer/messages';
import { es } from '@/renderer/messages/es';
import {
  collectMessagePaths,
  createTranslator,
} from '@/renderer/messages/translator';

function readPath(catalog: object, path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }

    return (node as Record<string, unknown>)[segment];
  }, catalog);
}

describe('catálogo de mensajes', () => {
  it('todas las hojas contienen texto no vacío y las funciones devuelven texto', () => {
    const paths = collectMessagePaths(es);

    expect(paths.length).toBeGreaterThan(100);
    expect(new Set(paths).size).toBe(paths.length);

    for (const path of paths) {
      const value = readPath(es, path);

      if (typeof value === 'function') {
        const message = (value as (...args: string[]) => string)(
          ...Array.from({ length: value.length }, () => 'ejemplo'),
        );

        expect(message.trim(), path).not.toBe('');
        continue;
      }

      expect(typeof value, path).toBe('string');
      expect((value as string).trim(), path).not.toBe('');
    }
  });

  it('el traductor resuelve claves anidadas y parámetros tipados', () => {
    const t = createTranslator(es);

    expect(t('shell.views.home')).toBe('Inicio');
    expect(t('shell.version', '0.1.0')).toBe('Versión 0.1.0');
    expect(t('updates.percentValue', '42 %')).toBe('42 %');
  });

  it('una clave ausente falla en typecheck y en tiempo de ejecución', () => {
    const t = createTranslator(es);

    expect(() => {
      // @ts-expect-error la clave no existe en el catálogo
      t('shell.noExiste');
    }).toThrow(/Mensaje ausente/);
  });

  it('un catálogo traducido funciona sin cambiar el traductor', () => {
    const english = {
      ...es,
      shell: {
        ...es.shell,
        views: {
          home: 'Home',
          search: 'Search',
          worlds: 'Worlds',
          world: 'World',
          entities: 'Entries',
          entity: 'Entry',
          samples: 'Samples',
        },
      },
    } satisfies MessageCatalog;
    const t = createTranslator(english);

    expect(t('shell.views.home')).toBe('Home');
    expect(t('shell.views.samples')).toBe('Samples');
    expect(t('home.emptyAction')).toBe(es.home.emptyAction);
  });

  it('resuelve el locale del perfil y cae al idioma de reserva', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('en')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(resolveLocale('es')).toBe('es');
    expect(resolveLocale('fr')).toBe('es');
    expect(resolveLocale(undefined)).toBe('es');
    expect(getCatalog('es')).toBe(CATALOGS.es);

    const i18n = createI18n('fr');
    expect(i18n.locale).toBe('es');
    expect(i18n.messages.shell.brandName).toBe('World Craft');
    expect(i18n.t('shell.views.home')).toBe('Inicio');
  });

  it('expone un objeto I18n completo para componentes y módulos puros', () => {
    const i18n: I18n = createI18n('es');

    expect(i18n.formats.locale).toBe('es');
    expect(i18n.formats.intlLocale).toBe('es-ES');
    expect(i18n.t('components.toast.dismiss')).toBe('Cerrar aviso');
  });
});
