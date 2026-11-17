import { expect, test } from '@playwright/test';

import { es } from '../../src/messages/es';

/**
 * Internacionalización en el navegador (M0-12).
 *
 * Solo existe catálogo español, así que el E2E comprueba lo que ya se puede
 * verificar de verdad: el documento declara su idioma, una preferencia no
 * soportada no rompe la interfaz y las fechas se presentan con `Intl` y `<time>`
 * en UTC, no como ISO en crudo.
 */

test.describe('idioma del documento', () => {
  test('declara español y lo mantiene con Accept-Language no soportado', async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(
      page.getByRole('heading', { level: 1, name: es.home.title }),
    ).toBeVisible();
  });

  test('una cookie de idioma sin catálogo cae al español', async ({
    page,
    baseURL,
    context,
  }) => {
    await context.addCookies([
      {
        name: 'wc-locale',
        value: 'en',
        url: baseURL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(
      page.getByRole('heading', { level: 1, name: es.home.title }),
    ).toBeVisible();
  });

  test('una cookie manipulada no rompe la página', async ({
    page,
    baseURL,
    context,
  }) => {
    await context.addCookies([
      {
        name: 'wc-locale',
        value: '../../etc/passwd',
        url: baseURL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('main')).toBeVisible();
  });
});

test.describe('fechas localizadas', () => {
  test('la comprobación de estado usa <time> con ISO y texto en UTC', async ({
    page,
  }) => {
    await page.goto('/health');

    const checkedAt = page.locator('time');
    const dateTime = await checkedAt.getAttribute('datetime');

    expect(dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // El atributo lleva el instante; el texto visible no repite el ISO crudo.
    await expect(checkedAt).not.toHaveText(dateTime as string);

    // El año se deriva del propio instante para que la prueba no caduque.
    const year = new Date(dateTime as string).getUTCFullYear().toString();

    await expect(checkedAt).toHaveText(new RegExp(year));
    await expect(checkedAt).toHaveText(/(UTC|GMT)/);
    await expect(
      page.getByText(es.health.checkedAtLabel, { exact: true }),
    ).toBeVisible();
  });
});

test.describe('textos centralizados', () => {
  test('la navegación y los avisos accesibles salen del catálogo', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('navigation', { name: es.a11y.mainNavigation }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: es.a11y.openCommandPalette }),
    ).toBeVisible();
    await expect(page.getByText(es.footer.note)).toBeVisible();
  });
});
