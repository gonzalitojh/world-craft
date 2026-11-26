import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ElectronApplication, Page } from '@playwright/test';
import sharp from 'sharp';

import { ORPHAN_BACKUP_MANIFEST_FILE } from '../../src/main/assets/constants';
import { tryReadBackupManifest } from '../../src/main/backup/manifest';
import {
  computeFileSha256,
  inspectBackupFile,
} from '../../src/main/backup/verify';
import { closeDatabase, openDatabase } from '../../src/main/db/connection';
import { resolveDataPaths } from '../../src/main/db/paths';
import {
  PRE_DELETE_RECOVERY_FILE,
  parsePreDeleteRecovery,
} from '../../src/main/data/delete-all';
import { readLibraryArchiveIndex } from '../../src/main/data/library/archive';
import { parseLibraryManifestJson } from '../../src/main/data/library/manifest';
import { parseLibrarySettingsJson } from '../../src/main/data/library/settings';
import {
  ASSETS_COPY_MANIFEST_FILE,
  verifyAssetsCopy,
} from '../../src/main/data/verified-copy';
import {
  extractArchiveEntry,
  hashArchiveEntry,
  readArchiveEntry,
} from '../../src/main/transfer/archive/reader';
import { es as messages } from '../../src/renderer/messages/es';

import {
  applyAuditTheme,
  auditFocus,
  auditReducedMotion,
  expectAxeClean,
  expectNoOverflow,
  measureView,
  runAxe,
  setAuditViewport,
  settle,
  takeAuditScreenshot,
} from './fixtures/audit';
import { expect, launchElectronApp, test } from './fixtures/electron-app';

/**
 * Flujo completo de Ajustes y Datos sobre el build real de escritorio.
 *
 * Cada prueba usa su propio `userData` temporal. Los diálogos nativos, la
 * apertura de carpetas y el reinicio tras el borrado se sustituyen **solo** en
 * el proceso principal; nunca se abre un diálogo real ni se relanza un proceso
 * fuera de Playwright. Las comprobaciones de archivos se hacen desde Node, sin
 * exponer rutas a la interfaz.
 */

const SETTINGS = messages.settings;
const DATA = SETTINGS.data;
const WORLD_NAME = 'Crónica visual de las mareas';
const ENTITY_NAME = 'Aria de la biblioteca';
const ORPHAN_ID = '018f1000-0000-7000-8000-0000000009aa';
const LONG_LIBRARY_NAME =
  'biblioteca-de-las-mareas-grises-y-los-confines-del-mundo-conocido-para-la-cronica-completa.zip';

const running = new Set<ElectronApplication>();
const extraDirectories: string[] = [];

interface DialogStubPaths {
  readonly openPath: string | null;
  readonly savePath: string | null;
}

async function launch(userDataDir: string) {
  const launched = await launchElectronApp(userDataDir);

  running.add(launched.electronApp);

  return launched;
}

async function stop(application: ElectronApplication): Promise<void> {
  running.delete(application);
  await application.close().catch(() => {});
}

test.afterEach(async () => {
  for (const application of [...running]) {
    running.delete(application);
    await application.close().catch(() => {});
  }

  await Promise.all(
    extraDirectories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, force: true, maxRetries: 5 }),
      ),
  );
});

async function extraDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-settings-e2e-'));

  extraDirectories.push(directory);

  return directory;
}

async function stubDialogs(
  application: ElectronApplication,
  paths: DialogStubPaths,
): Promise<void> {
  await application.evaluate(({ dialog }, next) => {
    const target = dialog as unknown as {
      showOpenDialog: (
        ...args: unknown[]
      ) => Promise<{ canceled: boolean; filePaths: string[] }>;
      showSaveDialog: (
        ...args: unknown[]
      ) => Promise<{ canceled: boolean; filePath?: string }>;
    };

    target.showOpenDialog = async () =>
      next.openPath === null
        ? { canceled: true, filePaths: [] }
        : { canceled: false, filePaths: [next.openPath] };
    target.showSaveDialog = async () =>
      next.savePath === null
        ? { canceled: true }
        : { canceled: false, filePath: next.savePath };
  }, paths);
}

async function stubOpenPath(application: ElectronApplication): Promise<void> {
  await application.evaluate(({ shell }) => {
    const scope = globalThis as unknown as { __wcOpenPaths?: string[] };

    scope.__wcOpenPaths = [];
    shell.openPath = async (target: string) => {
      scope.__wcOpenPaths?.push(target);
      return '';
    };
  });
}

async function readOpenPaths(
  application: ElectronApplication,
): Promise<readonly string[]> {
  return application.evaluate(() => {
    const scope = globalThis as unknown as { __wcOpenPaths?: string[] };

    return [...(scope.__wcOpenPaths ?? [])];
  });
}

async function armSaveDialog(application: ElectronApplication): Promise<void> {
  await application.evaluate(({ dialog }) => {
    const scope = globalThis as unknown as {
      __wcResolveSave?: (result: {
        canceled: boolean;
        filePath?: string;
      }) => void;
    };

    dialog.showSaveDialog = (() =>
      new Promise((resolve) => {
        scope.__wcResolveSave = resolve;
      })) as unknown as typeof dialog.showSaveDialog;
  });
}

async function resolveSaveDialog(
  application: ElectronApplication,
  filePath: string | null,
): Promise<void> {
  await application.evaluate((_electron, target) => {
    const scope = globalThis as unknown as {
      __wcResolveSave?: (result: {
        canceled: boolean;
        filePath?: string;
      }) => void;
    };
    const resolve = scope.__wcResolveSave;

    delete scope.__wcResolveSave;
    resolve?.(
      target === null
        ? { canceled: true }
        : { canceled: false, filePath: target },
    );
  }, filePath);
}

async function stubRestart(application: ElectronApplication): Promise<void> {
  await application.evaluate(({ app }) => {
    const scope = globalThis as unknown as {
      __wcRestartCalls?: { relaunch: number; exit: number };
    };

    scope.__wcRestartCalls = { relaunch: 0, exit: 0 };
    app.relaunch = () => {
      if (scope.__wcRestartCalls !== undefined) {
        scope.__wcRestartCalls.relaunch += 1;
      }
    };
    app.exit = () => {
      if (scope.__wcRestartCalls !== undefined) {
        scope.__wcRestartCalls.exit += 1;
      }
    };
  });
}

async function readRestartCalls(
  application: ElectronApplication,
): Promise<{ relaunch: number; exit: number }> {
  return application.evaluate(() => {
    const scope = globalThis as unknown as {
      __wcRestartCalls?: { relaunch: number; exit: number };
    };

    return scope.__wcRestartCalls ?? { relaunch: 0, exit: 0 };
  });
}

async function openSettings(page: Page): Promise<void> {
  // Ajustes vive en el pie del rail, fuera del `<nav>` de vistas.
  await page
    .getByRole('button', { name: messages.shell.views.settings, exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.settings,
    }),
  ).toBeVisible();
}

interface AppearanceInput {
  readonly theme: 'light' | 'dark';
  readonly density: 'comfortable' | 'compact';
  readonly fontScale: 'small' | 'normal' | 'large';
}

async function setAppearance(
  page: Page,
  input: AppearanceInput,
): Promise<void> {
  const appearance = page.locator('#apariencia');

  await appearance
    .getByRole('radio', {
      name: SETTINGS.appearance.theme[input.theme],
    })
    .check();
  await appearance
    .getByRole('radio', {
      name: SETTINGS.appearance.density[input.density],
    })
    .check();
  await appearance
    .getByRole('radio', {
      name: SETTINGS.appearance.fontScale[input.fontScale],
    })
    .check();

  const html = page.locator('html');

  await expect(html).toHaveAttribute('data-theme', input.theme);
  await expect(html).toHaveAttribute('data-density', input.density);
  await expect(html).toHaveAttribute('data-font-scale', input.fontScale);
}

async function expectSummaryReady(page: Page): Promise<void> {
  await expect(
    page.getByText(DATA.summary.worldsActive, { exact: true }),
  ).toBeVisible();
}

interface SeededWorld {
  readonly worldId: string;
  readonly worldName: string;
  readonly entityId: string;
  readonly entityName: string;
}

async function seedWorld(page: Page, name = WORLD_NAME): Promise<SeededWorld> {
  return page.evaluate(
    async ({ worldName, entityName }) => {
      const api = window.worldCraft;
      const worldResult = await api.worlds.create({ name: worldName });

      if (!worldResult.ok) {
        throw new Error(`Mundo: ${worldResult.error.code}`);
      }

      const typesResult = await api.entityTypes.list(worldResult.data.id);

      if (!typesResult.ok || typesResult.data.length === 0) {
        throw new Error('No hay tipos de ficha.');
      }

      const type = typesResult.data[0];

      if (type === undefined) {
        throw new Error('Sin tipo de ficha.');
      }

      const entityResult = await api.entities.create({
        worldId: worldResult.data.id,
        typeId: type.id,
        name: entityName,
      });

      if (!entityResult.ok) {
        throw new Error(`Ficha: ${entityResult.error.code}`);
      }

      return {
        worldId: worldResult.data.id,
        worldName: worldResult.data.name,
        entityId: entityResult.data.id,
        entityName: entityResult.data.name,
      };
    },
    { worldName: name, entityName: ENTITY_NAME },
  );
}

async function createImageFile(width = 32, height = 32): Promise<string> {
  const directory = await extraDirectory();
  const file = join(directory, 'imagen.png');

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 60, b: 90 },
    },
  })
    .png()
    .toFile(file);

  return file;
}

interface ImportedAsset {
  readonly assetId: string;
}

async function importImage(
  page: Page,
  worldId: string,
): Promise<ImportedAsset> {
  return page.evaluate(async (id) => {
    const result = await window.worldCraft.assets.import({
      worldId: id,
      alt: 'Imagen de prueba',
    });

    if (!result.ok) {
      throw new Error(`Imagen: ${result.error.code}`);
    }

    const asset = result.data.imported[0];

    if (asset === undefined) {
      throw new Error('No se pudo importar la imagen.');
    }

    return { assetId: asset.id };
  }, worldId);
}

async function fileExists(target: string): Promise<boolean> {
  return access(target).then(
    () => true,
    () => false,
  );
}

async function expectMissingOrEmpty(target: string): Promise<void> {
  if (!(await fileExists(target))) {
    return;
  }

  const stats = await stat(target);

  expect(stats.isDirectory(), `${target} debería faltar o estar vacío`).toBe(
    true,
  );
  expect(await readdir(target), `${target} debería estar vacío`).toEqual([]);
}

test('navegación, apariencia y persistencia de Ajustes', async ({
  userDataDir,
}) => {
  const first = await launch(userDataDir);
  const { page } = first;

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.home,
    }),
  ).toBeVisible();

  // Desde el pie del rail.
  await openSettings(page);
  await expect
    .poll(() => page.evaluate(() => window.location.hash))
    .toBe('#/settings');

  await setAppearance(page, {
    theme: 'dark',
    density: 'compact',
    fontScale: 'large',
  });

  // Recargar conserva la ruta y la apariencia.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.settings,
    }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('html')).toHaveAttribute(
    'data-font-scale',
    'large',
  );

  // Hash directo desde Inicio.
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.home })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.home,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/settings';
  });
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.settings,
    }),
  ).toBeVisible();

  // Desde la paleta de comandos.
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.home })
    .click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press('Control+K');

  const palette = page.getByRole('dialog', { name: messages.palette.title });

  await expect(palette).toBeVisible();
  await palette
    .getByRole('option', {
      name: new RegExp(messages.palette.commands.settings),
    })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.settings,
    }),
  ).toBeVisible();

  await stop(first.electronApp);

  // Un arranque limpio vuelve a Inicio, pero conserva la apariencia.
  const second = await launch(userDataDir);

  await expect(
    second.page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.home,
    }),
  ).toBeVisible();
  await expect(second.page.locator('html')).toHaveAttribute(
    'data-theme',
    'dark',
  );
  await expect(second.page.locator('html')).toHaveAttribute(
    'data-density',
    'compact',
  );
  await expect(second.page.locator('html')).toHaveAttribute(
    'data-font-scale',
    'large',
  );

  await openSettings(second.page);
  await expect(second.page.locator('html')).toHaveAttribute(
    'data-theme',
    'dark',
  );
  await stop(second.electronApp);
});

test('matriz visual, foco y reduced motion de Ajustes', async ({
  userDataDir,
}) => {
  test.slow();
  const launched = await launch(userDataDir);
  const { electronApp, page } = launched;
  const image = await createImageFile();
  const libraryDirectory = await extraDirectory();
  const longLibrary = join(libraryDirectory, LONG_LIBRARY_NAME);

  // Texto largo realista en el resultado de exportación para comprobar el
  // ajuste de línea dentro de la página de Ajustes.
  await stubDialogs(electronApp, {
    openPath: image,
    savePath: longLibrary,
  });

  const world = await seedWorld(page);

  await importImage(page, world.worldId);
  await openSettings(page);
  await setAppearance(page, {
    theme: 'light',
    density: 'compact',
    fontScale: 'large',
  });
  await expectSummaryReady(page);

  await page.getByRole('button', { name: DATA.export.action }).click();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: DATA.export.resultTitle,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(LONG_LIBRARY_NAME, { exact: true }),
  ).toBeVisible();

  for (const width of [1024, 1280, 1600] as const) {
    await setAuditViewport(electronApp, page, width);

    for (const theme of ['light', 'dark'] as const) {
      await applyAuditTheme(page, theme);
      await settle(page);

      const measured = await measureView(page);
      const label = `Ajustes ${width}px ${theme}`;

      expectNoOverflow(measured.overflow, label);
      expectAxeClean(await runAxe(page), label);
      await takeAuditScreenshot(page, 'settings', 'ready', theme, width);
    }
  }

  await setAuditViewport(electronApp, page, 1280);
  await applyAuditTheme(page, 'light');

  const focus = await auditFocus(page);

  expect(focus.failures, 'anillo de foco visible').toEqual([]);
  expect(focus.orderFailures, 'orden de tabulación').toEqual([]);
  expect(
    focus.minControl ?? 0,
    `objetivo mínimo (${focus.minControlLabel ?? 'sin control'})`,
  ).toBeGreaterThanOrEqual(28);
  if (focus.minPrimary !== null) {
    expect(
      focus.minPrimary,
      `primario mínimo (${focus.minPrimaryLabel ?? 'sin primario'})`,
    ).toBeGreaterThanOrEqual(32);
  }

  const motion = await auditReducedMotion(page);

  expect(motion.loops, 'bucles con movimiento reducido').toEqual([]);
  for (const transition of motion.transitions) {
    expect(
      transition.duration,
      `${transition.selector} con movimiento reducido`,
    ).toBeLessThanOrEqual(1);
  }
  expect(motion.railCollapseDuration).toBeLessThanOrEqual(1);

  await stop(electronApp);
});

test('captura Datos y los diálogos en ambos temas', async ({ userDataDir }) => {
  test.slow();
  const launched = await launch(userDataDir);
  const { electronApp, page } = launched;
  const image = await createImageFile();
  const paths = resolveDataPaths(userDataDir);
  const exportDirectory = await extraDirectory();

  await stubDialogs(electronApp, { openPath: image, savePath: null });
  const world = await seedWorld(page);

  await importImage(page, world.worldId);
  await writeFile(
    join(paths.assetsWorldsDir, world.worldId, `${ORPHAN_ID}.webp`),
    Buffer.from('huerfana-para-captura'),
  );

  await openSettings(page);
  await expectSummaryReady(page);
  await setAuditViewport(electronApp, page, 1280);

  const orphans = page.locator('.wc-settings__subsection').filter({
    has: page.getByRole('heading', {
      name: DATA.orphans.title,
      exact: true,
    }),
  });

  await orphans.getByRole('button', { name: DATA.orphans.analyze }).click();
  await expect(
    orphans.locator('.wc-settings__summary-row').first(),
  ).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await applyAuditTheme(page, theme);
    await settle(page);

    await takeAuditScreenshot(page, 'settings', 'data', theme, 1280, '#datos');

    // Exportación en curso: el diálogo permanece abierto mientras el diálogo
    // nativo de guardado no responde, así que la captura es determinista.
    await armSaveDialog(electronApp);
    await page.getByRole('button', { name: DATA.export.action }).click();

    const exportDialog = page.getByRole('dialog', {
      name: DATA.export.running,
    });

    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.locator('.wc-settings__status')).toBeFocused();
    await expect(page.locator('[data-settings-announcer]')).toBeEmpty();
    await takeAuditScreenshot(page, 'settings', 'export-dialog', theme, 1280);
    await resolveSaveDialog(
      electronApp,
      join(exportDirectory, `biblioteca-captura-${theme}.zip`),
    );
    await expect(
      page.getByRole('heading', { name: DATA.export.resultTitle }),
    ).toBeVisible();

    await orphans.getByRole('button', { name: DATA.orphans.purge }).click();

    const orphansDialog = page.getByRole('dialog', {
      name: DATA.orphans.dialogTitle,
    });

    await expect(orphansDialog).toBeVisible();
    await takeAuditScreenshot(page, 'settings', 'orphans-dialog', theme, 1280);
    await orphansDialog
      .getByRole('button', { name: DATA.orphans.cancel })
      .click();

    await page.getByRole('button', { name: DATA.danger.action }).click();

    const deleteDialog = page.getByRole('dialog', {
      name: DATA.danger.dialogTitle,
    });

    await expect(deleteDialog).toBeVisible();
    await takeAuditScreenshot(page, 'settings', 'delete-dialog', theme, 1280);
    await deleteDialog
      .getByRole('button', { name: DATA.danger.cancel })
      .click();
  }

  await stop(electronApp);
});

test('devuelve el foco al cerrar huérfanas y el error de exportación', async ({
  userDataDir,
}) => {
  const launched = await launch(userDataDir);
  const { electronApp, page } = launched;
  const paths = resolveDataPaths(userDataDir);
  const destination = join(
    await extraDirectory(),
    'sin-carpeta',
    'biblioteca.zip',
  );

  await stubDialogs(electronApp, { openPath: null, savePath: destination });

  const world = await seedWorld(page);

  await mkdir(join(paths.assetsWorldsDir, world.worldId), {
    recursive: true,
  });
  await writeFile(
    join(paths.assetsWorldsDir, world.worldId, `${ORPHAN_ID}.webp`),
    Buffer.from('huerfana'),
  );

  await openSettings(page);
  await expectSummaryReady(page);

  const orphans = page.locator('.wc-settings__subsection').filter({
    has: page.getByRole('heading', {
      name: DATA.orphans.title,
      exact: true,
    }),
  });

  await orphans.getByRole('button', { name: DATA.orphans.analyze }).click();

  const purgeButton = orphans.getByRole('button', {
    name: DATA.orphans.purge,
  });

  await purgeButton.click();

  const orphansDialog = page.getByRole('dialog', {
    name: DATA.orphans.dialogTitle,
  });

  await orphansDialog
    .getByRole('button', { name: DATA.orphans.cancel })
    .click();
  await expect(orphansDialog).not.toBeVisible();
  await expect(purgeButton).toBeFocused();
  await expect(page.locator('[data-settings-announcer]')).toBeEmpty();

  const exportButton = page.getByRole('button', {
    name: DATA.export.action,
  });

  await exportButton.click();

  const exportDialog = page.getByRole('dialog', {
    name: DATA.export.errorTitle,
  });

  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-settings-announcer]')).toBeEmpty();
  await exportDialog
    .getByRole('button', { name: messages.components.dialog.close })
    .last()
    .click();
  await expect(exportDialog).not.toBeVisible();
  await expect(exportButton).toBeFocused();

  await stop(electronApp);
});

test('abre las carpetas correctas sin exponer rutas', async ({
  userDataDir,
}) => {
  const launched = await launch(userDataDir);
  const { electronApp, page } = launched;

  await openSettings(page);
  await stubOpenPath(electronApp);

  const copy = DATA.folders;

  for (const name of [
    copy.open.data,
    copy.open.assets,
    copy.open.backups,
    copy.open.logs,
    copy.open.imports,
    copy.open.exports,
  ]) {
    await page.getByRole('button', { name }).click();
  }

  await expect
    .poll(async () => (await readOpenPaths(electronApp)).length)
    .toBe(6);

  const paths = resolveDataPaths(userDataDir);
  const expected = [
    paths.dataDir,
    paths.assetsDir,
    paths.backupsDir,
    paths.logsDir,
    paths.importsDir,
    paths.exportsDir,
  ];

  expect([...(await readOpenPaths(electronApp))].sort()).toEqual(
    [...expected].sort(),
  );

  expect(await page.locator('body').innerText()).not.toContain(userDataDir);
  expect(await page.content()).not.toContain(userDataDir);

  await stop(electronApp);
});

test('exporta la biblioteca, la verifica y la importa en otro userData', async ({
  userDataDir,
}) => {
  test.slow();
  const first = await launch(userDataDir);
  const { electronApp, page } = first;
  const image = await createImageFile();

  await stubDialogs(electronApp, { openPath: image, savePath: null });
  const world = await seedWorld(page);

  await importImage(page, world.worldId);
  await openSettings(page);
  await expectSummaryReady(page);

  // Cancelación: no se crea archivo y el botón vuelve a estar disponible.
  const libraryFile = join(userDataDir, 'biblioteca.zip');
  const exportButton = page.getByRole('button', {
    name: DATA.export.action,
  });

  await exportButton.click();
  await expect(exportButton).toBeEnabled();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: DATA.export.resultTitle,
    }),
  ).toHaveCount(0);
  expect(await fileExists(libraryFile)).toBe(false);

  await stubDialogs(electronApp, { openPath: image, savePath: libraryFile });
  await exportButton.click();
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: DATA.export.resultTitle,
    }),
  ).toBeVisible();
  await expect(page.getByText('biblioteca.zip', { exact: true })).toBeVisible();

  const index = await readLibraryArchiveIndex(libraryFile);
  const manifestText = (
    await readArchiveEntry(libraryFile, 'manifest.json', 16 * 1024 ** 2)
  ).toString('utf8');
  const manifest = parseLibraryManifestJson(manifestText);
  const settings = parseLibrarySettingsJson(
    (await readArchiveEntry(libraryFile, 'settings.json', 64 * 1024)).toString(
      'utf8',
    ),
  );

  expect(manifest.format).toBe('world-craft-library');
  expect(manifest.formatVersion).toBe(1);
  expect(manifest.database.path).toBe('database/world-craft.sqlite');
  expect(manifest.database.integrity).toBe('ok');
  expect(settings.theme).toBe('light');

  const worldEntry = manifest.worlds[0];

  if (worldEntry === undefined) {
    throw new Error('La biblioteca no contiene el mundo sembrado.');
  }

  expect(worldEntry.name).toBe(WORLD_NAME);
  expect(index.entries.map((entry) => entry.path).sort()).toEqual(
    [
      'database/world-craft.sqlite',
      'manifest.json',
      'settings.json',
      worldEntry.path,
    ].sort(),
  );

  expect(
    await hashArchiveEntry(
      libraryFile,
      'database/world-craft.sqlite',
      256 * 1024 ** 2,
    ),
  ).toBe(manifest.database.sha256);
  expect(await hashArchiveEntry(libraryFile, 'settings.json', 64 * 1024)).toBe(
    manifest.settings.sha256,
  );
  expect(
    await hashArchiveEntry(libraryFile, worldEntry.path, 256 * 1024 ** 2),
  ).toBe(worldEntry.sha256);

  const databaseFile = join(await extraDirectory(), 'world-craft.sqlite');

  await extractArchiveEntry(
    libraryFile,
    'database/world-craft.sqlite',
    databaseFile,
    256 * 1024 ** 2,
  );

  const database = openDatabase({ file: databaseFile, readonly: true });

  try {
    expect(inspectBackupFile(databaseFile, manifest.schemaVersion)).toBe('ok');
  } finally {
    closeDatabase(database);
  }

  const worldPackage = join(await extraDirectory(), 'mundo.zip');

  await extractArchiveEntry(
    libraryFile,
    worldEntry.path,
    worldPackage,
    256 * 1024 ** 2,
  );

  await stop(first.electronApp);

  // Importación mundo a mundo en un perfil limpio.
  const secondUserData = await extraDirectory();
  const second = await launch(secondUserData);

  await stubDialogs(second.electronApp, {
    openPath: worldPackage,
    savePath: null,
  });
  await second.page
    .getByRole('button', { name: messages.shell.viewMenuLabel })
    .click();
  await second.page
    .getByRole('menuitem', { name: messages.transfer.actions.import })
    .click();
  await expect(
    second.page.getByRole('heading', {
      name: messages.transfer.titles.imported,
    }),
  ).toBeVisible();

  const imported = await second.page.evaluate(
    async (expected) => {
      const worlds = await window.worldCraft.worlds.list();

      if (!worlds.ok) {
        return null;
      }

      const match = worlds.data.find(
        (item) => item.name === expected.worldName,
      );

      if (match === undefined) {
        return null;
      }

      const entities = await window.worldCraft.entities.list({
        worldId: match.id,
      });

      return {
        worldId: match.id,
        entityNames: entities.ok ? entities.data.map((item) => item.name) : [],
      };
    },
    { worldName: WORLD_NAME },
  );

  expect(imported).not.toBeNull();
  expect(imported?.worldId).toMatch(/[0-9a-f-]{36}/);
  expect(imported?.entityNames).toContain(ENTITY_NAME);

  await stop(second.electronApp);
});

test('analiza y purga imágenes huérfanas con copia verificable', async ({
  userDataDir,
}) => {
  const launched = await launch(userDataDir);
  const { electronApp, page } = launched;
  const image = await createImageFile();
  const paths = resolveDataPaths(userDataDir);

  await stubDialogs(electronApp, { openPath: image, savePath: null });
  const world = await seedWorld(page);

  const asset = await importImage(page, world.worldId);
  const orphanFile = join(
    paths.assetsWorldsDir,
    world.worldId,
    `${ORPHAN_ID}.webp`,
  );
  const referencedFile = join(
    paths.assetsWorldsDir,
    world.worldId,
    `${asset.assetId}.webp`,
  );

  await writeFile(orphanFile, Buffer.from('huerfana'));

  await openSettings(page);
  await expectSummaryReady(page);

  const orphanSection = page.locator('.wc-settings__subsection').filter({
    has: page.getByRole('heading', {
      name: DATA.orphans.title,
      exact: true,
    }),
  });

  await orphanSection
    .getByRole('button', { name: DATA.orphans.analyze })
    .click();

  const purgeableRow = orphanSection
    .locator('.wc-settings__summary-row')
    .filter({ hasText: DATA.orphans.rows.purgeable });

  await expect(purgeableRow.locator('dd')).toHaveText('1');

  await orphanSection.getByRole('button', { name: DATA.orphans.purge }).click();

  const dialog = page.getByRole('dialog', {
    name: DATA.orphans.dialogTitle,
  });

  await expect(dialog).toBeVisible();

  const confirm = dialog.getByRole('button', { name: DATA.orphans.confirm });

  await expect(confirm).toBeDisabled();
  await dialog
    .getByRole('checkbox', { name: DATA.orphans.confirmLabel })
    .check();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(
    orphanSection.getByRole('heading', {
      name: DATA.orphans.resultTitle,
    }),
  ).toBeVisible();

  expect(await fileExists(orphanFile)).toBe(false);
  expect(await fileExists(referencedFile)).toBe(true);

  const backups = await readdir(paths.orphanBackupsDir);
  const backupName = backups[0];

  if (backupName === undefined || backups.length !== 1) {
    throw new Error('Se esperaba una única copia de huérfanos.');
  }

  const backupDirectory = join(paths.orphanBackupsDir, backupName);
  const backupManifest = JSON.parse(
    await readFile(join(backupDirectory, ORPHAN_BACKUP_MANIFEST_FILE), 'utf8'),
  ) as unknown;

  expect(backupManifest).toBeTruthy();
  expect(
    await fileExists(
      join(
        backupDirectory,
        'assets',
        'worlds',
        world.worldId,
        `${ORPHAN_ID}.webp`,
      ),
    ),
  ).toBe(true);
  expect(await fileExists(referencedFile)).toBe(true);

  await stop(electronApp);
});

test('borra todos los datos, conserva la copia y arranca limpio', async ({
  userDataDir,
}) => {
  test.slow();
  const launched = await launch(userDataDir);
  const { electronApp, page } = launched;
  const paths = resolveDataPaths(userDataDir);
  const image = await createImageFile();
  const outside = await extraDirectory();
  const sentinel = join(outside, 'instalacion-simulada.txt');
  const updaterId = join(userDataDir, '.updaterId');
  const unknownEntry = join(userDataDir, 'entrada-desconocida.txt');

  await writeFile(sentinel, 'instalacion intacta');
  await writeFile(updaterId, 'sample-updater-id');
  await writeFile(unknownEntry, 'contenido desconocido');

  await stubDialogs(electronApp, { openPath: image, savePath: null });
  await stubRestart(electronApp);

  const world = await seedWorld(page);

  await importImage(page, world.worldId);
  await openSettings(page);
  await setAppearance(page, {
    theme: 'dark',
    density: 'compact',
    fontScale: 'large',
  });
  await expectSummaryReady(page);

  const copy = DATA.danger;

  await page.getByRole('button', { name: copy.action }).click();

  const dialog = page.getByRole('dialog', { name: copy.dialogTitle });

  await expect(dialog).toBeVisible();

  const confirm = dialog.getByRole('button', { name: copy.confirm });
  const keepBackups = dialog.getByRole('checkbox', {
    name: copy.keepBackupsLabel,
  });

  await expect(keepBackups).not.toBeChecked();
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(copy.phraseLabel).fill(copy.phraseValue);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(
    dialog.getByRole('heading', { name: copy.doneTitle }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readRestartCalls(electronApp)).exit)
    .toBe(1);

  const backupNames = await readdir(paths.preDeleteBackupsDir);
  const backupName = backupNames[0];

  if (backupName === undefined || backupNames.length !== 1) {
    throw new Error('Se esperaba una única copia previa al borrado.');
  }

  const backupDirectory = join(paths.preDeleteBackupsDir, backupName);
  const manifest = await tryReadBackupManifest(backupDirectory);

  if (manifest === null) {
    throw new Error('La copia previa no tiene manifiesto válido.');
  }

  const backupDatabase = join(backupDirectory, 'world-craft.sqlite');

  expect(manifest.reason).toBe('pre-delete');
  expect(await computeFileSha256(backupDatabase)).toBe(manifest.sha256);
  expect(inspectBackupFile(backupDatabase, manifest.schemaVersion)).toBe('ok');

  const recovery = parsePreDeleteRecovery(
    JSON.parse(
      await readFile(join(backupDirectory, PRE_DELETE_RECOVERY_FILE), 'utf8'),
    ) as unknown,
  );

  expect(recovery.database.sha256).toBe(manifest.sha256);

  const backupAssets = await verifyAssetsCopy({
    assetsDir: join(backupDirectory, 'assets'),
    manifestFile: join(backupDirectory, ASSETS_COPY_MANIFEST_FILE),
  });

  expect(backupAssets.count).toBeGreaterThanOrEqual(1);

  const backupConnection = openDatabase({
    file: backupDatabase,
    readonly: true,
  });

  try {
    const row = backupConnection
      .prepare('select count(*) as total from worlds')
      .get() as { total: number };

    expect(row.total).toBe(1);
  } finally {
    closeDatabase(backupConnection);
  }

  await expectMissingOrEmpty(paths.dataDir);
  await expectMissingOrEmpty(paths.assetsDir);
  await expectMissingOrEmpty(paths.logsDir);
  await expectMissingOrEmpty(paths.importsTempDir);
  await expectMissingOrEmpty(paths.exportsTempDir);
  expect(await readdir(paths.backupsDir)).toEqual(['pre-delete']);

  expect(await readFile(updaterId, 'utf8')).toBe('sample-updater-id');
  expect(await readFile(unknownEntry, 'utf8')).toBe('contenido desconocido');
  expect(await readFile(sentinel, 'utf8')).toBe('instalacion intacta');

  await stop(electronApp);

  // Relanzar sobre el mismo perfil: no quedan datos ni preferencias.
  const relaunched = await launch(userDataDir);

  await expect(
    relaunched.page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.home,
    }),
  ).toBeVisible();

  const remaining = await relaunched.page.evaluate(async () => {
    const worlds = await window.worldCraft.worlds.list();

    return worlds.ok ? worlds.data.length : -1;
  });

  expect(remaining).toBe(0);
  expect(await relaunched.page.locator('html').getAttribute('data-theme')).toBe(
    'light',
  );
  expect(
    await relaunched.page.locator('html').getAttribute('data-density'),
  ).toBe('comfortable');
  expect(
    await relaunched.page.locator('html').getAttribute('data-font-scale'),
  ).toBe('normal');

  await openSettings(relaunched.page);
  await expect(
    relaunched.page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.settings,
    }),
  ).toBeVisible();

  await stop(relaunched.electronApp);
});

// Escenario de modo seguro/no disponible: cubrirlo aquí exigiría interceptar
// `dialog.showMessageBox` antes de que Electron arranque, porque el aviso de
// recuperación es un diálogo nativo que bloquea el proceso principal y
// Playwright solo se conecta después de `launch`. La interfaz de «no
// disponible» y los botones deshabilitados ya se cubren en
// `tests/components/data-settings.test.tsx` y `data-settings-hook.test.tsx`.
