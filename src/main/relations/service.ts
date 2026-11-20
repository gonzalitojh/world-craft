/**
 * Servicio de dominio de las relaciones y de sus tipos.
 *
 * Orquesta validación, claves, timestamps y reglas de integridad sobre el
 * repositorio. No conoce Electron ni IPC: recibe la base compartida y devuelve
 * los tipos del contrato. El ID y el reloj se inyectan en las pruebas.
 *
 * Reglas:
 * - Una relación une dos fichas vivas del mismo mundo; no admite origen igual a
 *   destino ni duplicados exactos. Un tipo simétrico (mismo nombre directo e
 *   inverso) tampoco admite la arista inversa duplicada.
 * - El tipo es del sistema o de ese mismo mundo; los del sistema no se editan
 *   ni se borran.
 * - Las etiquetas vacías se guardan como `null` y la interfaz usa el nombre del
 *   tipo; la ficha de destino lee siempre la etiqueta inversa.
 * - Un tipo personalizado en uso no se borra: primero hay que eliminar sus
 *   relaciones.
 */
import {
  type RelationCreateInput,
  type RelationDeleteInput,
  type RelationDeleteResult,
  type RelationEdge,
  type RelationListInput,
  type RelationType,
  type RelationTypeCreateInput,
  type RelationTypeDeleteResult,
  type RelationTypeRemoveInput,
  type RelationTypeUpdateInput,
  type RelationUpdateInput,
} from '../../shared/contracts/relations';
import { systemRelationTypeOrder } from '../../shared/relations/catalog';
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { generateUuidv7 } from '../db/ids';
import { RelationInputError, RelationTypeProtectedError } from './errors';
import {
  createRelationRepository,
  type RelationEdgeRecord,
  type RelationEntityRecord,
  type RelationTypeRecord,
} from './repository';
import {
  normalizeRelationColor,
  normalizeRelationFilter,
  normalizeRelationLabel,
  normalizeRelationMetadata,
  normalizeRelationNotes,
  normalizeRelationStrength,
  normalizeRelationTypeInverseName,
  normalizeRelationTypeKey,
  normalizeRelationTypeName,
  slugifyRelationTypeName,
  uniqueRelationTypeKey,
} from './validation';

/** Servicio de relaciones. */
export interface RelationsService {
  listTypes(worldId: string): readonly RelationType[];
  createType(input: RelationTypeCreateInput): RelationType;
  updateType(input: RelationTypeUpdateInput): RelationType | null;
  removeType(input: RelationTypeRemoveInput): RelationTypeDeleteResult;
  list(input: RelationListInput): readonly RelationEdge[];
  create(input: RelationCreateInput): RelationEdge;
  update(input: RelationUpdateInput): RelationEdge | null;
  remove(input: RelationDeleteInput): RelationDeleteResult;
}

/** Opciones del servicio; todas las dependencias externas se inyectan. */
export interface RelationsServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
  readonly generateId?: () => string;
}

interface NormalizedRelationEditable {
  readonly label: string | null;
  readonly inverseLabel: string | null;
  readonly notes: string | null;
  readonly strength: number;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

/** Crea el servicio sobre la base compartida del proceso principal. */
export function createRelationsService(
  options: RelationsServiceOptions,
): RelationsService {
  const repository = createRelationRepository(options.database);
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  const write = <T>(operation: () => T): T =>
    options.sqlite.transaction(operation)();

  const requireWorld = (worldId: string): void => {
    if (!repository.worldExists(worldId)) {
      throw new RelationInputError('El mundo no existe o está en la papelera.');
    }
  };

  const requireType = (worldId: string, typeId: string): RelationTypeRecord => {
    const type = repository.findTypeById(worldId, typeId);

    if (type === null) {
      throw new RelationInputError(
        'El tipo de relación no existe en este mundo.',
      );
    }

    return type;
  };

  const requireEntity = (
    worldId: string,
    entityId: string,
    role: 'origen' | 'destino',
  ): RelationEntityRecord => {
    const entity = repository.findEntity(worldId, entityId);

    if (entity === null || entity.deletedAt !== null) {
      throw new RelationInputError(
        `La ficha de ${role} no existe o está en la papelera de este mundo.`,
      );
    }

    return entity;
  };

  const isSymmetric = (type: RelationTypeRecord): boolean =>
    type.name === type.inverseName;

  const assertNotDuplicate = (
    worldId: string,
    sourceId: string,
    targetId: string,
    type: RelationTypeRecord,
    excludeId?: string,
  ): void => {
    const duplicate = repository.findDuplicate(
      worldId,
      sourceId,
      targetId,
      type.id,
      excludeId,
    );

    if (duplicate !== null) {
      throw new RelationInputError('Esa relación ya existe.');
    }

    if (
      isSymmetric(type) &&
      repository.findDuplicate(
        worldId,
        targetId,
        sourceId,
        type.id,
        excludeId,
      ) !== null
    ) {
      throw new RelationInputError(
        'Esa relación simétrica ya existe en el sentido contrario.',
      );
    }
  };

  const normalizeEditable = (input: {
    readonly label?: string | null | undefined;
    readonly inverseLabel?: string | null | undefined;
    readonly notes?: string | null | undefined;
    readonly strength?: number | undefined;
    readonly metadata?:
      Readonly<Record<string, string | number | boolean>> | undefined;
  }): NormalizedRelationEditable => ({
    label: normalizeRelationLabel(input.label),
    inverseLabel: normalizeRelationLabel(input.inverseLabel),
    notes: normalizeRelationNotes(input.notes),
    strength: normalizeRelationStrength(input.strength),
    metadata: normalizeRelationMetadata(input.metadata),
  });

  const listOrderedTypes = (worldId: string): readonly RelationType[] => {
    const records = repository.listTypes(worldId);
    const system = records
      .filter((record) => record.isSystem)
      .sort(
        (left, right) =>
          systemRelationTypeOrder(left.key) -
            systemRelationTypeOrder(right.key) ||
          left.key.localeCompare(right.key),
      );
    const custom = records
      .filter((record) => !record.isSystem)
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name, 'es') ||
          left.key.localeCompare(right.key),
      );

    return [...system, ...custom].map(toRelationType);
  };

  return {
    listTypes(worldId) {
      return repository.worldExists(worldId) ? listOrderedTypes(worldId) : [];
    },

    createType(input) {
      requireWorld(input.worldId);
      const name = normalizeRelationTypeName(input.name);
      const inverseName = normalizeRelationTypeInverseName(input.inverseName);
      const color = normalizeRelationColor(input.color);
      const base =
        input.key !== undefined && input.key.trim().length > 0
          ? normalizeRelationTypeKey(input.key)
          : slugifyRelationTypeName(name);
      const key = uniqueRelationTypeKey(
        base,
        (candidate) =>
          repository.findTypeByKey(input.worldId, candidate) !== null,
      );
      const at = now();
      const record: RelationTypeRecord = {
        id: generateId(),
        worldId: input.worldId,
        key,
        name,
        inverseName,
        color,
        isSystem: false,
        createdAt: at,
        updatedAt: at,
      };

      write(() => {
        repository.insertType(record);
      });

      return toRelationType(record);
    },

    updateType(input) {
      const existing = repository.findTypeById(input.worldId, input.id);

      if (existing === null) {
        return null;
      }

      if (existing.isSystem) {
        throw new RelationTypeProtectedError();
      }

      if (existing.worldId !== input.worldId) {
        return null;
      }

      if (!repository.worldExists(input.worldId)) {
        return null;
      }

      const updated: RelationTypeRecord = {
        ...existing,
        name: normalizeRelationTypeName(input.name),
        inverseName: normalizeRelationTypeInverseName(input.inverseName),
        color: normalizeRelationColor(input.color),
        updatedAt: now(),
      };

      if (
        updated.name === existing.name &&
        updated.inverseName === existing.inverseName &&
        updated.color === existing.color
      ) {
        return toRelationType(existing);
      }

      repository.updateType(updated);

      return toRelationType(updated);
    },

    removeType(input) {
      const existing = repository.findTypeById(input.worldId, input.id);

      if (existing === null) {
        return { deleted: false };
      }

      if (existing.isSystem) {
        throw new RelationTypeProtectedError();
      }

      if (existing.worldId !== input.worldId) {
        return { deleted: false };
      }

      if (!repository.worldExists(input.worldId)) {
        return { deleted: false };
      }

      if (repository.countRelationsByType(existing.id) > 0) {
        throw new RelationInputError(
          'No se puede borrar un tipo de relación que todavía está en uso.',
        );
      }

      return {
        deleted: write(() => repository.deleteType(existing.id)),
      };
    },

    list(input) {
      if (!repository.worldExists(input.worldId)) {
        return [];
      }

      return repository
        .list(input.worldId, normalizeRelationFilter(input.filter))
        .map(toEdge);
    },

    create(input) {
      requireWorld(input.worldId);
      const source = requireEntity(input.worldId, input.sourceId, 'origen');
      const target = requireEntity(input.worldId, input.targetId, 'destino');

      if (source.id === target.id) {
        throw new RelationInputError(
          'Una ficha no puede relacionarse consigo misma.',
        );
      }

      const type = requireType(input.worldId, input.typeId);
      assertNotDuplicate(input.worldId, source.id, target.id, type);

      const editable = normalizeEditable(input);
      const at = now();
      const record: RelationEdgeRecord = {
        id: generateId(),
        worldId: input.worldId,
        typeId: type.id,
        typeKey: type.key,
        typeName: type.name,
        typeInverseName: type.inverseName,
        typeColor: type.color,
        isSystemType: type.isSystem,
        label: editable.label,
        inverseLabel: editable.inverseLabel,
        notes: editable.notes,
        strength: editable.strength,
        metadata: editable.metadata,
        source: toEntityRef(source),
        target: toEntityRef(target),
        createdAt: at,
        updatedAt: at,
      };

      write(() => {
        repository.insert(record);
      });

      return toEdge(record);
    },

    update(input) {
      const existing = repository.findById(input.worldId, input.id);

      if (existing === null) {
        return null;
      }

      const source = requireEntity(input.worldId, existing.source.id, 'origen');
      const target = requireEntity(
        input.worldId,
        existing.target.id,
        'destino',
      );
      const type = requireType(input.worldId, input.typeId);

      assertNotDuplicate(
        input.worldId,
        source.id,
        target.id,
        type,
        existing.id,
      );

      const editable = normalizeEditable(input);
      const updated: RelationEdgeRecord = {
        ...existing,
        typeId: type.id,
        typeKey: type.key,
        typeName: type.name,
        typeInverseName: type.inverseName,
        typeColor: type.color,
        isSystemType: type.isSystem,
        label: editable.label,
        inverseLabel: editable.inverseLabel,
        notes: editable.notes,
        strength: editable.strength,
        metadata: editable.metadata,
        source: toEntityRef(source),
        target: toEntityRef(target),
        updatedAt: now(),
      };

      return write(() => (repository.update(updated) ? toEdge(updated) : null));
    },

    remove(input) {
      return {
        deleted: write(() => repository.remove(input.worldId, input.id)),
      };
    },
  };
}

/**
 * Servicio de sustitución cuando la base no está disponible (modo seguro).
 *
 * Cualquier llamada lanza y el router la convierte en `INTERNAL_ERROR`; la
 * interfaz muestra un estado de error en lugar de datos inventados.
 */
export function createUnavailableRelationsService(): RelationsService {
  const unavailable = (): never => {
    throw new Error('Las relaciones no están disponibles en modo seguro.');
  };

  return {
    listTypes: unavailable,
    createType: unavailable,
    updateType: unavailable,
    removeType: unavailable,
    list: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
  };
}

function toRelationType(record: RelationTypeRecord): RelationType {
  return {
    id: record.id,
    worldId: record.worldId,
    key: record.key,
    name: record.name,
    inverseName: record.inverseName,
    color: record.color,
    isSystem: record.isSystem,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toEdge(record: RelationEdgeRecord): RelationEdge {
  return {
    id: record.id,
    worldId: record.worldId,
    typeId: record.typeId,
    typeKey: record.typeKey,
    typeName: record.typeName,
    typeInverseName: record.typeInverseName,
    typeColor: record.typeColor,
    isSystemType: record.isSystemType,
    label: record.label,
    inverseLabel: record.inverseLabel,
    notes: record.notes,
    strength: record.strength,
    metadata: record.metadata,
    source: record.source,
    target: record.target,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toEntityRef(entity: RelationEntityRecord): RelationEdge['source'] {
  return {
    id: entity.id,
    name: entity.name,
    typeKey: entity.typeKey,
    typeName: entity.typeName,
    typeIcon: entity.typeIcon,
    typeColor: entity.typeColor,
  };
}
