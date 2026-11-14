import { describe, expect, it } from 'vitest';

import { buildHealthPayload } from '@/lib/health';

describe('buildHealthPayload', () => {
  it('devuelve el estado ok con una marca ISO', () => {
    const now = new Date('2026-11-14T10:00:00.000Z');

    expect(buildHealthPayload(now)).toEqual({
      status: 'ok',
      timestamp: '2026-11-14T10:00:00.000Z',
    });
  });

  it('usa la hora actual por defecto', () => {
    const before = Date.now();
    const payload = buildHealthPayload();
    const after = Date.now();

    expect(payload.status).toBe('ok');
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);

    const timestamp = Date.parse(payload.timestamp);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('solo expone el estado y la marca de tiempo', () => {
    expect(Object.keys(buildHealthPayload()).sort()).toEqual([
      'status',
      'timestamp',
    ]);
  });
});
