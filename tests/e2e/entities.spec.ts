import { join } from 'node:path';

import type { Page } from '@playwright/test';
import sharp from 'sharp';

import { es as messages } from '../../src/renderer/messages/es';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, test } from './fixtures/electron-app';

const WORLD_NAME = 'Las Mareas Grises';

const LONG_NAME = 'A'.repeat(120);
const LONG_SUMMARY = 'Mareas'.repeat(46).slice(0, 280);
const LONG_ALIAS = 'Alias'.repeat(16);
const LONG_ALIASES = Array.from(
  { length: 10 },
  (_, index) => `${LONG_ALIAS.slice(0, 77)} ${String(index).padStart(2, '0')}`,
);
const LONG_TAG = 'Norte'.repeat(8);
const LONG_TEXT = 'Mareas y sal. '.repeat(80).trim();
const LONG_FIELD_TYPE_NAME = 'Archivo extremo';
const LONG_FIELD_LABEL = 'Campo'.repeat(16);
const LONG_FIELD_VALUE = 'Marea'.repeat(160);

async function dismissToasts(page: Page) {
  const closeButtons = page.getByRole('button', { name: /^Cerrar aviso/ });

  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click();
  }
}

async function settleLayout(page: Page): Promise<void> {
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

async function enterEdit(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.detail.edit, exact: true })
    .click();
  await expect(
    page.getByRole('textbox', {
      name: messages.entities.detail.nameLabel,
      exact: true,
    }),
  ).toBeFocused();
}

async function doneEditing(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.detail.done, exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: messages.entities.detail.edit,
      exact: true,
    }),
  ).toBeFocused({ timeout: 10_000 });
}

async function openSection(page: Page, section: string) {
  const region = page.locator(`[data-section="${section}"]`);
  const toggle = region.locator('.wc-disclosure__toggle');

  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  return region;
}

async function setPanelOpen(page: Page, open: boolean): Promise<void> {
  const show = page.getByRole('button', {
    name: messages.entities.detail.propertiesShow,
  });
  const hide = page.getByRole('button', {
    name: messages.entities.detail.propertiesHide,
  });
  const target = open ? show : hide;

  if ((await target.count()) > 0 && (await target.isVisible())) {
    await target.click();
  }

  await expect(open ? hide : show).toHaveAttribute(
    'aria-expanded',
    open ? 'true' : 'false',
  );
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
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

async function createRitualType(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.list.menuLabel })
    .click();
  await page
    .getByRole('menuitem', { name: messages.entities.list.manageTypes })
    .click();

  const manager = page.getByRole('dialog');

  await manager
    .getByRole('button', { name: messages.entities.types.create })
    .click();
  await manager
    .getByLabel(messages.entities.types.nameLabel)
    .fill('Lugar ritual');
  await manager
    .getByRole('button', { name: messages.entities.types.addField })
    .click();
  await manager
    .getByRole('textbox', {
      name: messages.entities.types.fieldLabel,
      exact: true,
    })
    .fill('Deidad');
  await manager
    .getByRole('button', { name: messages.entities.types.createSubmit })
    .click();

  await expect(
    manager.getByText('Lugar ritual', { exact: true }),
  ).toBeVisible();
  await manager
    .getByRole('button', { name: messages.entities.types.close })
    .last()
    .click();
  await dismissToasts(page);
}

async function markRitualFieldRequired(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.list.menuLabel })
    .click();
  await page
    .getByRole('menuitem', { name: messages.entities.list.manageTypes })
    .click();

  const manager = page.getByRole('dialog');

  await manager
    .getByRole('button', {
      name: messages.entities.types.editNamed('Lugar ritual'),
      exact: true,
    })
    .click();
  await manager.getByLabel(messages.entities.types.fieldRequired).check();
  await manager
    .getByRole('button', { name: messages.entities.types.save })
    .click();

  await expect(
    manager.getByText('Lugar ritual', { exact: true }),
  ).toBeVisible();
  await manager
    .getByRole('button', { name: messages.entities.types.close })
    .last()
    .click();
  await dismissToasts(page);
}

async function createLongFieldType(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.list.menuLabel })
    .click();
  await page
    .getByRole('menuitem', { name: messages.entities.list.manageTypes })
    .click();

  const manager = page.getByRole('dialog');

  await manager
    .getByRole('button', { name: messages.entities.types.create })
    .click();
  await manager
    .getByLabel(messages.entities.types.nameLabel)
    .fill(LONG_FIELD_TYPE_NAME);
  await manager
    .getByRole('button', { name: messages.entities.types.addField })
    .click();
  await manager
    .getByRole('textbox', {
      name: messages.entities.types.fieldLabel,
      exact: true,
    })
    .fill(LONG_FIELD_LABEL);
  await manager
    .getByRole('button', { name: messages.entities.types.createSubmit })
    .click();

  await expect(
    manager.getByText(LONG_FIELD_TYPE_NAME, { exact: true }),
  ).toBeVisible();
  await manager
    .getByRole('button', { name: messages.entities.types.close })
    .last()
    .click();
  await dismissToasts(page);
}

async function createLongEntity(
  page: Page,
  options: { readonly type?: string; readonly fieldLabel?: string } = {},
): Promise<void> {
  await createEntity(page, {
    name: LONG_NAME,
    ...(options.type === undefined ? {} : { type: options.type }),
  });
  await enterEdit(page);
  await page
    .getByLabel(messages.entities.detail.aliasesLabel)
    .fill(LONG_ALIASES.join(', '));
  await page
    .getByLabel(messages.entities.detail.summaryLabel)
    .fill(LONG_SUMMARY);

  if (options.fieldLabel !== undefined) {
    const attributes = await openSection(page, 'attributes');

    await attributes
      .getByLabel(options.fieldLabel, { exact: true })
      .fill(LONG_FIELD_VALUE);
  }

  const editor = page.locator('.wc-editor__content');
  await editor.click();
  await page.keyboard.insertText(LONG_TEXT);
  await waitForSaved(page);
  await doneEditing(page);

  await page
    .getByRole('button', { name: messages.entities.detail.newTag })
    .click();
  const tagDialog = page.getByRole('dialog');

  await tagDialog.getByLabel(messages.entities.tags.nameLabel).fill(LONG_TAG);
  await tagDialog
    .getByRole('button', { name: messages.entities.tags.submit })
    .click();
  await waitForSaved(page);
  await dismissToasts(page);
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

  // En reposo no hay formulario permanente: se entra en edición para escribir.
  await expect(
    page.getByRole('textbox', {
      name: messages.entities.detail.nameLabel,
      exact: true,
    }),
  ).toHaveCount(0);
  await enterEdit(page);
  await page
    .getByLabel(messages.entities.detail.aliasesLabel)
    .fill('La Cartógrafa');
  await waitForSaved(page);

  const editor = page.locator('.wc-editor__content');
  await editor.click();
  await page.keyboard.type('Mara dibuja mapas con tinta de sal.');
  await waitForSaved(page);
  await doneEditing(page);

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

  const resources = await openSection(page, 'resources');
  await resources
    .getByRole('button', { name: messages.entities.detail.addImages })
    .click();

  const galleryThumb = page.locator('.wc-gallery__thumb').first();
  await expect(galleryThumb).toBeVisible();
  await expect(galleryThumb).toHaveAttribute('src', /^wc-asset:\/\/thumb\//);

  const properties = page.getByRole('complementary', {
    name: messages.entities.detail.propertiesTitle,
  });

  await properties
    .getByRole('button', { name: messages.entities.detail.chooseCover })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', {
      name: messages.entities.detail.coverOption(1),
    })
    .click();
  await expect(page.locator('.wc-entity-cover__picture')).toHaveAttribute(
    'src',
    /^wc-asset:\/\/asset\//,
  );

  await properties
    .getByRole('button', { name: messages.entities.detail.newTag })
    .click();
  const tagDialog = page.getByRole('dialog');

  await tagDialog.getByLabel(messages.entities.tags.nameLabel).fill('Norte');
  await tagDialog
    .getByRole('button', { name: messages.entities.tags.submit })
    .click();
  await expect(page.getByText('Norte', { exact: true }).first()).toBeVisible();
  await waitForSaved(page);
  await dismissToasts(page);

  const favorite = page.getByRole('button', {
    name: messages.entities.detail.favoriteLabel,
    exact: true,
  });

  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
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
    page.getByText(messages.entities.detail.aliasLine('La Cartógrafa')),
  ).toBeVisible();
  await expect(
    page.getByText('Mara dibuja mapas con tinta de sal.'),
  ).toBeVisible();

  await enterEdit(page);
  await page
    .getByRole('button', { name: messages.entities.editor.link })
    .click();
  const linkDialog = page.getByRole('dialog');

  await linkDialog
    .getByLabel(messages.entities.editor.linkSearch)
    .fill('Puerto Sal');
  await linkDialog.getByRole('button', { name: /Puerto Sal/ }).click();
  await waitForSaved(page);

  const internalLink = page
    .locator('.wc-editor__content a')
    .filter({ hasText: 'Puerto Sal' })
    .first();
  await expect(internalLink).toHaveAttribute(
    'href',
    /^wc-entity:\/\/[0-9a-f-]{36}$/,
  );
  await doneEditing(page);

  // En lectura un clic normal navega; no hace falta Ctrl ni «Abrir enlace».
  await internalLink.click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Puerto Sal' }),
  ).toBeVisible();

  // Regresión: al volver a abrir la ficha en frío, el enlace sigue navegando.
  await backToEntities(page);
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed('Mara Viento'),
    })
    .click();
  await page
    .locator('.wc-editor__content a')
    .filter({ hasText: 'Puerto Sal' })
    .first()
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
    .getByRole('button', { name: messages.entities.list.create })
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

test('crea relaciones, muestra la etiqueta inversa, navega a los backlinks y rechaza duplicados', async ({
  page,
  electronApp,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, { name: 'Mara Viento' });
  await backToEntities(page);
  await createEntity(page, { name: 'Puerto Sal', type: 'Ciudad' });
  await backToEntities(page);

  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed('Mara Viento'),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();

  const addRelation = async (
    typeLabel: string,
    targetLabel: string,
    expectSuccess: boolean,
    notes?: string,
  ) => {
    await page
      .getByRole('button', { name: messages.entities.relations.add })
      .click();
    const dialog = page.getByRole('dialog');

    await expectAxeWithoutSerious(page);

    await dialog
      .getByLabel(messages.entities.relations.typeLabel, { exact: false })
      .selectOption({ label: typeLabel });
    await dialog
      .getByLabel(/^Ficha de destino/)
      .selectOption({ label: targetLabel });

    if (notes !== undefined) {
      await dialog
        .getByLabel(messages.entities.relations.notesLabel)
        .fill(notes);
    }

    await dialog
      .getByRole('button', {
        name: messages.entities.relations.submitCreate,
      })
      .click();

    if (expectSuccess) {
      await expect(dialog).not.toBeVisible();
      await dismissToasts(page);
    } else {
      await expect(
        dialog.getByRole('alert').getByText(messages.entities.relations.error),
      ).toBeVisible();
      await dialog
        .getByRole('button', { name: messages.entities.relations.cancel })
        .click();
      await dismissToasts(page);
    }
  };

  await addRelation('Ubicado en / Contiene', 'Puerto Sal · Ciudad', true);

  const panel = page.locator('[data-section="relations"]');

  await expect(panel.getByText('Ubicado en')).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Puerto Sal', exact: true }),
  ).toBeVisible();

  await addRelation('Ubicado en / Contiene', 'Puerto Sal · Ciudad', false);

  await page
    .getByRole('button', { name: messages.entities.relations.manageTypes })
    .click();
  const manager = page.getByRole('dialog');

  await expectAxeWithoutSerious(page);

  await manager
    .getByRole('button', { name: messages.entities.relations.types.create })
    .click();
  await manager.getByLabel(/^Etiqueta directa/).fill('Mentor de');
  await manager.getByLabel(/^Etiqueta inversa/).fill('Aprendiz de');
  await manager
    .getByRole('button', {
      name: messages.entities.relations.types.createSubmit,
    })
    .click();
  await expect(manager.getByText('Mentor de / Aprendiz de')).toBeVisible();
  await manager
    .getByRole('button', { name: messages.entities.relations.types.close })
    .last()
    .click();
  await dismissToasts(page);

  await addRelation(
    'Mentor de / Aprendiz de',
    'Puerto Sal · Ciudad',
    true,
    'Mareas y sal. '.repeat(25).trim(),
  );
  await expect(panel.getByText('Mentor de')).toBeVisible();

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

    await settleLayout(page);
    await expectNoOverflow(page);
  }

  await panel
    .getByRole('button', { name: 'Puerto Sal', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Puerto Sal' }),
  ).toBeVisible();

  const backlinks = await openSection(page, 'relations');

  await expect(backlinks.getByText('Contiene')).toBeVisible();
  await expect(backlinks.getByText('Aprendiz de')).toBeVisible();
  await expect(
    backlinks.getByRole('button', { name: 'Mara Viento', exact: true }).first(),
  ).toBeVisible();

  await backlinks
    .getByRole('button', { name: 'Mara Viento', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await expectAxeWithoutSerious(page);
  }
});

test('la lista y la ficha con contenido largo no desbordan y pasan axe en ambos temas', async ({
  page,
  electronApp,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createLongEntity(page);
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

    await settleLayout(page);
    await expectNoOverflow(page);

    await page
      .getByRole('button', {
        name: messages.entities.card.openNamed(LONG_NAME),
      })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: LONG_NAME }),
    ).toBeVisible();
    await expectNoOverflow(page);
    await backToEntities(page);
  }

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
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
      .getByRole('button', { name: messages.entities.list.menuLabel })
      .click();
    await page
      .getByRole('menuitem', { name: messages.entities.list.manageTypes })
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
        name: messages.entities.card.openNamed(LONG_NAME),
      })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: LONG_NAME }),
    ).toBeVisible();
    await expectAxeWithoutSerious(page);
    await backToEntities(page);
  }
});

test('documento vivo: lectura, foco, secciones, panel, separador y memoria de sesión', async ({
  page,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, { name: 'Mara Viento' });

  // Lectura por defecto y sin formulario de nombre.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: messages.entities.detail.nameLabel,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: messages.entities.detail.edit,
      exact: true,
    }),
  ).toBeVisible();

  // El clic en el título es un atajo de ratón que enfoca Nombre.
  await page.getByRole('heading', { level: 2, name: 'Mara Viento' }).click();
  await expect(
    page.getByRole('textbox', {
      name: messages.entities.detail.nameLabel,
      exact: true,
    }),
  ).toBeFocused();
  await doneEditing(page);

  // Secciones plegables con estado visible y Enter/Espacio.
  const description = page.locator('[data-section="description"]');
  const descriptionToggle = description.locator('.wc-disclosure__toggle');

  await expect(descriptionToggle).toHaveAttribute('aria-expanded', 'true');
  await descriptionToggle.focus();
  await page.keyboard.press('Enter');
  await expect(descriptionToggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press(' ');
  await expect(descriptionToggle).toHaveAttribute('aria-expanded', 'true');

  // Las relaciones mantienen la separación entre el texto guía y el vacío.
  const relations = await openSection(page, 'relations');
  const relationGap = await relations.evaluate((region) => {
    const root = region.querySelector('.wc-relations');
    const [lead, next] = root === null ? [] : [...root.children];

    if (lead === undefined || next === undefined) {
      return null;
    }

    return (
      next.getBoundingClientRect().top - lead.getBoundingClientRect().bottom
    );
  });

  expect(relationGap).not.toBeNull();
  expect(relationGap ?? 0).toBeGreaterThanOrEqual(12);

  // Panel ocultable, visible en todos los anchos y con memoria.
  await setPanelOpen(page, true);

  const separator = page.getByRole('separator', {
    name: messages.entities.detail.propertiesResize,
  });

  await expect(separator).toHaveAttribute('aria-valuemin', '280');
  await expect(separator).toHaveAttribute('aria-valuemax', '360');
  await expect(separator).toHaveAttribute('aria-valuenow', '320');

  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '336');
  await page.keyboard.press('Home');
  await expect(separator).toHaveAttribute('aria-valuenow', '280');
  await page.keyboard.press('End');
  await expect(separator).toHaveAttribute('aria-valuenow', '360');
  await page.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', '344');
  await separator.dblclick();
  await expect(separator).toHaveAttribute('aria-valuenow', '320');
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '336');

  await descriptionToggle.focus();
  await page.keyboard.press('Enter');
  await expect(descriptionToggle).toHaveAttribute('aria-expanded', 'false');
  await setPanelOpen(page, false);

  await backToEntities(page);
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed('Mara Viento'),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();

  await expect(
    page.locator('[data-section="description"] .wc-disclosure__toggle'),
  ).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.getByRole('button', { name: messages.entities.detail.propertiesShow }),
  ).toHaveAttribute('aria-expanded', 'false');

  await page
    .getByRole('button', { name: messages.entities.detail.propertiesShow })
    .click();
  await expect(
    page.getByRole('separator', {
      name: messages.entities.detail.propertiesResize,
    }),
  ).toHaveAttribute('aria-valuenow', '336');
});

test('el separador se arrastra con puntero, Escape cancela y el ancho persiste', async ({
  page,
  electronApp,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, { name: 'Mara Viento' });

  await electronApp.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows()[0];

    if (main === undefined) {
      throw new Error('No hay ventana principal.');
    }

    main.setContentSize(1280, 800);
  });
  await settleLayout(page);
  await setPanelOpen(page, true);

  const separator = page.getByRole('separator', {
    name: messages.entities.detail.propertiesResize,
  });

  await expect(separator).toHaveAttribute('aria-valuenow', '320');

  const dragBy = async (offset: number): Promise<void> => {
    const box = await separator.boundingBox();

    if (box === null) {
      throw new Error('El separador no tiene caja visible.');
    }

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + offset, y, { steps: 5 });
  };

  await dragBy(30);
  await page.mouse.up();
  await expect(separator).toHaveAttribute('aria-valuenow', '350');

  // Escape durante el arrastre restaura el ancho con el que se empezó.
  await dragBy(40);
  await expect(separator).toHaveAttribute('aria-valuenow', '360');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(separator).toHaveAttribute('aria-valuenow', '350');

  await backToEntities(page);
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed('Mara Viento'),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Mara Viento' }),
  ).toBeVisible();
  await expect(
    page.getByRole('separator', {
      name: messages.entities.detail.propertiesResize,
    }),
  ).toHaveAttribute('aria-valuenow', '350');
});

test('errores visibles: un campo obligatorio abre su sección y recibe el foco', async ({
  page,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createRitualType(page);
  await createEntity(page, { name: 'Altar de sal', type: 'Lugar ritual' });

  // El campo nace opcional para poder crear la ficha; después se vuelve
  // obligatorio y la ficha existente queda sin ese valor.
  await backToEntities(page);
  await markRitualFieldRequired(page);
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed('Altar de sal'),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Altar de sal' }),
  ).toBeVisible();

  await enterEdit(page);

  const attributes = page.locator('[data-section="attributes"]');
  const attributesToggle = attributes.locator('.wc-disclosure__toggle');

  await expect(attributesToggle).toHaveAttribute('aria-expanded', 'false');

  await page
    .getByRole('button', { name: messages.entities.detail.done })
    .click();

  // Sigue en edición, abre Campos del tipo, muestra el error y enfoca el control.
  await expect(
    page.getByRole('button', { name: messages.entities.detail.done }),
  ).toBeVisible();
  await expect(attributesToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByText(messages.entities.attributes.errors.required),
  ).toBeVisible();
  await expect(page.locator('#wc-attribute-deidad')).toBeFocused();
  await expect(page.getByText(messages.entities.detail.invalid)).toBeVisible();

  await page.getByLabel('Deidad').fill('La Marea');
  await doneEditing(page);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Altar de sal' }),
  ).toBeVisible();
});

test('matriz 1024/1280/1600 × temas × panel abierto/cerrado sin desbordar y con axe', async ({
  page,
  electronApp,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createLongFieldType(page);
  await createLongEntity(page, {
    type: LONG_FIELD_TYPE_NAME,
    fieldLabel: LONG_FIELD_LABEL,
  });

  await expect(
    page.getByRole('heading', { level: 2, name: LONG_NAME }),
  ).toBeVisible();
  await expect(page.locator('.wc-document-header__slug')).toHaveText(
    'a'.repeat(80),
  );

  const aliases = page.locator('.wc-document-header__aliases');

  await expect(aliases).toContainText(LONG_ALIASES[0] ?? '');
  await expect(aliases).toContainText(LONG_ALIASES.at(-1) ?? '');
  await expect(page.getByText(LONG_FIELD_LABEL, { exact: true })).toBeVisible();
  await expect(page.getByText(LONG_FIELD_VALUE, { exact: true })).toBeVisible();
  await expect(page.getByText(LONG_TAG, { exact: true }).first()).toBeVisible();
  await expect(page.locator('.wc-editor__content')).not.toHaveAttribute(
    'role',
    'textbox',
  );

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);

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
      await settleLayout(page);

      for (const open of [true, false] as const) {
        await setPanelOpen(page, open);
        await expectNoOverflow(page);
        await expectAxeWithoutSerious(page);
      }
    }
  }
});

test('mueve una ficha a la papelera desde el menú de la página', async ({
  page,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, { name: 'Mara Viento' });

  const trigger = page.getByRole('button', {
    name: messages.entities.detail.menuLabel,
  });
  const deleteDialog = page.getByRole('dialog', {
    name: messages.entities.detail.deleteTitle('Mara Viento'),
  });

  await trigger.click();
  await page
    .getByRole('menuitem', { name: messages.entities.detail.delete })
    .click();
  await expect(deleteDialog).toBeVisible();

  // Cancelar devuelve el foco al disparador del menú.
  await page.keyboard.press('Escape');
  await expect(deleteDialog).not.toBeVisible();
  await expect(trigger).toBeFocused();

  // Confirmar anuncia el resultado y retira la ficha de la lista.
  await trigger.click();
  await page
    .getByRole('menuitem', { name: messages.entities.detail.delete })
    .click();
  await deleteDialog
    .getByRole('button', { name: messages.entities.detail.deleteSubmit })
    .click();

  await expect(
    page.getByText(messages.entities.notices.removed('Mara Viento')),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.entities.list.title }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mara Viento' })).toHaveCount(
    0,
  );

  // La página de la ficha desaparece, así que el foco vuelve al contenido.
  expect(await page.evaluate(() => document.activeElement?.id ?? null)).toBe(
    'wc-main',
  );
});
