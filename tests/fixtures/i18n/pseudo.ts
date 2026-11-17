/**
 * Pseudo-catálogo para pruebas de i18n.
 *
 * Envuelve cada hoja del catálogo real entre marcas visibles. Un componente que
 * pinte el pseudo-catálogo demuestra que usa el catálogo que le pasa el
 * `LocaleProvider` y no un texto fijo o importado directamente.
 */
import { es } from '@/messages/es';
import type { Messages } from '@/messages/translator';

/** Marca de apertura del pseudo-texto. */
export const PSEUDO_OPEN = '⟦';

/** Marca de cierre del pseudo-texto. */
export const PSEUDO_CLOSE = '⟧';

/** Transforma una cadena en su versión pseudo. */
export function pseudoText(value: string): string {
  return `${PSEUDO_OPEN}${value}${PSEUDO_CLOSE}`;
}

function pseudoize(node: unknown): unknown {
  if (typeof node === 'string') {
    return pseudoText(node);
  }

  if (Array.isArray(node)) {
    return node.map(pseudoize);
  }

  if (typeof node === 'object' && node !== null) {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, pseudoize(value)]),
    );
  }

  return node;
}

/** Catálogo con la misma forma que el español y todos los textos marcados. */
export const pseudoMessages = pseudoize(es) as Messages;
