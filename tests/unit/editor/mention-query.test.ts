import { describe, expect, it } from 'vitest';

import {
  detectMentionQuery,
  filterMentionCandidates,
  normalizeMentionText,
  rankMentionCandidates,
} from '@/renderer/components/editor/mention-query';
import type { EntitySummary } from '@/shared/contracts/entities';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '018f0000-0000-7000-8000-000000000109';

function entity(
  id: string,
  name: string,
  options: {
    readonly aliases?: readonly string[];
    readonly typeName?: string;
  } = {},
): EntitySummary {
  return {
    id,
    worldId: WORLD_ID,
    typeId: TYPE_ID,
    typeKey: 'city',
    typeName: options.typeName ?? 'Ciudad',
    typeIcon: 'building-2',
    typeColor: 'ochre',
    name,
    slug: name.toLocaleLowerCase('es').replaceAll(' ', '-'),
    aliases: options.aliases ?? [],
    summary: null,
    imageAssetId: null,
    isFavorite: false,
    status: 'active',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const puerto = entity('01900000-0000-7000-8000-000000000003', 'Puerto Sal', {
  aliases: ['La Dársena'],
});
const mara = entity('01900000-0000-7000-8000-000000000002', 'Mara Viento', {
  aliases: ['La Cartógrafa'],
  typeName: 'Personaje',
});
const altar = entity('01900000-0000-7000-8000-000000000004', 'Altar de Sal', {
  typeName: 'Lugar',
});
const candidates = [puerto, mara, altar];

describe('detección de la consulta de mención', () => {
  it('abre con @ al inicio del bloque y tras espacio o puntuación de apertura', () => {
    for (const text of [
      '@',
      '@Puer',
      'Nació en @Puer',
      '(@Puer',
      '«@Puer',
      '"@Puer',
      "'@Puer",
      '—@Puer',
      '-@Puer',
    ]) {
      expect(detectMentionQuery(text)?.trigger, text).toBe('@');
    }

    expect(detectMentionQuery('@Puer')).toEqual({
      trigger: '@',
      start: 0,
      query: 'Puer',
    });
  });

  it('no abre @ tras una letra o un número (correo@dominio)', () => {
    expect(detectMentionQuery('correo@dominio')).toBeNull();
    expect(detectMentionQuery('2026@dominio')).toBeNull();
    expect(detectMentionQuery('@')).not.toBeNull();
  });

  it('abre con [[ en cualquier posición', () => {
    expect(detectMentionQuery('[[Puer')).toEqual({
      trigger: '[[',
      start: 0,
      query: 'Puer',
    });
    expect(detectMentionQuery('Nació en [[Puer')).toEqual({
      trigger: '[[',
      start: 9,
      query: 'Puer',
    });
  });

  it('admite espacios en la consulta y conserva mayúsculas y acentos', () => {
    expect(detectMentionQuery('@Puerto de la Sal')?.query).toBe(
      'Puerto de la Sal',
    );
    expect(detectMentionQuery('[[Mara Vïento')?.query).toBe('Mara Vïento');
  });

  it('cierra la consulta a 60 caracteres', () => {
    expect(detectMentionQuery(`@${'a'.repeat(60)}`)).not.toBeNull();
    expect(detectMentionQuery(`@${'a'.repeat(61)}`)).toBeNull();
    expect(detectMentionQuery(`[[${'a'.repeat(61)}`)).toBeNull();
  });

  it('invalida corchetes y saltos de bloque', () => {
    expect(detectMentionQuery('[[Puerto]')).toBeNull();
    expect(detectMentionQuery('[[Puerto]]')).toBeNull();
    expect(detectMentionQuery('@Puerto[')).toBeNull();
    expect(detectMentionQuery('[[Puerto\nSal')).toBeNull();
  });

  it('elige el disparador más cercano al cursor', () => {
    expect(detectMentionQuery('@Uno [[Dos')).toEqual({
      trigger: '[[',
      start: 5,
      query: 'Dos',
    });
    expect(detectMentionQuery('[[Uno @Dos')).toEqual({
      trigger: '@',
      start: 6,
      query: 'Dos',
    });
  });

  it('devuelve null sin disparador', () => {
    expect(detectMentionQuery('')).toBeNull();
    expect(detectMentionQuery('Texto normal')).toBeNull();
  });
});

describe('filtrado y ranking de candidatas', () => {
  it('normaliza mayúsculas y acentos', () => {
    expect(normalizeMentionText('Puérto Sál')).toBe('puerto sal');
  });

  it('filtra por nombre, alias y tipo sin distinguir mayúsculas ni acentos', () => {
    expect(
      rankMentionCandidates(candidates, 'puer').map((entry) => entry.id),
    ).toEqual([puerto.id]);
    expect(
      rankMentionCandidates(candidates, 'cartografa').map((entry) => entry.id),
    ).toEqual([mara.id]);
    expect(
      rankMentionCandidates(candidates, 'LUGAR').map((entry) => entry.id),
    ).toEqual([altar.id]);
    expect(
      rankMentionCandidates(candidates, 'SAL').map((entry) => entry.id),
    ).toEqual([altar.id, puerto.id]);
  });

  it('ordena primero por nombre y después por alias y tipo', () => {
    const results = rankMentionCandidates(candidates, 'sal');

    expect(results.map((entry) => entry.name)).toEqual([
      'Altar de Sal',
      'Puerto Sal',
    ]);
  });

  it('mantiene todas las fichas con consulta vacía', () => {
    expect(rankMentionCandidates(candidates, '   ')).toHaveLength(3);
  });

  it('limita a 8 opciones y devuelve el total', () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      entity(
        `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`,
        `Ficha ${index}`,
      ),
    );
    const result = filterMentionCandidates(many, 'Ficha');

    expect(result.matches).toHaveLength(8);
    expect(result.total).toBe(40);
  });

  it('devuelve vacío cuando no hay coincidencias o la lista está vacía', () => {
    expect(filterMentionCandidates(candidates, 'zzz')).toEqual({
      matches: [],
      total: 0,
    });
    expect(filterMentionCandidates([], '')).toEqual({ matches: [], total: 0 });
  });
});
