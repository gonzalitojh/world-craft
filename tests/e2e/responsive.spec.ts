import { expect, test, type Page } from '@playwright/test';

import { es } from '../../src/messages/es';

const viewports = [
  { name: 'móvil', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'escritorio', width: 1280, height: 800 },
];

const routes = [
  '/',
  '/login',
  '/health',
  '/design-system',
  '/esta-ruta-no-existe',
];

for (const viewport of viewports) {
  test(`sin scroll horizontal ni desbordes a ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      expect(
        metrics.scrollWidth,
        `scroll horizontal en ${route} a ${viewport.width}px`,
      ).toBeLessThanOrEqual(metrics.innerWidth);
    }
  });
}

test('los botones se apilan en móvil y se alinean en escritorio', async ({
  page,
}) => {
  const primary = () => page.getByRole('link', { name: es.home.primaryAction });
  const secondary = () =>
    page.getByRole('link', { name: es.home.secondaryAction });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const mobilePrimary = await primary().boundingBox();
  const mobileSecondary = await secondary().boundingBox();

  expect(mobilePrimary).not.toBeNull();
  expect(mobileSecondary).not.toBeNull();
  if (mobilePrimary && mobileSecondary) {
    expect(mobileSecondary.y).toBeGreaterThan(mobilePrimary.y);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  const desktopPrimary = await primary().boundingBox();
  const desktopSecondary = await secondary().boundingBox();

  if (desktopPrimary && desktopSecondary) {
    expect(Math.abs(desktopPrimary.y - desktopSecondary.y)).toBeLessThan(4);
  }
});

test('el título largo envuelve sin desbordar en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const title = page.getByRole('heading', { level: 1, name: es.home.title });
  const box = await title.boundingBox();

  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeLessThanOrEqual(360);
    // Un título de una sola línea desbordaría: comprobamos que ocupa varias.
    expect(box.height).toBeGreaterThan(48);
  }
});

test.describe('shell del taller', () => {
  const rail = (page: Page) =>
    page.getByRole('navigation', { name: es.a11y.sidebarNavigation });

  test('el rail aparece desde 768 px y se completa desde 1024 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/design-system');
    await expect(rail(page)).toBeHidden();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(rail(page)).toBeVisible();

    // Entre 768 y 1023 px el rail es solo iconos: etiqueta accesible, sin texto
    // visible y con el ancho colapsado.
    await expect(
      rail(page).getByRole('link', { name: es.nav.home }),
    ).toBeVisible();
    const collapsed = await rail(page).boundingBox();
    expect(collapsed?.width ?? 0).toBeLessThan(120);

    await page.setViewportSize({ width: 1280, height: 800 });
    const expanded = await rail(page).boundingBox();
    expect(expanded?.width ?? 0).toBeGreaterThan(200);
    await expect(rail(page).getByText(es.nav.home)).toBeVisible();
  });

  test('la barra inferior solo se ve por debajo de 768 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/design-system');

    const more = page.getByRole('button', { name: es.a11y.openMore });

    await expect(more).toBeVisible();

    const box = await more.boundingBox();
    // Objetivo táctil de 44 px.
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(more).toBeHidden();
  });

  test('el último contenido queda por encima de la barra fija', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/design-system');

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    const lastPath = page.getByText(es.design.captures.paths[3] ?? '');
    const bar = page.getByRole('navigation', {
      name: es.a11y.mainNavigation,
    });

    const lastBox = await lastPath.boundingBox();
    const barBox = await bar.boundingBox();

    expect(lastBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    if (lastBox && barBox) {
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barBox.y + 1);
    }
  });

  test('el texto largo y la palabra sin espacios no desbordan a 360 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/design-system');

    const longText = page.getByText(es.design.typography.longText);

    await longText.scrollIntoViewIfNeeded();

    const metrics = await page.evaluate((word) => {
      const target = Array.from(document.querySelectorAll('p')).find(
        (node) => node.textContent?.trim() === word,
      );
      const box = target?.getBoundingClientRect();

      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        wordRight: box ? box.right : 0,
        lines: box ? box.height : 0,
      };
    }, es.design.typography.longWord);

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.wordRight).toBeLessThanOrEqual(metrics.innerWidth);
    // Una palabra larguísima ocupa más de una línea: no se trunca.
    expect(metrics.lines).toBeGreaterThan(20);
  });
});
