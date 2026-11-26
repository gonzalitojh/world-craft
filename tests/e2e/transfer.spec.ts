import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ElectronApplication, Page } from '@playwright/test';
import sharp from 'sharp';

import {
  readArchiveEntry,
  readArchiveIndex,
} from '../../src/main/transfer/archive/reader';
import { parseManifestJson } from '../../src/main/transfer/format/manifest';
import { parseWorldTransferJson } from '../../src/main/transfer/format/world';
import { es as messages } from '../../src/renderer/messages/es';
import { buildRawZip, type RawZipEntry } from '../integration/helpers/zip';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, test } from './fixtures/electron-app';
import { launchElectronApp } from './fixtures/electron-app';

const WORLD_NAME = 'Crónica de las Mareas E2E';
const ENTITY_NAME = 'Aria de prueba';
const SECOND_ENTITY_NAME = 'Orden del Faro E2E';
const CUSTOM_TYPE_NAME = 'Criatura de prueba';
const CUSTOM_TYPE_KEY = 'criatura-de-prueba';
const TAG_NAME = 'Navegante E2E';
const VERSION_LABEL = 'Retrato inicial';
const BASELINE_WORLD_NAME = 'Mundo previo E2E';
const BASELINE_ENTITY_NAME = 'Ficha previa E2E';
const RELATION_TYPE_KEY = 'ally-of';

interface DialogStubPaths {
  readonly openPath: string | null;
  readonly savePath: string | null;
}

async function stubDialogs(
  electronApp: ElectronApplication,
  paths: DialogStubPaths,
): Promise<void> {
  await electronApp.evaluate(({ dialog }, next) => {
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

async function goHome(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.home })
    .click();
}

async function setContentWidth(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
): Promise<void> {
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

async function installWorldAndEntity(page: Page): Promise<{
  readonly worldId: string;
  readonly entityId: string;
  readonly secondEntityId: string;
}> {
  return page.evaluate(
    async ({
      worldName,
      entityName,
      secondEntityName,
      customTypeName,
      customTypeKey,
      tagName,
      versionLabel,
      relationTypeKey,
    }) => {
      const worldResult = await window.worldCraft.worlds.create({
        name: worldName,
      });

      if (!worldResult.ok) {
        throw new Error('No se pudo crear el mundo de la prueba.');
      }

      const world = worldResult.data;
      const customTypeResult = await window.worldCraft.entityTypes.create({
        worldId: world.id,
        name: customTypeName,
        key: customTypeKey,
        icon: 'paw-print',
        color: 'moss',
        fields: [
          {
            key: 'poder',
            label: 'Poder',
            type: 'number',
            required: false,
          },
        ],
      });

      if (!customTypeResult.ok) {
        throw new Error('No se pudo crear el tipo personalizado.');
      }

      const typesResult = await window.worldCraft.entityTypes.list(world.id);

      if (!typesResult.ok) {
        throw new Error('No se pudieron leer los tipos de entidad.');
      }

      const character = typesResult.data.find(
        (type) => type.key === 'character',
      );

      if (character === undefined) {
        throw new Error('Falta el tipo de sistema character.');
      }

      const assetsResult = await window.worldCraft.assets.import({
        worldId: world.id,
        alt: 'Retrato de prueba',
      });

      if (!assetsResult.ok || assetsResult.data.imported.length === 0) {
        throw new Error('No se pudo importar la imagen de la prueba.');
      }

      const tagResult = await window.worldCraft.tags.create({
        worldId: world.id,
        name: tagName,
        color: 'moss',
      });

      if (!tagResult.ok) {
        throw new Error('No se pudo crear la etiqueta de la prueba.');
      }

      const entityResult = await window.worldCraft.entities.create({
        worldId: world.id,
        typeId: customTypeResult.data.id,
        name: entityName,
        description: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Descripción inicial.' }],
            },
          ],
        },
        attributes: { poder: 7 },
        imageAssetId: assetsResult.data.imported[0]?.id,
        tagIds: [tagResult.data.id],
      });

      if (!entityResult.ok) {
        throw new Error('No se pudo crear la ficha de la prueba.');
      }

      const secondEntityResult = await window.worldCraft.entities.create({
        worldId: world.id,
        typeId: character.id,
        name: secondEntityName,
        summary: 'Segunda ficha del mundo de prueba.',
      });

      if (!secondEntityResult.ok) {
        throw new Error('No se pudo crear la segunda ficha de la prueba.');
      }

      const versionResult = await window.worldCraft.versions.create({
        worldId: world.id,
        entityId: entityResult.data.id,
        label: versionLabel,
      });

      if (!versionResult.ok || !versionResult.data.created) {
        throw new Error('No se pudo crear la versión manual.');
      }

      const relationTypes = await window.worldCraft.relationTypes.list(
        world.id,
      );

      if (!relationTypes.ok) {
        throw new Error('No se pudieron leer los tipos de relación.');
      }

      const relationType = relationTypes.data.find(
        (type) => type.key === relationTypeKey,
      );

      if (relationType === undefined) {
        throw new Error('Falta el tipo de relación ally-of.');
      }

      const relationResult = await window.worldCraft.relations.create({
        worldId: world.id,
        sourceId: entityResult.data.id,
        targetId: secondEntityResult.data.id,
        typeId: relationType.id,
        label: 'Aliado de prueba',
      });

      if (!relationResult.ok) {
        throw new Error('No se pudo crear la relación de la prueba.');
      }

      return {
        worldId: world.id,
        entityId: entityResult.data.id,
        secondEntityId: secondEntityResult.data.id,
      };
    },
    {
      worldName: WORLD_NAME,
      entityName: ENTITY_NAME,
      secondEntityName: SECOND_ENTITY_NAME,
      customTypeName: CUSTOM_TYPE_NAME,
      customTypeKey: CUSTOM_TYPE_KEY,
      tagName: TAG_NAME,
      versionLabel: VERSION_LABEL,
      relationTypeKey: RELATION_TYPE_KEY,
    },
  );
}

async function installBaselineWorld(
  page: Page,
): Promise<{ readonly worldId: string; readonly entityId: string }> {
  return page.evaluate(
    async ({ worldName, entityName }) => {
      const worldResult = await window.worldCraft.worlds.create({
        name: worldName,
      });

      if (!worldResult.ok) {
        throw new Error('No se pudo crear el mundo previo.');
      }

      const typesResult = await window.worldCraft.entityTypes.list(
        worldResult.data.id,
      );

      if (!typesResult.ok) {
        throw new Error('No se pudieron leer los tipos del mundo previo.');
      }

      const character = typesResult.data.find(
        (type) => type.key === 'character',
      );

      if (character === undefined) {
        throw new Error('Falta el tipo de sistema character.');
      }

      const entityResult = await window.worldCraft.entities.create({
        worldId: worldResult.data.id,
        typeId: character.id,
        name: entityName,
        summary: 'Contenido que la importación no debe modificar.',
      });

      if (!entityResult.ok) {
        throw new Error('No se pudo crear la ficha previa.');
      }

      return {
        worldId: worldResult.data.id,
        entityId: entityResult.data.id,
      };
    },
    {
      worldName: BASELINE_WORLD_NAME,
      entityName: BASELINE_ENTITY_NAME,
    },
  );
}

/**
 * Reconstruye el paquete quitando una etiqueta del mundo pero dejando su nombre
 * en una ficha. La importación debe completarse con el aviso `missing-tag`, que
 * es el estado de éxito con avisos que revisa axe.
 */
async function buildWarningArchive(
  source: string,
  target: string,
): Promise<void> {
  const index = await readArchiveIndex(source);
  const manifest = parseManifestJson(
    (await readArchiveEntry(source, 'manifest.json', 16 * 1024 ** 2)).toString(
      'utf8',
    ),
  );
  const world = parseWorldTransferJson(
    (await readArchiveEntry(source, 'world.json', 256 * 1024 ** 2)).toString(
      'utf8',
    ),
  );
  const tags = world.tags.filter((tag) => tag.name !== TAG_NAME);

  if (tags.length === world.tags.length) {
    throw new Error('La prueba esperaba la etiqueta del mundo.');
  }

  const worldData = Buffer.from(
    `${JSON.stringify({ ...world, tags }, null, 2)}\n`,
  );
  const files = manifest.files.map((entry) =>
    entry.path === 'world.json'
      ? {
          path: entry.path,
          size: worldData.byteLength,
          sha256: createHash('sha256').update(worldData).digest('hex'),
        }
      : entry,
  );
  const updatedManifest = {
    ...manifest,
    counts: { ...manifest.counts, tags: tags.length },
    files,
  };
  const entries: RawZipEntry[] = [
    {
      name: 'manifest.json',
      data: Buffer.from(`${JSON.stringify(updatedManifest, null, 2)}\n`),
    },
    { name: 'world.json', data: worldData },
  ];

  for (const entry of index.entries) {
    if (entry.parsed.kind !== 'asset') {
      continue;
    }

    entries.push({
      name: entry.path,
      data: await readArchiveEntry(source, entry.path, 25 * 1024 * 1024),
    });
  }

  await writeFile(target, buildRawZip(entries));
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((nextTheme) => {
    document.documentElement.dataset.theme = nextTheme;
  }, theme);
}

async function measureDialog(page: Page): Promise<{
  readonly clientWidth: number;
  readonly documentWidth: number;
  readonly bodyClientWidth: number;
  readonly bodyScrollWidth: number;
}> {
  return page.evaluate(() => {
    const body = document.querySelector('dialog.wc-transfer .wc-dialog__body');

    return {
      clientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyClientWidth: body?.clientWidth ?? 0,
      bodyScrollWidth: body?.scrollWidth ?? 0,
    };
  });
}

/**
 * Sustituye el contenido del resumen por el peor caso de longitud y recuentos.
 * No cambia el componente: comprueba que las clases reales del diálogo ajustan
 * el contenido sin desbordar a 1024, 1280 y 1600 px.
 */
async function fillLongDialogContent(page: Page): Promise<void> {
  await page.evaluate(
    ({ longName, longFile }) => {
      const dialog = document.querySelector('dialog.wc-transfer');

      if (dialog === null) {
        throw new Error('La prueba esperaba el diálogo de transferencia.');
      }

      const notice = dialog.querySelector('.wc-transfer__notice');

      if (notice !== null) {
        notice.textContent = `«${longName}» se ha importado como un mundo nuevo, con algunos avisos.`;
      }

      const meta = dialog.querySelector('.wc-transfer__meta');

      if (meta !== null) {
        const row = document.createElement('div');
        const label = document.createElement('dt');
        const value = document.createElement('dd');

        row.className = 'wc-transfer__meta-row';
        label.className = 'wc-transfer__meta-label';
        label.textContent = 'Archivo';
        value.className =
          'wc-transfer__meta-value wc-transfer__meta-value--mono';
        value.textContent = longFile;
        row.append(label, value);
        meta.append(row);
      }

      for (const count of dialog.querySelectorAll(
        '.wc-transfer__count-value',
      )) {
        count.textContent = '500.000';
      }

      const summary = dialog.querySelector('.wc-transfer__summary');

      if (summary !== null) {
        const section = document.createElement('section');
        const title = document.createElement('h3');
        const list = document.createElement('ul');

        section.className = 'wc-transfer__section';
        title.className = 'wc-transfer__section-title';
        title.textContent = 'Avisos';
        list.className = 'wc-transfer__warnings';

        for (let index = 0; index < 3; index += 1) {
          const item = document.createElement('li');

          item.className = 'wc-transfer__warning';
          item.textContent =
            'Se han descartado 500.000 fichas porque su tipo no estaba en el archivo.';
          list.append(item);
        }

        section.append(title, list);
        summary.append(section);
      }
    },
    {
      longName: 'A'.repeat(120),
      longFile: `${'b'.repeat(120)}.zip`,
    },
  );
}

async function expectNoSeriousAxeViolations(
  page: Page,
  context: string,
): Promise<void> {
  const results = await analyzeWithAxe(
    page,
    {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    },
    'dialog.wc-transfer',
  );

  expect(
    results.violations
      .filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      )
      .map((violation) => `${context}: ${violation.id}`),
  ).toEqual([]);
}

test('exporta, inspecciona e importa un mundo completo sin tocar el perfil de destino', async ({
  userDataDir,
}) => {
  test.setTimeout(120_000);

  const imagePath = join(userDataDir, 'imagen-de-prueba.png');
  const exportPath = join(userDataDir, 'mundo-exportado.zip');
  const image = await sharp({
    create: {
      width: 12,
      height: 12,
      channels: 3,
      background: { r: 20, g: 80, b: 120 },
    },
  })
    .png()
    .toBuffer();

  await writeFile(imagePath, image);

  const first = await launchElectronApp(userDataDir);
  let second: Awaited<ReturnType<typeof launchElectronApp>> | null = null;
  let secondUserData: string | null = null;

  try {
    await stubDialogs(first.electronApp, {
      openPath: imagePath,
      savePath: exportPath,
    });

    await installWorldAndEntity(first.page);
    await first.page.reload();
    await first.page.waitForLoadState('domcontentloaded');

    await expect(
      first.page.getByRole('heading', { level: 3, name: WORLD_NAME }),
    ).toBeVisible();
    await first.page
      .getByRole('button', {
        name: messages.worlds.card.openNamed(WORLD_NAME),
      })
      .click();
    await expect(
      first.page.getByRole('heading', { level: 1, name: WORLD_NAME }),
    ).toBeVisible();

    await first.page
      .getByRole('button', { name: messages.shell.viewMenuLabel })
      .click();
    await first.page
      .getByRole('menuitem', { name: messages.transfer.actions.export })
      .click();

    await expect(
      first.page.getByRole('heading', {
        name: messages.transfer.titles.exported,
      }),
    ).toBeVisible();

    const index = await readArchiveIndex(exportPath);
    const manifest = parseManifestJson(
      (
        await readArchiveEntry(exportPath, 'manifest.json', 16 * 1024 ** 2)
      ).toString('utf8'),
    );
    const world = parseWorldTransferJson(
      (
        await readArchiveEntry(exportPath, 'world.json', 256 * 1024 ** 2)
      ).toString('utf8'),
    );

    expect(
      index.entries.filter((entry) => entry.parsed.kind === 'asset'),
    ).toHaveLength(1);
    expect(manifest.counts.entities).toBe(2);
    expect(manifest.counts.entityTypes).toBe(1);
    expect(manifest.counts.tags).toBe(1);
    expect(manifest.counts.relations).toBe(1);
    expect(manifest.counts.versions).toBe(1);
    expect(manifest.counts.assets).toBe(1);

    const exportedEntities = world.entities.map((entity) => entity.name);

    expect(exportedEntities).toEqual(
      expect.arrayContaining([ENTITY_NAME, SECOND_ENTITY_NAME]),
    );
    expect(world.entityTypes.types.map((type) => type.key)).toContain(
      CUSTOM_TYPE_KEY,
    );
    expect(world.tags.map((tag) => tag.name)).toContain(TAG_NAME);

    const exportedEntity = world.entities.find(
      (entity) => entity.name === ENTITY_NAME,
    );

    expect(exportedEntity?.tagNames).toContain(TAG_NAME);
    expect(
      exportedEntity?.versions.some(
        (version) => version.label === VERSION_LABEL,
      ),
    ).toBe(true);
    expect(exportedEntity?.imageAssetId).not.toBeNull();
    expect(
      world.relations.some(
        (relation) => relation.typeKey === RELATION_TYPE_KEY,
      ),
    ).toBe(true);
    expect(world.assets).toHaveLength(1);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(first.page, theme);
      await expectNoSeriousAxeViolations(first.page, `exportación ${theme}`);
    }

    await setTheme(first.page, 'light');
    await first.page
      .getByRole('dialog')
      .getByRole('button', { name: messages.components.dialog.close })
      .last()
      .click();
    await first.electronApp.close();

    secondUserData = await mkdtemp(join(tmpdir(), 'world-craft-e2e-transfer-'));
    second = await launchElectronApp(secondUserData);

    const baseline = await installBaselineWorld(second.page);

    await second.page.reload();
    await second.page.waitForLoadState('domcontentloaded');
    await expect(
      second.page.getByRole('heading', {
        level: 3,
        name: BASELINE_WORLD_NAME,
      }),
    ).toBeVisible();

    await stubDialogs(second.electronApp, {
      openPath: exportPath,
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

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(second.page, theme);
      await expectNoSeriousAxeViolations(second.page, `importación ${theme}`);
    }

    await fillLongDialogContent(second.page);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(second.page, theme);

      for (const width of [1024, 1280, 1600] as const) {
        await setContentWidth(second.electronApp, second.page, width);

        const metrics = await measureDialog(second.page);

        expect(metrics.clientWidth).toBeGreaterThan(0);
        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.bodyClientWidth).toBeGreaterThan(0);
        expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(
          metrics.bodyClientWidth,
        );
        await expect(second.page.getByRole('dialog')).toBeVisible();
      }
    }

    await second.page.emulateMedia({ reducedMotion: 'reduce' });

    const reducedMotion = await second.page.evaluate(() => {
      const progress = document.createElement('div');
      const bar = document.createElement('span');

      progress.className = 'wc-progress wc-progress--indeterminate';
      bar.className = 'wc-progress__bar';
      progress.append(bar);
      document.body.append(progress);

      const animationName = getComputedStyle(bar).animationName;

      progress.remove();
      return animationName;
    });

    expect(reducedMotion).toBe('none');
    await second.page.emulateMedia({ reducedMotion: 'no-preference' });
    await setTheme(second.page, 'light');

    const imported = await second.page.evaluate(
      async (expected) => {
        const worlds = await window.worldCraft.worlds.list();

        if (!worlds.ok) {
          return null;
        }

        const world = worlds.data.find(
          (item) => item.name === expected.worldName,
        );
        const baselineWorld = worlds.data.find(
          (item) => item.name === expected.baselineWorldName,
        );

        if (world === undefined || baselineWorld === undefined) {
          return null;
        }

        const [entities, types, tags, relations, assets, baselineEntities] =
          await Promise.all([
            window.worldCraft.entities.list({ worldId: world.id }),
            window.worldCraft.entityTypes.list(world.id),
            window.worldCraft.tags.list(world.id),
            window.worldCraft.relations.list({ worldId: world.id }),
            window.worldCraft.assets.list(world.id),
            window.worldCraft.entities.list({ worldId: baselineWorld.id }),
          ]);

        if (
          !entities.ok ||
          !types.ok ||
          !tags.ok ||
          !relations.ok ||
          !assets.ok ||
          !baselineEntities.ok
        ) {
          return null;
        }

        const entity = entities.data.find(
          (item) => item.name === expected.entityName,
        );
        const detail =
          entity === undefined
            ? null
            : await window.worldCraft.entities.get({
                worldId: world.id,
                id: entity.id,
              });
        const versions =
          entity === undefined
            ? null
            : await window.worldCraft.versions.list({
                worldId: world.id,
                entityId: entity.id,
              });

        return {
          worldCount: worlds.data.length,
          worldId: world.id,
          entities: entities.data.length,
          entityNames: entities.data.map((item) => item.name),
          typeKeys: types.data.map((item) => item.key),
          tagNames: tags.data.map((item) => item.name),
          relationTypeKeys: relations.data.map((item) => item.typeKey),
          relationNames: relations.data.map(
            (item) => `${item.source.name}->${item.target.name}`,
          ),
          versionLabels:
            versions?.ok === true
              ? versions.data.map((version) => version.label)
              : [],
          assets: assets.data.length,
          imageAssetId:
            detail?.ok && detail.data !== null
              ? detail.data.imageAssetId
              : null,
          baseline: {
            worldId: baselineWorld.id,
            entityNames: baselineEntities.data.map((item) => item.name),
            summaries: baselineEntities.data.map((item) => item.summary),
          },
        };
      },
      {
        worldName: WORLD_NAME,
        entityName: ENTITY_NAME,
        baselineWorldName: BASELINE_WORLD_NAME,
      },
    );

    expect(imported).not.toBeNull();
    expect(imported?.worldCount).toBe(2);
    expect(imported?.entities).toBe(2);
    expect(imported?.entityNames).toEqual(
      expect.arrayContaining([ENTITY_NAME, SECOND_ENTITY_NAME]),
    );
    expect(imported?.typeKeys).toContain(CUSTOM_TYPE_KEY);
    expect(imported?.tagNames).toContain(TAG_NAME);
    expect(imported?.relationTypeKeys).toEqual([RELATION_TYPE_KEY]);
    expect(imported?.relationNames).toEqual([
      `${ENTITY_NAME}->${SECOND_ENTITY_NAME}`,
    ]);
    expect(imported?.versionLabels).toContain(VERSION_LABEL);
    expect(imported?.assets).toBe(1);
    expect(imported?.imageAssetId).not.toBeNull();
    expect(imported?.baseline.worldId).toBe(baseline.worldId);
    expect(imported?.baseline.entityNames).toEqual([BASELINE_ENTITY_NAME]);
    expect(imported?.baseline.summaries).toEqual([
      'Contenido que la importación no debe modificar.',
    ]);

    await second.page
      .getByRole('button', { name: messages.transfer.actions.openWorld })
      .click();
    await expect(
      second.page.getByRole('heading', { level: 1, name: WORLD_NAME }),
    ).toBeVisible();

    const warningPath = join(secondUserData, 'con-avisos.zip');

    await buildWarningArchive(exportPath, warningPath);
    await goHome(second.page);
    await stubDialogs(second.electronApp, {
      openPath: warningPath,
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
    await expect(
      second.page.getByText(messages.transfer.status.successWithWarnings),
    ).toBeVisible();
    await expect(
      second.page.getByText(
        messages.transfer.summary.warnings['missing-tag'].one.replace(
          '{count}',
          '1',
        ),
      ),
    ).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(second.page, theme);
      await expectNoSeriousAxeViolations(
        second.page,
        `importación con avisos ${theme}`,
      );
    }

    await setTheme(second.page, 'light');
    await second.page
      .getByRole('dialog')
      .getByRole('button', { name: messages.components.dialog.close })
      .last()
      .click();

    const traversalPath = join(secondUserData, 'traversal.zip');

    await writeFile(
      traversalPath,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'world.json', data: Buffer.from('{}') },
        { name: 'assets/../evil.webp', data: Buffer.from('x') },
      ]),
    );
    await stubDialogs(second.electronApp, {
      openPath: traversalPath,
      savePath: null,
    });
    await goHome(second.page);
    const worldsBefore = await second.page.evaluate(async () => {
      const result = await window.worldCraft.worlds.list();
      return result.ok ? result.data.length : -1;
    });

    await second.page
      .getByRole('button', { name: messages.shell.viewMenuLabel })
      .click();
    await second.page
      .getByRole('menuitem', { name: messages.transfer.actions.import })
      .click();

    await expect(
      second.page.getByRole('heading', {
        name: messages.transfer.titles.importFailed,
      }),
    ).toBeVisible();
    await expect(
      second.page.getByText(
        messages.transfer.errors.codes.TRANSFER_ENTRY_REJECTED,
      ),
    ).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(second.page, theme);
      await expectNoSeriousAxeViolations(second.page, `error ${theme}`);
    }

    await setTheme(second.page, 'light');

    const worldsAfter = await second.page.evaluate(async () => {
      const result = await window.worldCraft.worlds.list();
      return result.ok ? result.data.length : -1;
    });

    expect(worldsAfter).toBe(worldsBefore);
  } finally {
    await second?.electronApp.close().catch(() => undefined);

    if (secondUserData !== null) {
      await rm(secondUserData, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    }

    await first.electronApp.close().catch(() => undefined);
  }
});
