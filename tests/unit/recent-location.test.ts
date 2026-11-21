import { describe, expect, it } from 'vitest';

import {
  resolveContinueTarget,
  type RecentLocation,
} from '@/renderer/lib/recent-location';
import type { WorldSummary } from '@/shared/contracts/worlds';

const WORLDS: readonly WorldSummary[] = [
  {
    id: 'world-1',
    name: 'Las Mareas Grises',
    slug: 'las-mareas-grises',
    summary: 'Una historia de mareas.',
    genres: ['Fantasía'],
    language: 'es',
    status: 'active',
    coverAssetId: null,
    createdAt: 1,
    updatedAt: 2,
    archivedAt: null,
  },
  {
    id: 'world-2',
    name: 'Crónica del faro',
    slug: 'cronica-del-faro',
    summary: null,
    genres: [],
    language: 'es',
    status: 'archived',
    coverAssetId: null,
    createdAt: 1,
    updatedAt: 2,
    archivedAt: 3,
  },
];

describe('resolución del destino de «Continuar»', () => {
  it('devuelve null sin destino', () => {
    expect(resolveContinueTarget(null, WORLDS)).toBeNull();
  });

  it('devuelve null si el mundo ya no está en la biblioteca', () => {
    const location: RecentLocation = { kind: 'world', worldId: 'world-9' };

    expect(resolveContinueTarget(location, WORLDS)).toBeNull();
  });

  it('resuelve un mundo con su nombre actual', () => {
    const location: RecentLocation = { kind: 'world', worldId: 'world-1' };

    expect(resolveContinueTarget(location, WORLDS)).toEqual({
      kind: 'world',
      worldId: 'world-1',
      worldName: 'Las Mareas Grises',
      entityId: null,
      entityName: null,
    });
  });

  it('resuelve una ficha con nombre conocido', () => {
    const location: RecentLocation = {
      kind: 'entity',
      worldId: 'world-1',
      entityId: 'entity-7',
      entityName: 'Aldo Varela',
    };

    expect(resolveContinueTarget(location, WORLDS)).toEqual({
      kind: 'entity',
      worldId: 'world-1',
      worldName: 'Las Mareas Grises',
      entityId: 'entity-7',
      entityName: 'Aldo Varela',
    });
  });

  it('mantiene el nombre nulo de una ficha aún sin cargar', () => {
    const location: RecentLocation = {
      kind: 'entity',
      worldId: 'world-1',
      entityId: 'entity-7',
      entityName: null,
    };

    expect(resolveContinueTarget(location, WORLDS)?.entityName).toBeNull();
  });

  it('no muta el destino recordado', () => {
    const location: RecentLocation = {
      kind: 'entity',
      worldId: 'world-1',
      entityId: 'entity-7',
      entityName: null,
    };
    const snapshot = structuredClone(location);

    resolveContinueTarget(location, WORLDS);

    expect(location).toEqual(snapshot);
  });
});
