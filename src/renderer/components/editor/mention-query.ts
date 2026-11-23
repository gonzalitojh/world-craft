/**
 * Lógica pura del selector de menciones.
 *
 * Detecta el disparador (`@` o `[[`) sobre el texto que precede al cursor y
 * filtra y ordena las fichas candidatas. No conoce ProseMirror ni React: el
 * plugin le pasa el texto del bloque y las fichas ya cargadas. El mismo módulo
 * alimenta el popup y la lista del diálogo de enlace.
 */
import type { EntitySummary } from '../../../shared/contracts/entities';

/** Disparadores admitidos por el selector de menciones. */
export type MentionTrigger = '@' | '[[';

/** Disparador detectado y consulta tecleada hasta el cursor. */
export interface MentionQueryMatch {
  readonly trigger: MentionTrigger;
  /** Índice del disparador dentro del bloque de texto (no posición del documento). */
  readonly start: number;
  readonly query: string;
}

/** Resultado del filtrado: página visible y total de coincidencias. */
export interface MentionSearchResult {
  readonly matches: readonly EntitySummary[];
  readonly total: number;
}

/** Tope de caracteres de la consulta antes de cerrar el selector. */
export const MENTION_QUERY_MAX_LENGTH = 60;

/** Máximo de opciones visibles en el popup. */
export const MENTION_RESULT_LIMIT = 8;

const OPENING_PUNCTUATION = new Set(['(', '«', '"', "'", '—', '-']);
const DIACRITICS = /\p{Diacritic}/gu;

/**
 * Normaliza un texto para comparar sin distinguir mayúsculas ni acentos.
 */
export function normalizeMentionText(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLocaleLowerCase('es');
}

function validateAt(
  textBefore: string,
  start: number,
): MentionQueryMatch | null {
  const query = textBefore.slice(start + 1);

  if (query.length > MENTION_QUERY_MAX_LENGTH) {
    return null;
  }

  if (query.includes('[') || query.includes(']') || query.includes('\n')) {
    return null;
  }

  const previous = start === 0 ? undefined : textBefore[start - 1];

  if (
    previous !== undefined &&
    !/\s/u.test(previous) &&
    !OPENING_PUNCTUATION.has(previous)
  ) {
    return null;
  }

  return { trigger: '@', start, query };
}

function validateBracket(
  textBefore: string,
  start: number,
): MentionQueryMatch | null {
  const query = textBefore.slice(start + 2);

  if (query.length > MENTION_QUERY_MAX_LENGTH) {
    return null;
  }

  if (query.includes('[') || query.includes(']') || query.includes('\n')) {
    return null;
  }

  return { trigger: '[[', start, query };
}

/**
 * Detecta el disparador válido más cercano al cursor.
 *
 * `@` solo abre si va al inicio del bloque, tras un espacio o tras una
 * puntuación de apertura; así `correo@dominio` no abre nada. `[[` abre en
 * cualquier posición. La consulta no puede contener corchetes ni un salto de
 * bloque y se corta a 60 caracteres.
 */
export function detectMentionQuery(
  textBefore: string,
): MentionQueryMatch | null {
  const atIndex = textBefore.lastIndexOf('@');
  const bracketIndex = textBefore.lastIndexOf('[[');
  const at = atIndex === -1 ? null : validateAt(textBefore, atIndex);
  const bracket =
    bracketIndex === -1 ? null : validateBracket(textBefore, bracketIndex);

  if (at === null) {
    return bracket;
  }

  if (bracket === null) {
    return at;
  }

  return at.start > bracket.start ? at : bracket;
}

function scoreCandidate(entity: EntitySummary, term: string): number | null {
  const name = normalizeMentionText(entity.name);
  const aliases = entity.aliases.map(normalizeMentionText);
  const typeName = normalizeMentionText(entity.typeName);

  if (name.startsWith(term)) {
    return 0;
  }

  if (name.includes(term)) {
    return 1;
  }

  if (aliases.some((alias) => alias.startsWith(term))) {
    return 2;
  }

  if (aliases.some((alias) => alias.includes(term))) {
    return 3;
  }

  if (typeName.includes(term)) {
    return 4;
  }

  return null;
}

/**
 * Filtra las fichas que coinciden con la consulta y las ordena por relevancia:
 * nombre al inicio, nombre contenido, alias y, por último, tipo. El orden de
 * llegada se conserva entre igualdades para que la lista no baile.
 */
export function rankMentionCandidates(
  candidates: readonly EntitySummary[],
  query: string,
): readonly EntitySummary[] {
  const term = normalizeMentionText(query.trim());

  if (term.length === 0) {
    return candidates;
  }

  const ranked: Array<{
    readonly entity: EntitySummary;
    readonly score: number;
    readonly index: number;
  }> = [];

  candidates.forEach((entity, index) => {
    const score = scoreCandidate(entity, term);

    if (score !== null) {
      ranked.push({ entity, score, index });
    }
  });

  ranked.sort((first, second) => {
    if (first.score !== second.score) {
      return first.score - second.score;
    }

    const byName = first.entity.name.localeCompare(second.entity.name, 'es');

    return byName === 0 ? first.index - second.index : byName;
  });

  return ranked.map((entry) => entry.entity);
}

/**
 * Devuelve la página visible (8 opciones por defecto) y el total de
 * coincidencias para anunciar «8 de 40 fichas».
 */
export function filterMentionCandidates(
  candidates: readonly EntitySummary[],
  query: string,
  limit: number = MENTION_RESULT_LIMIT,
): MentionSearchResult {
  const ranked = rankMentionCandidates(candidates, query);

  return {
    matches: ranked.slice(0, Math.max(0, limit)),
    total: ranked.length,
  };
}
