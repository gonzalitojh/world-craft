/**
 * Servicio de dominio de la papelera.
 *
 * Lista los tres grupos, restaura a su mundo y tipo de origen con motivos de
 * dominio explícitos, y purga de forma definitiva después de crear una copia
 * recuperable. Una única cola serializa las purgas y el vaciado para que nunca
 * se solapen dos copias ni dos borrados.
 *
 * El borrado físico de un mundo respeta `activity_log` y el resto de claves
 * foráneas; los metadatos de sus assets no usados se mueven a
 * `assets_quarantine` y los archivos nunca se borran desde la papelera.
 */
import type {
  TrashEmptyInput,
  TrashEmptyResult,
  TrashEntityItem,
  TrashEntityTypeItem,
  TrashListInput,
  TrashPage,
  TrashPurgeInput,
  TrashPurgeResult,
  TrashRestoreInput,
  TrashRestoreResult,
  TrashWorldItem,
} from '../../shared/contracts/trash';
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import {
  countExternalAssetReferences,
  resolvePurgeableWorlds,
} from './asset-references';
import {
  createTrashRepository,
  type TrashEntityTypeTarget,
  type TrashEntityTarget,
  type TrashWorldTarget,
} from './repository';
import {
  nextTrashCursor,
  normalizeTrashLimit,
  parseTrashCursor,
} from './validation';

/** Creador de la copia previa; devuelve `false` si no se pudo verificar. */
export type SafetyCopyCreator = (timestamp: number) => Promise<boolean>;

/** Servicio público de la papelera. */
export interface TrashService {
  list(input: TrashListInput): TrashPage;
  restore(input: TrashRestoreInput): TrashRestoreResult;
  purge(input: TrashPurgeInput): Promise<TrashPurgeResult>;
  empty(input: TrashEmptyInput): Promise<TrashEmptyResult>;
}

/** Opciones del servicio; todas las dependencias externas se inyectan. */
export interface TrashServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
  /** Sin copia verificable no se borra nada. */
  readonly createSafetyCopy?: SafetyCopyCreator;
}

/** Crea el servicio sobre la base compartida del proceso principal. */
export function createTrashService(options: TrashServiceOptions): TrashService {
  const repository = createTrashRepository(options.database, options.sqlite);
  const now = options.now ?? Date.now;
  const createSafetyCopy: SafetyCopyCreator =
    options.createSafetyCopy ?? (async () => false);
  const write = <T>(operation: () => T): T =>
    options.sqlite.transaction(operation)();

  let tail: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };

  const restoreWorld = (target: TrashWorldTarget): TrashRestoreResult => {
    if (target.deletedAt === null) {
      return { restored: false, reason: 'already-restored' };
    }

    return repository.restoreWorld(target.id, now())
      ? { restored: true }
      : { restored: false, reason: 'not-found' };
  };

  const restoreEntity = (target: TrashEntityTarget): TrashRestoreResult => {
    if (target.deletedAt === null) {
      return { restored: false, reason: 'already-restored' };
    }

    const world = repository.findWorld(target.worldId);

    if (world === null || world.deletedAt !== null) {
      return { restored: false, reason: 'world-in-trash' };
    }

    const type = repository.findEntityType(target.typeId);

    if (type === null || type.deletedAt !== null) {
      return { restored: false, reason: 'type-unavailable' };
    }

    if (!type.isSystem && type.worldId !== target.worldId) {
      return { restored: false, reason: 'type-unavailable' };
    }

    return repository.restoreEntity(target.id, now())
      ? { restored: true }
      : { restored: false, reason: 'not-found' };
  };

  const restoreEntityType = (
    target: TrashEntityTypeTarget,
  ): TrashRestoreResult => {
    if (target.deletedAt === null) {
      return { restored: false, reason: 'already-restored' };
    }

    if (target.isSystem || target.worldId === null) {
      return { restored: false, reason: 'type-unavailable' };
    }

    const world = repository.findWorld(target.worldId);

    if (world === null || world.deletedAt !== null) {
      return { restored: false, reason: 'world-in-trash' };
    }

    return repository.restoreEntityType(target.id, now())
      ? { restored: true }
      : { restored: false, reason: 'not-found' };
  };

  const precheckPurge = (
    kind: TrashPurgeInput['kind'],
    id: string,
  ): TrashPurgeResult | null => {
    switch (kind) {
      case 'world': {
        const target = repository.findWorld(id);

        if (target === null) {
          return { purged: false, reason: 'not-found' };
        }

        if (target.deletedAt === null) {
          return { purged: false, reason: 'already-purged' };
        }

        // El precheck evita crear una copia si el mundo no se puede purgar;
        // el servicio repite la comprobación dentro de la transacción.
        return countExternalAssetReferences(options.sqlite, id) > 0
          ? { purged: false, reason: 'assets-in-use' }
          : null;
      }
      case 'entity': {
        const target = repository.findEntity(id);

        if (target === null) {
          return { purged: false, reason: 'not-found' };
        }

        return target.deletedAt === null
          ? { purged: false, reason: 'already-purged' }
          : null;
      }
      case 'entityType': {
        const target = repository.findEntityType(id);

        if (target === null || target.isSystem) {
          return { purged: false, reason: 'not-found' };
        }

        if (target.deletedAt === null) {
          return { purged: false, reason: 'already-purged' };
        }

        return repository.countEntitiesByType(id) > 0
          ? { purged: false, reason: 'type-in-use' }
          : null;
      }
    }
  };

  const applyPurge = (
    kind: TrashPurgeInput['kind'],
    id: string,
    at: number,
  ): TrashPurgeResult => {
    switch (kind) {
      case 'world':
        return repository.purgeWorld(id, at)
          ? { purged: true }
          : { purged: false, reason: 'assets-in-use' };
      case 'entity':
        repository.purgeEntity(id);
        break;
      case 'entityType':
        repository.purgeEntityType(id);
        break;
    }

    return { purged: true };
  };

  return {
    list(input) {
      const limit = normalizeTrashLimit(input.limit);
      const cursor = parseTrashCursor(input.cursor);

      switch (input.group) {
        case 'worlds': {
          const rows = repository.listWorlds(cursor, limit);
          const items: TrashWorldItem[] = rows.map((row) => ({
            kind: 'world',
            id: row.id,
            name: row.name,
            deletedAt: row.deletedAt,
          }));

          return {
            items,
            nextCursor: nextTrashCursor(rows, limit),
          };
        }
        case 'entities': {
          const rows = repository.listEntities(cursor, limit);
          const items: TrashEntityItem[] = rows.map((row) => ({
            kind: 'entity',
            id: row.id,
            name: row.name,
            worldId: row.worldId,
            worldName: row.worldName,
            typeName: row.typeName,
            worldDeletedAt: row.worldDeletedAt,
            deletedAt: row.deletedAt,
          }));

          return {
            items,
            nextCursor: nextTrashCursor(rows, limit),
          };
        }
        case 'entityTypes': {
          const rows = repository.listEntityTypes(cursor, limit);
          const items: TrashEntityTypeItem[] = rows.map((row) => ({
            kind: 'entityType',
            id: row.id,
            name: row.name,
            worldId: row.worldId,
            worldName: row.worldName,
            key: row.key,
            worldDeletedAt: row.worldDeletedAt,
            deletedAt: row.deletedAt,
          }));

          return {
            items,
            nextCursor: nextTrashCursor(rows, limit),
          };
        }
      }
    },

    restore(input) {
      return write((): TrashRestoreResult => {
        switch (input.kind) {
          case 'world': {
            const target = repository.findWorld(input.id);
            return target === null
              ? { restored: false, reason: 'not-found' }
              : restoreWorld(target);
          }
          case 'entity': {
            const target = repository.findEntity(input.id);
            return target === null
              ? { restored: false, reason: 'not-found' }
              : restoreEntity(target);
          }
          case 'entityType': {
            const target = repository.findEntityType(input.id);
            return target === null
              ? { restored: false, reason: 'not-found' }
              : restoreEntityType(target);
          }
        }
      });
    },

    purge(input) {
      return enqueue(async (): Promise<TrashPurgeResult> => {
        const rejected = precheckPurge(input.kind, input.id);

        if (rejected !== null) {
          return rejected;
        }

        const at = now();

        // La copia se crea fuera de la transacción; el borrado posterior es
        // síncrono. Si la copia falla, no se borra nada.
        if (!(await createSafetyCopy(at))) {
          return { purged: false, reason: 'backup-failed' };
        }

        return write(() => {
          const recheck = precheckPurge(input.kind, input.id);

          return recheck ?? applyPurge(input.kind, input.id, at);
        });
      });
    },

    empty() {
      return enqueue(async (): Promise<TrashEmptyResult> => {
        const at = now();

        if (!(await createSafetyCopy(at))) {
          return {
            backup: 'failed',
            purged: { worlds: 0, entities: 0, entityTypes: 0 },
            skipped: 0,
          };
        }

        return write((): TrashEmptyResult => {
          let entities = 0;
          let worlds = 0;
          let entityTypes = 0;
          let skipped = 0;

          for (const id of repository.listDeletedEntityIds()) {
            repository.purgeEntity(id);
            entities += 1;
          }

          // Se decide el conjunto antes de tocar las portadas: una referencia
          // entre dos mundos que se vacían no bloquea, pero la de cualquier
          // superviviente sí. El punto fijo resuelve cadenas y ciclos.
          const worldIds = repository.listDeletedWorldIds();
          const worldPlan = resolvePurgeableWorlds(options.sqlite, worldIds);
          const purgeable = new Set(worldPlan.purgeable);

          for (const id of worldPlan.purgeable) {
            repository.clearWorldCover(id);
          }

          let remaining = [...worldPlan.purgeable];

          while (remaining.length > 0) {
            const retry: string[] = [];
            let progressed = false;

            for (const id of remaining) {
              if (repository.purgeWorld(id, at, purgeable)) {
                worlds += 1;
                progressed = true;
              } else {
                retry.push(id);
              }
            }

            if (!progressed) {
              skipped += retry.length;
              break;
            }

            remaining = retry;
          }

          skipped += worldPlan.blocked.length;

          for (const id of repository.listDeletedEntityTypeIds()) {
            if (repository.countEntitiesByType(id) > 0) {
              skipped += 1;
              continue;
            }

            repository.purgeEntityType(id);
            entityTypes += 1;
          }

          return {
            backup: 'created',
            purged: { worlds, entities, entityTypes },
            skipped,
          };
        });
      });
    },
  };
}

/** Servicio de sustitución cuando la base no está disponible (modo seguro). */
export function createUnavailableTrashService(): TrashService {
  const unavailable = (): never => {
    throw new Error('La papelera no está disponible en modo seguro.');
  };

  return {
    list: unavailable,
    restore: unavailable,
    purge: unavailable,
    empty: unavailable,
  };
}
