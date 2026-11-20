import type { Page } from '@playwright/test';

import { es as messages } from '../../src/renderer/messages/es';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, test } from './fixtures/electron-app';

const WORLD_NAME = 'Las Mareas Grises';
const WORLD_SUMMARY = 'Una historia de mareas, cartógrafos y pactos de sal.';
const COPY_NAME = messages.worlds.duplicate.defaultName(WORLD_NAME);

async function dismissToasts(page: Page) {
  const closeButtons = page.getByRole('button', { name: /^Cerrar aviso/ });

  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click();
  }
}

async function openCreateDialog(page: Page) {
  await page.getByRole('button', { name: messages.home.emptyAction }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function fillWorldForm(
  page: Page,
  values: {
    readonly name: string;
    readonly summary?: string;
    readonly genres?: string;
  },
) {
  await page
    .getByLabel(messages.worlds.form.nameLabel, { exact: false })
    .fill(values.name);

  if (values.summary !== undefined) {
    await page
      .getByLabel(messages.worlds.form.summaryLabel)
      .fill(values.summary);
  }

  if (values.genres !== undefined) {
    await page.getByLabel(messages.worlds.form.genresLabel).fill(values.genres);
  }
}

async function createWorld(
  page: Page,
  values: {
    readonly name: string;
    readonly summary?: string;
    readonly genres?: string;
  },
) {
  await openCreateDialog(page);
  await fillWorldForm(page, values);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.form.submitCreate })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: values.name, exact: true }),
  ).toBeVisible();
}

test('crea, edita, duplica, archiva, restaura y elimina un mundo', async ({
  page,
}) => {
  await createWorld(page, {
    name: WORLD_NAME,
    summary: WORLD_SUMMARY,
    genres: 'Fantasía, Aventura',
  });

  await expect(
    page.getByText(messages.worlds.notices.created(WORLD_NAME)),
  ).toBeVisible();
  await dismissToasts(page);
  await expect(
    page.getByText(messages.worlds.activity.actions.created),
  ).toBeVisible();

  // Edición desde la página del mundo.
  await page
    .getByRole('button', { name: messages.worlds.card.editNamed(WORLD_NAME) })
    .click();
  await page
    .getByLabel(messages.worlds.form.summaryLabel)
    .fill('Resumen actualizado desde la prueba.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.form.submitEdit })
    .click();
  await expect(
    page.getByText('Resumen actualizado desde la prueba.'),
  ).toBeVisible();
  await expect(
    page.getByText(messages.worlds.notices.updated(WORLD_NAME)),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: messages.worlds.card.editNamed(WORLD_NAME),
    }),
  ).toBeFocused();
  await dismissToasts(page);

  // Duplicado con el nombre propuesto.
  await page
    .getByRole('button', {
      name: messages.worlds.card.duplicateNamed(WORLD_NAME),
    })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.duplicate.submit })
    .click();
  await expect(
    page.getByText(messages.worlds.notices.duplicated(COPY_NAME)),
  ).toBeVisible();
  await dismissToasts(page);

  // Lista: ambos mundos visibles y aislados.
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await expect(
    page.getByRole('heading', { level: 3, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: COPY_NAME, exact: true }),
  ).toBeVisible();

  // Archivado del original.
  await page
    .getByRole('button', {
      name: messages.worlds.card.archiveNamed(WORLD_NAME),
    })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.confirm.archiveSubmit })
    .click();
  await expect(
    page.getByText(messages.worlds.notices.archived(WORLD_NAME)),
  ).toBeVisible();
  await dismissToasts(page);

  await page
    .getByLabel(messages.worlds.list.statusLabel)
    .selectOption('archived');
  await expect(
    page.getByRole('heading', { level: 3, name: WORLD_NAME, exact: true }),
  ).toBeVisible();

  // Restauración.
  await page
    .getByRole('button', {
      name: messages.worlds.card.restoreNamed(WORLD_NAME),
    })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.confirm.restoreSubmit })
    .click();
  await expect(
    page.getByText(messages.worlds.notices.restored(WORLD_NAME)),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: WORLD_NAME, exact: true }),
  ).not.toBeVisible();
  await dismissToasts(page);

  // Eliminación con confirmación de la copia.
  await page.getByLabel(messages.worlds.list.statusLabel).selectOption('all');
  await page
    .getByRole('button', { name: messages.worlds.card.deleteNamed(COPY_NAME) })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.confirm.deleteSubmit })
    .click();
  await expect(
    page.getByText(messages.worlds.notices.deleted(COPY_NAME)),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: COPY_NAME, exact: true }),
  ).not.toBeVisible();
});

test('el diálogo se abre y se cierra por teclado y devuelve el foco', async ({
  page,
}) => {
  const createButton = page.getByRole('button', {
    name: messages.home.emptyAction,
  });

  await createButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByLabel(messages.worlds.form.nameLabel, { exact: false }),
  ).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(createButton).toBeFocused();

  // Cancelar y la X del encabezado también devuelven el foco al disparador.
  await createButton.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.form.cancel })
    .click();
  await expect(createButton).toBeFocused();

  await createButton.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.components.dialog.close })
    .click();
  await expect(createButton).toBeFocused();
});

test('el dashboard y la ficha funcionan en ambos temas y sin desbordar', async ({
  page,
  electronApp,
}) => {
  const longName = 'A'.repeat(120);
  const longSummary = 'Mareas'.repeat(20).slice(0, 280);

  await createWorld(page, {
    name: longName,
    summary: longSummary,
    genres: 'Fantasía',
  });

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

    const worldMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));

    expect(worldMetrics.clientWidth).toBeGreaterThan(0);
    expect(
      worldMetrics.documentWidth,
      JSON.stringify(worldMetrics),
    ).toBeLessThanOrEqual(worldMetrics.clientWidth);
    expect(
      worldMetrics.bodyWidth,
      JSON.stringify(worldMetrics),
    ).toBeLessThanOrEqual(worldMetrics.clientWidth);

    // Inicio con la tarjeta del mundo largo tampoco desborda.
    await page
      .getByRole('navigation', { name: messages.shell.navigationLabel })
      .getByRole('button', { name: messages.shell.views.home })
      .click();
    await expect(
      page.getByRole('heading', { level: 3, name: longName, exact: true }),
    ).toBeVisible();

    const homeMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));

    expect(homeMetrics.documentWidth).toBeLessThanOrEqual(
      homeMetrics.clientWidth,
    );
    expect(homeMetrics.bodyWidth).toBeLessThanOrEqual(homeMetrics.clientWidth);

    // Vuelve a la ficha para la siguiente anchura.
    await page
      .getByRole('button', { name: messages.worlds.card.openNamed(longName) })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: longName, exact: true }),
    ).toBeVisible();
  }
});
