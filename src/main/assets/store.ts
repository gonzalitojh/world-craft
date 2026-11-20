/**
 * Repositorio de metadatos de assets.
 *
 * La interfaz es la frontera entre el servicio (importación, huérfanos y
 * protocolo) y Drizzle. En M0 solo se necesitan `insert`, `findById`,
 * `listAll` y `count`; cualquier consulta nueva se añade aquí con su prueba de
 * integración.
 */
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import type { WorldCraftDatabase } from '../db/client';
import { assets } from '../db/schema/assets';
import { worlds } from '../db/schema/worlds';
import type { AssetKind } from './constants';
import { toAssetError } from './errors';

/** Fila de `assets` tal como la consume el dominio. */
export interface AssetRecord {
  readonly id: string;
  readonly worldId: string;
  readonly kind: AssetKind;
  readonly relativePath: string;
  readonly mime: string;
  readonly size: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly hash: string;
  readonly createdAt: number;
}

/** Operaciones de metadatos que necesita el servicio de assets. */
export interface AssetRepository {
  insert(record: AssetRecord): void;
  findById(id: string): AssetRecord | null;
  listAll(): readonly AssetRecord[];
  listByWorld(worldId: string): readonly AssetRecord[];
  count(): number;
  worldExists(worldId: string): boolean;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createAssetRepository(
  database: WorldCraftDatabase,
): AssetRepository {
  return {
    insert(record) {
      try {
        database
          .insert(assets)
          .values({
            id: record.id,
            worldId: record.worldId,
            kind: record.kind,
            relativePath: record.relativePath,
            mime: record.mime,
            size: record.size,
            width: record.width,
            height: record.height,
            alt: record.alt,
            hash: record.hash,
            createdAt: record.createdAt,
          })
          .run();
      } catch (error) {
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }
    },

    findById(id) {
      try {
        const row = database
          .select()
          .from(assets)
          .where(eq(assets.id, id))
          .get();

        return row === undefined ? null : toRecord(row);
      } catch (error) {
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }
    },

    listAll() {
      try {
        return database
          .select()
          .from(assets)
          .orderBy(asc(assets.createdAt), asc(assets.id))
          .all()
          .map(toRecord);
      } catch (error) {
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }
    },

    listByWorld(worldId) {
      try {
        return database
          .select()
          .from(assets)
          .where(and(eq(assets.worldId, worldId), eq(assets.kind, 'image')))
          .orderBy(desc(assets.createdAt), desc(assets.id))
          .all()
          .map(toRecord);
      } catch (error) {
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }
    },

    count() {
      try {
        const row = database
          .select({ total: sql<number>`count(*)` })
          .from(assets)
          .get();

        return row?.total ?? 0;
      } catch (error) {
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }
    },

    worldExists(worldId) {
      try {
        return (
          database
            .select({ id: worlds.id })
            .from(worlds)
            .where(and(eq(worlds.id, worldId), isNull(worlds.deletedAt)))
            .get() !== undefined
        );
      } catch (error) {
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }
    },
  };
}

interface AssetRow {
  readonly id: string;
  readonly worldId: string;
  readonly kind: string;
  readonly relativePath: string;
  readonly mime: string;
  readonly size: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly hash: string;
  readonly createdAt: number;
}

function toRecord(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    kind: row.kind as AssetKind,
    relativePath: row.relativePath,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    hash: row.hash,
    createdAt: row.createdAt,
  };
}
