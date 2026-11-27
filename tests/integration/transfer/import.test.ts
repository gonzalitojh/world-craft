import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { and, eq, isNull } from 'drizzle-orm';
import yazl from 'yazl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readUserVersion } from '@/main/db/connection';
import { assets } from '@/main/db/schema/assets';
import {
  entities,
  entityGallery,
  entityTags,
  tags,
} from '@/main/db/schema/entities';
import { entityTypes } from '@/main/db/schema/entity-types';
import { relations } from '@/main/db/schema/relations';
import { entityVersions } from '@/main/db/schema/versions';
import { activityLog, worlds } from '@/main/db/schema/worlds';
import {
  readArchiveEntry,
  readArchiveIndex,
} from '@/main/transfer/archive/reader';
import { TransferError } from '@/main/transfer/errors';
import { exportWorld } from '@/main/transfer/export/service';
import { parseManifestJson } from '@/main/transfer/format/manifest';
import { parseWorldTransferJson } from '@/main/transfer/format/world';
import type { PreparedImport } from '@/main/transfer/import/prepare';
import {
  createImportService,
  createUnavailableImportService,
  type ImportService,
} from '@/main/transfer/import/service';
import {
  createTransferFixture,
  FIXTURE_ENTITY_ARIA_ID,
  FIXTURE_ENTITY_ORDER_ID,
  FIXTURE_WORLD_ID,
  type TransferFixture,
} from '../helpers/transfer-fixture';
import { buildRawZip } from '../helpers/zip';

const IMPORT_TIME = 1_900_000_000_000;

let fixture: TransferFixture;
let archive: string;

beforeEach(async () => {
  fixture = await createTransferFixture();
  archive = join(fixture.rootDir, 'cronica.zip');

  await exportWorld({
    database: fixture.database,
    sqlite: fixture.sqlite,
    assetsDir: fixture.assetsDir,
    worldId: FIXTURE_WORLD_ID,
    destinationFile: archive,
    appVersion: '0.1.0',
    schemaVersion: fixture.schemaVersion,
    now: () => 1_800_000_000_000,
  });
});

afterEach(async () => {
  fixture.close();
  await fixture.cleanup();
});

function createService(
  options: Partial<Parameters<typeof createImportService>[0]> = {},
): ImportService {
  return createImportService({
    database: fixture.database,
    sqlite: fixture.sqlite,
    importsDir: fixture.importsDir,
    assetsDir: fixture.assetsDir,
    assetsWorldsDir: fixture.assetsWorldsDir,
    assetsTempDir: fixture.assetsTempDir,
    schemaVersion: fixture.schemaVersion,
    now: () => IMPORT_TIME,
    ...options,
  });
}

async function importArchive(service = createService()) {
  return service.importWorld(archive);
}

async function countWorlds(): Promise<number> {
  return fixture.database.select().from(worlds).all().length;
}

async function countEntities(): Promise<number> {
  return fixture.database.select().from(entities).all().length;
}

describe('importación de un mundo', () => {
  it('crea un mundo nuevo con IDs regenerados y referencias remapeadas', async () => {
    const result = await importArchive();

    expect(result.worldName).toBe('Crónica de las Mareas');
    expect(result.slug).toBe('cronica-de-las-mareas-2');
    expect(result.slugAdjusted).toBe(true);
    expect(result.counts).toEqual({
      entities: 2,
      entityTypes: 1,
      relationTypes: 1,
      tags: 2,
      relations: 3,
      versions: 2,
      assets: 5,
    });
    expect(result.warnings).toEqual([]);

    const world = fixture.database
      .select()
      .from(worlds)
      .where(eq(worlds.id, result.worldId))
      .get();

    expect(world?.status).toBe('active');
    expect(world?.deletedAt).toBeNull();
    expect(world?.archivedAt).toBeNull();
    expect(world?.createdAt).toBe(IMPORT_TIME);
    expect(world?.updatedAt).toBe(IMPORT_TIME);
    expect(world?.slug).toBe('cronica-de-las-mareas-2');

    const importedEntities = fixture.database
      .select()
      .from(entities)
      .where(
        and(eq(entities.worldId, result.worldId), isNull(entities.deletedAt)),
      )
      .all();

    expect(importedEntities).toHaveLength(2);
    expect(
      importedEntities.some((entity) => entity.id === FIXTURE_ENTITY_ARIA_ID),
    ).toBe(false);

    const aria = importedEntities.find((entity) => entity.name === 'Aria');
    const order = importedEntities.find(
      (entity) => entity.name === 'Orden del Faro',
    );

    expect(aria).toBeDefined();
    expect(order).toBeDefined();

    const ariaAttributes = JSON.parse(aria?.attributes ?? '{}') as Record<
      string,
      unknown
    >;
    const orderAttributes = JSON.parse(order?.attributes ?? '{}') as Record<
      string,
      unknown
    >;

    expect(ariaAttributes.affiliation).toBe(order?.id);
    expect(orderAttributes.leader).toBe(aria?.id);
    expect(aria?.description).toContain(`wc-entity://${order?.id}`);
    expect(order?.description).toContain(`wc-entity://${aria?.id}`);
    expect(aria?.description).not.toContain(FIXTURE_ENTITY_ORDER_ID);
    expect(aria?.imageAssetId).not.toBeNull();
    expect(aria?.imageAssetId).not.toBe('018f1000-0000-7000-8000-000000000302');

    const ariaTags = fixture.database
      .select({ id: tags.id, name: tags.name })
      .from(entityTags)
      .innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(eq(entityTags.entityId, aria?.id ?? ''))
      .all();

    expect(ariaTags.map((tag) => tag.name)).toEqual(['Mar', 'Norte']);

    const gallery = fixture.database
      .select({
        assetId: entityGallery.assetId,
        position: entityGallery.position,
      })
      .from(entityGallery)
      .where(eq(entityGallery.entityId, aria?.id ?? ''))
      .orderBy(entityGallery.position)
      .all();

    expect(gallery).toHaveLength(2);
    expect(gallery.every((item) => item.assetId !== null)).toBe(true);

    const versions = fixture.database
      .select()
      .from(entityVersions)
      .where(eq(entityVersions.entityId, aria?.id ?? ''))
      .all();

    expect(versions).toHaveLength(2);
    expect(versions.some((version) => version.origin === 'manual')).toBe(true);
    expect(
      versions.some((version) => version.descriptionText === 'Aria, antes.'),
    ).toBe(true);

    const importedRelations = fixture.database
      .select()
      .from(relations)
      .where(eq(relations.worldId, result.worldId))
      .all();

    expect(importedRelations).toHaveLength(3);
    expect(
      importedRelations.every(
        (relation) =>
          relation.sourceId === aria?.id || relation.sourceId === order?.id,
      ),
    ).toBe(true);
    expect(
      importedRelations.every(
        (relation) =>
          relation.targetId === aria?.id || relation.targetId === order?.id,
      ),
    ).toBe(true);

    const customType = fixture.database
      .select()
      .from(entityTypes)
      .where(
        and(
          eq(entityTypes.worldId, result.worldId),
          eq(entityTypes.key, 'faction'),
        ),
      )
      .get();

    expect(customType?.id).not.toBe('018f1000-0000-7000-8000-000000000101');

    const importedTags = fixture.database
      .select()
      .from(tags)
      .where(eq(tags.worldId, result.worldId))
      .all();

    expect(importedTags).toHaveLength(2);

    const importedAssets = fixture.database
      .select()
      .from(assets)
      .where(eq(assets.worldId, result.worldId))
      .all();

    expect(importedAssets).toHaveLength(5);

    for (const asset of importedAssets) {
      const file = join(fixture.assetsDir, ...asset.relativePath.split('/'));
      const thumb = file.replace(/\.webp$/, '.thumb.webp');

      expect((await stat(file)).size).toBe(asset.size);
      expect((await stat(thumb)).size).toBeGreaterThan(0);
      expect(asset.relativePath.startsWith(`worlds/${result.worldId}/`)).toBe(
        true,
      );
      expect(asset.hash).toMatch(/^[0-9a-f]{64}$/);
    }

    expect(world?.coverAssetId).not.toBeNull();
    expect(
      importedAssets.some((asset) => asset.id === world?.coverAssetId),
    ).toBe(true);

    const activity = fixture.database
      .select()
      .from(activityLog)
      .where(
        and(
          eq(activityLog.worldId, result.worldId),
          eq(activityLog.action, 'world.imported'),
        ),
      )
      .get();

    expect(activity).toBeDefined();

    expect(readUserVersion(fixture.sqlite)).toBe(9);
    await expect(readdir(fixture.importsTempDir)).resolves.toEqual([]);
    expect((await readdir(fixture.assetsTempDir)).length).toBe(0);
  });

  it('conserva intacto el mundo existente', async () => {
    const before = fixture.database
      .select()
      .from(entities)
      .where(eq(entities.worldId, FIXTURE_WORLD_ID))
      .all();
    const beforeAssets = fixture.database
      .select()
      .from(assets)
      .where(eq(assets.worldId, FIXTURE_WORLD_ID))
      .all();
    const beforeFiles = new Map<string, Buffer>();

    for (const asset of beforeAssets) {
      beforeFiles.set(
        asset.id,
        await readFile(
          join(fixture.assetsDir, ...asset.relativePath.split('/')),
        ),
      );
    }

    await importArchive();

    const after = fixture.database
      .select()
      .from(entities)
      .where(eq(entities.worldId, FIXTURE_WORLD_ID))
      .all();

    expect(after.map((entity) => entity.id).sort()).toEqual(
      before.map((entity) => entity.id).sort(),
    );

    for (const asset of beforeAssets) {
      const file = await readFile(
        join(fixture.assetsDir, ...asset.relativePath.split('/')),
      );

      expect(file.equals(beforeFiles.get(asset.id) ?? Buffer.alloc(0))).toBe(
        true,
      );
    }

    expect(
      fixture.database
        .select()
        .from(worlds)
        .where(eq(worlds.id, FIXTURE_WORLD_ID))
        .get()?.slug,
    ).toBe('cronica-de-las-mareas');
  });

  it('rechaza un manifiesto con schemaVersion superior al de la app', async () => {
    const future = join(fixture.rootDir, 'schema-futuro.zip');

    await rebuildWithManifestSchemaVersion(future, fixture.schemaVersion + 1);

    const before = await countWorlds();

    await expect(createService().importWorld(future)).rejects.toMatchObject({
      code: 'TRANSFER_FORMAT_UNSUPPORTED',
    });
    expect(await countWorlds()).toBe(before);
    expect(await readdir(fixture.importsTempDir)).toEqual([]);
  });

  it('acepta el schemaVersion actual y uno anterior', async () => {
    for (const schemaVersion of [
      fixture.schemaVersion,
      fixture.schemaVersion - 1,
    ]) {
      const file = join(fixture.rootDir, `schema-${schemaVersion}.zip`);

      await rebuildWithManifestSchemaVersion(file, schemaVersion);

      const result = await createService().importWorld(file);

      expect(result.worldId).toBeDefined();
      expect(result.worldName).toBe('Crónica de las Mareas');
    }
  });

  it('resuelve conflictos de slug con sufijos', async () => {
    const first = await importArchive();
    const second = await importArchive();

    expect(first.slug).toBe('cronica-de-las-mareas-2');
    expect(second.slug).toBe('cronica-de-las-mareas-3');
  });

  it('conserva etiquetas que solo difieren en mayúsculas', async () => {
    const lowerTagId = '018f1000-0000-7000-8000-000000000203';

    fixture.database
      .insert(tags)
      .values({
        id: lowerTagId,
        worldId: FIXTURE_WORLD_ID,
        name: 'mar',
        color: 'moss',
        createdAt: 1_800_000_000_000,
      })
      .run();
    fixture.database
      .insert(entityTags)
      .values({ entityId: FIXTURE_ENTITY_ARIA_ID, tagId: lowerTagId })
      .run();

    await exportWorld({
      database: fixture.database,
      sqlite: fixture.sqlite,
      assetsDir: fixture.assetsDir,
      worldId: FIXTURE_WORLD_ID,
      destinationFile: archive,
      appVersion: '0.1.0',
      schemaVersion: fixture.schemaVersion,
      now: () => 1_800_000_000_000,
    });

    const result = await importArchive();
    const importedTags = fixture.database
      .select()
      .from(tags)
      .where(eq(tags.worldId, result.worldId))
      .all();
    const tagNames = importedTags.map((tag) => tag.name);

    expect(tagNames).toHaveLength(3);
    expect(tagNames).toEqual(expect.arrayContaining(['Mar', 'mar', 'Norte']));

    const importedEntity = fixture.database
      .select()
      .from(entities)
      .where(
        and(eq(entities.worldId, result.worldId), eq(entities.name, 'Aria')),
      )
      .get();

    if (importedEntity === undefined) {
      throw new Error('La prueba esperaba la ficha Aria.');
    }

    const linkedTags = fixture.database
      .select()
      .from(entityTags)
      .where(eq(entityTags.entityId, importedEntity.id))
      .all();
    const linkedNames = linkedTags.flatMap((link) => {
      const tag = importedTags.find((item) => item.id === link.tagId);
      return tag === undefined ? [] : [tag.name];
    });

    expect(linkedNames.sort()).toEqual(['Mar', 'Norte', 'mar'].sort());
  });

  it('cancela durante la lectura y durante la preparación de assets', async () => {
    for (const cancelledPhase of ['reading', 'preparing'] as const) {
      const service = createService();
      const promise = service.importWorld(archive, {
        onEvent: (event) => {
          if (event.phase === cancelledPhase) {
            service.cancel();
          }
        },
      });

      await expect(promise).rejects.toMatchObject({
        code: 'TRANSFER_CANCELLED',
      });
      expect(await countWorlds()).toBe(2);
      expect(await readdir(fixture.importsTempDir)).toEqual([]);
      expect(await readdir(fixture.assetsTempDir)).toEqual([]);
    }
  });

  it('no cancela una importación que ya está guardando', async () => {
    const service: ImportService = createService({
      beforeCommit: () => {
        expect(service.cancel()).toEqual({ cancelled: false });
      },
    });

    const result = await service.importWorld(archive);

    expect(result.slug).toBe('cronica-de-las-mareas-2');
    expect(result.worldId).toBeDefined();
    expect(service.isBusy()).toBe(false);
  });

  it('cancela durante la extracción sin dejar mundo ni archivos', async () => {
    const worldsBefore = await countWorlds();
    const entitiesBefore = await countEntities();
    const service = createService();
    const promise = service.importWorld(archive, {
      onEvent: (event) => {
        if (event.phase === 'extracting' && event.completed === 1) {
          service.cancel();
        }
      },
    });

    await expect(promise).rejects.toMatchObject({
      code: 'TRANSFER_CANCELLED',
    });

    expect(await countWorlds()).toBe(worldsBefore);
    expect(await countEntities()).toBe(entitiesBefore);
    expect(await readdir(fixture.importsTempDir)).toEqual([]);
    expect(await readdir(fixture.assetsTempDir)).toEqual([]);
    const generated = await readdir(fixture.assetsWorldsDir);

    expect(generated.some((name) => name !== FIXTURE_WORLD_ID)).toBe(false);
  });

  it('revierte la transacción si falla antes del commit', async () => {
    const worldsBefore = await countWorlds();
    const entitiesBefore = await countEntities();
    const service = createService({
      beforeCommit: () => {
        throw new Error('fallo inyectado');
      },
    });

    await expect(service.importWorld(archive)).rejects.toMatchObject({
      code: 'TRANSFER_SAVE_FAILED',
    });

    expect(await countWorlds()).toBe(worldsBefore);
    expect(await countEntities()).toBe(entitiesBefore);
    expect(await readdir(fixture.importsTempDir)).toEqual([]);
    expect(await readdir(fixture.assetsTempDir)).toEqual([]);
    expect(
      (await readdir(fixture.assetsWorldsDir)).filter(
        (name) => name !== FIXTURE_WORLD_ID,
      ),
    ).toEqual([]);
  });

  it('rechaza el ZIP si supera los límites inyectados', async () => {
    const service = createService({ limits: { maxEntries: 2 } });

    await expect(service.importWorld(archive)).rejects.toMatchObject({
      code: 'TRANSFER_LIMIT_EXCEEDED',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza un ZIP con traversal sin tocar datos', async () => {
    const malicious = join(fixture.rootDir, 'traversal.zip');

    await writeFile(
      malicious,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'world.json', data: Buffer.from('{}') },
        { name: 'assets/../evil.webp', data: Buffer.from('x') },
      ]),
    );

    const service = createService();

    await expect(service.importWorld(malicious)).rejects.toMatchObject({
      code: 'TRANSFER_ENTRY_REJECTED',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza un enlace simbólico aunque el nombre sea válido', async () => {
    const malicious = join(fixture.rootDir, 'symlink.zip');

    await writeFile(
      malicious,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'world.json', data: Buffer.from('{}') },
        {
          name: 'assets/018f1000-0000-7000-8000-000000000999.webp',
          data: Buffer.from('x'),
          externalAttributes: (0o120777 << 16) >>> 0,
        },
      ]),
    );

    await expect(createService().importWorld(malicious)).rejects.toMatchObject({
      code: 'TRANSFER_ENTRY_REJECTED',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza nombres reservados de Windows', async () => {
    const malicious = join(fixture.rootDir, 'reserved.zip');

    await writeFile(
      malicious,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'world.json', data: Buffer.from('{}') },
        { name: 'assets/CON.webp', data: Buffer.from('x') },
      ]),
    );

    await expect(createService().importWorld(malicious)).rejects.toMatchObject({
      code: 'TRANSFER_ENTRY_REJECTED',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza una entrada cifrada', async () => {
    const malicious = join(fixture.rootDir, 'cifrado.zip');

    await writeFile(
      malicious,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'world.json', data: Buffer.from('{}') },
        {
          name: 'assets/018f1000-0000-7000-8000-000000000999.webp',
          // Cabecera de cifrado tradicional de 12 bytes + un byte de datos.
          data: Buffer.concat([Buffer.alloc(12), Buffer.from('x')]),
          crcData: Buffer.from('x'),
          uncompressedSize: 1,
          flags: 0x0801,
        },
      ]),
    );

    await expect(createService().importWorld(malicious)).rejects.toMatchObject({
      code: 'TRANSFER_ENTRY_REJECTED',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza rutas absolutas y separadores de Windows', async () => {
    for (const [name, path] of [
      ['absoluta.zip', '/etc/passwd'],
      ['unc.zip', '\\\\servidor\\recurso\\x.webp'],
    ] as const) {
      const malicious = join(fixture.rootDir, name);

      await writeFile(
        malicious,
        buildRawZip([
          { name: 'manifest.json', data: Buffer.from('{}') },
          { name: 'world.json', data: Buffer.from('{}') },
          { name: path, data: Buffer.from('x') },
        ]),
      );

      await expect(
        createService().importWorld(malicious),
      ).rejects.toMatchObject({ code: 'TRANSFER_ENTRY_REJECTED' });
    }

    expect(await countWorlds()).toBe(2);
  });

  it('rechaza entradas duplicadas', async () => {
    const malicious = join(fixture.rootDir, 'duplicado.zip');

    await writeFile(
      malicious,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'world.json', data: Buffer.from('{}') },
      ]),
    );

    await expect(createService().importWorld(malicious)).rejects.toMatchObject({
      code: 'TRANSFER_ENTRY_REJECTED',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza un ZIP truncado o que no es un ZIP', async () => {
    const broken = join(fixture.rootDir, 'roto.zip');

    await writeFile(broken, 'no es un zip', 'utf8');

    await expect(createService().importWorld(broken)).rejects.toBeInstanceOf(
      TransferError,
    );
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza un asset que no es WebP aunque el nombre lo sea', async () => {
    const pngZip = join(fixture.rootDir, 'png.zip');

    await rebuildWithAssetReplacement(
      pngZip,
      async () => {
        const { default: sharp } = await import('sharp');

        return sharp({
          create: {
            width: 4,
            height: 4,
            channels: 3,
            background: { r: 1, g: 2, b: 3 },
          },
        })
          .png()
          .toBuffer();
      },
      false,
    );

    await expect(createService().importWorld(pngZip)).rejects.toMatchObject({
      code: 'TRANSFER_ASSET_INVALID',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza un checksum incorrecto', async () => {
    const corrupt = join(fixture.rootDir, 'checksum.zip');

    await rebuildWithAssetReplacement(
      corrupt,
      async () => {
        const original = await readArchiveEntry(
          archive,
          'assets/018f1000-0000-7000-8000-000000000303.webp',
          25 * 1024 * 1024,
        );
        const replacement = Buffer.from(original);
        const last = replacement.length - 1;

        if (last >= 0) {
          replacement[last] = (replacement[last] ?? 0) ^ 0xff;
        }

        return replacement;
      },
      true,
    );

    await expect(createService().importWorld(corrupt)).rejects.toMatchObject({
      code: 'TRANSFER_CHECKSUM_MISMATCH',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza un world.json alterado con el mismo tamaño', async () => {
    const corrupt = join(fixture.rootDir, 'world-checksum.zip');

    await rebuildWithWorldReplacement(
      corrupt,
      (worldBuffer) => {
        const original = worldBuffer.toString('utf8');
        const altered = original.replace(
          'Crónica de las Mareas',
          'Xrónica de las Mareas',
        );

        expect(altered).not.toBe(original);
        expect(Buffer.byteLength(altered, 'utf8')).toBe(worldBuffer.byteLength);

        return Buffer.from(altered, 'utf8');
      },
      true,
    );

    await expect(createService().importWorld(corrupt)).rejects.toMatchObject({
      code: 'TRANSFER_CHECKSUM_MISMATCH',
    });
    expect(await countWorlds()).toBe(2);
  });

  it('rechaza rutas preparadas fuera de los temporales sin leer ni borrar fuera', async () => {
    const outside = join(fixture.rootDir, 'fuera');
    const externalStaging = join(outside, 'staging');
    const externalAssets = join(outside, 'assets-temp', 'world');
    const externalPlan = join(externalStaging, 'plan.json');
    const sentinel = join(externalAssets, 'sentinel.txt');

    await mkdir(externalStaging, { recursive: true });
    await mkdir(externalAssets, { recursive: true });
    await writeFile(externalPlan, '{"plan":"externo"}', 'utf8');
    await writeFile(sentinel, 'dato externo', 'utf8');

    const before = await countWorlds();
    const prepare = async (): Promise<PreparedImport> => ({
      planFile: externalPlan,
      stagingDir: externalStaging,
      assetTempDir: externalAssets,
      worldId: '018f1000-0000-7000-8000-000000000999',
      worldName: 'Mundo externo',
      slug: 'mundo-externo',
      slugAdjusted: false,
      counts: {
        entities: 0,
        entityTypes: 0,
        relationTypes: 0,
        tags: 0,
        relations: 0,
        versions: 0,
        assets: 0,
      },
      warnings: [],
      totalAssetBytes: 0,
    });

    await expect(
      createService({ prepare }).importWorld(archive),
    ).rejects.toMatchObject({ code: 'TRANSFER_INTERNAL' });

    expect(await readFile(externalPlan, 'utf8')).toBe('{"plan":"externo"}');
    expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
    expect(await countWorlds()).toBe(before);
  });

  it('rechaza la importación sin espacio antes de extraer', async () => {
    const before = await countWorlds();

    await expect(
      createService({ readFreeSpace: async () => 0 }).importWorld(archive),
    ).rejects.toMatchObject({ code: 'TRANSFER_NO_SPACE' });

    expect(await countWorlds()).toBe(before);
    await expect(readdir(fixture.importsTempDir)).resolves.toEqual([]);
  });

  it.runIf(process.platform === 'win32')(
    'rechaza una junction en imports/.tmp sin tocar su destino',
    async () => {
      const outside = join(fixture.rootDir, 'junction-imports');
      const sentinel = join(outside, 'sentinel.txt');

      await mkdir(outside, { recursive: true });
      await writeFile(sentinel, 'dato externo', 'utf8');
      await rm(fixture.importsTempDir, { recursive: true, force: true });

      try {
        await symlink(outside, fixture.importsTempDir, 'junction');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          return;
        }

        throw error;
      }

      const before = await countWorlds();

      await expect(createService().importWorld(archive)).rejects.toMatchObject({
        code: 'TRANSFER_INPUT_INVALID',
      });

      expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
      expect(await countWorlds()).toBe(before);
    },
  );

  it.runIf(process.platform === 'win32')(
    'rechaza una junction en assets/.tmp sin escribir fuera',
    async () => {
      const outside = join(fixture.rootDir, 'junction-assets');
      const sentinel = join(outside, 'sentinel.txt');

      await mkdir(outside, { recursive: true });
      await writeFile(sentinel, 'dato externo', 'utf8');
      await rm(fixture.assetsTempDir, { recursive: true, force: true });

      try {
        await symlink(outside, fixture.assetsTempDir, 'junction');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          return;
        }

        throw error;
      }

      const before = await countWorlds();

      await expect(createService().importWorld(archive)).rejects.toMatchObject({
        code: 'TRANSFER_DESTINATION_UNAVAILABLE',
      });

      expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
      expect(await countWorlds()).toBe(before);
    },
  );

  it.runIf(process.platform === 'win32')(
    'rechaza una junction en assets/worlds sin publicar fuera',
    async () => {
      const outside = join(fixture.rootDir, 'junction-worlds');
      const sentinel = join(outside, 'sentinel.txt');
      const realWorlds = join(fixture.assetsDir, 'worlds-real');

      await mkdir(outside, { recursive: true });
      await writeFile(sentinel, 'dato externo', 'utf8');
      await rename(fixture.assetsWorldsDir, realWorlds);
      await symlink(outside, fixture.assetsWorldsDir, 'junction');

      const before = await countWorlds();

      await expect(createService().importWorld(archive)).rejects.toMatchObject({
        code: 'TRANSFER_DESTINATION_UNAVAILABLE',
      });

      expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
      expect(await countWorlds()).toBe(before);
    },
  );

  it.runIf(process.platform === 'win32')(
    'rechaza una junction en assets/.tmp/<operationId> antes de leer el plan',
    async () => {
      const operationId = '018f1000-0000-7000-8000-000000000905';
      const outside = join(fixture.rootDir, 'junction-asset-operation');
      const sentinel = join(outside, 'sentinel.txt');
      const stagingDir = join(fixture.importsTempDir, operationId);
      const planFile = join(stagingDir, 'plan.json');

      await mkdir(join(stagingDir, 'assets'), { recursive: true });
      await writeFile(planFile, '{"plan":"no leído"}', 'utf8');
      await mkdir(outside, { recursive: true });
      await writeFile(sentinel, 'dato externo', 'utf8');
      await symlink(
        outside,
        join(fixture.assetsTempDir, operationId),
        'junction',
      );

      const prepare = async (): Promise<PreparedImport> => ({
        planFile,
        stagingDir,
        assetTempDir: join(
          fixture.assetsTempDir,
          operationId,
          '018f1000-0000-7000-8000-000000000999',
        ),
        worldId: '018f1000-0000-7000-8000-000000000999',
        worldName: 'Mundo externo',
        slug: 'mundo-externo',
        slugAdjusted: false,
        counts: {
          entities: 0,
          entityTypes: 0,
          relationTypes: 0,
          tags: 0,
          relations: 0,
          versions: 0,
          assets: 0,
        },
        warnings: [],
        totalAssetBytes: 0,
      });

      const before = await countWorlds();

      await expect(
        createService({
          prepare,
          generateOperationId: () => operationId,
        }).importWorld(archive),
      ).rejects.toMatchObject({ code: 'TRANSFER_INTERNAL' });

      // El staging conocido por el principal sí se limpia; el destino externo
      // de la junction permanece intacto.
      await expect(stat(planFile)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
      expect(await countWorlds()).toBe(before);
    },
  );

  it.runIf(process.platform === 'win32')(
    'rechaza una junction en imports/.tmp/<operationId> antes de leer el plan',
    async () => {
      const operationId = '018f1000-0000-7000-8000-000000000906';
      const outside = join(fixture.rootDir, 'junction-import-operation');
      const sentinel = join(outside, 'sentinel.txt');
      const stagingDir = join(fixture.importsTempDir, operationId);

      await mkdir(outside, { recursive: true });
      await writeFile(sentinel, 'dato externo', 'utf8');
      await symlink(outside, stagingDir, 'junction');

      const prepare = async (): Promise<PreparedImport> => ({
        planFile: join(stagingDir, 'plan.json'),
        stagingDir,
        assetTempDir: join(
          fixture.assetsTempDir,
          operationId,
          '018f1000-0000-7000-8000-000000000999',
        ),
        worldId: '018f1000-0000-7000-8000-000000000999',
        worldName: 'Mundo externo',
        slug: 'mundo-externo',
        slugAdjusted: false,
        counts: {
          entities: 0,
          entityTypes: 0,
          relationTypes: 0,
          tags: 0,
          relations: 0,
          versions: 0,
          assets: 0,
        },
        warnings: [],
        totalAssetBytes: 0,
      });

      const before = await countWorlds();

      await expect(
        createService({
          prepare,
          generateOperationId: () => operationId,
        }).importWorld(archive),
      ).rejects.toMatchObject({ code: 'TRANSFER_INTERNAL' });

      expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
      expect(await countWorlds()).toBe(before);
    },
  );

  it('el servicio de modo seguro rechaza cualquier importación', async () => {
    const service = createUnavailableImportService();

    expect(service.isBusy()).toBe(false);
    expect(service.cancel()).toEqual({ cancelled: false });
    await expect(service.importWorld(archive)).rejects.toBeInstanceOf(
      TransferError,
    );
  });

  it('no deja un mundo parcial si el plan declara un slug ya ocupado', async () => {
    // El plan resuelve el slug contra la base antes de insertar; dos
    // importaciones seguidas demuestran que no se reutiliza.
    const first = await importArchive();
    const second = await importArchive();

    expect(first.slug).not.toBe(second.slug);
    expect(
      fixture.database
        .select()
        .from(worlds)
        .all()
        .filter(
          (world) => world.id === first.worldId || world.id === second.worldId,
        ),
    ).toHaveLength(2);
  });
});

/**
 * Reconstruye el ZIP exportado cambiando un asset. Con `keepManifest` se deja
 * el manifiesto original para aislar la comprobación de checksum; sin él se
 * actualizan tamaño y SHA-256 para probar la validación de contenido.
 */
async function rebuildWithAssetReplacement(
  file: string,
  replace: () => Promise<Buffer>,
  keepManifest: boolean,
): Promise<void> {
  const index = await readArchiveIndex(archive);
  const manifestBuffer = await readArchiveEntry(
    archive,
    'manifest.json',
    16 * 1024 ** 2,
  );
  const manifest = parseManifestJson(manifestBuffer.toString('utf8'));
  const worldBuffer = await readArchiveEntry(
    archive,
    'world.json',
    256 * 1024 ** 2,
  );
  parseWorldTransferJson(worldBuffer.toString('utf8'));
  const assetEntry = index.entries.find(
    (entry) =>
      entry.parsed.kind === 'asset' &&
      entry.path === 'assets/018f1000-0000-7000-8000-000000000303.webp',
  );

  if (assetEntry === undefined) {
    throw new Error('La prueba esperaba el asset de galería.');
  }

  const replacement = await replace();
  const files = keepManifest
    ? manifest.files
    : manifest.files.map((entry) =>
        entry.path === assetEntry.path
          ? {
              path: entry.path,
              size: replacement.byteLength,
              sha256: createHash('sha256').update(replacement).digest('hex'),
            }
          : entry,
      );
  const updatedManifest = { ...manifest, files };
  const zip = new yazl.ZipFile();

  zip.addBuffer(
    Buffer.from(`${JSON.stringify(updatedManifest, null, 2)}\n`),
    'manifest.json',
    {
      mtime: new Date('1980-01-01T00:00:00.000Z'),
      mode: 0o644,
      compress: true,
    },
  );
  zip.addBuffer(worldBuffer, 'world.json', {
    mtime: new Date('1980-01-01T00:00:00.000Z'),
    mode: 0o644,
    compress: true,
  });

  for (const entry of index.entries) {
    if (entry.parsed.kind !== 'asset') {
      continue;
    }

    const data =
      entry.path === assetEntry.path
        ? replacement
        : await readArchiveEntry(archive, entry.path, 25 * 1024 * 1024);

    zip.addBuffer(data, entry.path, {
      mtime: new Date('1980-01-01T00:00:00.000Z'),
      mode: 0o644,
      compress: false,
    });
  }

  zip.end();
  await pipeline(zip.outputStream, createWriteStream(file));
}

/**
 * Reconstruye el ZIP exportado cambiando `world.json`, manteniendo el CRC
 * válido del ZIP. Con `keepManifest` se conserva el checksum original para
 * aislar la comprobación del manifiesto.
 */
async function rebuildWithWorldReplacement(
  file: string,
  replace: (world: Buffer) => Buffer,
  keepManifest: boolean,
): Promise<void> {
  const index = await readArchiveIndex(archive);
  const manifestBuffer = await readArchiveEntry(
    archive,
    'manifest.json',
    16 * 1024 ** 2,
  );
  const manifest = parseManifestJson(manifestBuffer.toString('utf8'));
  const worldBuffer = await readArchiveEntry(
    archive,
    'world.json',
    256 * 1024 ** 2,
  );
  const replacement = replace(Buffer.from(worldBuffer));
  const files = keepManifest
    ? manifest.files
    : manifest.files.map((entry) =>
        entry.path === 'world.json'
          ? {
              path: entry.path,
              size: replacement.byteLength,
              sha256: createHash('sha256').update(replacement).digest('hex'),
            }
          : entry,
      );
  const updatedManifest = { ...manifest, files };
  const zip = new yazl.ZipFile();

  zip.addBuffer(
    Buffer.from(`${JSON.stringify(updatedManifest, null, 2)}\n`),
    'manifest.json',
    {
      mtime: new Date('1980-01-01T00:00:00.000Z'),
      mode: 0o644,
      compress: true,
    },
  );
  zip.addBuffer(replacement, 'world.json', {
    mtime: new Date('1980-01-01T00:00:00.000Z'),
    mode: 0o644,
    compress: true,
  });

  for (const entry of index.entries) {
    if (entry.parsed.kind !== 'asset') {
      continue;
    }

    zip.addBuffer(
      await readArchiveEntry(archive, entry.path, 25 * 1024 * 1024),
      entry.path,
      {
        mtime: new Date('1980-01-01T00:00:00.000Z'),
        mode: 0o644,
        compress: false,
      },
    );
  }

  zip.end();
  await pipeline(zip.outputStream, createWriteStream(file));
}

/** Reconstruye el ZIP exportado cambiando solo `manifest.schemaVersion`. */
async function rebuildWithManifestSchemaVersion(
  file: string,
  schemaVersion: number,
): Promise<void> {
  const index = await readArchiveIndex(archive);
  const manifest = parseManifestJson(
    (await readArchiveEntry(archive, 'manifest.json', 16 * 1024 ** 2)).toString(
      'utf8',
    ),
  );
  const worldBuffer = await readArchiveEntry(
    archive,
    'world.json',
    256 * 1024 ** 2,
  );
  const zip = new yazl.ZipFile();

  zip.addBuffer(
    Buffer.from(`${JSON.stringify({ ...manifest, schemaVersion }, null, 2)}\n`),
    'manifest.json',
    {
      mtime: new Date('1980-01-01T00:00:00.000Z'),
      mode: 0o644,
      compress: true,
    },
  );
  zip.addBuffer(worldBuffer, 'world.json', {
    mtime: new Date('1980-01-01T00:00:00.000Z'),
    mode: 0o644,
    compress: true,
  });

  for (const entry of index.entries) {
    if (entry.parsed.kind !== 'asset') {
      continue;
    }

    zip.addBuffer(
      await readArchiveEntry(archive, entry.path, 25 * 1024 * 1024),
      entry.path,
      {
        mtime: new Date('1980-01-01T00:00:00.000Z'),
        mode: 0o644,
        compress: false,
      },
    );
  }

  zip.end();
  await pipeline(zip.outputStream, createWriteStream(file));
}
