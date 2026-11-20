import { join } from 'node:path';

import type { Page } from '@playwright/test';
import sharp from 'sharp';

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
    page.getByRole('heading', { level: 2, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
  await dismissToasts(page);
}

async function openEntities(page: Page) {
  await page
    .getByRole('button', { name: messages.entities.list.title })
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

async function backToEntities(page: Page) {
  await page
    .getByRole('button', { name: messages.entities.detail.back })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.entities.list.title }),
  ).toBeVisible();
}

async function waitForSaved(page: Page) {
  await expect(page.getByText(messages.entities.detail.saved)).toBeVisible({
    timeout: 10_000,
  });
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

async function expectAxeWithoutSerious(page: Page): Promise<void> {
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

test('crea, edita, autoguarda, etiqueta, marca favorita y filtra fichas', async ({
  page,
  electronApp,
  userDataDir,
}) => {
  await createWorld(page);
  await openEntities(page);

  await expect(
    page.getByRole('heading', { name: messages.entities.list.emptyTitle }),
  ).toBeVisible();

  await createEntity(page, { name: 'Mara Viento' });

  await page
    .getByLabel(messages.entities.detail.aliasesLabel)
    .fill('La Cartógrafa');
  await waitForSaved(page);

  const editor = page.locator('.wc-editor__content');
  await editor.click();
  await page.keyboard.type('Mara dibuja mapas con tinta de sal.');
  await waitForSaved(page);

  // Importación con el diálogo nativo: se sustituye el selector solo en el
  // proceso principal y se usa una imagen real para que sharp la procese.
  const imagePath = join(userDataDir, 'retrato.png');
  await sharp({
    create: {
      width: 96,
      height: 96,
      channels: 3,
      background: '#5a7a55',
    },
  })
    .png()
    .toFile(imagePath);

  await electronApp.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [filePath],
    })) as unknown as typeof dialog.showOpenDialog;
  }, imagePath);

  const side = page.locator('.wc-entity-side');
  await side
    .getByRole('button', { name: messages.entities.detail.addImages })
    .first()
    .click();

  const galleryThumb = page.locator('.wc-gallery__thumb').first();
  await expect(galleryThumb).toBeVisible();
  await expect(galleryThumb).toHaveAttribute('src', /^wc-asset:\/\/thumb\//);

  await side
    .getByRole('button', { name: messages.entities.detail.chooseMain })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel(
      messages.entities.detail.setMainNamed(
        messages.entities.detail.imageOption(1),
      ),
    )
    .click();
  await expect(page.locator('.wc-entity-image__picture')).toHaveAttribute(
    'src',
    /^wc-asset:\/\/asset\//,
  );

  await page
    .getByRole('button', { name: messages.entities.detail.newTag })
    .click();
  const tagDialog = page.getByRole('dialog');

  await tagDialog.getByLabel(messages.entities.tags.nameLabel).fill('Norte');
  await tagDialog
    .getByRole('button', { name: messages.entities.tags.submit })
    .click();
  await expect(page.getByText('Norte', { exact: true }).first()).toBeVisible();
  await dismissToasts(page);

  await page
    .getByRole('button', { name: messages.entities.detail.favorite })
    .click();
  await expect(
    page.getByRole('button', { name: messages.entities.detail.unfavorite }),
  ).toBeVisible();
  await dismissToasts(page);

  await backToEntities(page);
  await createEntity(page, { name: 'Puerto Sal', type: 'Ciudad' });
  await backToEntities(page);

  const filters = page.locator('.wc-filters');

  await filters.getByLabel(messages.entities.list.searchLabel).fill('Mara');
  await expect(page.getByText('Mara Viento')).toBeVisible();
  await expect(page.getByText('Puerto Sal')).not.toBeVisible();
  await filters.getByLabel(messages.entities.list.searchLabel).fill('');
  await expect(page.getByText('Puerto Sal')).toBeVisible();

  await filters
    .getByLabel(messages.entities.list.typeLabel, { exact: true })
    .selectOption({ label: 'Ciudad' });
  await expect(page.getByText('Puerto Sal')).toBeVisible();
  await expect(page.getByText('Mara Viento')).not.toBeVisible();
  await page
    .getByRole('button', { name: messages.entities.list.clearFilters })
    .click();

  await filters
    .getByLabel(messages.entities.list.tagLabel, { exact: true })
    .selectOption({ label: 'Norte' });
  await expect(page.getByText('Mara Viento')).toBeVisible();
  await expect(page.getByText('Puerto Sal')).not.toBeVisible();
  await page
    .getByRole('button', { name: messages.entities.list.clearFilters })
    .click();

  await filters.getByLabel(messages.entities.list.favoriteLabel).check();
  await expect(page.getByText('Mara Viento')).toBeVisible();
  await expect(page.getByText('Puerto Sal')).not.toBeVisible();
  await filters.getByLabel(messages.entities.list.favoriteLabel).uncheck();

  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed('Mara Viento'),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();
  await expect(
    page.getByLabel(messages.entities.detail.aliasesLabel),
  ).toHaveValue('La Cartógrafa');
  await expect(
    page.getByText('Mara dibuja mapas con tinta de sal.'),
  ).toBeVisible();

  await page
    .getByRole('button', { name: messages.entities.editor.link })
    .click();
  const linkDialog = page.getByRole('dialog');

  await linkDialog
    .getByLabel(messages.entities.editor.linkSearch)
    .fill('Puerto Sal');
  await linkDialog.getByRole('button', { name: /Puerto Sal/ }).click();

  const internalLink = page
    .locator('.wc-editor__content a')
    .filter({ hasText: 'Puerto Sal' })
    .first();
  await expect(internalLink).toHaveAttribute(
    'href',
    /^wc-entity:\/\/[0-9a-f-]{36}$/,
  );
  await internalLink.click();
  await page
    .getByRole('button', { name: messages.entities.editor.linkOpen })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Puerto Sal' }),
  ).toBeVisible();
});

test('la creación rápida desde la barra superior abre la ficha en el mundo actual', async ({
  page,
}) => {
  await createWorld(page);

  await page
    .getByRole('banner')
    .getByRole('button', { name: messages.entities.quick.button })
    .click();

  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.entities.create.nameLabel, { exact: false })
    .fill('Mara Viento');
  await dialog
    .getByRole('button', { name: messages.entities.quick.submit })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();
  await expect(page.getByText('Personaje').first()).toBeVisible();

  await backToEntities(page);
  await expect(page.getByText('Mara Viento')).toBeVisible();
});

test('la lista y la ficha con contenido largo no desbordan y pasan axe en ambos temas', async ({
  page,
  electronApp,
}) => {
  const longName = 'A'.repeat(120);
  const longSummary = 'Mareas'.repeat(46).slice(0, 280);
  const longAlias = 'Alias'.repeat(16);
  const longTag = 'Norte'.repeat(8);
  const longText = 'X'.repeat(800);

  await createWorld(page);
  await openEntities(page);
  await createEntity(page, { name: longName });

  await page.getByLabel(messages.entities.detail.aliasesLabel).fill(longAlias);
  await page
    .getByLabel(messages.entities.detail.summaryLabel)
    .fill(longSummary);
  await page.locator('.wc-editor__content').click();
  await page.keyboard.type(longText);
  await waitForSaved(page);

  await page
    .getByRole('button', { name: messages.entities.detail.newTag })
    .click();
  const tagDialog = page.getByRole('dialog');

  await tagDialog.getByLabel(messages.entities.tags.nameLabel).fill(longTag);
  await tagDialog
    .getByRole('button', { name: messages.entities.tags.submit })
    .click();
  await waitForSaved(page);
  await dismissToasts(page);
  await backToEntities(page);

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

    await page
      .getByRole('button', {
        name: messages.entities.card.openNamed(longName),
      })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: longName }),
    ).toBeVisible();
    await expectNoOverflow(page);
    await backToEntities(page);
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
    await expectAxeWithoutSerious(page);

    await page
      .locator('#wc-main')
      .getByRole('button', { name: messages.entities.list.create })
      .first()
      .click();
    await expectAxeWithoutSerious(page);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: messages.entities.create.cancel })
      .click();

    await page
      .getByRole('button', { name: messages.entities.list.manageTypes })
      .click();
    await expect(
      page.getByRole('dialog').getByText(messages.entities.types.lead),
    ).toBeVisible();
    await expectAxeWithoutSerious(page);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: messages.entities.types.close })
      .last()
      .click();

    await page
      .getByRole('button', {
        name: messages.entities.card.openNamed(longName),
      })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: longName }),
    ).toBeVisible();
    await expectAxeWithoutSerious(page);
    await backToEntities(page);
  }
});
