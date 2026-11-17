import { describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';

const mocks = vi.hoisted(() => ({ probeDatabase: vi.fn() }));

vi.mock('@/lib/health', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/health')>();

  return { ...actual, probeDatabase: mocks.probeDatabase };
});

describe('GET /api/health', () => {
  it('devuelve 200 cuando Supabase responde', async () => {
    mocks.probeDatabase.mockResolvedValue('available');

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      database: 'available',
    });
  });

  it.each(['paused', 'error'] as const)(
    'devuelve 503 cuando la base está en %s',
    async (database) => {
      mocks.probeDatabase.mockResolvedValue(database);

      const response = await GET();
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(body).toMatchObject({ status: 'degraded', database });
    },
  );

  it('no permite cachear la respuesta', async () => {
    mocks.probeDatabase.mockResolvedValue('available');

    const response = await GET();

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('no expone detalles de infraestructura en la respuesta', async () => {
    mocks.probeDatabase.mockResolvedValue('error');

    const body = (await (await GET()).json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual([
      'database',
      'status',
      'timestamp',
    ]);
    expect(JSON.stringify(body)).not.toMatch(
      /postgres|password|host|DATABASE_URL/i,
    );
  });
});
