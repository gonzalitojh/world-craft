import { expect, test } from '@playwright/test';

test.describe('endpoint de salud y cabeceras', () => {
  test('GET /api/health devuelve JSON sin caché', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['cache-control']).toBe('no-store');

    const body = (await response.json()) as {
      status?: string;
      timestamp?: string;
    };

    expect(body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.timestamp ?? ''))).toBe(false);
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
  });

  test('las páginas aplican las cabeceras de seguridad', async ({
    request,
  }) => {
    const response = await request.get('/');

    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    // `poweredByHeader: false` oculta Next.js.
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('el manifest es válido y apunta al icono', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');

    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name?: string;
      start_url?: string;
      icons?: Array<{ src?: string }>;
    };

    expect(manifest.name).toBe('World Craft');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons?.[0]?.src).toBe('/icon.svg');
  });

  test('el favicon vectorial se sirve correctamente', async ({ request }) => {
    const response = await request.get('/icon.svg');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  });
});
