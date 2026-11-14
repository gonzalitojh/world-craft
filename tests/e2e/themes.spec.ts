import { expect, test } from '@playwright/test';

import { es } from '../../src/messages/es';

const LIGHT_SURFACE = 'rgb(247, 242, 232)';
const DARK_SURFACE = 'rgb(21, 18, 14)';

test.describe('temas Claro y Oscuro', () => {
  test('sigue la preferencia del sistema al cargar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      )
      .toBe(DARK_SURFACE);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      )
      .toBe(LIGHT_SURFACE);
  });

  test('reacciona al cambio de tema sin recargar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('el texto y las superficies usan los tokens en ambos temas', async ({
    page,
  }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');

      const colors = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const heading = getComputedStyle(
          document.querySelector('h1') as HTMLElement,
        );

        return {
          background: body.backgroundColor,
          text: body.color,
          heading: heading.color,
          headingFamily: heading.fontFamily,
        };
      });

      expect(colors.background).toBe(
        colorScheme === 'dark' ? DARK_SURFACE : LIGHT_SURFACE,
      );
      expect(colors.text).toBe(colors.heading);
      expect(colors.headingFamily).toMatch(/Fraunces|serif/i);
      expect(colors.text).not.toBe(colors.background);
    }
  });

  test('el botón deshabilitado usa tokens legibles en ambos temas', async ({
    page,
  }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/login');

      const button = page.getByRole('button', {
        name: es.login.disabledAction,
      });
      const mutedText = page.getByText(es.login.description);

      const buttonStyles = await button.evaluate((node) => {
        const styles = getComputedStyle(node);
        return {
          background: styles.backgroundColor,
          color: styles.color,
          opacity: styles.opacity,
        };
      });
      const mutedColor = await mutedText.evaluate(
        (node) => getComputedStyle(node).color,
      );

      // Sin opacidad reducida: el estado inactivo se marca con superficie
      // elevada y texto atenuado, no bajando el contraste.
      expect(buttonStyles.opacity).toBe('1');
      expect(buttonStyles.color).toBe(mutedColor);
      expect(buttonStyles.background).not.toBe(buttonStyles.color);
    }
  });
});
