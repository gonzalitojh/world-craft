/**
 * Servicio de dominio de los mundos.
 *
 * Orquesta validación, slugs, timestamps y registro de actividad sobre el
 * repositorio. No conoce Electron ni IPC: recibe un `WorldCraftDatabase` y
 * devuelve los tipos compartidos. El ID y el reloj se inyectan en las pruebas.
 */
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { generateUuidv7 } from '../db/ids';
import {
  WORLD_ACTIVITY_LIMIT_DEFAULT,
  WORLD_ACTIVITY_LIMIT_MAX,
  type WorldActivityEntry,
  type WorldActivityFilter,
  type WorldCreateInput,
  type WorldDetail,
  type WorldDuplicateInput,
  type WorldSetArchivedInput,
  type WorldSummary,
  type WorldUpdateInput,
} from '../../shared/contracts/worlds';
import {
  createWorldRepository,
  type ActivityRecord,
  type NewActivityRecord,
  type WorldRecord,
} from './repository';
import { normalizeWorldSlug, slugifyWorldName, uniqueWorldSlug } from './slug';
import {
  normalizeWorldDescription,
  normalizeWorldGenres,
  normalizeWorldLanguage,
  normalizeWorldName,
  normalizeWorldSummary,
} from './validation';

/** Resultado de crear un mundo: siempre existe si no se lanza un error. */
export interface WorldsService {
  list(): readonly WorldSummary[];
  get(id: string): WorldDetail | null;
  create(input: WorldCreateInput): WorldDetail;
  update(input: WorldUpdateInput): WorldDetail | null;
  duplicate(input: WorldDuplicateInput): WorldDetail | null;
  setArchived(input: WorldSetArchivedInput): WorldDetail | null;
  remove(id: string): boolean;
  listActivity(filter?: WorldActivityFilter): readonly WorldActivityEntry[];
}

/** Opciones del servicio; todas las dependencias externas se inyectan. */
export interface WorldsServiceOptions {
  readonly database: WorldCraftDatabase;
  /** Conexión subyacente para agrupar cada mutación y su actividad. */
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
  readonly generateId?: () => string;
  /**
   * Copia el contenido del mundo duplicado dentro de la misma transacción.
   * La composición principal lo usa para copiar los tipos personalizados.
   */
  readonly onDuplicate?: (
    sourceWorldId: string,
    targetWorldId: string,
    at: number,
  ) => void;
}

/** Crea el servicio sobre la base compartida del proceso principal. */
export function createWorldsService(
  options: WorldsServiceOptions,
): WorldsService {
  const repository = createWorldRepository(options.database);
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  // Drizzle usa la misma conexión de better-sqlite3, así que una transacción
  // nativa agrupa la escritura y su actividad sin duplicar la capa de datos.
  const write = <T>(operation: () => T): T =>
    options.sqlite.transaction(operation)();

  const slugExists = (slug: string): boolean =>
    repository.findBySlug(slug) !== null;

  const logActivity = (
    worldId: string,
    action: NewActivityRecord['action'],
    diff: unknown,
    at: number,
  ): void => {
    repository.insertActivity({
      id: generateId(),
      worldId,
      action,
      entityType: 'world',
      entityId: worldId,
      diff,
      createdAt: at,
    });
  };

  return {
    list() {
      return repository.list().map(toSummary);
    },

    get(id) {
      const record = repository.findById(id);

      return record === null || record.deletedAt !== null
        ? null
        : toDetail(record);
    },

    create(input) {
      const at = now();
      const name = normalizeWorldName(input.name);
      const baseSlug =
        input.slug !== undefined && input.slug.trim().length > 0
          ? normalizeWorldSlug(input.slug)
          : slugifyWorldName(name);
      const slug = uniqueWorldSlug(baseSlug, slugExists);
      const record: WorldRecord = {
        id: generateId(),
        name,
        slug,
        summary: normalizeWorldSummary(input.summary),
        description: normalizeWorldDescription(input.description),
        coverAssetId: null,
        genres: normalizeWorldGenres(input.genres),
        status: 'active',
        language: normalizeWorldLanguage(input.language),
        settings: '{}',
        createdAt: at,
        updatedAt: at,
        archivedAt: null,
        deletedAt: null,
      };

      return write(() => {
        repository.insert(record);
        logActivity(
          record.id,
          'world.created',
          {
            fields: [
              'name',
              'slug',
              'summary',
              'description',
              'genres',
              'language',
            ],
          },
          at,
        );

        return toDetail(record);
      });
    },

    update(input) {
      const existing = repository.findById(input.id);

      if (existing === null || existing.deletedAt !== null) {
        return null;
      }

      const at = now();
      const name = normalizeWorldName(input.name);
      const slug =
        input.slug !== undefined && input.slug.trim().length > 0
          ? uniqueWorldSlug(normalizeWorldSlug(input.slug), (candidate) =>
              candidate === existing.slug
                ? false
                : repository.findBySlug(candidate) !== null,
            )
          : existing.slug;
      const summary = normalizeWorldSummary(input.summary);
      const description = normalizeWorldDescription(input.description);
      const genres = normalizeWorldGenres(input.genres);
      const language = normalizeWorldLanguage(input.language);
      const changed = changedFields(existing, {
        name,
        slug,
        summary,
        description,
        genres,
        language,
      });

      if (changed.length === 0) {
        return toDetail(existing);
      }

      const updated: WorldRecord = {
        ...existing,
        name,
        slug,
        summary,
        description,
        genres,
        language,
        updatedAt: at,
      };

      return write(() => {
        repository.update(updated);
        logActivity(updated.id, 'world.updated', { fields: changed }, at);

        return toDetail(updated);
      });
    },

    duplicate(input) {
      const source = repository.findById(input.id);

      if (source === null || source.deletedAt !== null) {
        return null;
      }

      const at = now();
      const name = normalizeWorldName(input.name);
      const slug = uniqueWorldSlug(slugifyWorldName(name), slugExists);
      const copy: WorldRecord = {
        ...source,
        id: generateId(),
        name,
        slug,
        // La portada es un asset del mundo original: no se comparte entre
        // mundos. La galería del mundo permitirá elegir otra.
        coverAssetId: null,
        status: 'active',
        createdAt: at,
        updatedAt: at,
        archivedAt: null,
        deletedAt: null,
      };

      return write(() => {
        repository.insert(copy);
        options.onDuplicate?.(source.id, copy.id, at);
        logActivity(copy.id, 'world.duplicated', { sourceId: source.id }, at);

        return toDetail(copy);
      });
    },

    setArchived(input) {
      const existing = repository.findById(input.id);

      if (existing === null || existing.deletedAt !== null) {
        return null;
      }

      const status = input.archived ? 'archived' : 'active';

      if (existing.status === status) {
        return toDetail(existing);
      }

      const at = now();
      const updated: WorldRecord = {
        ...existing,
        status,
        archivedAt: input.archived ? at : null,
        updatedAt: at,
      };

      return write(() => {
        repository.update(updated);
        logActivity(
          updated.id,
          input.archived ? 'world.archived' : 'world.restored',
          {},
          at,
        );

        return toDetail(updated);
      });
    },

    remove(id) {
      const existing = repository.findById(id);

      if (existing === null || existing.deletedAt !== null) {
        return false;
      }

      const at = now();

      return write(() => {
        if (!repository.softDelete(id, at)) {
          return false;
        }

        logActivity(id, 'world.deleted', {}, at);

        return true;
      });
    },

    listActivity(filter) {
      const requested = filter?.limit ?? WORLD_ACTIVITY_LIMIT_DEFAULT;
      const limit = Math.min(
        Math.max(Math.trunc(requested), 1),
        WORLD_ACTIVITY_LIMIT_MAX,
      );

      return repository
        .listActivity({ worldId: filter?.worldId, limit })
        .map(toActivityEntry);
    },
  };
}

/**
 * Servicio de sustitución cuando la base no está disponible (modo seguro).
 *
 * Cualquier llamada lanza y el router la convierte en `INTERNAL_ERROR`; la
 * interfaz muestra un estado de error en lugar de datos inventados.
 */
export function createUnavailableWorldsService(): WorldsService {
  const unavailable = (): never => {
    throw new Error('Los mundos no están disponibles en modo seguro.');
  };

  return {
    list: unavailable,
    get: unavailable,
    create: unavailable,
    update: unavailable,
    duplicate: unavailable,
    setArchived: unavailable,
    remove: unavailable,
    listActivity: unavailable,
  };
}

function toSummary(record: WorldRecord): WorldSummary {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    summary: record.summary,
    genres: record.genres,
    language: record.language,
    status: record.status,
    coverAssetId: record.coverAssetId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  };
}

function toDetail(record: WorldRecord): WorldDetail {
  return { ...toSummary(record), description: record.description };
}

function toActivityEntry(record: ActivityRecord): WorldActivityEntry {
  return {
    id: record.id,
    worldId: record.worldId,
    worldName: record.worldName,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    createdAt: record.createdAt,
  };
}

interface EditableFields {
  readonly name: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly genres: readonly string[];
  readonly language: WorldRecord['language'];
}

/** Lista de campos que realmente cambian, para el `diff` de actividad. */
function changedFields(
  before: WorldRecord,
  after: EditableFields,
): readonly (keyof EditableFields)[] {
  const changed: (keyof EditableFields)[] = [];

  if (before.name !== after.name) changed.push('name');
  if (before.slug !== after.slug) changed.push('slug');
  if (before.summary !== after.summary) changed.push('summary');
  if (before.description !== after.description) changed.push('description');
  if (JSON.stringify(before.genres) !== JSON.stringify(after.genres)) {
    changed.push('genres');
  }
  if (before.language !== after.language) changed.push('language');

  return changed;
}
