/**
 * Servicio de dominio del historial de versiones de la descripción.
 *
 * No conoce Electron ni IPC: recibe la base compartida, el reloj y el generador
 * de IDs. Agrupa las ráfagas de autoguardado, guarda versiones manuales con
 * etiqueta, restaura una versión conservando antes el estado actual y aplica la
 * poda de automáticas en cada escritura.
 *
 * Un fallo de negocio (`not-found`, `unchanged`, `manual-limit`) no lanza: se
 * devuelve como resultado para que la interfaz muestre un motivo claro sin
 * filtrar detalles internos.
 */
import {
  VERSION_LIST_LIMIT_DEFAULT,
  VERSION_LIST_LIMIT_MAX,
  VERSION_PREVIEW_MAX_LENGTH,
  type EntityVersionSummary,
  type VersionCreateInput,
  type VersionCreateResult,
  type VersionListInput,
  type VersionRestoreInput,
  type VersionRestoreResult,
} from '../../shared/contracts/versions';
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { generateUuidv7 } from '../db/ids';
import {
  canCreateManualVersion,
  selectExpiredVersionIds,
  shouldCreateAutoVersion,
} from './policy';
import {
  createVersionRepository,
  type VersionRecord,
  type VersionRepository,
} from './repository';

/** Servicio público del historial de versiones. */
export interface VersionsService {
  list(input: VersionListInput): readonly EntityVersionSummary[];
  create(input: VersionCreateInput): VersionCreateResult;
  restore(input: VersionRestoreInput): VersionRestoreResult;
}

/** Registro automático que ejecuta el servicio de fichas en su transacción. */
export interface VersionRecorder {
  recordBeforeChange(input: {
    readonly entityId: string;
    readonly description: string | null;
    readonly descriptionText: string | null;
    readonly at: number;
  }): void;
}

/** Opciones del servicio; todas las dependencias externas se inyectan. */
export interface VersionsServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
  readonly generateId?: () => string;
}

/** Crea el servicio y el registrador sobre la base compartida. */
export function createVersionsService(
  options: VersionsServiceOptions,
): VersionsService {
  const repository = createVersionRepository(options.database);
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  const write = <T>(operation: () => T): T =>
    options.sqlite.transaction(operation)();

  return {
    list(input) {
      const entity = repository.findEntity(input.worldId, input.entityId);

      if (entity === null || entity.deletedAt !== null) {
        return [];
      }

      const limit = clampLimit(input.limit);

      return repository.listByEntity(input.entityId, limit).map(toSummary);
    },

    create(input) {
      const entity = repository.findEntity(input.worldId, input.entityId);

      if (entity === null || entity.deletedAt !== null) {
        return { created: false, reason: 'not-found' };
      }

      const existing = repository.listAllByEntity(input.entityId);

      if (!canCreateManualVersion(existing)) {
        return { created: false, reason: 'manual-limit' };
      }

      const at = now();
      const record: VersionRecord = {
        id: generateId(),
        entityId: input.entityId,
        description: entity.description,
        descriptionText: entity.descriptionText,
        label: input.label.trim(),
        origin: 'manual',
        createdAt: at,
      };

      write(() => {
        repository.insert(record);
        prune(repository, input.entityId, at);
      });

      return { created: true, version: toSummary(record) };
    },

    restore(input) {
      return write((): VersionRestoreResult => {
        const entity = repository.findEntity(input.worldId, input.entityId);

        if (entity === null || entity.deletedAt !== null) {
          return { restored: false, reason: 'not-found' };
        }

        const version = repository.findVersion(input.entityId, input.versionId);

        if (version === null) {
          return { restored: false, reason: 'not-found' };
        }

        if (
          entity.description === version.description &&
          entity.descriptionText === version.descriptionText
        ) {
          return { restored: false, reason: 'unchanged' };
        }

        const at = now();

        // El estado actual se conserva antes de aplicar la versión elegida:
        // restaurar nunca destruye contenido de forma irreversible.
        repository.insert({
          id: generateId(),
          entityId: input.entityId,
          description: entity.description,
          descriptionText: entity.descriptionText,
          label: null,
          origin: 'restore',
          createdAt: at,
        });

        if (
          !repository.updateEntityDescription(
            input.worldId,
            input.entityId,
            version.description,
            version.descriptionText,
            at,
          )
        ) {
          return { restored: false, reason: 'not-found' };
        }

        prune(repository, input.entityId, at);

        return { restored: true };
      });
    },
  };
}

/**
 * Crea el registrador que usa `entities.update` dentro de su transacción.
 *
 * Guarda el estado saliente solo si la descripción es no vacía y la última
 * versión no está dentro de la ventana de agrupación. No abre transacción: la
 * comparte con la actualización de la ficha.
 */
export function createVersionRecorder(
  options: VersionsServiceOptions,
): VersionRecorder {
  const repository = createVersionRepository(options.database);
  const generateId = options.generateId ?? generateUuidv7;

  return {
    recordBeforeChange({ entityId, description, descriptionText, at }) {
      // Una descripción vacía no tiene contenido que perder.
      if (description === null) {
        return;
      }

      const latest = repository.findLatest(entityId);

      if (!shouldCreateAutoVersion(latest, at)) {
        return;
      }

      repository.insert({
        id: generateId(),
        entityId,
        description,
        descriptionText,
        label: null,
        origin: 'auto',
        createdAt: at,
      });

      prune(repository, entityId, at);
    },
  };
}

/** Servicio de sustitución cuando la base no está disponible (modo seguro). */
export function createUnavailableVersionsService(): VersionsService {
  const unavailable = (): never => {
    throw new Error(
      'El historial de versiones no está disponible en modo seguro.',
    );
  };

  return {
    list: unavailable,
    create: unavailable,
    restore: unavailable,
  };
}

function prune(
  repository: VersionRepository,
  entityId: string,
  at: number,
): void {
  const versions = repository.listAllByEntity(entityId);
  const expired = selectExpiredVersionIds(versions, at);

  repository.deleteByIds(expired);
}

function toSummary(record: VersionRecord): EntityVersionSummary {
  return {
    id: record.id,
    entityId: record.entityId,
    origin: record.origin,
    label: record.label,
    createdAt: record.createdAt,
    descriptionTextPreview: (record.descriptionText ?? '').slice(
      0,
      VERSION_PREVIEW_MAX_LENGTH,
    ),
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return VERSION_LIST_LIMIT_DEFAULT;
  }

  return Math.min(VERSION_LIST_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
}
