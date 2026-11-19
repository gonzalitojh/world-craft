import { describe, expect, it } from 'vitest';

import { selectExpiredBackups } from '@/main/backup/rotation';

function candidates(count: number): { directory: string; createdAt: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    directory: `copia-${index}`,
    createdAt: `2026-11-${String(19 - index).padStart(2, '0')}T10:00:00.000Z`,
  }));
}

describe('selección de copias caducadas', () => {
  it('conserva las más recientes y marca el resto', () => {
    const entries = candidates(5);

    expect(
      selectExpiredBackups({
        candidates: entries,
        keep: 2,
        protectedDirectories: new Set(),
      }),
    ).toEqual(['copia-2', 'copia-3', 'copia-4']);
  });

  it('no caduca nada si la retención cubre todas las copias', () => {
    expect(
      selectExpiredBackups({
        candidates: candidates(3),
        keep: 3,
        protectedDirectories: new Set(),
      }),
    ).toEqual([]);
  });

  it('protege la copia más reciente global y la del propio motivo', () => {
    expect(
      selectExpiredBackups({
        candidates: candidates(3),
        keep: 0,
        protectedDirectories: new Set(['copia-0']),
      }),
    ).toEqual(['copia-1', 'copia-2']);
  });

  it('admite retención cero sin borrar una copia protegida', () => {
    expect(
      selectExpiredBackups({
        candidates: candidates(1),
        keep: 0,
        protectedDirectories: new Set(['copia-0']),
      }),
    ).toEqual([]);
  });
});
