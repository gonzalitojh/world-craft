/**
 * Utilidades puras de la consulta FTS5.
 *
 * Separa la tokenización, la construcción del `MATCH` y el cálculo de
 * distancias para poder probarlas sin base de datos. Ningún texto del usuario
 * se interpola: los tokens se entrecomillan y el repositorio siempre usa
 * parámetros enlazados.
 */
import { SEARCH_TOKENS_MAX } from '../../shared/contracts/search';

/** Separador de palabras: cualquier cosa que no sea letra o número Unicode. */
const TOKEN_SEPARATOR = /[^\p{L}\p{N}]+/u;

/**
 * Normaliza y divide la consulta.
 *
 * `NFKC`, minúsculas y deduplicación hacen que «Canción», «cancion» y
 * «Canción  canción» produzcan los mismos tokens. Se limita el número de
 * tokens para que una consulta enorme no genere un `MATCH` desproporcionado.
 */
export function tokenizeQuery(raw: string): readonly string[] {
  const normalized = raw
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('es')
    .normalize('NFKC');
  const tokens = normalized
    .split(TOKEN_SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  return [...new Set(tokens)].slice(0, SEARCH_TOKENS_MAX);
}

/**
 * Entrecomilla un token y lo convierte en prefijo.
 *
 * FTS5 interpreta `*`, `"`, `-` y `OR` como sintaxis; entrecomillar el token
 * elimina esa ambigüedad y aplica el prefijo al último término.
 */
export function toPrefixTerm(token: string): string {
  return `"${token.replace(/"/g, '""')}"*`;
}

/**
 * Construye un `MATCH` con grupos en AND y alternativas en OR.
 *
 * Cada grupo representa un token de la consulta y contiene el token original
 * más, si existen, sus expansiones aproximadas. Un grupo vacío se ignora.
 */
export function buildMatchExpression(
  groups: readonly (readonly string[])[],
): string {
  return groups
    .map((group) => {
      const terms = [...new Set(group.filter((term) => term.length > 0))];

      if (terms.length === 0) {
        return null;
      }

      return terms.length === 1
        ? toPrefixTerm(terms[0] ?? '')
        : `(${terms.map(toPrefixTerm).join(' OR ')})`;
    })
    .filter((group): group is string => group !== null)
    .join(' AND ');
}

/**
 * Distancia de edición de Levenshtein con corte temprano.
 *
 * Devuelve `limit + 1` en cuanto sabe que supera el límite, de modo que el
 * vocabulario de un índice grande no se recorre entero para cada candidato.
 */
export function levenshteinDistance(
  left: string,
  right: string,
  limit: number,
): number {
  if (left === right) {
    return 0;
  }

  if (Math.abs(left.length - right.length) > limit) {
    return limit + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    let rowMinimum = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
      rowMinimum = Math.min(rowMinimum, current[rightIndex] ?? 0);
    }

    if (rowMinimum > limit) {
      return limit + 1;
    }

    [previous, current] = [current, previous];
  }

  return previous[right.length] ?? limit + 1;
}

/**
 * Elige expansiones aproximadas para un token.
 *
 * Solo se admiten candidatos con la misma inicial y una distancia de 1 para
 * palabras cortas o 2 para palabras largas. Se prefieren las de menor distancia
 * y, en empate, las que aparecen en más documentos.
 */
export function pickFuzzyExpansions(
  token: string,
  candidates: readonly { readonly term: string; readonly documents: number }[],
  max = 2,
): readonly string[] {
  if (token.length < 4) {
    return [];
  }

  const allowedDistance = token.length >= 8 ? 2 : 1;
  const scored = candidates
    .filter((candidate) => candidate.term !== token)
    .map((candidate) => ({
      ...candidate,
      distance: levenshteinDistance(token, candidate.term, allowedDistance),
    }))
    .filter((candidate) => candidate.distance <= allowedDistance)
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.documents - left.documents ||
        left.term.localeCompare(right.term, 'es'),
    );

  return scored.slice(0, max).map((candidate) => candidate.term);
}
