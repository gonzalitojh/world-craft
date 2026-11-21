import type { Page } from '@playwright/test';

import { es as messages } from '../../src/renderer/messages/es';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, test } from './fixtures/electron-app';

const WORLD_NAME = 'Las Mareas Grises';

async function dismissToasts(page: Page) {
  const closeButtons = page.getByRole('button', { name: /^Cerrar aviso/ });

  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click();
  }
}

async function createWorld(page: Page) {
  await page.getByRole('button', { name: messages.home.emptyAction }).click();
  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.worlds.form.nameLabel, { exact: false })
    .fill(WORLD_NAME);
  await dialog
    .getByLabel(messages.worlds.form.summaryLabel)
    .fill('Una historia de mareas y cartógrafos.');
  await dialog
    .getByRole('button', { name: messages.worlds.form.submitCreate })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', {
      name: messages.worlds.detail.modules.label,
    }),
  ).toBeVisible();
  await dismissToasts(page);
}

async function openEntities(page: Page) {
  await page
    .getByRole('navigation', {
      name: messages.worlds.detail.modules.label,
    })
    .getByRole('button', { name: messages.worlds.detail.modules.entities })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.entities.list.title }),
  ).toBeVisible();
}

async function createEntity(
  page: Page,
  values: { readonly name: string; readonly type?: string },
) {
  await page
    .locator('#wc-main')
    .getByRole('button', { name: messages.entities.list.create })
    .first()
    .click();

  const dialog = page.getByRole('dialog');

  if (values.type !== undefined) {
    await dialog
      .getByLabel(messages.entities.create.typeLabel)
      .selectOption({ label: values.type });
  }

  await dialog
    .getByLabel(messages.entities.create.nameLabel, { exact: false })
    .fill(values.name);
  await dialog
    .getByRole('button', { name: messages.entities.create.submit })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name: values.name, exact: true }),
  ).toBeVisible();
  await dismissToasts(page);
}

async function openSearchPage(page: Page) {
  // La entrada de producto a la búsqueda es la paleta Ctrl+K; el rail ya no
  // tiene un ítem «Búsqueda».
  await page.keyboard.press('Control+k');

  const palette = page.getByRole('dialog', { name: messages.palette.title });

  await palette
    .getByRole('option', { name: new RegExp(messages.palette.commands.search) })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.search.title }),
  ).toBeVisible();
}

async function measureOverflow(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
}

async function expectNoOverflow(page: Page): Promise<void> {
  const metrics = await measureOverflow(page);

  expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
  expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

test('Ctrl+K no se abre con un diálogo modal abierto', async ({ page }) => {
  await page.getByRole('button', { name: messages.home.emptyAction }).click();

  const worldDialog = page.getByRole('dialog', {
    name: messages.worlds.form.createTitle,
  });

  await expect(worldDialog).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog', { name: messages.palette.title }),
  ).toHaveCount(0);
  await expect(worldDialog).toBeVisible();
});

test('busca por prefijo y error tipográfico, filtra, abre resultados y reconstruye el índice', async ({
  page,
  electronApp,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, { name: 'Gandalf el Gris' });
  await page
    .getByRole('button', { name: messages.entities.detail.back })
    .click();
  await createEntity(page, { name: 'Puerto Sal', type: 'Ciudad' });
  await page
    .getByRole('button', { name: messages.entities.detail.back })
    .click();

  await page
    .getByRole('button', {
      name: messages.entities.card.favoriteNamed('Gandalf el Gris'),
    })
    .click();
  await dismissToasts(page);

  // Paleta con Ctrl+K desde el contenido: busca y abre con Enter.
  await page.locator('#wc-main').getByRole('heading').first().click();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', {
    name: messages.palette.title,
  });
  await expect(palette).toBeVisible();
  await expect(
    palette.getByRole('combobox', { name: messages.palette.inputLabel }),
  ).toBeFocused();

  await palette.getByRole('combobox').fill('gand');
  await expect(
    palette.getByRole('option', { name: /Gandalf el Gris/ }),
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Gandalf el Gris' }),
  ).toBeVisible();
  await dismissToasts(page);

  // Página de búsqueda con recientes y favoritos.
  await openSearchPage(page);
  await expect(
    page.getByRole('heading', { name: messages.search.favoritesTitle }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: messages.search.favoritesTitle })
      .getByRole('button', {
        name: /Gandalf el Gris/,
      }),
  ).toBeVisible();

  const input = page.getByLabel(messages.search.inputLabel);

  // La tolerancia a errores tipográficos mantiene el resultado.
  await input.fill('gandolf');
  await expect(
    page.getByText(/resultados parecidos a «gandalf»/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Gandalf el Gris/,
    }),
  ).toBeVisible();

  // Prefijo y filtros combinados.
  await input.fill('gand');
  await page
    .getByLabel(messages.search.worldLabel, { exact: true })
    .selectOption({ label: WORLD_NAME });
  await page
    .getByLabel(messages.search.kindLabel, { exact: true })
    .selectOption('entity');
  await page
    .getByLabel(messages.search.statusLabel, { exact: true })
    .selectOption('active');

  await expect(page.getByText(/1 resultado/)).toBeVisible();

  // Ctrl+K no se abre dentro de un campo de texto.
  await input.focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Reconstrucción del índice desde la paleta.
  await page
    .getByRole('heading', { level: 2, name: messages.search.title })
    .click();
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog', { name: messages.palette.title }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: messages.palette.inputLabel })
    .fill('reconstruir');
  await expect(
    page.getByRole('option', { name: messages.palette.commands.rebuild }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Índice reconstruido/)).toBeVisible();
  await dismissToasts(page);

  // Abrir un resultado de la lista.
  await input.fill('puerto');
  await page
    .getByRole('button', {
      name: /Puerto Sal/,
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Puerto Sal' }),
  ).toBeVisible();

  // Ventana de escritorio, dos temas y axe con resultados.
  await openSearchPage(page);
  await input.fill('gand');

  for (const width of [1024, 1280, 1600] as const) {
    await electronApp.evaluate(
      ({ BrowserWindow }, size) => {
        const main = BrowserWindow.getAllWindows()[0];

        if (main === undefined) {
          throw new Error('No hay ventana principal.');
        }

        main.setContentSize(size.width, size.height);
      },
      { width, height: 700 },
    );

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        }),
    );

    await expectNoOverflow(page);
  }

  for (const theme of ['light', 'dark'] as const) {
    const html = page.locator('html');
    const currentTheme = await html.getAttribute('data-theme');

    if (currentTheme !== theme) {
      const currentLabel =
        currentTheme === 'dark'
          ? messages.shell.theme.currentDark
          : messages.shell.theme.currentLight;

      await page
        .getByRole('button', {
          name: messages.shell.theme.switchLabel(currentLabel),
        })
        .click();
    }

    await expect(html).toHaveAttribute('data-theme', theme);

    const results = await analyzeWithAxe(page, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });

    expect(results.testEngine.name).toBe('axe-core');
    expect(
      results.violations
        .filter(
          (violation) =>
            violation.impact === 'critical' || violation.impact === 'serious',
        )
        .map((violation) => ({
          id: violation.id,
          help: violation.help,
          nodes: violation.nodes.length,
        })),
    ).toEqual([]);
  }
});
