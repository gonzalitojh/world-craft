import type { ElectronApplication, Page } from '@playwright/test';

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

async function goHome(page: Page) {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.home })
    .click();
}

async function goWorlds(page: Page) {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
}

function worldModules(page: Page) {
  return page.getByRole('navigation', {
    name: messages.worlds.detail.modules.label,
  });
}

async function openEntities(page: Page) {
  await worldModules(page)
    .getByRole('button', { name: messages.worlds.detail.modules.entities })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.entities.list.title }),
  ).toBeVisible();
}

async function createEntity(page: Page, name: string) {
  await openEntities(page);

  await page
    .locator('#wc-main')
    .getByRole('button', { name: messages.entities.list.create })
    .first()
    .click();

  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.entities.create.nameLabel, { exact: false })
    .fill(name);
  await dialog
    .getByRole('button', { name: messages.entities.create.submit })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name, exact: true }),
  ).toBeVisible();
  await dismissToasts(page);
}

async function openCardMenu(page: Page, name: string) {
  await page
    .getByRole('button', { name: messages.worlds.card.actionsNamed(name) })
    .click();
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  const html = page.locator('html');
  const current = await html.getAttribute('data-theme');

  if (current !== theme) {
    const currentLabel =
      current === 'dark'
        ? messages.shell.theme.currentDark
        : messages.shell.theme.currentLight;

    await page
      .getByRole('button', {
        name: messages.shell.theme.switchLabel(currentLabel),
      })
      .click();
  }

  await expect(html).toHaveAttribute('data-theme', theme);
}

async function setRail(page: Page, collapsed: boolean) {
  const collapseButton = page.getByRole('button', {
    name: messages.shell.collapse,
  });
  const expanded = (await collapseButton.count()) > 0;

  if (collapsed && expanded) {
    await collapseButton.click();
  } else if (!collapsed && !expanded) {
    await page.getByRole('button', { name: messages.shell.expand }).click();
  }
}

async function setContentWidth(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
) {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, 700);
    },
    { width },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function fillWorldForm(
  page: Page,
  values: {
    readonly name: string;
    readonly summary?: string;
    readonly description?: string;
    readonly genres?: string;
    readonly slug?: string;
  },
) {
  await page
    .getByLabel(messages.worlds.form.nameLabel, { exact: false })
    .fill(values.name);

  if (values.slug !== undefined) {
    await page
      .getByLabel(messages.worlds.form.slugLabel, { exact: false })
      .fill(values.slug);
  }

  if (values.summary !== undefined) {
    await page
      .getByLabel(messages.worlds.form.summaryLabel)
      .fill(values.summary);
  }

  if (values.description !== undefined) {
    await page
      .getByLabel(messages.worlds.form.descriptionLabel)
      .fill(values.description);
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
    readonly description?: string;
    readonly genres?: string;
    readonly slug?: string;
  },
) {
  await openCreateDialog(page);
  await fillWorldForm(page, values);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.form.submitCreate })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: values.name, exact: true }),
  ).toBeVisible();
  await expect(worldModules(page)).toBeVisible();
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

  // Edición desde el menú «⋯» de la barra superior.
  await page
    .getByRole('button', { name: messages.shell.viewMenuLabel })
    .click();
  await page.getByRole('menuitem', { name: messages.worlds.card.edit }).click();
  await page
    .getByRole('dialog')
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
    page.getByRole('button', { name: messages.shell.viewMenuLabel }),
  ).toBeFocused();
  await dismissToasts(page);

  // Duplicado con el nombre propuesto.
  await page
    .getByRole('button', { name: messages.shell.viewMenuLabel })
    .click();
  await page
    .getByRole('menuitem', { name: messages.worlds.card.duplicate })
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

  // Archivado del original desde el menú «⋯» de la tarjeta.
  await openCardMenu(page, WORLD_NAME);
  await page
    .getByRole('menuitem', { name: messages.worlds.card.archive })
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
  await openCardMenu(page, WORLD_NAME);
  await page
    .getByRole('menuitem', { name: messages.worlds.card.restore })
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
  await openCardMenu(page, COPY_NAME);
  await page
    .getByRole('menuitem', { name: messages.worlds.card.delete })
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

test('Continúa con el último mundo de la sesión y se pierde al recargar', async ({
  page,
}) => {
  await createWorld(page, { name: WORLD_NAME });
  await goHome(page);

  const continueRegion = page.getByRole('region', {
    name: messages.home.continueTitle,
  });

  await expect(continueRegion).toBeVisible();
  await expect(
    continueRegion.getByRole('heading', { level: 3, name: WORLD_NAME }),
  ).toBeVisible();

  await continueRegion
    .getByRole('button', { name: messages.home.continueWorldAction })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
  await expect(worldModules(page)).toBeVisible();

  await goHome(page);
  await expect(
    page.getByRole('region', { name: messages.home.continueTitle }),
  ).toBeVisible();

  // La memoria es de sesión: al recargar desaparece y manda la estantería.
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: messages.home.continueTitle }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 3, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
});

test('Continúa con la última ficha abierta y vuelve a ella', async ({
  page,
}) => {
  const entityName = 'Aldo Varela';

  await createWorld(page, { name: WORLD_NAME });
  await createEntity(page, entityName);
  await goHome(page);

  const continueRegion = page.getByRole('region', {
    name: messages.home.continueTitle,
  });

  await expect(
    continueRegion.getByRole('heading', { level: 3, name: entityName }),
  ).toBeVisible();
  await expect(
    continueRegion.getByText(messages.home.continueEntityMeta(WORLD_NAME)),
  ).toBeVisible();

  await continueRegion
    .getByRole('button', { name: messages.home.continueEntityAction })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name: entityName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
});

test('Continuar desaparece si se elimina el mundo recordado', async ({
  page,
}) => {
  await createWorld(page, { name: WORLD_NAME });
  await goHome(page);
  await expect(
    page.getByRole('region', { name: messages.home.continueTitle }),
  ).toBeVisible();

  await goWorlds(page);
  await openCardMenu(page, WORLD_NAME);
  await page
    .getByRole('menuitem', { name: messages.worlds.card.delete })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.confirm.deleteSubmit })
    .click();

  // Al borrar el mundo abierto, App vuelve a Inicio y el destino deja de existir.
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: messages.home.continueTitle }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: messages.home.emptyTitle }),
  ).toBeVisible();
});

test('el menú de la tarjeta funciona con teclado y devuelve el foco', async ({
  page,
}) => {
  await createWorld(page, { name: WORLD_NAME });
  await goHome(page);

  const trigger = page.getByRole('button', {
    name: messages.worlds.card.actionsNamed(WORLD_NAME),
  });

  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: messages.worlds.card.edit }),
  ).toBeFocused();

  await page.keyboard.press('End');
  await expect(
    page.getByRole('menuitem', { name: messages.worlds.card.delete }),
  ).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('la vista de mundo es modular', async ({ page }) => {
  const modules = messages.worlds.detail.modules;
  const entityName = 'Mara Viento';

  await createWorld(page, { name: WORLD_NAME });

  const nav = worldModules(page);

  await expect(
    nav.getByRole('button', { name: modules.summary }),
  ).toHaveAttribute('aria-current', 'page');

  for (const label of [modules.maps, modules.manuscript, modules.graph]) {
    await expect(nav.getByRole('button', { name: label })).toHaveCount(0);
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }

  await expect(nav.getByText(modules.planned)).toHaveCount(3);

  const entitiesButton = nav.getByRole('button', { name: modules.entities });

  await expect(entitiesButton).toContainText(messages.entities.list.count(0));

  // Entrada con teclado: Resumen está enfocado y Tab llega a Fichas.
  await nav.getByRole('button', { name: modules.summary }).focus();
  await page.keyboard.press('Tab');
  await expect(entitiesButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { level: 2, name: messages.entities.list.title }),
  ).toBeVisible();

  await page
    .locator('#wc-main')
    .getByRole('button', { name: messages.entities.list.create })
    .first()
    .click();

  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.entities.create.nameLabel, { exact: false })
    .fill(entityName);
  await dialog
    .getByRole('button', { name: messages.entities.create.submit })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: entityName, exact: true }),
  ).toBeVisible();
  await dismissToasts(page);

  // Vuelve al mundo: el recuento se refresca al remontar la página.
  await page
    .getByRole('button', { name: messages.entities.detail.back })
    .click();
  await page
    .getByRole('button', { name: messages.entities.list.backToWorld })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
  await expect(entitiesButton).toContainText(messages.entities.list.count(1));
});

test('la vista de mundo no desborda ni rompe el contraste con contenido largo', async ({
  page,
  electronApp,
}) => {
  const longName =
    'Crónica de la expedición al archipiélago de las Mareas Grises y los pactos de sal del alba';
  const longSlug =
    'cronica-de-la-expedicion-al-archipielago-mareas-grises-pactos-de-sal';
  const description =
    'La expedición recorrió las islas del norte, levantó actas de cada desembarco y dibujó a mano las líneas de bajamar que el atlas oficial daba por definitivas. '
      .repeat(40)
      .slice(0, 4_000);
  const genres = [
    'Fantasía épica',
    'Aventura marítima',
    'Misterio de marea',
    'Histórico naval',
    'Cartografía imaginaria',
    'Intriga cortesana',
    'Viajes y exploración',
    'Pactos de sal',
  ];

  expect(longName.length).toBeLessThanOrEqual(120);
  expect(longSlug.length).toBeLessThanOrEqual(80);
  expect(description).toHaveLength(4_000);

  await createWorld(page, {
    name: longName,
    slug: longSlug,
    description,
    genres: genres.join(', '),
  });

  for (const collapsed of [false, true] as const) {
    await setRail(page, collapsed);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);

      for (const width of [1024, 1280, 1600] as const) {
        await setContentWidth(electronApp, page, width);

        const context = `${width}px, rail ${collapsed ? 'plegado' : 'expandido'}, tema ${theme}`;

        await expect(
          page.getByRole('heading', {
            level: 1,
            name: longName,
            exact: true,
          }),
        ).toBeVisible();
        await expect(worldModules(page)).toBeVisible();
        await expect(page.locator('.wc-world-header__genres li')).toHaveCount(
          8,
        );
        await expect(page.getByText(longSlug)).toBeVisible();

        const descriptionNode = page.locator('.wc-world-description');

        expect((await descriptionNode.textContent())?.length, context).toBe(
          4_000,
        );

        const metrics = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
        }));

        expect(metrics.clientWidth).toBeGreaterThan(0);
        expect(
          metrics.documentWidth,
          `${context}: ${JSON.stringify(metrics)}`,
        ).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.clientWidth);

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
                violation.impact === 'critical' ||
                violation.impact === 'serious',
            )
            .map((violation) => ({
              id: violation.id,
              help: violation.help,
              context,
              nodes: violation.nodes.length,
            })),
        ).toEqual([]);
      }
    }
  }

  // Se deja el rail expandido para no contaminar la ventana de la prueba.
  await setRail(page, false);
});

test('Inicio envuelve el contenido largo sin scroll horizontal con el rail expandido y plegado', async ({
  page,
  electronApp,
}) => {
  const longName =
    'Crónica de la expedición al archipiélago de las Mareas Grises y los pactos de sal del alba';
  const longSummary =
    'La expedición recorrió las islas del norte, levantó actas de cada desembarco y dibujó a mano las líneas de bajamar que el atlas oficial daba por definitivas. '
      .repeat(3)
      .slice(0, 280)
      // El formulario recorta y elimina el espacio final del resumen.
      .trimEnd();
  const genres = [
    'Fantasía',
    'Aventura',
    'Misterio',
    'Histórico',
    'Marítimo',
    'Épico',
    'Intriga',
    'Viajes',
  ];

  expect(longName).toHaveLength(90);
  // El formulario y el contrato limitan el resumen a 280 caracteres y recortan
  // el espacio final; la cadena queda en 279.
  expect(longSummary).toHaveLength(279);

  await createWorld(page, {
    name: longName,
    summary: longSummary,
    genres: genres.join(', '),
  });
  await goHome(page);

  const recent = page.getByRole('region', {
    name: messages.home.recentTitle,
  });
  const card = recent.getByRole('article');
  const summary = card.locator('.wc-world-card__summary');

  await expect(
    card.getByRole('heading', { level: 3, name: longName, exact: true }),
  ).toBeVisible();
  await expect(card.locator('.wc-world-card__genres li')).toHaveCount(8);

  // El resumen se limita a dos líneas sin perder el texto completo del DOM.
  expect(await summary.textContent()).toBe(longSummary);
  expect(
    await summary.evaluate((element) =>
      window.getComputedStyle(element).getPropertyValue('-webkit-line-clamp'),
    ),
  ).toBe('2');

  // axe sin críticos ni graves en Inicio, en los dos temas.
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await goHome(page);

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

  for (const collapsed of [false, true] as const) {
    await setRail(page, collapsed);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);

      for (const width of [1024, 1280, 1600] as const) {
        await setContentWidth(electronApp, page, width);
        await goHome(page);

        const metrics = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
        }));

        expect(
          metrics.documentWidth,
          `${width}px, rail ${collapsed ? 'plegado' : 'expandido'}, tema ${theme}: ${JSON.stringify(metrics)}`,
        ).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.clientWidth);

        await expect(
          page
            .getByRole('region', { name: messages.home.recentTitle })
            .getByRole('heading', { level: 3, name: longName, exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', {
            name: messages.worlds.card.openNamed(longName),
          }),
        ).toBeVisible();
      }
    }
  }

  // Se deja el rail expandido para no contaminar la ventana de la prueba.
  await setRail(page, false);
});
