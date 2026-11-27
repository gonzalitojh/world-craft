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
  type WorldRichTextDocument,
  type WorldSetArchivedInput,
  type WorldSetCoverInput,
  type WorldSummary,
  type WorldUpdateInput,
} from '../../shared/contracts/worlds';
import {
  collectEntityLinkIds,
  extractEntityDescriptionText,
  plainTextToRichTextDocument,
  stripRichTextLinks,
} from '../../shared/entities/description';
import {
  parseWorldDescription,
  validateWorldDescription,
} from '../../shared/worlds/description';
import {
  createWorldRepository,
  type ActivityRecord,
  type NewActivityRecord,
  type WorldRecord,
} from './repository';
import { WorldInputError } from './errors';
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
  setCover(input: WorldSetCoverInput): WorldDetail | null;
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

  /**
   * Comprueba que la portada es una imagen del propio mundo.
   *
   * El renderer no es autoridad: aunque envíe un asset ajeno, inexistente o de
   * otro tipo, aquí se rechaza. `null` siempre es válido y quita la portada.
   */
  const resolveCoverAssetId = (
    worldId: string,
    assetId: string | null,
  ): string | null => {
    if (assetId === null) {
      return null;
    }

    if (repository.findImageAsset(worldId, assetId) === null) {
      throw new WorldInputError(
        'La portada debe ser una imagen de este mundo.',
      );
    }

    return assetId;
  };

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

  /**
   * Comprueba que los enlaces internos apuntan a fichas vivas del mismo mundo.
   *
   * En la creación el mundo aún no existe y no puede tener fichas, así que
   * cualquier enlace se rechaza. La autoridad final es este proceso principal:
   * la interfaz valida antes solo cuando la lista de candidatas está completa.
   */
  const validateDescriptionLinks = (
    worldId: string | null,
    document: WorldRichTextDocument | null,
  ): void => {
    if (document === null) {
      return;
    }

    for (const entityId of collectEntityLinkIds(document)) {
      if (
        worldId === null ||
        repository.findLiveEntity(worldId, entityId) === null
      ) {
        throw new WorldInputError(
          'La descripción enlaza a una ficha que no está disponible en este mundo.',
        );
      }
    }
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
      const description = normalizeWorldDescription(input.description);

      validateDescriptionLinks(null, description.document);

      const record: WorldRecord = {
        id: generateId(),
        name,
        slug,
        summary: normalizeWorldSummary(input.summary),
        description: description.json,
        descriptionText: description.text,
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

      validateDescriptionLinks(existing.id, description.document);

      const genres = normalizeWorldGenres(input.genres);
      const language = normalizeWorldLanguage(input.language);
      const coverAssetId =
        input.coverAssetId === undefined
          ? existing.coverAssetId
          : resolveCoverAssetId(existing.id, input.coverAssetId);
      const changed = changedFields(existing, {
        name,
        slug,
        summary,
        description: description.json,
        descriptionText: description.text,
        genres,
        language,
        coverAssetId,
      });

      if (changed.length === 0) {
        return toDetail(existing);
      }

      const updated: WorldRecord = {
        ...existing,
        name,
        slug,
        summary,
        description: description.json,
        descriptionText: description.text,
        genres,
        language,
        coverAssetId,
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
      // Las fichas no se copian: un enlace interno apuntaría al mundo original.
      // Se conserva el texto y se quita solo la marca de enlace.
      const degraded = degradeDescription(source);
      const copy: WorldRecord = {
        ...source,
        id: generateId(),
        name,
        slug,
        description: degraded.description,
        descriptionText: degraded.descriptionText,
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

    setCover(input) {
      const existing = repository.findById(input.worldId);

      if (existing === null || existing.deletedAt !== null) {
        return null;
      }

      const coverAssetId = resolveCoverAssetId(existing.id, input.assetId);

      // Elegir la portada actual no escribe ni registra actividad: el usuario
      // no ha cambiado nada.
      if (existing.coverAssetId === coverAssetId) {
        return toDetail(existing);
      }

      const at = now();
      const updated: WorldRecord = {
        ...existing,
        coverAssetId,
        updatedAt: at,
      };

      return write(() => {
        repository.update(updated);
        logActivity(updated.id, 'world.updated', { fields: ['cover'] }, at);

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
    setCover: unavailable,
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
  return {
    ...toSummary(record),
    description: readDescriptionDocument(record),
  };
}

/**
 * Lee el documento guardado con tolerancia a datos corruptos.
 *
 * Si el JSON es ilegible o no cumple el esquema, reconstruye un documento desde
 * el texto plano para que el texto visible no se pierda; nunca se registra el
 * contenido en logs.
 */
function readDescriptionDocument(
  record: WorldRecord,
): WorldRichTextDocument | null {
  const parsed = parseWorldDescription(record.description);

  if (parsed.ok) {
    if (parsed.document !== null) {
      return parsed.document;
    }

    return plainTextToRichTextDocument(record.descriptionText ?? '');
  }

  return plainTextToRichTextDocument(record.descriptionText ?? '');
}

/**
 * Degrada los enlaces internos de una descripción al duplicar o restaurar.
 *
 * Conserva el texto y el resto de marcas. Si el documento guardado fuera
 * ilegible, se reconstruye desde `description_text`.
 */
function degradeDescription(record: WorldRecord): {
  readonly description: string | null;
  readonly descriptionText: string | null;
} {
  const parsed = parseWorldDescription(record.description);

  if (parsed.ok && parsed.document !== null) {
    const stripped = stripRichTextLinks(parsed.document);

    if (stripped !== null) {
      const validated = validateWorldDescription(stripped);

      if (validated.ok) {
        return {
          description: validated.json,
          descriptionText: validated.text,
        };
      }
    }
  }

  const fallback = plainTextToRichTextDocument(record.descriptionText ?? '');

  if (fallback === null) {
    return { description: null, descriptionText: record.descriptionText };
  }

  const validated = validateWorldDescription(fallback);

  if (validated.ok) {
    return { description: validated.json, descriptionText: validated.text };
  }

  // Documento heredado que supera el límite vigente: se conserva el texto
  // visible en el documento y en `description_text`. La lectura lo reconstruye
  // desde el texto plano si la validación estricta no lo acepta, de modo que el
  // duplicado nunca deja la descripción como `null`.
  return {
    description: JSON.stringify(fallback),
    descriptionText: extractEntityDescriptionText(fallback),
  };
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
  readonly descriptionText: string | null;
  readonly genres: readonly string[];
  readonly language: WorldRecord['language'];
  readonly coverAssetId: string | null;
}

/** Claves del `diff` de actividad; la portada se registra como `cover`. */
type EditableFieldKey = Exclude<keyof EditableFields, 'coverAssetId'> | 'cover';

/** Lista de campos que realmente cambian, para el `diff` de actividad. */
function changedFields(
  before: WorldRecord,
  after: EditableFields,
): readonly EditableFieldKey[] {
  const changed: EditableFieldKey[] = [];

  if (before.name !== after.name) changed.push('name');
  if (before.slug !== after.slug) changed.push('slug');
  if (before.summary !== after.summary) changed.push('summary');

  // El documento y su texto plano son un solo campo visible: se comparan
  // juntos y se registra una única entrada `description`.
  if (
    before.description !== after.description ||
    before.descriptionText !== after.descriptionText
  ) {
    changed.push('description');
  }

  if (JSON.stringify(before.genres) !== JSON.stringify(after.genres)) {
    changed.push('genres');
  }

  if (before.language !== after.language) changed.push('language');

  if (before.coverAssetId !== after.coverAssetId) changed.push('cover');

  return changed;
}
