import { expect, test } from '@playwright/test';

import { es } from '../../src/messages/es';

/**
 * Página viva del sistema de diseño (issue #8, fase 3).
 *
 * Aquí se prueba lo que solo se puede comprobar con un navegador: el orden del
 * documento, la trampa de foco de los overlays, la devolución del foco, las
 * teclas de las pestañas y de la paleta, el anuncio de los avisos y el globo de
 * ayuda al enfocar.
 *
 * Los nombres visibles salen del catálogo para no repetir cadenas.
 */

test.describe('estructura y orden de foco', () => {
  test('el enlace de salto es lo primero y lleva al contenido', async ({
    page,
  }) => {
    await page.goto('/design-system');

    const skipLink = page.getByRole('link', { name: es.a11y.skipToContent });

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();
  });

  test('el orden del documento es topbar, rail y contenido', async ({
    page,
  }) => {
    await page.goto('/design-system');

    const order = await page.evaluate(
      (labels) => {
        const banner = document.querySelector('header');
        const rail = document.querySelector(`nav[aria-label="${labels.rail}"]`);
        const main = document.querySelector('main');
        const bottomBar = document.querySelector(
          `nav[aria-label="${labels.main}"]`,
        );

        if (!banner || !rail || !main) {
          return { found: false };
        }

        const follows = (first: Element, second: Element) =>
          Boolean(
            first.compareDocumentPosition(second) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          );

        return {
          found: true,
          bannerBeforeRail: follows(banner, rail),
          railBeforeMain: follows(rail, main),
          mainBeforeBottomBar: bottomBar ? follows(main, bottomBar) : true,
        };
      },
      { rail: es.a11y.sidebarNavigation, main: es.a11y.mainNavigation },
    );

    expect(order).toEqual({
      found: true,
      bannerBeforeRail: true,
      railBeforeMain: true,
      mainBeforeBottomBar: true,
    });
  });
});

test.describe('overlays', () => {
  test('el diálogo atrapa el foco y lo devuelve al cerrarse', async ({
    page,
  }) => {
    await page.goto('/design-system');

    const trigger = page.getByRole('button', {
      name: es.design.components.dialog.trigger,
    });

    await trigger.click();

    const dialog = page.getByRole('dialog', {
      name: es.design.components.dialog.heading,
    });

    await expect(dialog).toBeVisible();

    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() =>
          Boolean(document.activeElement?.closest('[role="dialog"]')),
        ),
      ).toBe(true);
    }

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('el panel lateral se cierra con Escape y devuelve el foco', async ({
    page,
  }) => {
    await page.goto('/design-system');

    const trigger = page.getByRole('button', {
      name: es.design.components.drawer.right,
    });

    await trigger.click();

    const panel = page.getByRole('dialog', {
      name: es.design.components.drawer.heading,
    });

    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-side', 'right');

    await page.keyboard.press('Escape');

    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('la paleta de comandos abre con Ctrl+K y devuelve el foco', async ({
    page,
  }) => {
    await page.goto('/design-system');

    const launcher = page.getByRole('button', {
      name: es.design.commandLabel,
    });
    const dialog = page.getByRole('dialog', { name: es.command.title });

    // Abrir con el botón confirma que la isla ya está hidratada; el atajo se
    // prueba justo después, con el foco de vuelta en el mismo botón.
    await launcher.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();

    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('combobox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
  });
});

test.describe('componentes interactivos', () => {
  test('las pestañas se mueven con las flechas', async ({ page }) => {
    await page.goto('/design-system');

    const first = page.getByRole('tab', {
      name: es.design.components.tabs.first,
    });
    const second = page.getByRole('tab', {
      name: es.design.components.tabs.second,
    });

    await first.focus();
    await page.keyboard.press('ArrowRight');

    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(
      page
        .getByRole('tabpanel')
        .getByText(es.design.components.tabs.secondBody),
    ).toBeVisible();
  });

  test('el aviso se anuncia en la región viva y se cierra con teclado', async ({
    page,
  }) => {
    await page.goto('/design-system');

    await page
      .getByRole('button', { name: es.design.components.toast.info })
      .click();

    const region = page.getByRole('region', {
      name: es.toast.regionPolite,
      exact: true,
    });

    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(
      region.getByText(es.design.components.toast.info),
    ).toBeVisible();

    const dismiss = region.getByRole('button', {
      name: es.a11y.dismissToast,
    });

    await dismiss.focus();
    await page.keyboard.press('Enter');

    await expect(
      region.getByText(es.design.components.toast.info),
    ).toBeHidden();
  });

  test('el globo de ayuda aparece al enfocar el disparador', async ({
    page,
  }) => {
    await page.goto('/design-system');

    const trigger = page.getByRole('button', {
      name: es.design.components.tooltip.trigger,
    });

    await trigger.focus();

    const tooltip = page.getByRole('tooltip');

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(es.design.components.tooltip.helper);
  });
});
