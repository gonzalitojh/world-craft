import { APP_VERSION } from '../../src/shared/app-info';
import { es as messages } from '../../src/renderer/messages/es';

import { expect, test } from './fixtures/electron-app';

test('abre la ventana con el shell y la identidad de la aplicación', async ({
  electronApp,
  page,
  userDataDir,
}) => {
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.home,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: messages.shell.navigationLabel }),
  ).toBeVisible();
  await expect(
    page.getByText(messages.shell.version(APP_VERSION)),
  ).toBeVisible();
  await expect(page).toHaveTitle(messages.app.title);

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

test('navega entre Inicio y Muestras sin recargar la ventana', async ({
  page,
}) => {
  const navigation = page.getByRole('navigation', {
    name: messages.shell.navigationLabel,
  });

  await navigation
    .getByRole('button', { name: messages.shell.views.samples })
    .click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.samples,
    }),
  ).toBeVisible();
  await expect(
    navigation.getByRole('button', { name: messages.shell.views.samples }),
  ).toHaveAttribute('aria-current', 'page');

  await navigation
    .getByRole('button', { name: messages.shell.views.home })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
});

test('conmuta los temas Claro y Oscuro', async ({ page }) => {
  const html = page.locator('html');
  const lightToggle = page.getByRole('button', {
    name: messages.shell.theme.switchLabel(messages.shell.theme.currentLight),
  });

  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(lightToggle).toBeVisible();

  await lightToggle.click();

  await expect(html).toHaveAttribute('data-theme', 'dark');

  const darkToggle = page.getByRole('button', {
    name: messages.shell.theme.switchLabel(messages.shell.theme.currentDark),
  });

  await expect(darkToggle).toBeVisible();
  await darkToggle.click();

  await expect(html).toHaveAttribute('data-theme', 'light');
});

for (const width of [1024, 1280, 1600] as const) {
  test(`no hay scroll horizontal de página a ${width} px`, async ({
    electronApp,
    page,
  }) => {
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

    // Dos frames para que el resize y el layout se apliquen antes de medir.
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

    // La página de Muestras concentra textos largos y todos los componentes:
    // se mide con contenido realista, no solo con el estado vacío de Inicio.
    await page
      .getByRole('navigation', { name: messages.shell.navigationLabel })
      .getByRole('button', { name: messages.shell.views.samples })
      .click();
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

    // `clientWidth` descuenta la barra de desplazamiento vertical, que aparece
    // al cargar Muestras con contenido largo; lo que importa es que el ancho
    // del documento no supere el del área visible.
    expect(metrics.clientWidth).toBeGreaterThan(0);
    expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
      metrics.clientWidth,
    );
    expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
      metrics.clientWidth,
    );
  });
}
