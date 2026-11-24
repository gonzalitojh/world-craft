import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { es as messages } from '../../src/renderer/messages/es';

import { expect, test } from './fixtures/electron-app';

const WORLD_NAME = 'Las Mareas Grises';
const ENTITY_NAME = 'Mara Viento';
const SECOND_ENTITY = 'Hija de la marea';

async function dismissToasts(page: Page): Promise<void> {
  const closeButtons = page.getByRole('button', { name: /^Cerrar aviso/ });

  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click();
  }
}

async function createWorld(page: Page): Promise<void> {
  await page.getByRole('button', { name: messages.home.emptyAction }).click();
  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.worlds.form.nameLabel, { exact: false })
    .fill(WORLD_NAME);
  await dialog
    .getByRole('button', { name: messages.worlds.form.submitCreate })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
  await dismissToasts(page);
}

async function goTrash(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.trash })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.trash }),
  ).toBeVisible();
}

async function goWorlds(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.worlds }),
  ).toBeVisible();
}

async function openWorld(page: Page): Promise<void> {
  await goWorlds(page);
  await page
    .getByRole('button', { name: messages.worlds.card.openNamed(WORLD_NAME) })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: WORLD_NAME, exact: true }),
  ).toBeVisible();
}

async function openEntities(page: Page): Promise<void> {
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

async function createEntity(page: Page, name: string): Promise<void> {
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

async function enterEdit(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.detail.edit, exact: true })
    .click();
}

async function doneEditing(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.detail.done })
    .click();
}

async function writeDescription(page: Page, text: string): Promise<void> {
  await enterEdit(page);
  const editor = page.locator('.wc-editor__content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.type(text);
  await expect(page.getByText(messages.entities.detail.saved)).toBeVisible({
    timeout: 10_000,
  });
  await doneEditing(page);
}

async function openHistory(page: Page): Promise<void> {
  await page.locator('[data-section="history"] .wc-disclosure__toggle').click();
  await expect(page.locator('#wc-entity-section-history')).toHaveAttribute(
    'data-open',
    'true',
  );
}

async function deleteEntityFromDetail(
  page: Page,
  name = ENTITY_NAME,
): Promise<void> {
  await page
    .getByRole('button', { name: messages.entities.detail.menuLabel })
    .click();
  await page
    .getByRole('menuitem', { name: messages.entities.detail.delete })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.entities.detail.deleteSubmit })
    .click();
  await expect(
    page.getByText(messages.entities.notices.removed(name)),
  ).toBeVisible();
}

test('papelera, versiones y purga con copia previa', async ({
  page,
  userDataDir,
}) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, ENTITY_NAME);

  await writeDescription(page, 'Primera versión de la crónica de mareas.');

  await openHistory(page);
  await expect(page.getByText(messages.entities.history.empty)).toBeVisible({
    timeout: 10_000,
  });

  await page
    .getByRole('button', { name: messages.entities.history.save })
    .click();
  const saveDialog = page.getByRole('dialog', {
    name: messages.entities.history.saveDialog.title,
  });
  const label = saveDialog.getByLabel(
    messages.entities.history.saveDialog.label,
    { exact: false },
  );

  await expect(label).toBeFocused();
  await label.fill('Antes de cambiar');
  await saveDialog
    .getByRole('button', { name: messages.entities.history.saveDialog.submit })
    .click();
  await expect(
    page.getByText(messages.entities.history.saveDialog.success),
  ).toBeVisible();
  await dismissToasts(page);

  await page.locator('[data-section="history"] .wc-disclosure__toggle').click();
  await expect(page.locator('#wc-entity-section-history')).toHaveAttribute(
    'data-open',
    'false',
  );

  await writeDescription(page, 'Segunda versión de la crónica de mareas.');

  await openHistory(page);
  await expect(page.getByText('Antes de cambiar')).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByText(messages.entities.history.origins.auto).first(),
  ).toBeVisible();

  await page
    .getByRole('button', { name: /Restaurar la versión «Antes de cambiar»/ })
    .click();
  const restoreDialog = page.getByRole('dialog');
  const preview = restoreDialog.getByRole('region', {
    name: messages.entities.history.restoreDialog.previewLabel,
  });

  await expect(preview).toContainText('Primera versión');
  await restoreDialog
    .getByRole('button', {
      name: messages.entities.history.restoreDialog.submit,
    })
    .click();
  await expect(
    page.getByText(messages.entities.history.restoreDialog.success),
  ).toBeVisible();
  await expect(page.locator('.wc-editor__content')).toContainText(
    'Primera versión',
  );
  await dismissToasts(page);

  await deleteEntityFromDetail(page);
  await goTrash(page);

  const entityRow = page.locator('[data-trash-kind="entity"]');
  await expect(entityRow).toContainText(ENTITY_NAME);
  await expect(entityRow).toContainText(`${WORLD_NAME} ·`);

  await page
    .getByRole('button', { name: messages.trash.row.restoreNamed(ENTITY_NAME) })
    .click();
  await expect(
    page.getByText(messages.trash.row.restored(ENTITY_NAME)),
  ).toBeVisible();
  await dismissToasts(page);

  await openWorld(page);
  await openEntities(page);
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed(ENTITY_NAME),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: ENTITY_NAME, exact: true }),
  ).toBeVisible();

  await deleteEntityFromDetail(page);
  await goTrash(page);
  await page
    .getByRole('button', { name: messages.trash.row.purgeNamed(ENTITY_NAME) })
    .click();

  const purgeDialog = page.getByRole('dialog', {
    name: messages.trash.purgeDialog.title(ENTITY_NAME),
  });

  await expect(
    purgeDialog.getByText(messages.trash.purgeDialog.copyNote),
  ).toBeVisible();
  await expect(
    purgeDialog.getByRole('button', {
      name: messages.trash.purgeDialog.cancel,
    }),
  ).toBeFocused();
  await purgeDialog
    .getByRole('button', { name: messages.trash.purgeDialog.submit })
    .click();
  await expect(
    page.getByText(messages.trash.row.purged(ENTITY_NAME)),
  ).toBeVisible();
  await dismissToasts(page);
  await expect(page.getByText(ENTITY_NAME)).toHaveCount(0);

  const backups = await readdir(join(userDataDir, 'backups', 'pre-purge'));
  expect(backups.length).toBeGreaterThan(0);
  const manifest = await readdir(
    join(userDataDir, 'backups', 'pre-purge', backups[0] as string),
  );
  expect(manifest).toContain('manifest.json');
});

test('restaurar una ficha exige restaurar antes su mundo', async ({ page }) => {
  await createWorld(page);
  await openEntities(page);
  await createEntity(page, SECOND_ENTITY);
  await deleteEntityFromDetail(page, SECOND_ENTITY);

  await page
    .getByRole('button', { name: messages.entities.list.backToWorld })
    .click();
  await openWorld(page);

  await page
    .getByRole('button', { name: messages.shell.viewMenuLabel })
    .click();
  await page
    .getByRole('menuitem', { name: messages.worlds.card.delete })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: messages.worlds.confirm.deleteSubmit })
    .click();
  await expect(
    page.getByText(messages.worlds.notices.deleted(WORLD_NAME)),
  ).toBeVisible();
  await dismissToasts(page);

  await goTrash(page);
  await page
    .getByRole('button', {
      name: messages.trash.row.restoreNamed(SECOND_ENTITY),
    })
    .click();
  await expect(
    page.getByText(messages.trash.row.worldInTrashNotice(WORLD_NAME)),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: messages.trash.row.restoreNamed(SECOND_ENTITY),
    }),
  ).toBeEnabled();

  await page
    .getByRole('button', { name: messages.trash.row.restoreNamed(WORLD_NAME) })
    .click();
  await expect(
    page.getByText(messages.trash.row.restored(WORLD_NAME)),
  ).toBeVisible();
  await dismissToasts(page);

  await page
    .getByRole('button', {
      name: messages.trash.row.restoreNamed(SECOND_ENTITY),
    })
    .click();
  await expect(
    page.getByText(messages.trash.row.restored(SECOND_ENTITY)),
  ).toBeVisible();
  await dismissToasts(page);

  await openWorld(page);
  await openEntities(page);
  await expect(
    page.getByRole('button', {
      name: messages.entities.card.openNamed(SECOND_ENTITY),
    }),
  ).toBeVisible();
});
