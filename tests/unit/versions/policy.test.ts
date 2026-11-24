import { describe, expect, it } from 'vitest';

import {
  AUTO_VERSION_MAX,
  AUTO_VERSION_RETENTION_MS,
  VERSION_COALESCE_WINDOW_MS,
  type VersionOrigin,
} from '@/shared/contracts/versions';

import {
  canCreateManualVersion,
  selectExpiredVersionIds,
  shouldCreateAutoVersion,
  type VersionPolicyEntry,
} from '@/main/versions/policy';

const NOW = 1_760_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function entry(
  id: string,
  origin: VersionOrigin,
  createdAt: number,
): VersionPolicyEntry {
  return { id, origin, createdAt };
}

describe('política de versiones', () => {
  it('abre una ráfaga nueva cuando no hay versión previa o la última no es automática', () => {
    expect(shouldCreateAutoVersion(null, NOW)).toBe(true);
    expect(shouldCreateAutoVersion(entry('manual', 'manual', NOW), NOW)).toBe(
      true,
    );
    expect(shouldCreateAutoVersion(entry('restore', 'restore', NOW), NOW)).toBe(
      true,
    );
  });

  it('agrupa los autoguardados dentro de la ventana de cinco minutos', () => {
    const justInside = NOW - (VERSION_COALESCE_WINDOW_MS - 1);
    const exactlyOutside = NOW - VERSION_COALESCE_WINDOW_MS;

    expect(
      shouldCreateAutoVersion(entry('auto', 'auto', justInside), NOW),
    ).toBe(false);
    expect(
      shouldCreateAutoVersion(entry('auto', 'auto', exactlyOutside), NOW),
    ).toBe(true);
  });

  it('poda las automáticas más antiguas al superar el máximo y protege la más reciente', () => {
    const entries = Array.from({ length: AUTO_VERSION_MAX + 3 }, (_, index) =>
      entry(`auto-${index}`, 'auto', NOW - index * 1_000),
    );

    const expired = selectExpiredVersionIds(entries, NOW);

    expect(expired).toHaveLength(3);
    expect(expired).not.toContain('auto-0');
    expect(expired).toEqual(['auto-22', 'auto-21', 'auto-20']);
  });

  it('poda por retención de 90 días aunque no supere el máximo', () => {
    const entries = [
      entry('recent', 'auto', NOW - 1_000),
      entry('old', 'auto', NOW - AUTO_VERSION_RETENTION_MS - DAY),
    ];

    expect(selectExpiredVersionIds(entries, NOW)).toEqual(['old']);
  });

  it('nunca poda la automática más reciente aunque esté fuera de retención', () => {
    const entries = [
      entry('only-old', 'auto', NOW - AUTO_VERSION_RETENTION_MS - DAY),
    ];

    expect(selectExpiredVersionIds(entries, NOW)).toEqual([]);
  });

  it('no poda nunca versiones manuales ni de restauración', () => {
    const entries = Array.from({ length: 60 }, (_, index) =>
      entry(
        `manual-${index}`,
        index % 2 === 0 ? 'manual' : 'restore',
        NOW - index * DAY,
      ),
    );

    expect(selectExpiredVersionIds(entries, NOW)).toEqual([]);
  });

  it('bloquea las manuales al alcanzar el tope, sin podar las existentes', () => {
    const atLimit = Array.from({ length: 50 }, (_, index) =>
      entry(`manual-${index}`, 'manual', NOW),
    );

    expect(canCreateManualVersion(atLimit)).toBe(false);
    expect(selectExpiredVersionIds(atLimit, NOW)).toEqual([]);
  });

  it('permite crear manuales por debajo del tope y las bloquea al alcanzarlo', () => {
    expect(canCreateManualVersion([])).toBe(true);
    expect(
      canCreateManualVersion(
        Array.from({ length: 49 }, (_, index) =>
          entry(`manual-${index}`, 'manual', NOW),
        ),
      ),
    ).toBe(true);
    expect(
      canCreateManualVersion(
        Array.from({ length: 50 }, (_, index) =>
          entry(`manual-${index}`, 'manual', NOW),
        ),
      ),
    ).toBe(false);
  });
});
