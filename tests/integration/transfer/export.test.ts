import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readArchiveEntry,
  readArchiveIndex,
} from '@/main/transfer/archive/reader';
import { TransferError } from '@/main/transfer/errors';
import { parseManifestJson } from '@/main/transfer/format/manifest';
import {
  parseWorldTransferJson,
  type WorldTransfer,
} from '@/main/transfer/format/world';
import { exportWorld } from '@/main/transfer/export/service';
import {
  TRANSFER_SPACE_MARGIN_BYTES,
  type FreeSpaceProbe,
} from '@/main/transfer/fs';
import {
  closeDatabase,
  openDatabase,
  readUserVersion,
} from '@/main/db/connection';
import { createDatabaseClient } from '@/main/db/client';
import { entities } from '@/main/db/schema/entities';
import {
  createTransferFixture,
  FIXTURE_ASSET_GALLERY_ONE_ID,
  FIXTURE_ENTITY_ARIA_ID,
  FIXTURE_ENTITY_DELETED_ID,
  FIXTURE_TRASHED_WORLD_ID,
  FIXTURE_WORLD_ID,
  type TransferFixture,
} from '../helpers/transfer-fixture';

let fixture: TransferFixture;
let destination: string;

beforeEach(async () => {
  fixture = await createTransferFixture();
  destination = join(fixture.rootDir, 'cronica.zip');
});

afterEach(async () => {
  fixture.close();
  await fixture.cleanup();
});

function exportOptions(
  overrides: {
    readonly file?: string;
    readonly signal?: AbortSignal;
    readonly readFreeSpace?: FreeSpaceProbe;
  } = {},
) {
  return {
    database: fixture.database,
    sqlite: fixture.sqlite,
    assetsDir: fixture.assetsDir,
    worldId: FIXTURE_WORLD_ID,
    destinationFile: overrides.file ?? destination,
    appVersion: '0.1.0',
    schemaVersion: fixture.schemaVersion,
    now: () => 1_800_000_000_000,
    ...(overrides.signal === undefined ? {} : { signal: overrides.signal }),
    ...(overrides.readFreeSpace === undefined
      ? {}
      : { readFreeSpace: overrides.readFreeSpace }),
  };
}

async function readWorldFromZip(file: string): Promise<WorldTransfer> {
  const buffer = await readArchiveEntry(file, 'world.json', 256 * 1024 ** 2);

  return parseWorldTransferJson(buffer.toString('utf8'));
}

describe('exportación de un mundo', () => {
  it('rechaza la exportación sin espacio antes de escribir', async () => {
    await expect(
      exportWorld({
        ...exportOptions(),
        readFreeSpace: async () => 0,
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_NO_SPACE' });

    await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('suma el destino existente al espacio requerido', async () => {
    const baseline = join(fixture.rootDir, 'base.zip');
    let baseRequired = 0;

    await exportWorld({
      ...exportOptions({ file: baseline }),
      readFreeSpace: async (_directory, requiredBytes) => {
        baseRequired = requiredBytes;
        return Number.MAX_SAFE_INTEGER;
      },
    });

    const existingSize = 1024;

    await writeFile(destination, Buffer.alloc(existingSize, 1));

    let requiredWithExisting = 0;

    await expect(
      exportWorld({
        ...exportOptions(),
        readFreeSpace: async (_directory, requiredBytes) => {
          requiredWithExisting = requiredBytes;
          return baseRequired + TRANSFER_SPACE_MARGIN_BYTES + existingSize - 1;
        },
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_NO_SPACE' });

    expect(requiredWithExisting - baseRequired).toBe(existingSize);
  });

  it('exporta y verifica un world.json muy comprimible', async () => {
    const text = 'A'.repeat(50_000);
    const description = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    });
    const aria = fixture.database
      .select()
      .from(entities)
      .where(eq(entities.id, FIXTURE_ENTITY_ARIA_ID))
      .get();

    if (aria === undefined) {
      throw new Error('La prueba esperaba la ficha Aria.');
    }

    fixture.database
      .update(entities)
      .set({ description, descriptionText: text })
      .where(eq(entities.worldId, FIXTURE_WORLD_ID))
      .run();
    fixture.database
      .insert(entities)
      .values(
        Array.from({ length: 6 }, (_, index) => ({
          id: `018f1000-0000-7000-8000-00000000060${index}`,
          worldId: FIXTURE_WORLD_ID,
          typeId: aria.typeId,
          name: `Relleno ${index}`,
          slug: `relleno-${index}`,
          aliases: '[]',
          summary: null,
          description,
          descriptionText: text,
          imageAssetId: null,
          attributes: '{}',
          status: 'active',
          isFavorite: 0,
          createdAt: 1_800_000_000_000 + index,
          updatedAt: 1_800_000_000_000 + index,
          deletedAt: null,
        })),
      )
      .run();

    await exportWorld(exportOptions());

    const index = await readArchiveIndex(destination, {
      maxCompressionRatio: Number.POSITIVE_INFINITY,
    });
    const worldEntry = index.entries.find(
      (entry) => entry.parsed.kind === 'world',
    );

    expect(worldEntry).toBeDefined();
    expect(worldEntry?.compressedSize).toBeGreaterThan(0);
    expect(
      (worldEntry?.uncompressedSize ?? 0) / (worldEntry?.compressedSize ?? 1),
    ).toBeGreaterThan(100);
  });

  it('exporta solo contenido vivo con assets y un mundo coherente', async () => {
    const result = await exportWorld(exportOptions());

    expect(result.worldId).toBe(FIXTURE_WORLD_ID);
    expect(result.worldName).toBe('Crónica de las Mareas');
    expect(result.fileName).toBe('cronica.zip');
    expect(result.size).toBeGreaterThan(0);
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

    const index = await readArchiveIndex(destination);

    expect(index.entries).toHaveLength(7);
    expect(
      index.entries.filter((entry) => entry.parsed.kind === 'asset'),
    ).toHaveLength(5);

    const manifest = parseManifestJson(
      (
        await readArchiveEntry(destination, 'manifest.json', 16 * 1024 ** 2)
      ).toString('utf8'),
    );

    expect(manifest.format).toBe('world-craft-world');
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.assetsIncluded).toBe(true);
    expect(manifest.world.name).toBe('Crónica de las Mareas');
    expect(manifest.files).toHaveLength(6);
    expect(manifest.counts).toEqual(result.counts);

    const world = await readWorldFromZip(destination);

    expect(world.entities.map((entity) => entity.name)).toEqual([
      'Aria',
      'Orden del Faro',
    ]);
    expect(world.entities.some((entity) => entity.name === 'Eco')).toBe(false);
    expect(world.coverAssetId).not.toBeNull();
    expect(world.tags.map((tag) => tag.name)).toEqual(['Mar', 'Norte']);
    expect(world.relations).toHaveLength(3);
    expect(world.entityTypes.types).toHaveLength(1);
    expect(world.relationTypes.types).toHaveLength(1);

    const aria = world.entities.find((entity) => entity.name === 'Aria');

    expect(aria?.versions).toHaveLength(2);
    expect(aria?.gallery).toHaveLength(2);
    expect(aria?.tagNames).toEqual(['Mar', 'Norte']);
    expect(aria?.attributes).toMatchObject({ age: 34, status: 'alive' });

    const order = world.entities.find(
      (entity) => entity.name === 'Orden del Faro',
    );
    expect(order?.attributes.leader).toBeDefined();
    expect(order?.description).not.toBeNull();

    // La actividad no viaja dentro de ningún bloque.
    expect(JSON.stringify(world)).not.toContain('activity_log');
    expect(JSON.stringify(world)).not.toContain('"world.updated"');

    expect(readUserVersion(fixture.sqlite)).toBe(10);
  });

  it('sanea enlaces y referencias rotas con avisos', async () => {
    fixture.database
      .update(entities)
      .set({
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Eco',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: `wc-entity://${FIXTURE_ENTITY_DELETED_ID}`,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        attributes: JSON.stringify({
          age: 34,
          affiliation: FIXTURE_ENTITY_DELETED_ID,
        }),
      })
      .where(eq(entities.id, FIXTURE_ENTITY_ARIA_ID))
      .run();

    const result = await exportWorld(exportOptions());

    expect(result.warnings).toEqual([
      { code: 'broken-entity-link', count: 1 },
      { code: 'broken-reference-attribute', count: 1 },
    ]);

    const world = await readWorldFromZip(destination);
    const aria = world.entities.find((entity) => entity.name === 'Aria');

    expect(aria?.description).not.toContain(FIXTURE_ENTITY_DELETED_ID);
    expect(aria?.attributes.affiliation).toBeUndefined();
  });

  it('exporta desde una conexión de solo lectura como el worker', async () => {
    const sqlite = openDatabase({
      file: fixture.databaseFile,
      readonly: true,
    });
    const database = createDatabaseClient(sqlite);

    try {
      const result = await exportWorld({
        ...exportOptions(),
        database: database.orm,
        sqlite: database.sqlite,
      });

      expect(result.counts.entities).toBe(2);
      expect((await stat(destination)).size).toBeGreaterThan(0);
    } finally {
      closeDatabase(sqlite);
    }
  });

  it('produce un paquete determinista con el mismo reloj', async () => {
    const second = join(fixture.rootDir, 'cronica-2.zip');

    await exportWorld(exportOptions());
    await exportWorld(exportOptions({ file: second }));

    const firstManifest = await readArchiveEntry(
      destination,
      'manifest.json',
      16 * 1024 ** 2,
    );
    const secondManifest = await readArchiveEntry(
      second,
      'manifest.json',
      16 * 1024 ** 2,
    );
    const firstWorld = await readArchiveEntry(
      destination,
      'world.json',
      256 * 1024 ** 2,
    );
    const secondWorld = await readArchiveEntry(
      second,
      'world.json',
      256 * 1024 ** 2,
    );

    expect(firstManifest.equals(secondManifest)).toBe(true);
    expect(firstWorld.equals(secondWorld)).toBe(true);
  });

  it('aborta y limpia el .partial si falta un asset', async () => {
    await rm(
      join(
        fixture.assetsDir,
        'worlds',
        FIXTURE_WORLD_ID,
        `${FIXTURE_ASSET_GALLERY_ONE_ID}.webp`,
      ),
    );
    await writeFile(destination, 'anterior', 'utf8');

    await expect(exportWorld(exportOptions())).rejects.toMatchObject({
      code: 'TRANSFER_ASSET_INVALID',
    });

    expect((await stat(destination)).size).toBe('anterior'.length);
    expect(
      (await readdir(fixture.rootDir)).filter((file) =>
        file.endsWith('.partial'),
      ),
    ).toEqual([]);
  });

  it('aborta si el hash del asset no coincide con la base', async () => {
    const file = join(
      fixture.assetsDir,
      'worlds',
      FIXTURE_WORLD_ID,
      `${FIXTURE_ASSET_GALLERY_ONE_ID}.webp`,
    );
    const original = await readFile(file);

    await writeFile(file, Buffer.concat([original, Buffer.from([1, 2, 3])]));

    await expect(exportWorld(exportOptions())).rejects.toMatchObject({
      code: 'TRANSFER_ASSET_INVALID',
    });
    await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rechaza un mundo en papelera', async () => {
    await expect(
      exportWorld({ ...exportOptions(), worldId: FIXTURE_TRASHED_WORLD_ID }),
    ).rejects.toMatchObject({ code: 'TRANSFER_SOURCE_NOT_FOUND' });
  });

  it('respeta una cancelación previa sin dejar archivos', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      exportWorld(exportOptions({ signal: controller.signal })),
    ).rejects.toMatchObject({ code: 'TRANSFER_CANCELLED' });
    await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      (await readdir(fixture.rootDir)).filter((file) =>
        file.endsWith('.partial'),
      ),
    ).toEqual([]);
  });

  it('normaliza el error de un destino inexistente', async () => {
    await expect(
      exportWorld(
        exportOptions({ file: join(fixture.rootDir, 'no-existe', 'x.zip') }),
      ),
    ).rejects.toBeInstanceOf(TransferError);
  });
});
