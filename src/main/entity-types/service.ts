/**
 * Servicio de dominio de los tipos de entidad.
 *
 * Orquesta validación, claves, timestamps y transferencia sobre el repositorio.
 * No conoce Electron ni IPC: recibe un `WorldCraftDatabase` y devuelve los
 * tipos compartidos. El ID y el reloj se inyectan en las pruebas.
 *
 * Reglas:
 * - Los tipos del sistema (`isSystem`) nunca se editan ni se borran.
 * - Cada tipo personalizado pertenece a un mundo y solo se lista o modifica
 *   desde ese mundo.
 * - Duplicar un tipo del sistema en un mundo es la vía prevista para ajustar
 *   una plantilla sin tocar el original.
 */
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { generateUuidv7 } from '../db/ids';
import {
  ENTITY_TYPE_TRANSFER_VERSION,
  type EntityTypeCreateInput,
  type EntityTypeDeleteResult,
  type EntityTypeDuplicateInput,
  type EntityTypeRemoveInput,
  type EntityTypeSummary,
  type EntityTypeTransfer,
  type EntityTypeTransferEntry,
  type EntityTypeUpdateInput,
} from '../../shared/contracts/entity-types';
import { systemEntityTypeOrder } from '../../shared/entity-types/catalog';
import { EntityTypeInputError, EntityTypeProtectedError } from './errors';
import {
  createEntityTypeRepository,
  type EntityTypeRecord,
} from './repository';
import { entityTypeTransferSchema } from './transfer';
import {
  normalizeEditableEntityType,
  normalizeEntityTypeKey,
  normalizeEntityTypeName,
  slugifyEntityTypeName,
  uniqueEntityTypeKey,
} from './validation';

/** Servicio de tipos de entidad. */
export interface EntityTypesService {
  list(worldId: string): readonly EntityTypeSummary[];
  create(input: EntityTypeCreateInput): EntityTypeSummary;
  update(input: EntityTypeUpdateInput): EntityTypeSummary | null;
  duplicate(input: EntityTypeDuplicateInput): EntityTypeSummary | null;
  remove(input: EntityTypeRemoveInput): EntityTypeDeleteResult;
  /** Exporta solo los tipos personalizados del mundo. */
  exportTypes(worldId: string): EntityTypeTransfer;
  /** Importa un bloque versionado en un mundo existente. */
  importTypes(worldId: string, payload: unknown): readonly EntityTypeSummary[];
  /** Copia los tipos personalizados al duplicar un mundo, dentro de su transacción. */
  copyFromWorld(sourceWorldId: string, targetWorldId: string, at: number): void;
}

/** Opciones del servicio; todas las dependencias externas se inyectan. */
export interface EntityTypesServiceOptions {
  readonly database: WorldCraftDatabase;
  /** Conexión subyacente para importar varios tipos de forma atómica. */
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
  readonly generateId?: () => string;
}

/** Crea el servicio sobre la base compartida del proceso principal. */
export function createEntityTypesService(
  options: EntityTypesServiceOptions,
): EntityTypesService {
  const repository = createEntityTypeRepository(options.database);
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  const write = <T>(operation: () => T): T =>
    options.sqlite.transaction(operation)();

  const keyExists = (worldId: string, key: string): boolean =>
    repository.findByKey(worldId, key) !== null;

  const requireWorld = (worldId: string): void => {
    if (!repository.worldExists(worldId)) {
      throw new EntityTypeInputError(
        'El mundo no existe o está en la papelera.',
      );
    }
  };

  const toRecord = (
    input: {
      readonly worldId: string;
      readonly key: string;
      readonly name: string;
      readonly icon: EntityTypeSummary['icon'];
      readonly color: EntityTypeSummary['color'];
      readonly fields: EntityTypeSummary['fields'];
    },
    at: number,
  ): EntityTypeRecord => ({
    id: generateId(),
    worldId: input.worldId,
    key: input.key,
    name: input.name,
    icon: input.icon,
    color: input.color,
    fields: input.fields,
    isSystem: false,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  });

  return {
    list(worldId) {
      if (!repository.worldExists(worldId)) {
        return [];
      }

      const records = repository.list(worldId);
      const system = records
        .filter((record) => record.isSystem)
        .sort(
          (left, right) =>
            systemEntityTypeOrder(left.key) -
              systemEntityTypeOrder(right.key) ||
            left.key.localeCompare(right.key),
        );
      const custom = records
        .filter((record) => !record.isSystem)
        .sort(
          (left, right) =>
            left.name.localeCompare(right.name, 'es') ||
            left.key.localeCompare(right.key),
        );

      return [...system, ...custom].map(toSummary);
    },

    create(input) {
      requireWorld(input.worldId);
      const editable = normalizeEditableEntityType(input);
      const base =
        input.key !== undefined && input.key.trim().length > 0
          ? normalizeEntityTypeKey(input.key)
          : slugifyEntityTypeName(editable.name);
      const key = uniqueEntityTypeKey(base, (candidate) =>
        keyExists(input.worldId, candidate),
      );
      const at = now();
      const record = toRecord({ ...editable, worldId: input.worldId, key }, at);

      repository.insert(record);

      return toSummary(record);
    },

    update(input) {
      const existing = repository.findById(input.id);

      if (existing === null || existing.deletedAt !== null) {
        return null;
      }

      if (existing.isSystem) {
        throw new EntityTypeProtectedError();
      }

      if (existing.worldId !== input.worldId) {
        return null;
      }

      // Un mundo en la papelera no se puede mutar aunque la fila del tipo siga
      // existiendo hasta la purga.
      if (!repository.worldExists(input.worldId)) {
        return null;
      }

      const editable = normalizeEditableEntityType(input);

      // Un tipo con fichas vivas no puede perder campos ni cambiar su tipo:
      // los valores guardados quedarían huérfanos o dejarían de validar. Se
      // permite añadir campos, cambiar etiquetas, opciones, icono o color.
      if (repository.countEntitiesByType(existing.id) > 0) {
        for (const previous of existing.fields) {
          const next = editable.fields.find(
            (field) => field.key === previous.key,
          );

          if (next === undefined || next.type !== previous.type) {
            throw new EntityTypeInputError(
              'El tipo tiene fichas: no puedes quitar un campo ni cambiar su tipo.',
            );
          }
        }
      }

      if (
        existing.name === editable.name &&
        existing.icon === editable.icon &&
        existing.color === editable.color &&
        JSON.stringify(existing.fields) === JSON.stringify(editable.fields)
      ) {
        return toSummary(existing);
      }

      const updated: EntityTypeRecord = {
        ...existing,
        ...editable,
        updatedAt: now(),
      };

      return repository.update(updated) ? toSummary(updated) : null;
    },

    duplicate(input) {
      requireWorld(input.worldId);
      const source = repository.findById(input.id);

      if (source === null || source.deletedAt !== null) {
        return null;
      }

      // Un tipo personalizado de otro mundo no se puede duplicar: rompería el
      // aislamiento. Los del sistema sí, porque son universales.
      if (source.worldId !== null && source.worldId !== input.worldId) {
        return null;
      }

      const name = normalizeEntityTypeName(input.name);
      const base = slugifyEntityTypeName(name);
      const key = uniqueEntityTypeKey(base, (candidate) =>
        keyExists(input.worldId, candidate),
      );
      const at = now();
      const copy: EntityTypeRecord = {
        id: generateId(),
        worldId: input.worldId,
        key,
        name,
        icon: source.icon,
        color: source.color,
        fields: source.fields,
        isSystem: false,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };

      repository.insert(copy);

      return toSummary(copy);
    },

    remove(input) {
      const existing = repository.findById(input.id);

      if (existing === null || existing.deletedAt !== null) {
        return { deleted: false };
      }

      if (existing.isSystem) {
        throw new EntityTypeProtectedError();
      }

      if (existing.worldId !== input.worldId) {
        return { deleted: false };
      }

      if (!repository.worldExists(input.worldId)) {
        return { deleted: false };
      }

      // Un tipo con fichas vivas no se borra: las fichas quedarían apuntando a
      // una plantilla lógicamente eliminada. La interfaz ofrece borrar o
      // cambiar esas fichas primero.
      if (repository.countEntitiesByType(input.id) > 0) {
        throw new EntityTypeInputError(
          'El tipo todavía tiene fichas asociadas.',
        );
      }

      return {
        deleted: repository.remove(input.id, input.worldId, now()),
      };
    },

    exportTypes(worldId) {
      requireWorld(worldId);

      return {
        version: ENTITY_TYPE_TRANSFER_VERSION,
        types: repository.listCustomByWorld(worldId).map(toTransferEntry),
      };
    },

    importTypes(worldId, payload) {
      requireWorld(worldId);
      const parsed = entityTypeTransferSchema.safeParse(payload);

      if (!parsed.success) {
        throw new EntityTypeInputError(
          'El bloque de tipos no tiene un formato válido.',
        );
      }

      // La clave de un tipo borrado sigue reservada para no reutilizarla en una
      // exportación anterior; por eso se comprueba contra la base completa.
      const collision = parsed.data.types.find(
        (type) => repository.findByKey(worldId, type.key) !== null,
      );

      if (collision !== undefined) {
        throw new EntityTypeInputError(
          'El mundo ya tiene un tipo con esa clave.',
        );
      }

      const at = now();
      const records = parsed.data.types.map((type) =>
        toRecord({ ...type, worldId }, at),
      );

      return write(() => {
        for (const record of records) {
          repository.insert(record);
        }

        return records.map(toSummary);
      });
    },

    copyFromWorld(sourceWorldId, targetWorldId, at) {
      for (const source of repository.listCustomByWorld(sourceWorldId)) {
        const key = uniqueEntityTypeKey(
          source.key,
          (candidate) =>
            repository.findByKey(targetWorldId, candidate) !== null,
        );
        repository.insert({
          id: generateId(),
          worldId: targetWorldId,
          key,
          name: source.name,
          icon: source.icon,
          color: source.color,
          fields: source.fields,
          isSystem: false,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        });
      }
    },
  };
}

/**
 * Servicio de sustitución cuando la base no está disponible (modo seguro).
 *
 * Cualquier llamada lanza y el router la convierte en `INTERNAL_ERROR`; la
 * interfaz muestra un estado de error en lugar de datos inventados.
 */
export function createUnavailableEntityTypesService(): EntityTypesService {
  const unavailable = (): never => {
    throw new Error(
      'Los tipos de entidad no están disponibles en modo seguro.',
    );
  };

  return {
    list: unavailable,
    create: unavailable,
    update: unavailable,
    duplicate: unavailable,
    remove: unavailable,
    exportTypes: unavailable,
    importTypes: unavailable,
    copyFromWorld: unavailable,
  };
}

function toSummary(record: EntityTypeRecord): EntityTypeSummary {
  return {
    id: record.id,
    worldId: record.worldId,
    key: record.key,
    name: record.name,
    icon: record.icon,
    color: record.color,
    isSystem: record.isSystem,
    fields: record.fields,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toTransferEntry(record: EntityTypeRecord): EntityTypeTransferEntry {
  return {
    key: record.key,
    name: record.name,
    icon: record.icon,
    color: record.color,
    fields: record.fields,
  };
}
