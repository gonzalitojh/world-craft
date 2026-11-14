import { expect, test } from '@playwright/test';

import { es } from '../../src/messages/es';

test.describe('rutas base', () => {
  test('la portada muestra el título, la navegación y las acciones', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: es.home.title }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: es.a11y.mainNavigation }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: es.home.primaryAction }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: es.home.secondaryAction }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('solo hay un h1 en la portada', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('login es un placeholder sin formulario', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { level: 1, name: es.login.title }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: es.login.disabledAction }),
    ).toBeDisabled();
    await expect(page.getByText(es.login.disabledReason)).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
  });

  test('health muestra el estado operativo con texto, no solo color', async ({
    page,
  }) => {
    await page.goto('/health');

    await expect(
      page.getByRole('heading', { level: 1, name: es.health.title }),
    ).toBeVisible();
    await expect(
      page.getByText(es.health.statusOk, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(es.health.commitLabel)).toBeVisible();
  });

  test('una ruta inexistente devuelve 404 con la página propia', async ({
    page,
  }) => {
    const response = await page.goto('/esta-ruta-no-existe');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: es.notFound.title }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: es.notFound.backHome }),
    ).toBeVisible();
  });

  test('el enlace de salto es lo primero en recibir el foco', async ({
    page,
  }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: es.a11y.skipToContent });

    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });

  test('los metadatos declaran noindex y el idioma español', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
  });
});
