import { describe, expect, it } from 'vitest';

import { defaultLocale } from '@/lib/i18n/locale';
import {
  availableLocales,
  catalogs,
  getMessages,
  t,
  type MessageKey,
} from '@/messages';
import { es } from '@/messages/es';
import {
  collectLeaves,
  createTranslator,
  diffCatalogs,
} from '@/messages/translator';

import {
  catalogWithoutHomeTitle,
  tinyCatalog,
} from '../fixtures/i18n/catalog-incomplete';
import {
  PSEUDO_CLOSE,
  PSEUDO_OPEN,
  pseudoMessages,
  pseudoText,
} from '../fixtures/i18n/pseudo';

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

describe('registro de catálogos', () => {
  it('solo ofrece idiomas con catálogo completo', () => {
    expect(availableLocales).toEqual(['es']);

    for (const locale of availableLocales) {
      expect(catalogs[locale]).toBeDefined();
    }
  });

  it('no registra stubs para los idiomas del modelo sin traducir', () => {
    expect(catalogs.en).toBeUndefined();
    expect(catalogs.it).toBeUndefined();
  });

  it('cae al catálogo base si se pide un idioma sin catálogo', () => {
    expect(getMessages('en')).toBe(es);
  });
});

describe('auditoría de catálogos', () => {
  it('collectLeaves recorre objetos y listas', () => {
    const paths = collectLeaves(es).map((leaf) => leaf.path);

    expect(paths).toContain('home.title');
    expect(paths).toContain('home.pillars.0.title');
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('diffCatalogs detecta la clave ausente', () => {
    expect(diffCatalogs(es, catalogWithoutHomeTitle)).toEqual(['home.title']);
  });

  it('diffCatalogs señala todo lo que falta en un catálogo mínimo', () => {
    const missing = diffCatalogs(es, tinyCatalog);

    expect(missing).toContain('meta.description');
    expect(missing).toContain('home.pillars.0.title');
    expect(missing).not.toContain('meta.title');
    expect(missing).not.toContain('home.title');
  });

  it('un catálogo completo no tiene diferencias', () => {
    expect(diffCatalogs(es, es)).toEqual([]);
    expect(diffCatalogs(es, pseudoMessages)).toEqual([]);
  });
});

describe('pseudo-catálogo', () => {
  it('usa marcas distintas y cierra con U+27E7', () => {
    expect(PSEUDO_OPEN).toBe('\u27e6');
    expect(PSEUDO_CLOSE).toBe('\u27e7');
    expect(PSEUDO_OPEN).not.toBe(PSEUDO_CLOSE);
    expect(pseudoText('hola')).toBe('\u27e6hola\u27e7');
  });
});

describe('createTranslator', () => {
  it('liga el traductor al catálogo recibido', () => {
    const translate = createTranslator(pseudoMessages);

    expect(translate('home.title')).toBe(pseudoText(es.home.title));
    expect(translate('a11y.skipToContent')).toBe(
      pseudoText(es.a11y.skipToContent),
    );
  });
});
