import type { ElectronApplication, Page } from '@playwright/test';

import { APP_VERSION } from '../../src/shared/app-info';
import { es as messages } from '../../src/renderer/messages/es';

import { expect, test } from './fixtures/electron-app';
import { openSamples } from './fixtures/internal-view';

async function dismissToasts(page: Page): Promise<void> {
  const closeButtons = page.getByRole('button', { name: /^Cerrar aviso/ });

  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click();
  }
}

async function setViewportWidth(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
  height = 700,
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height);
    },
    { width, height },
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

async function createWorld(page: Page, name: string): Promise<void> {
  const navigation = page.getByRole('navigation', {
    name: messages.shell.navigationLabel,
  });

  await navigation
    .getByRole('button', { name: messages.shell.views.home })
    .click();
  await page
    .getByRole('button', { name: messages.worlds.actions.create })
    .click();

  const dialog = page.getByRole('dialog');

  await dialog
    .getByLabel(messages.worlds.form.nameLabel, { exact: false })
    .fill(name);
  await dialog
    .getByRole('button', { name: messages.worlds.form.submitCreate })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', {
      name: messages.worlds.detail.modules.label,
    }),
  ).toBeVisible();
  await dismissToasts(page);
}

test('abre la ventana con el shell, sin versión en la navegación', async ({
  electronApp,
  page,
  userDataDir,
}) => {
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: messages.shell.navigationLabel }),
  ).toBeVisible();
  await expect(page.locator('.wc-shell__version')).toHaveCount(0);
  await expect(page).toHaveTitle(messages.app.title);

  // La versión instalada vive en el diálogo de actualizaciones.
  await page.getByRole('button', { name: messages.updates.open }).click();

  const updates = page.getByRole('dialog', { name: messages.updates.title });

  await expect(updates).toBeVisible();
  await expect(
    updates.getByText(messages.updates.installedVersionLabel, { exact: true }),
  ).toBeVisible();
  await expect(
    updates.getByText(APP_VERSION, { exact: false }).first(),
  ).toBeVisible();

  await updates
    .getByRole('button', { name: messages.components.dialog.close })
    .last()
    .click();
  await expect(updates).not.toBeVisible();

  const window = await electronApp.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows()[0];

    if (main === undefined) {
      return null;
    }

    return {
      visible: main.isVisible(),
      minimumSize: main.getMinimumSize(),
      rendererUrl: main.webContents.getURL(),
    };
  });

  expect(window).not.toBeNull();
  expect(window?.visible).toBe(true);
  expect(window?.minimumSize).toEqual([1024, 700]);
  expect(window?.rendererUrl.startsWith('file://')).toBe(true);
  expect(userDataDir).toContain('world-craft-e2e-');
});

test('navega entre Inicio y Mundos y mantiene Muestras fuera de producto', async ({
  page,
}) => {
  const navigation = page.getByRole('navigation', {
    name: messages.shell.navigationLabel,
  });

  await expect(
    navigation.getByRole('button', { name: messages.shell.views.samples }),
  ).toHaveCount(0);

  await navigation
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.worlds }),
  ).toBeVisible();
  await expect(
    navigation.getByRole('button', { name: messages.shell.views.worlds }),
  ).toHaveAttribute('aria-current', 'page');

  await navigation
    .getByRole('button', { name: messages.shell.views.home })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
  await expect(
    navigation.getByRole('button', { name: messages.shell.views.home }),
  ).toHaveAttribute('aria-current', 'page');

  // Muestras tampoco aparece en la paleta.
  await page.keyboard.press('Control+K');

  const palette = page.getByRole('dialog', { name: messages.palette.title });

  await expect(palette).toBeVisible();
  await expect(palette.getByRole('option', { name: /Muestras/ })).toHaveCount(
    0,
  );
  await expect(
    palette.getByRole('option', {
      name: new RegExp(messages.palette.commands.search),
    }),
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(palette).not.toBeVisible();
});

test('abre Muestras solo por hash y limpia la URL al salir', async ({
  page,
}) => {
  await openSamples(page);

  expect(await page.evaluate(() => window.location.hash)).toBe(
    '#/internal/samples',
  );

  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.home })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.location.hash)).toBe('');

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();

  // Un hash desconocido también vuelve a Inicio, nunca a Muestras.
  await page.evaluate(() => {
    window.location.hash = '#/desconocido';
  });
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
});

test('el enlace de salto no cambia el hash ni la vista desde Mundos', async ({
  page,
}) => {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.worlds }),
  ).toBeVisible();

  const hashBefore = await page.evaluate(() => window.location.hash);
  const skipLink = page.getByRole('link', {
    name: messages.shell.skipToContent,
  });

  // Activación por teclado: mismo camino que un lector de pantalla.
  await skipLink.focus();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.worlds }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      activeId: document.activeElement?.id ?? null,
      hash: window.location.hash,
    })),
  ).toEqual({ activeId: 'wc-main', hash: hashBefore });
});

test('el enlace de salto conserva Muestras y su hash interno', async ({
  page,
}) => {
  await openSamples(page);

  const skipLink = page.getByRole('link', {
    name: messages.shell.skipToContent,
  });

  await skipLink.focus();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.samples,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      activeId: document.activeElement?.id ?? null,
      hash: window.location.hash,
    })),
  ).toEqual({ activeId: 'wc-main', hash: '#/internal/samples' });
});

test('el rail plegado mide 64 px y no desborda a 1024 px', async ({
  electronApp,
  page,
}) => {
  await setViewportWidth(electronApp, page, 1024, 700);

  await page.getByRole('button', { name: messages.shell.collapse }).click();
  await expect(
    page.getByRole('button', { name: messages.shell.expand }),
  ).toHaveAttribute('aria-expanded', 'false');

  // La transición de grid dura 160 ms; se espera a que el rail mida 64 px.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector<HTMLElement>('.wc-shell__rail')
            ?.getBoundingClientRect().width ?? 0,
      ),
    )
    .toBe(64);

  const metrics = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.wc-shell__rail');
    const shell = document.querySelector<HTMLElement>('.wc-shell');
    const topbar = document.querySelector<HTMLElement>('.wc-topbar');

    if (rail === null || shell === null || topbar === null) {
      return null;
    }

    return {
      railWidth: rail.getBoundingClientRect().width,
      clientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      shellWidth: shell.scrollWidth,
      topbarWidth: topbar.scrollWidth,
    };
  });

  expect(metrics).not.toBeNull();

  if (metrics !== null) {
    expect(metrics.railWidth).toBe(64);
    expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
      metrics.clientWidth,
    );
    expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
      metrics.clientWidth,
    );
    expect(metrics.shellWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
      metrics.clientWidth,
    );
    expect(metrics.topbarWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
      metrics.clientWidth,
    );
  }

  // Se deja expandido para no contaminar el estado de la ventana de la prueba.
  await page.getByRole('button', { name: messages.shell.expand }).click();
  await expect(
    page.getByRole('button', { name: messages.shell.collapse }),
  ).toHaveAttribute('aria-expanded', 'true');
});

test('con 0 mundos solo hay una primaria, la del estado vacío', async ({
  page,
}) => {
  await expect(page.locator('.wc-button--primary:visible')).toHaveCount(1);
  await expect(
    page.locator('.wc-topbar .wc-button--primary:visible'),
  ).toHaveCount(0);

  // Mundos con 0 también deja la primaria al estado vacío.
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await expect(page.locator('.wc-button--primary:visible')).toHaveCount(1);
  await expect(
    page.locator('.wc-topbar .wc-button--primary:visible'),
  ).toHaveCount(0);

  await createWorld(page, 'Las Mareas Grises');

  // En el mundo la única primaria es «Nueva ficha» de la barra.
  await expect(page.locator('.wc-button--primary:visible')).toHaveCount(1);
  await expect(
    page.locator('.wc-topbar').getByRole('button', {
      name: messages.entities.list.create,
    }),
  ).toBeVisible();
});

test('mantiene una sola primaria por vista de producto', async ({ page }) => {
  await createWorld(page, 'Las Mareas Grises');

  const navigation = page.getByRole('navigation', {
    name: messages.shell.navigationLabel,
  });

  // Mundo actual.
  await expect(page.locator('.wc-button--primary:visible')).toHaveCount(1);

  // Inicio y Mundos con al menos un mundo: la primaria es «Crear mundo».
  for (const view of ['home', 'worlds'] as const) {
    await navigation
      .getByRole('button', { name: messages.shell.views[view] })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: messages.shell.views[view] }),
    ).toBeVisible();
    await expect(page.locator('.wc-button--primary:visible')).toHaveCount(1);
  }

  // Búsqueda: sin primaria.
  await page.keyboard.press('Control+K');
  await page
    .getByRole('option', { name: new RegExp(messages.palette.commands.search) })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.search }),
  ).toBeVisible();
  await expect(page.locator('.wc-button--primary:visible')).toHaveCount(0);

  // Fichas: «Crear ficha» en la página y ninguna en la barra.
  await navigation
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await page
    .getByRole('button', {
      name: messages.worlds.card.openNamed('Las Mareas Grises'),
    })
    .click();
  await page
    .getByRole('navigation', {
      name: messages.worlds.detail.modules.label,
    })
    .getByRole('button', { name: messages.worlds.detail.modules.entities })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Las Mareas Grises' }),
  ).toBeVisible();

  // Espera explícita al estado vacío: antes de pintarse, la cabecera aún
  // muestra su primaria y el recuento no detectaría la duplicación.
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: messages.entities.list.emptyTitle,
    }),
  ).toBeVisible();
  await expect(page.locator('.wc-button--primary:visible')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: messages.entities.list.create }),
  ).toHaveCount(1);
  await expect(
    page
      .locator('.wc-entity-toolbar')
      .getByRole('button', { name: messages.entities.list.create }),
  ).toHaveCount(0);
  await expect(
    page.locator('.wc-topbar .wc-button--primary:visible'),
  ).toHaveCount(0);
});

test('el menú del mundo funciona con teclado, Escape y foco', async ({
  page,
}) => {
  await createWorld(page, 'Las Mareas Grises');

  const trigger = page.getByRole('button', {
    name: messages.shell.viewMenuLabel,
  });

  await trigger.click();

  const first = page.getByRole('menuitem', {
    name: messages.worlds.card.edit,
  });

  await expect(first).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: messages.worlds.card.duplicate }),
  ).toBeFocused();

  await page.keyboard.press('End');
  await expect(
    page.getByRole('menuitem', { name: messages.worlds.card.delete }),
  ).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Un diálogo abierto desde el menú vuelve a enfocar el disparador.
  await trigger.click();
  await page.getByRole('menuitem', { name: messages.worlds.card.edit }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('el tema y las actualizaciones se manejan como iconos accesibles', async ({
  page,
}) => {
  const html = page.locator('html');

  await expect(html).toHaveAttribute('data-theme', 'light');

  const lightToggle = page.getByRole('button', {
    name: messages.shell.theme.switchLabel(messages.shell.theme.currentLight),
  });

  await expect(lightToggle).not.toHaveAttribute('aria-pressed');
  await lightToggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  const darkToggle = page.getByRole('button', {
    name: messages.shell.theme.switchLabel(messages.shell.theme.currentDark),
  });

  await darkToggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: messages.updates.open }).click();

  const updates = page.getByRole('dialog', { name: messages.updates.title });

  await expect(updates).toBeVisible();
  await updates
    .getByRole('button', { name: messages.components.dialog.close })
    .last()
    .click();
  await expect(updates).not.toBeVisible();
});

test('carga Source Serif 4 desde el activo local y no pide fuentes por red', async ({
  page,
}) => {
  const fonts = await page.evaluate(async () => {
    const loaded = await Promise.all([
      document.fonts.load('400 16px "Source Serif 4"'),
      document.fonts.load('600 16px "Source Serif 4"'),
    ]);
    const faces: Array<{ weight: string; status: string }> = [];

    document.fonts.forEach((face) => {
      if (face.family.includes('Source Serif 4')) {
        faces.push({ weight: face.weight, status: face.status });
      }
    });

    return {
      checkRegular: document.fonts.check('400 16px "Source Serif 4"'),
      checkSemibold: document.fonts.check('600 16px "Source Serif 4"'),
      loadedCount: loaded.length,
      faces,
      remoteResources: performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => /^https?:/i.test(name)),
    };
  });

  expect(fonts.checkRegular).toBe(true);
  expect(fonts.checkSemibold).toBe(true);
  expect(fonts.loadedCount).toBe(2);
  expect(fonts.faces.map((face) => face.weight).sort()).toEqual(['400', '600']);
  expect(fonts.faces.every((face) => face.status === 'loaded')).toBe(true);
  expect(fonts.remoteResources).toEqual([]);
});

for (const width of [1024, 1280, 1600] as const) {
  test(`barra de 56 px y sin scroll horizontal a ${width} px con un nombre largo`, async ({
    electronApp,
    page,
  }) => {
    const longName = 'A'.repeat(120);

    await createWorld(page, longName);
    await setViewportWidth(electronApp, page, width);

    await expect(
      page.getByRole('heading', { level: 1, name: longName }),
    ).toBeVisible();

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.wc-shell');
      const topbar = document.querySelector<HTMLElement>('.wc-topbar');
      const title = document.querySelector<HTMLElement>('.wc-topbar__title');

      if (shell === null || topbar === null || title === null) {
        return null;
      }

      return {
        clientWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        shellWidth: shell.scrollWidth,
        topbarWidth: topbar.scrollWidth,
        topbarHeight: topbar.getBoundingClientRect().height,
        titleHeight: title.getBoundingClientRect().height,
        titleLineHeight: Number.parseFloat(getComputedStyle(title).lineHeight),
      };
    });

    expect(metrics).not.toBeNull();

    if (metrics !== null) {
      expect(
        metrics.documentWidth,
        JSON.stringify(metrics),
      ).toBeLessThanOrEqual(metrics.clientWidth);
      expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
        metrics.clientWidth,
      );
      expect(metrics.shellWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
        metrics.clientWidth,
      );
      expect(metrics.topbarWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
        metrics.clientWidth,
      );
      expect(metrics.topbarHeight).toBe(56);
      expect(metrics.titleHeight).toBeLessThanOrEqual(
        metrics.titleLineHeight + 1,
      );
    }
  });
}

test('Muestras sigue disponible para contenido largo sin desbordar', async ({
  page,
}) => {
  await openSamples(page);

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.samples,
    }),
  ).toBeVisible();

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(metrics.clientWidth).toBeGreaterThan(0);
  expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
  expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
});
