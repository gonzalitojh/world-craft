/**
 * Resolución tipada de mensajes y utilidades de plantilla.
 *
 * El catálogo se deriva del español: `MessagePath` solo admite claves
 * existentes y `MessageArguments` exige los mismos parámetros que la función
 * del mensaje. Una clave ausente o un argumento incorrecto rompe el typecheck,
 * no la interfaz en tiempo de ejecución (ADR 0009).
 */
import type { MessageCatalog } from './index';

/** Firma que comparten los mensajes con parámetros del catálogo. */
type MessageFunction = (...args: never[]) => string;

/** Claves de texto o función, con puntos para los mensajes anidados. */
export type MessagePath<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends MessageFunction
      ? K
      : T[K] extends readonly unknown[]
        ? never
        : T[K] extends object
          ? `${K}.${MessagePath<T[K]>}`
          : never;
}[keyof T & string];

type MessageAt<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? MessageAt<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Argumentos que acepta el mensaje de una ruta concreta. */
export type MessageArguments<T, P extends string> =
  MessageAt<T, P> extends (...args: infer Args) => string
    ? Args
    : MessageAt<T, P> extends string
      ? []
      : never;

/** Traductor ligado a un catálogo completo. */
export type Translator<T = MessageCatalog> = <P extends MessagePath<T>>(
  path: P,
  ...args: MessageArguments<T, P>
) => string;

/** Valores admitidos en una plantilla con marcadores `{nombre}`. */
export type MessageValues = Readonly<Record<string, string | number>>;

/**
 * Sustituye marcadores `{nombre}` por sus valores.
 *
 * Se usa para plantillas de plurales o mensajes nuevos; los mensajes actuales
 * con parámetros siguen siendo funciones puras del catálogo.
 */
export function formatMessage(template: string, values: MessageValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

function readPath(catalog: object, path: string): unknown {
  let node: unknown = catalog;

  for (const segment of path.split('.')) {
    if (
      typeof node !== 'object' ||
      node === null ||
      !Object.prototype.hasOwnProperty.call(node, segment)
    ) {
      throw new Error(`Mensaje ausente en el catálogo: ${path}`);
    }

    node = (node as Record<string, unknown>)[segment];
  }

  return node;
}

/**
 * Crea el traductor de un catálogo.
 *
 * El catálogo llega como argumento para que la prueba pueda demostrar que un
 * segundo idioma funciona sin tocar componentes y para que el proveedor cambie
 * de catálogo sin recargar la aplicación.
 */
export function createTranslator<T extends object>(catalog: T): Translator<T> {
  const translate = (path: string, ...args: readonly unknown[]): string => {
    const node = readPath(catalog, path);

    if (typeof node === 'function') {
      return (node as (...values: readonly unknown[]) => string)(...args);
    }

    if (typeof node === 'string') {
      return node;
    }

    throw new Error(`La clave ${path} no contiene un mensaje de texto.`);
  };

  return translate as Translator<T>;
}

/** Rutas de todas las hojas de texto o función; las listas se ignoran. */
export function collectMessagePaths(
  catalog: object,
  prefix = '',
): readonly string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix.length === 0 ? key : `${prefix}.${key}`;

    if (typeof value === 'string' || typeof value === 'function') {
      paths.push(path);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      paths.push(...collectMessagePaths(value as object, path));
    }
  }

  return paths;
}
