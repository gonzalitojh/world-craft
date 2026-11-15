import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { es } from '../../src/messages/es';

/**
 * Accesibilidad con axe (issue #8).
 *
 * Se revisan las pantallas en los dos temas y, en la página viva, también con
 * los overlays abiertos: un diálogo o un panel modal atraviesan el árbol de
 * accesibilidad (foco atrapado, fondo con `aria-hidden`), así que merecen su
 * propia pasada.
 */

const routes = [
  { path: '/', name: 'portada' },
  { path: '/login', name: 'login' },
  { path: '/health', name: 'estado' },
  { path: '/design-system', name: 'sistema de diseño' },
  { path: '/esta-ruta-no-existe', name: '404' },
];

/** Errores que bloquean la entrega: críticos o graves. */
async function blockingViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();

  return results.violations
    .filter(
      (violation) =>
        violation.impact === 'critical' || violation.impact === 'serious',
    )
    .map(
      (violation) => `${violation.id} (${violation.impact}): ${violation.help}`,
    );
}

for (const route of routes) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`sin errores críticos ni graves en ${route.name} (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(route.path);

      expect(await blockingViolations(page)).toEqual([]);
    });
  }
}

/*
 * `landmark-unique` es una regla moderada y por eso no entra en
 * `blockingViolations`. La página viva sí la incumplió: dos especímenes de
 * «Estado vacío» compartían nombre de región. Se comprueba aparte, en los dos
 * temas, para que no vuelva a colarse.
 */
test.describe('regiones con nombre único en la página viva', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`sin regiones homónimas (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/design-system');

      const results = await new AxeBuilder({ page })
        .withRules(['landmark-unique'])
        .analyze();

      expect(
        results.violations.map(
          (violation) => `${violation.id}: ${violation.help}`,
        ),
      ).toEqual([]);
    });
  }
});

test.describe('página del sistema de diseño con overlays abiertos', () => {
  test('diálogo abierto', async ({ page }) => {
    await page.goto('/design-system');

    await page
      .getByRole('button', { name: es.design.components.dialog.trigger })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });

  test('panel lateral abierto', async ({ page }) => {
    await page.goto('/design-system');

    await page
      .getByRole('button', { name: es.design.components.drawer.bottom })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });

  test('paleta de comandos abierta', async ({ page }) => {
    await page.goto('/design-system');

    await page.getByRole('button', { name: es.design.commandLabel }).click();
    await expect(
      page.getByRole('dialog', { name: es.command.title }),
    ).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });

  test('aviso visible', async ({ page }) => {
    await page.goto('/design-system');

    await page
      .getByRole('button', { name: es.design.components.toast.success })
      .click();
    await expect(
      page
        .getByRole('region', { name: es.toast.regionPolite, exact: true })
        .getByText(es.design.components.toast.success),
    ).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });
});
