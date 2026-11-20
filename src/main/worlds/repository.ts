/**
 * Repositorio Drizzle de mundos y actividad.
 *
 * Es la única capa que habla con SQL. Todas las consultas de lista filtran por
 * `deleted_at` y ordenan por actualización; la actividad se resuelve con un
 * `JOIN` para devolver el nombre del mundo y nunca mezclar filas de otros
 * mundos. Las fechas y los IDs llegan ya calculados por el servicio.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type { WorldCraftDatabase } from '../db/client';
import { activityLog, worlds } from '../db/schema/worlds';
import {
  isWorldActivityAction,
  type WorldActivityAction,
  type WorldLanguage,
  type WorldStatus,
} from '../../shared/contracts/worlds';

/** Fila de `worlds` tal como la consume el dominio. */
export interface WorldRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly coverAssetId: string | null;
  readonly genres: readonly string[];
  readonly status: WorldStatus;
  readonly language: WorldLanguage;
  readonly settings: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly archivedAt: number | null;
  readonly deletedAt: number | null;
}

/** Fila de actividad con el nombre del mundo resuelto. */
export interface ActivityRecord {
  readonly id: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly action: WorldActivityAction;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly diff: unknown;
  readonly createdAt: number;
}

/** Actividad nueva; el nombre del mundo se resuelve al leerla. */
export type NewActivityRecord = Omit<ActivityRecord, 'worldName'>;

/** Operaciones que necesita el servicio de mundos. */
export interface WorldRepository {
  list(): readonly WorldRecord[];
  findById(id: string): WorldRecord | null;
  findBySlug(slug: string): WorldRecord | null;
  insert(record: WorldRecord): void;
  update(record: WorldRecord): void;
  softDelete(id: string, deletedAt: number): boolean;
  insertActivity(record: NewActivityRecord): void;
  listActivity(options: {
    readonly worldId?: string | undefined;
    readonly limit: number;
  }): readonly ActivityRecord[];
}

interface WorldRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly coverAssetId: string | null;
  readonly genres: string;
  readonly status: string;
  readonly language: string;
  readonly settings: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly archivedAt: number | null;
  readonly deletedAt: number | null;
}

interface ActivityRow {
  readonly id: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly diff: string;
  readonly createdAt: number;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createWorldRepository(
  database: WorldCraftDatabase,
): WorldRepository {
  return {
    list() {
      return database
        .select()
        .from(worlds)
        .where(isNull(worlds.deletedAt))
        .orderBy(desc(worlds.updatedAt), desc(worlds.createdAt), asc(worlds.id))
        .all()
        .map(toWorldRecord);
    },

    findById(id) {
      const row = database.select().from(worlds).where(eq(worlds.id, id)).get();

      return row === undefined ? null : toWorldRecord(row);
    },

    findBySlug(slug) {
      const row = database
        .select()
        .from(worlds)
        .where(eq(worlds.slug, slug))
        .get();

      return row === undefined ? null : toWorldRecord(row);
    },

    insert(record) {
      database
        .insert(worlds)
        .values({
          id: record.id,
          name: record.name,
          slug: record.slug,
          summary: record.summary,
          description: record.description,
          coverAssetId: record.coverAssetId,
          genres: JSON.stringify(record.genres),
          status: record.status,
          language: record.language,
          settings: record.settings,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          archivedAt: record.archivedAt,
          deletedAt: record.deletedAt,
        })
        .run();
    },

    update(record) {
      database
        .update(worlds)
        .set({
          name: record.name,
          slug: record.slug,
          summary: record.summary,
          description: record.description,
          coverAssetId: record.coverAssetId,
          genres: JSON.stringify(record.genres),
          status: record.status,
          language: record.language,
          settings: record.settings,
          updatedAt: record.updatedAt,
          archivedAt: record.archivedAt,
          deletedAt: record.deletedAt,
        })
        .where(eq(worlds.id, record.id))
        .run();
    },

    softDelete(id, deletedAt) {
      const result = database
        .update(worlds)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(and(eq(worlds.id, id), isNull(worlds.deletedAt)))
        .run();

      return result.changes > 0;
    },

    insertActivity(record) {
      database
        .insert(activityLog)
        .values({
          id: record.id,
          worldId: record.worldId,
          action: record.action,
          entityType: record.entityType,
          entityId: record.entityId,
          diff: JSON.stringify(record.diff),
          createdAt: record.createdAt,
        })
        .run();
    },

    listActivity({ worldId, limit }) {
      const conditions = [isNull(worlds.deletedAt)];

      if (worldId !== undefined) {
        conditions.push(eq(activityLog.worldId, worldId));
      }

      return database
        .select({
          id: activityLog.id,
          worldId: activityLog.worldId,
          worldName: worlds.name,
          action: activityLog.action,
          entityType: activityLog.entityType,
          entityId: activityLog.entityId,
          diff: activityLog.diff,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .innerJoin(worlds, eq(activityLog.worldId, worlds.id))
        .where(and(...conditions))
        .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
        .limit(limit)
        .all()
        .flatMap(toActivityRecord);
    },
  };
}

function toWorldRecord(row: WorldRow): WorldRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    coverAssetId: row.coverAssetId,
    genres: parseGenres(row.genres),
    status: row.status === 'archived' ? 'archived' : 'active',
    language: toLanguage(row.language),
    settings: row.settings,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
  };
}

function toActivityRecord(row: ActivityRow): readonly ActivityRecord[] {
  if (!isWorldActivityAction(row.action)) {
    // Una acción desconocida de una versión futura no rompe la lista: se omite
    // en lugar de mostrar un texto inventado.
    return [];
  }

  return [
    {
      id: row.id,
      worldId: row.worldId,
      worldName: row.worldName,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      diff: parseJson(row.diff),
      createdAt: row.createdAt,
    },
  ];
}

function parseGenres(raw: string): readonly string[] {
  const value = parseJson(raw);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function toLanguage(raw: string): WorldLanguage {
  return raw === 'en' || raw === 'it' ? raw : 'es';
}
