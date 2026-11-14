import { expect, test } from '@playwright/test';

/**
 * Test de humo del tooling E2E: no arranca servidor ni aplicación.
 * La app real llega con M0-06 (issue #7).
 */
test('renderiza un heading con page.setContent', async ({ page }) => {
  await page.setContent('<main><h1>World Craft</h1></main>');

  await expect(
    page.getByRole('heading', { name: 'World Craft', level: 1 }),
  ).toBeVisible();
});
