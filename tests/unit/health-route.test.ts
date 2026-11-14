import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('devuelve 200 con el estado ok', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
  });

  it('no permite cachear la respuesta', () => {
    expect(GET().headers.get('cache-control')).toBe('no-store');
  });
});
