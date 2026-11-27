/**
 * Fixture de integración para exportación e importación.
 *
 * Crea una base migrada real y un mundo con dos tipos de entidad (uno del
 * sistema y uno personalizado), dos tipos de relación (uno del sistema y uno
 * personalizado), etiquetas, fichas vivas con imagen, galería, versión y
 * enlaces internos, relaciones y assets WebP reales generados con sharp.
 *
 * También siembra contenido que **no** debe exportarse: una ficha en papelera,
 * un mundo en papelera, actividad, un asset huérfano y una relación con un
 * extremo en papelera.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { eq } from 'drizzle-orm';
import sharp from 'sharp';

import { sha256 } from '@/main/assets/image';
import { initializeDatabase } from '@/main/db/startup';
import {
  closeDatabase,
  readUserVersion,
  type SqliteDatabase,
} from '@/main/db/connection';
import type { WorldCraftDatabase } from '@/main/db/client';
import { assets } from '@/main/db/schema/assets';
import {
  entities,
  entityGallery,
  entityTags,
  tags,
} from '@/main/db/schema/entities';
import { entityTypes } from '@/main/db/schema/entity-types';
import { relationTypes, relations } from '@/main/db/schema/relations';
import { entityVersions } from '@/main/db/schema/versions';
import { activityLog, worlds } from '@/main/db/schema/worlds';
import { plainTextToRichTextDocument } from '@/shared/entities/description';
import { REPOSITORY_MIGRATIONS_DIR, cleanup } from './temp-db';

export const FIXTURE_WORLD_ID = '018f1000-0000-7000-8000-000000000001';
export const FIXTURE_TRASHED_WORLD_ID = '018f1000-0000-7000-8000-000000000002';
export const FIXTURE_CUSTOM_TYPE_ID = '018f1000-0000-7000-8000-000000000101';
export const FIXTURE_CUSTOM_RELATION_TYPE_ID =
  '018f1000-0000-7000-8000-000000000102';
export const FIXTURE_TAG_SEA_ID = '018f1000-0000-7000-8000-000000000201';
export const FIXTURE_TAG_NORTH_ID = '018f1000-0000-7000-8000-000000000202';
export const FIXTURE_ASSET_COVER_ID = '018f1000-0000-7000-8000-000000000301';
export const FIXTURE_ASSET_ARIA_ID = '018f1000-0000-7000-8000-000000000302';
export const FIXTURE_ASSET_GALLERY_ONE_ID =
  '018f1000-0000-7000-8000-000000000303';
export const FIXTURE_ASSET_GALLERY_TWO_ID =
  '018f1000-0000-7000-8000-000000000304';
export const FIXTURE_ASSET_ORDER_ID = '018f1000-0000-7000-8000-000000000305';
export const FIXTURE_ASSET_ORPHAN_ID = '018f1000-0000-7000-8000-000000000306';
export const FIXTURE_ENTITY_ARIA_ID = '018f1000-0000-7000-8000-000000000401';
export const FIXTURE_ENTITY_ORDER_ID = '018f1000-0000-7000-8000-000000000402';
export const FIXTURE_ENTITY_DELETED_ID = '018f1000-0000-7000-8000-000000000403';
export const FIXTURE_TRASHED_ENTITY_ID = '018f1000-0000-7000-8000-000000000404';

const FIXED_TIME = 1_700_000_000_000;

/** Fixture listo para exportar o importar. */
export interface TransferFixture {
  readonly rootDir: string;
  readonly userDataDir: string;
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly databaseFile: string;
  readonly assetsDir: string;
  readonly assetsWorldsDir: string;
  readonly assetsTempDir: string;
  readonly importsDir: string;
  readonly importsTempDir: string;
  readonly exportsDir: string;
  readonly exportsTempDir: string;
  readonly schemaVersion: number;
  close(): void;
  cleanup(): Promise<void>;
}

/** Crea la base, las carpetas y siembra el mundo de prueba. */
export async function createTransferFixture(): Promise<TransferFixture> {
  const rootDir = await mkdtemp(join(tmpdir(), 'world-craft-transfer-'));
  const userDataDir = join(rootDir, 'user-data');

  const result = await initializeDatabase({
    userDataDir,
    migrationsDir: REPOSITORY_MIGRATIONS_DIR,
  });

  if (result.status !== 'ready') {
    throw new Error(`La base de la prueba no arrancó: ${result.code}`);
  }

  const database = result.client.orm;
  const sqlite = result.client.sqlite;
  const paths = result.paths;

  await seedFixture(database, paths.assetsDir);

  return {
    rootDir,
    userDataDir,
    database,
    sqlite,
    databaseFile: paths.databaseFile,
    assetsDir: paths.assetsDir,
    assetsWorldsDir: paths.assetsWorldsDir,
    assetsTempDir: paths.assetsTempDir,
    importsDir: paths.importsDir,
    importsTempDir: paths.importsTempDir,
    exportsDir: paths.exportsDir,
    exportsTempDir: paths.exportsTempDir,
    schemaVersion: readUserVersion(sqlite),
    close: () => closeDatabase(sqlite),
    cleanup: () => cleanup(rootDir),
  };
}

async function seedFixture(
  database: WorldCraftDatabase,
  assetsDir: string,
): Promise<void> {
  const systemCharacter = database
    .select({ id: entityTypes.id })
    .from(entityTypes)
    .where(eq(entityTypes.key, 'character'))
    .get();
  const systemOrganization = database
    .select({ id: entityTypes.id })
    .from(entityTypes)
    .where(eq(entityTypes.key, 'organization'))
    .get();
  const systemRelation = database
    .select({ id: relationTypes.id })
    .from(relationTypes)
    .where(eq(relationTypes.key, 'member-of'))
    .get();
  const systemRelationLeads = database
    .select({ id: relationTypes.id })
    .from(relationTypes)
    .where(eq(relationTypes.key, 'leads'))
    .get();

  if (
    systemCharacter === undefined ||
    systemOrganization === undefined ||
    systemRelation === undefined ||
    systemRelationLeads === undefined
  ) {
    throw new Error('Los catálogos del sistema no están sembrados.');
  }

  database
    .insert(worlds)
    .values([
      {
        id: FIXTURE_WORLD_ID,
        name: 'Crónica de las Mareas',
        slug: 'cronica-de-las-mareas',
        summary: 'Un archipiélago que cambia con la marea.',
        description: JSON.stringify(
          plainTextToRichTextDocument('Mundo de prueba para la exportación.'),
        ),
        descriptionText: 'Mundo de prueba para la exportación.',
        coverAssetId: null,
        genres: JSON.stringify(['fantasía', 'aventura']),
        status: 'active',
        language: 'es',
        settings: JSON.stringify({ ignored: true }),
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME + 10,
        archivedAt: null,
        deletedAt: null,
      },
      {
        id: FIXTURE_TRASHED_WORLD_ID,
        name: 'Mundo descartado',
        slug: 'mundo-descartado',
        summary: null,
        description: null,
        coverAssetId: null,
        genres: JSON.stringify([]),
        status: 'active',
        language: 'es',
        settings: '{}',
        createdAt: FIXED_TIME - 10,
        updatedAt: FIXED_TIME - 10,
        archivedAt: null,
        deletedAt: FIXED_TIME - 5,
      },
    ])
    .run();

  database
    .insert(entityTypes)
    .values({
      id: FIXTURE_CUSTOM_TYPE_ID,
      worldId: FIXTURE_WORLD_ID,
      key: 'faction',
      name: 'Facción',
      icon: 'users',
      color: 'prussian',
      fields: JSON.stringify([
        {
          key: 'motto',
          label: 'Lema',
          type: 'text',
          required: false,
          maxLength: 120,
        },
        {
          key: 'leader',
          label: 'Líder',
          type: 'reference',
          required: false,
          targetTypeKey: 'character',
        },
      ]),
      isSystem: 0,
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
      deletedAt: null,
    })
    .run();

  database
    .insert(relationTypes)
    .values({
      id: FIXTURE_CUSTOM_RELATION_TYPE_ID,
      worldId: FIXTURE_WORLD_ID,
      key: 'founded-by',
      name: 'Fundado por',
      inverseName: 'Fundó',
      color: 'ochre',
      isSystem: 0,
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    })
    .run();

  database
    .insert(tags)
    .values([
      {
        id: FIXTURE_TAG_SEA_ID,
        worldId: FIXTURE_WORLD_ID,
        name: 'Mar',
        color: 'prussian',
        createdAt: FIXED_TIME,
      },
      {
        id: FIXTURE_TAG_NORTH_ID,
        worldId: FIXTURE_WORLD_ID,
        name: 'Norte',
        color: 'moss',
        createdAt: FIXED_TIME,
      },
    ])
    .run();

  const cover = await insertAsset(database, assetsDir, FIXTURE_WORLD_ID, {
    id: FIXTURE_ASSET_COVER_ID,
    width: 40,
    height: 30,
    alt: 'Portada',
    createdAt: FIXED_TIME,
  });
  const ariaImage = await insertAsset(database, assetsDir, FIXTURE_WORLD_ID, {
    id: FIXTURE_ASSET_ARIA_ID,
    width: 32,
    height: 32,
    alt: 'Retrato de Aria',
    createdAt: FIXED_TIME + 1,
  });
  const galleryOne = await insertAsset(database, assetsDir, FIXTURE_WORLD_ID, {
    id: FIXTURE_ASSET_GALLERY_ONE_ID,
    width: 20,
    height: 10,
    alt: null,
    createdAt: FIXED_TIME + 2,
  });
  const galleryTwo = await insertAsset(database, assetsDir, FIXTURE_WORLD_ID, {
    id: FIXTURE_ASSET_GALLERY_TWO_ID,
    width: 16,
    height: 16,
    alt: 'Faro',
    createdAt: FIXED_TIME + 3,
  });
  const orderImage = await insertAsset(database, assetsDir, FIXTURE_WORLD_ID, {
    id: FIXTURE_ASSET_ORDER_ID,
    width: 24,
    height: 24,
    alt: 'Faro de la orden',
    createdAt: FIXED_TIME + 4,
  });
  await insertAsset(database, assetsDir, FIXTURE_WORLD_ID, {
    id: FIXTURE_ASSET_ORPHAN_ID,
    width: 8,
    height: 8,
    alt: null,
    createdAt: FIXED_TIME + 5,
  });

  // La portada se referencia después de insertar el asset: la clave foránea
  // de `worlds.cover_asset_id` exige que exista.
  database
    .update(worlds)
    .set({ coverAssetId: cover.id })
    .where(eq(worlds.id, FIXTURE_WORLD_ID))
    .run();

  database
    .insert(entities)
    .values([
      {
        id: FIXTURE_ENTITY_ARIA_ID,
        worldId: FIXTURE_WORLD_ID,
        typeId: systemCharacter.id,
        name: 'Aria',
        slug: 'aria',
        aliases: JSON.stringify(['La Navegante']),
        summary: 'Navegante del faro.',
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Aria conoce a ' },
                {
                  type: 'text',
                  text: 'la Orden',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: `wc-entity://${FIXTURE_ENTITY_ORDER_ID}`,
                      },
                    },
                  ],
                },
                { type: 'text', text: '.' },
              ],
            },
          ],
        }),
        descriptionText: 'Aria conoce a la Orden.',
        imageAssetId: ariaImage.id,
        attributes: JSON.stringify({
          age: 34,
          species: 'humana',
          affiliation: FIXTURE_ENTITY_ORDER_ID,
          status: 'alive',
        }),
        status: 'active',
        isFavorite: 1,
        createdAt: FIXED_TIME + 100,
        updatedAt: FIXED_TIME + 200,
        deletedAt: null,
      },
      {
        id: FIXTURE_ENTITY_ORDER_ID,
        worldId: FIXTURE_WORLD_ID,
        typeId: systemOrganization.id,
        name: 'Orden del Faro',
        slug: 'orden-del-faro',
        aliases: JSON.stringify([]),
        summary: 'Guardianes de la costa.',
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Fundada por ' },
                {
                  type: 'text',
                  text: 'Aria',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: `wc-entity://${FIXTURE_ENTITY_ARIA_ID}`,
                      },
                    },
                  ],
                },
                { type: 'text', text: '.' },
              ],
            },
          ],
        }),
        descriptionText: 'Fundada por Aria.',
        imageAssetId: orderImage.id,
        attributes: JSON.stringify({
          purpose: 'Guiar a los barcos',
          leader: FIXTURE_ENTITY_ARIA_ID,
        }),
        status: 'active',
        isFavorite: 0,
        createdAt: FIXED_TIME + 101,
        updatedAt: FIXED_TIME + 201,
        deletedAt: null,
      },
      {
        id: FIXTURE_ENTITY_DELETED_ID,
        worldId: FIXTURE_WORLD_ID,
        typeId: systemCharacter.id,
        name: 'Eco',
        slug: 'eco',
        aliases: JSON.stringify([]),
        summary: null,
        description: null,
        descriptionText: null,
        imageAssetId: null,
        attributes: JSON.stringify({}),
        status: 'active',
        isFavorite: 0,
        createdAt: FIXED_TIME + 102,
        updatedAt: FIXED_TIME + 202,
        deletedAt: FIXED_TIME + 300,
      },
      {
        id: FIXTURE_TRASHED_ENTITY_ID,
        worldId: FIXTURE_TRASHED_WORLD_ID,
        typeId: systemCharacter.id,
        name: 'Fantasma',
        slug: 'fantasma',
        aliases: JSON.stringify([]),
        summary: null,
        description: null,
        descriptionText: null,
        imageAssetId: null,
        attributes: JSON.stringify({}),
        status: 'active',
        isFavorite: 0,
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
        deletedAt: null,
      },
    ])
    .run();

  database
    .insert(entityTags)
    .values([
      { entityId: FIXTURE_ENTITY_ARIA_ID, tagId: FIXTURE_TAG_SEA_ID },
      { entityId: FIXTURE_ENTITY_ARIA_ID, tagId: FIXTURE_TAG_NORTH_ID },
    ])
    .run();

  database
    .insert(entityGallery)
    .values([
      {
        entityId: FIXTURE_ENTITY_ARIA_ID,
        assetId: galleryOne.id,
        position: 0,
      },
      {
        entityId: FIXTURE_ENTITY_ARIA_ID,
        assetId: galleryTwo.id,
        position: 1,
      },
    ])
    .run();

  database
    .insert(entityVersions)
    .values([
      {
        id: '018f1000-0000-7000-8000-000000000501',
        entityId: FIXTURE_ENTITY_ARIA_ID,
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Aria, antes.' }],
            },
          ],
        }),
        descriptionText: 'Aria, antes.',
        label: 'Primera versión',
        origin: 'manual',
        createdAt: FIXED_TIME + 150,
      },
      {
        id: '018f1000-0000-7000-8000-000000000502',
        entityId: FIXTURE_ENTITY_ARIA_ID,
        description: null,
        descriptionText: null,
        label: null,
        origin: 'auto',
        createdAt: FIXED_TIME + 160,
      },
      {
        id: '018f1000-0000-7000-8000-000000000503',
        entityId: FIXTURE_ENTITY_DELETED_ID,
        description: null,
        descriptionText: null,
        label: null,
        origin: 'auto',
        createdAt: FIXED_TIME + 170,
      },
    ])
    .run();

  database
    .insert(relations)
    .values([
      {
        id: '018f1000-0000-7000-8000-000000000601',
        worldId: FIXTURE_WORLD_ID,
        sourceId: FIXTURE_ENTITY_ORDER_ID,
        targetId: FIXTURE_ENTITY_ARIA_ID,
        typeId: systemRelation.id,
        label: null,
        inverseLabel: null,
        notes: 'Desde la fundación.',
        strength: 3,
        metadata: JSON.stringify({ since: 1200 }),
        createdAt: FIXED_TIME + 180,
        updatedAt: FIXED_TIME + 180,
      },
      {
        id: '018f1000-0000-7000-8000-000000000602',
        worldId: FIXTURE_WORLD_ID,
        sourceId: FIXTURE_ENTITY_ARIA_ID,
        targetId: FIXTURE_ENTITY_ORDER_ID,
        typeId: systemRelationLeads.id,
        label: 'Guía a',
        inverseLabel: 'Es guiado por',
        notes: null,
        strength: 4,
        metadata: JSON.stringify({}),
        createdAt: FIXED_TIME + 181,
        updatedAt: FIXED_TIME + 181,
      },
      {
        id: '018f1000-0000-7000-8000-000000000603',
        worldId: FIXTURE_WORLD_ID,
        sourceId: FIXTURE_ENTITY_ORDER_ID,
        targetId: FIXTURE_ENTITY_ARIA_ID,
        typeId: FIXTURE_CUSTOM_RELATION_TYPE_ID,
        label: null,
        inverseLabel: null,
        notes: null,
        strength: 2,
        metadata: JSON.stringify({}),
        createdAt: FIXED_TIME + 182,
        updatedAt: FIXED_TIME + 182,
      },
      {
        id: '018f1000-0000-7000-8000-000000000604',
        worldId: FIXTURE_WORLD_ID,
        sourceId: FIXTURE_ENTITY_ARIA_ID,
        targetId: FIXTURE_ENTITY_DELETED_ID,
        typeId: systemRelation.id,
        label: null,
        inverseLabel: null,
        notes: 'Extremo en papelera.',
        strength: 1,
        metadata: JSON.stringify({}),
        createdAt: FIXED_TIME + 183,
        updatedAt: FIXED_TIME + 183,
      },
    ])
    .run();

  database
    .insert(activityLog)
    .values({
      id: '018f1000-0000-7000-8000-000000000701',
      worldId: FIXTURE_WORLD_ID,
      action: 'world.updated',
      entityType: 'world',
      entityId: null,
      diff: '{}',
      createdAt: FIXED_TIME + 190,
    })
    .run();
}

interface InsertAssetInput {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string | null;
  readonly createdAt: number;
}

async function insertAsset(
  database: WorldCraftDatabase,
  assetsDir: string,
  worldId: string,
  input: InsertAssetInput,
): Promise<{ readonly id: string }> {
  const data = await sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .webp({ quality: 80 })
    .toBuffer();
  const relativePath = `worlds/${worldId}/${input.id}.webp`;
  const file = join(assetsDir, ...relativePath.split('/'));

  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);

  database
    .insert(assets)
    .values({
      id: input.id,
      worldId,
      kind: 'image',
      relativePath,
      mime: 'image/webp',
      size: data.byteLength,
      width: input.width,
      height: input.height,
      alt: input.alt,
      hash: sha256(data),
      createdAt: input.createdAt,
    })
    .run();

  return { id: input.id };
}
