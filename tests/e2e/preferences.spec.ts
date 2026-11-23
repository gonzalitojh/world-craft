import type { ElectronApplication, Page } from '@playwright/test';

import { es as messages } from '../../src/renderer/messages/es';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, launchElectronApp, test } from './fixtures/electron-app';

const WORLD_NAME = 'Las Mareas Grises';
const ENTITY_NAME = 'Mara Viento';

const running = new Set<ElectronApplication>();

test.afterEach(async () => {
  for (const application of running) {
    running.delete(application);
    await application.close().catch(() => {});
  }
});

async function launch(userDataDir: string) {
  const launched = await launchElectronApp(userDataDir);

  running.add(launched.electronApp);

  return launched;
}

async function stop(application: ElectronApplication): Promise<void> {
  running.delete(application);
  await application.close();
}

async function dismissToasts(page: Page) {
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

async function createEntity(page: Page): Promise<void> {
  await openEntities(page);
  await page
    .locator('#wc-main')
    .getByRole('button', { name: messages.entities.list.create })
    .first()
    .click();

  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.entities.create.nameLabel, { exact: false })
    .fill(ENTITY_NAME);
  await dialog
    .getByRole('button', { name: messages.entities.create.submit })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name: ENTITY_NAME, exact: true }),
  ).toBeVisible();
  await dismissToasts(page);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const html = page.locator('html');
  const current = await html.getAttribute('data-theme');

  if (current !== theme) {
    const label =
      current === 'dark'
        ? messages.shell.theme.currentDark
        : messages.shell.theme.currentLight;

    await page
      .getByRole('button', { name: messages.shell.theme.switchLabel(label) })
      .click();
  }

  await expect(html).toHaveAttribute('data-theme', theme);
}

async function setRail(page: Page, collapsed: boolean): Promise<void> {
  const collapse = page.getByRole('button', {
    name: messages.shell.collapse,
  });

  if (collapsed && (await collapse.count()) > 0) {
    await collapse.click();
  } else if (!collapsed) {
    await page.getByRole('button', { name: messages.shell.expand }).click();
  }
}

async function setContentWidth(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      const main = BrowserWindow.getAllWindows()[0];

      if (main === undefined) {
        throw new Error('No hay ventana principal.');
      }

      main.setContentSize(size.width, 700);
    },
    { width },
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
}

async function expectNoOverflow(page: Page, context: string): Promise<void> {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(
    metrics.documentWidth,
    `${context}: ${JSON.stringify(metrics)}`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function expectAxeWithoutSerious(page: Page, context: string) {
  const results = await analyzeWithAxe(page, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });

  expect(results.testEngine.name, context).toBe('axe-core');
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
    context,
  ).toEqual([]);
}

test('persiste tema, rail, panel, secciones y Continuar tras reiniciar', async ({
  userDataDir,
}) => {
  const first = await launch(userDataDir);
  const page = first.page;

  await createWorld(page);
  await createEntity(page);

  await setTheme(page, 'dark');
  await setRail(page, true);

  const descriptionToggle = page.locator(
    '[data-section="description"] .wc-disclosure__toggle',
  );

  await expect(descriptionToggle).toHaveAttribute('aria-expanded', 'true');
  await descriptionToggle.click();
  await expect(descriptionToggle).toHaveAttribute('aria-expanded', 'false');

  const relationsToggle = page.locator(
    '[data-section="relations"] .wc-disclosure__toggle',
  );

  if ((await relationsToggle.getAttribute('aria-expanded')) !== 'true') {
    await relationsToggle.click();
  }
  await expect(relationsToggle).toHaveAttribute('aria-expanded', 'true');

  const separator = page.getByRole('separator', {
    name: messages.entities.detail.propertiesResize,
  });

  await separator.focus();
  await page.keyboard.press('End');
  await expect(separator).toHaveAttribute('aria-valuenow', '360');

  await page
    .getByRole('button', { name: messages.entities.detail.propertiesHide })
    .click();
  await expect(
    page.getByRole('button', { name: messages.entities.detail.propertiesShow }),
  ).toHaveAttribute('aria-expanded', 'false');

  await stop(first.electronApp);

  const second = await launch(userDataDir);
  const reloaded = second.page;

  // El tema ya está fijado antes del primer render: se comprueba en cuanto
  // `domcontentloaded` termina, sin esperar a la aplicación.
  expect(await reloaded.locator('html').getAttribute('data-theme')).toBe(
    'dark',
  );

  const native = await second.electronApp.evaluate(
    ({ BrowserWindow, nativeTheme }) => ({
      dark: nativeTheme.shouldUseDarkColors,
      background: BrowserWindow.getAllWindows()[0]?.getBackgroundColor() ?? '',
    }),
  );

  expect(native.dark).toBe(true);
  expect(native.background.toLowerCase()).toContain('141715');

  // Rail plegado desde el primer frame y con nombres accesibles.
  await expect(
    reloaded.getByRole('button', { name: messages.shell.expand }),
  ).toHaveAttribute('aria-expanded', 'false');
  await expect(
    reloaded
      .getByRole('navigation', { name: messages.shell.navigationLabel })
      .getByRole('button', { name: messages.shell.views.home }),
  ).toHaveAttribute('aria-label', messages.shell.views.home);

  // La aplicación abre en Inicio y «Continuar» retoma la ficha con su nombre.
  await expect(
    reloaded.getByRole('heading', {
      level: 1,
      name: messages.shell.views.home,
    }),
  ).toBeVisible();

  const continueRegion = reloaded.getByRole('region', {
    name: messages.home.continueTitle,
  });

  await expect(
    continueRegion.getByRole('heading', {
      level: 3,
      name: ENTITY_NAME,
    }),
  ).toBeVisible();

  await continueRegion
    .getByRole('button', { name: messages.home.continueEntityAction })
    .click();

  await expect(
    reloaded.getByRole('heading', {
      level: 2,
      name: ENTITY_NAME,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    reloaded.locator('[data-section="description"] .wc-disclosure__toggle'),
  ).toHaveAttribute('aria-expanded', 'false');
  await expect(
    reloaded.locator('[data-section="relations"] .wc-disclosure__toggle'),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(
    reloaded.getByRole('button', {
      name: messages.entities.detail.propertiesShow,
    }),
  ).toHaveAttribute('aria-expanded', 'false');

  await reloaded
    .getByRole('button', { name: messages.entities.detail.propertiesShow })
    .click();
  const persistedSeparator = reloaded.getByRole('separator', {
    name: messages.entities.detail.propertiesResize,
  });

  await expect(persistedSeparator).toHaveAttribute('aria-valuenow', '360');

  // Checklist 13/14: a 1024 el panel se apila y desaparece el separador sin
  // desbordar; al volver a 1280 se recupera el ancho guardado (360, no 320).
  await setContentWidth(second.electronApp, reloaded, 1024);
  await expectNoOverflow(reloaded, '1024 px con panel persistido a 360');
  await expect(persistedSeparator).toBeHidden();

  await setContentWidth(second.electronApp, reloaded, 1280);
  await expect(persistedSeparator).toBeVisible();
  await expect(persistedSeparator).toHaveAttribute('aria-valuenow', '360');

  await stop(second.electronApp);
});

test('el reset por API vuelve a los defectos sin borrar mundos ni fichas', async ({
  userDataDir,
}) => {
  const launched = await launch(userDataDir);
  const { electronApp } = launched;
  const page = launched.page;

  await createWorld(page);
  await createEntity(page);
  await setTheme(page, 'dark');
  await setRail(page, true);
  await page
    .getByRole('button', { name: messages.entities.detail.propertiesHide })
    .click();

  const result = await page.evaluate(async () => {
    return window.worldCraft.preferences.reset();
  });

  expect(result.ok).toBe(true);

  // El tema del cromo se aplica en caliente, sin esperar a recargar.
  await expect
    .poll(() =>
      electronApp.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors),
    )
    .toBe(false);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(
    page.getByRole('button', { name: messages.shell.collapse }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('region', { name: messages.home.continueTitle }),
  ).toHaveCount(0);

  // El mundo y la ficha siguen existiendo: se abren desde la biblioteca.
  await page
    .getByRole('button', { name: messages.worlds.card.openNamed(WORLD_NAME) })
    .click();
  await openEntities(page);
  await expect(page.getByText(ENTITY_NAME)).toBeVisible();
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed(ENTITY_NAME),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: ENTITY_NAME, exact: true }),
  ).toBeVisible();
  // Un panel recién restablecido vuelve a estar abierto a 320.
  await expect(
    page.getByRole('button', { name: messages.entities.detail.propertiesHide }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('separator', {
      name: messages.entities.detail.propertiesResize,
    }),
  ).toHaveAttribute('aria-valuenow', '320');

  await stop(electronApp);
});

test('1024/1280/1600 en ambos temas con preferencias persistidas y axe', async ({
  userDataDir,
}) => {
  test.slow();

  const launched = await launch(userDataDir);
  const { electronApp } = launched;
  const page = launched.page;

  await createWorld(page);
  await setRail(page, true);

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);

    for (const width of [1024, 1280, 1600] as const) {
      await setContentWidth(electronApp, page, width);

      const context = `${width}px, rail plegado, tema ${theme}`;

      await expectNoOverflow(page, context);
      await expectAxeWithoutSerious(page, context);
    }
  }

  // El rail expandido conserva la misma ausencia de scroll a los tres anchos.
  await setRail(page, false);

  for (const width of [1024, 1280, 1600] as const) {
    await setContentWidth(electronApp, page, width);
    await expectNoOverflow(page, `${width}px, rail expandido`);
  }

  await stop(electronApp);
});
