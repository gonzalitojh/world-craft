import { describe, expect, it } from 'vitest';

import {
  buildMatchExpression,
  levenshteinDistance,
  pickFuzzyExpansions,
  tokenizeQuery,
  toPrefixTerm,
} from '@/main/search/query';

describe('consulta FTS5', () => {
  it('normaliza mayúsculas, diacríticos, signos y duplicados', () => {
    expect(tokenizeQuery('  Canción   de las MARÉAS, canción ')).toEqual([
      'cancion',
      'de',
      'las',
      'mareas',
    ]);
  });

  it('limita el número de tokens', () => {
    const query = Array.from({ length: 20 }, (_, index) => `t${index}`).join(
      ' ',
    );

    expect(tokenizeQuery(query)).toHaveLength(8);
  });

  it('entrecomilla y aplica prefijo sin interpretar sintaxis FTS', () => {
    expect(toPrefixTerm('gandalf')).toBe('"gandalf"*');
    expect(toPrefixTerm('a"b')).toBe('"a""b"*');
    expect(toPrefixTerm('OR')).toBe('"OR"*');
  });

  it('combina grupos en AND y alternativas en OR', () => {
    expect(buildMatchExpression([['gandolf', 'gandalf'], ['gris']])).toBe(
      '("gandolf"* OR "gandalf"*) AND "gris"*',
    );
    expect(buildMatchExpression([['solo'], []])).toBe('"solo"*');
  });

  it('calcula la distancia de edición con corte', () => {
    expect(levenshteinDistance('gandalf', 'gandolf', 1)).toBe(1);
    expect(levenshteinDistance('gandalf', 'gandalf', 1)).toBe(0);
    expect(levenshteinDistance('gandalf', 'radagast', 1)).toBe(2);
    expect(levenshteinDistance('abc', 'abcdef', 1)).toBe(2);
  });

  it('elige expansiones por distancia y frecuencia y descarta palabras cortas', () => {
    expect(pickFuzzyExpansions('gandolf', [])).toEqual([]);
    expect(
      pickFuzzyExpansions('gandolf', [
        { term: 'gandalf', documents: 10 },
        { term: 'gandolf', documents: 20 },
        { term: 'gandul', documents: 1 },
      ]),
    ).toEqual(['gandalf']);
    expect(
      pickFuzzyExpansions(
        'archipielago',
        [
          { term: 'archipielago', documents: 5 },
          { term: 'archipielagos', documents: 3 },
          { term: 'archipielaguito', documents: 1 },
        ],
        1,
      ),
    ).toEqual(['archipielagos']);
  });
});
