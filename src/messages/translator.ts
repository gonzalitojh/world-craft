/**
 * Contrato de traducción compartido por servidor y cliente.
 *
 * Este módulo **no importa ningún catálogo**: solo el tipo del catálogo base.
 * Por eso un componente cliente puede importar `createTranslator`, `MessageKey`
 * o `Messages` sin arrastrar `es.ts` al bundle del navegador. Los catálogos se
 * registran en `src/messages/index.ts`, que solo se usa en servidor.
 */
import type { es } from './es';

/** Forma del catálogo de mensajes, derivada del catálogo base. */
export type Messages = typeof es;

/**
 * Rutas con punto a cada texto: `'home.title'`, `'error.retry'`, etc.
 *
 * Se derivan del catálogo, así que una clave inexistente es un error de
 * compilación y no un texto en blanco en producción.
 */
export type LeafPath<Catalog> = {
  [Key in keyof Catalog & string]: Catalog[Key] extends string
    ? Key
    : `${Key}.${LeafPath<Catalog[Key]>}`;
}[keyof Catalog & string];

/** Clave válida de un mensaje visible. */
export type MessageKey = LeafPath<Messages>;

/** Traductor de claves a texto, ya ligado a un catálogo. */
export type Translator = (key: MessageKey) => string;

/** Recorre un catálogo y devuelve el nodo de una ruta con punto. */
function resolvePath(catalog: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, segment) => {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }

    return (node as Record<string, unknown>)[segment];
  }, catalog);
}

/**
 * Crea un traductor ligado a un catálogo concreto.
 *
 * Si en tiempo de ejecución falta el texto (por ejemplo, un catálogo futuro
 * incompleto), devuelve la propia clave en lugar de una cadena vacía: es más
 * fácil de detectar en una revisión y no rompe el layout.
 */
export function createTranslator(messages: Messages): Translator {
  return (key: MessageKey): string => {
    const value = resolvePath(messages, key);

    return typeof value === 'string' ? value : key;
  };
}

/** Hoja de un catálogo: su ruta con punto y el texto. */
export type CatalogLeaf = {
  path: string;
  value: string;
};

/**
 * Recoge todas las hojas de texto de un catálogo, incluidas las que viven en
 * listas (`home.pillars.0.title`).
 *
 * Es la base de la auditoría de catálogos: `diffCatalogs` la usa para detectar
 * claves ausentes y `tests/unit/messages.test.ts` para comprobar que ninguna
 * hoja queda vacía. No se usa en el render.
 */
export function collectLeaves(
  catalog: unknown,
  path: string[] = [],
): CatalogLeaf[] {
  if (typeof catalog === 'string') {
    return [{ path: path.join('.'), value: catalog }];
  }

  if (Array.isArray(catalog)) {
    return catalog.flatMap((value, index) =>
      collectLeaves(value, [...path, String(index)]),
    );
  }

  if (typeof catalog !== 'object' || catalog === null) {
    return [];
  }

  return Object.entries(catalog).flatMap(([key, value]) =>
    collectLeaves(value, [...path, key]),
  );
}

/**
 * Devuelve las rutas presentes en el catálogo base y ausentes en el candidato.
 *
 * Un catálogo candidato puede ser cualquier objeto: la función se usa también
 * con fixtures incompletos para demostrar que el detector funciona antes de
 * que exista un idioma nuevo.
 */
export function diffCatalogs(base: unknown, candidate: unknown): string[] {
  const candidatePaths = new Set(
    collectLeaves(candidate).map((leaf) => leaf.path),
  );

  return collectLeaves(base)
    .map((leaf) => leaf.path)
    .filter((path) => !candidatePaths.has(path));
}
