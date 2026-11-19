import { describe, expect, it } from 'vitest';

import { computeBackupBuckets } from '@/main/backup/scheduler';

function localTimestamp(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

describe('buckets de copias automáticas', () => {
  it('usa la fecha local para el día y el mes', () => {
    expect(computeBackupBuckets(localTimestamp(2026, 11, 19))).toEqual({
      daily: '2026-11-19',
      weekly: '2026-W47',
      monthly: '2026-11',
    });
  });

  it('calcula la semana ISO del primer día del año', () => {
    // Jueves 1 de enero de 2026: semana 1 de 2026.
    expect(computeBackupBuckets(localTimestamp(2026, 1, 1)).weekly).toBe(
      '2026-W01',
    );
  });

  it('atribuye el lunes anterior al año ISO siguiente', () => {
    // Lunes 29 de diciembre de 2025: semana 1 de 2026.
    expect(computeBackupBuckets(localTimestamp(2025, 12, 29)).weekly).toBe(
      '2026-W01',
    );
  });

  it('admite años con 53 semanas ISO', () => {
    expect(computeBackupBuckets(localTimestamp(2026, 12, 31)).weekly).toBe(
      '2026-W53',
    );
    expect(computeBackupBuckets(localTimestamp(2027, 1, 1)).weekly).toBe(
      '2026-W53',
    );
  });

  it('rellena con ceros el mes y el día', () => {
    expect(computeBackupBuckets(localTimestamp(2026, 1, 5))).toEqual({
      daily: '2026-01-05',
      weekly: '2026-W02',
      monthly: '2026-01',
    });
  });
});
