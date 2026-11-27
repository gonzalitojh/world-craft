/**
 * Contrato compartido de la papelera.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida la entrada con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * La papelera agrupa mundos, fichas y tipos personalizados con borrado lógico
 * (`deleted_at`). Un elemento en papelera conserva su mundo y su tipo
 * originales: no se mueve a otra carpeta ni se reasigna. Restaurar devuelve el
 * elemento a su contexto y purgar lo elimina de forma definitiva tras crear una
 * copia recuperable de la base.
 */
import type { IpcResult } from './result';

/** Grupos visibles de la papelera, en el orden de la interfaz. */
export const TRASH_GROUPS = ['worlds', 'entities', 'entityTypes'] as const;

export type TrashGroup = (typeof TRASH_GROUPS)[number];

/** Tipos de elemento que pueden estar en la papelera. */
export const TRASH_KINDS = ['world', 'entity', 'entityType'] as const;

export type TrashKind = (typeof TRASH_KINDS)[number];

/** Límites de paginación por cursor. */
export const TRASH_PAGE_LIMIT_DEFAULT = 50;
export const TRASH_PAGE_LIMIT_MAX = 200;

/** Cursor opaco `${deletedAt}:${id}` de la paginación de papelera. */
export const TRASH_CURSOR_PATTERN = /^\d+:[0-9a-f-]{36}$/;

/** Literales que exige el proceso principal para las acciones destructivas. */
export const TRASH_PURGE_CONFIRMATION = 'delete-forever' as const;
export const TRASH_EMPTY_CONFIRMATION = 'empty-trash' as const;

/** Mundo en papelera. */
export interface TrashWorldItem {
  readonly kind: 'world';
  readonly id: string;
  readonly name: string;
  readonly deletedAt: number;
}

/** Ficha en papelera, con su mundo y tipo de origen resueltos. */
export interface TrashEntityItem {
  readonly kind: 'entity';
  readonly id: string;
  readonly name: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly typeName: string;
  /** Momento en que el mundo de origen entró en papelera; `null` si está vivo. */
  readonly worldDeletedAt: number | null;
  readonly deletedAt: number;
}

/** Tipo personalizado en papelera, con su mundo de origen resuelto. */
export interface TrashEntityTypeItem {
  readonly kind: 'entityType';
  readonly id: string;
  readonly name: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly key: string;
  /** Momento en que el mundo de origen entró en papelera; `null` si está vivo. */
  readonly worldDeletedAt: number | null;
  readonly deletedAt: number;
}

/** Un elemento de la papelera. */
export type TrashItem = TrashWorldItem | TrashEntityItem | TrashEntityTypeItem;

/** Página de un grupo de la papelera. */
export interface TrashPage {
  readonly items: readonly TrashItem[];
  readonly nextCursor: string | null;
}

/** Datos para listar un grupo de la papelera. */
export interface TrashListInput {
  readonly group: TrashGroup;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

/** Datos para restaurar un elemento. */
export interface TrashRestoreInput {
  readonly kind: TrashKind;
  readonly id: string;
}

/** Motivos de dominio por los que una restauración no se aplica. */
export type TrashRestoreFailure =
  'not-found' | 'already-restored' | 'world-in-trash' | 'type-unavailable';

/** Resultado de restaurar: o se restauró, o el motivo es explícito. */
export type TrashRestoreResult =
  | { readonly restored: true }
  | { readonly restored: false; readonly reason: TrashRestoreFailure };

/** Datos para purgar un elemento de forma definitiva. */
export interface TrashPurgeInput {
  readonly kind: TrashKind;
  readonly id: string;
  readonly confirm: typeof TRASH_PURGE_CONFIRMATION;
}

/** Motivos de dominio por los que una purga no se aplica. */
export type TrashPurgeFailure =
  | 'not-found'
  | 'already-purged'
  | 'type-in-use'
  | 'assets-in-use'
  | 'backup-failed';

/** Resultado de purgar: o se purgó, o el motivo es explícito. */
export type TrashPurgeResult =
  | { readonly purged: true }
  | { readonly purged: false; readonly reason: TrashPurgeFailure };

/** Datos para vaciar la papelera. */
export interface TrashEmptyInput {
  readonly confirm: typeof TRASH_EMPTY_CONFIRMATION;
}

/** Resultado del vaciado con los contadores de lo eliminado. */
export interface TrashEmptyResult {
  readonly backup: 'created' | 'failed';
  readonly purged: {
    readonly worlds: number;
    readonly entities: number;
    readonly entityTypes: number;
  };
  /**
   * Elementos en uso que no se pudieron purgar y se conservan: tipos con
   * fichas y mundos cuyas imágenes usan otros mundos o fichas.
   */
  readonly skipped: number;
}

/** API tipada de papelera expuesta por el preload. */
export interface WorldCraftTrashApi {
  readonly list: (input: TrashListInput) => Promise<IpcResult<TrashPage>>;
  readonly restore: (
    input: TrashRestoreInput,
  ) => Promise<IpcResult<TrashRestoreResult>>;
  readonly purge: (
    input: TrashPurgeInput,
  ) => Promise<IpcResult<TrashPurgeResult>>;
  readonly empty: (
    input: TrashEmptyInput,
  ) => Promise<IpcResult<TrashEmptyResult>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Indica si un valor es un grupo admitido. */
export function isTrashGroup(value: unknown): value is TrashGroup {
  return (
    typeof value === 'string' &&
    (TRASH_GROUPS as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un tipo de elemento admitido. */
export function isTrashKind(value: unknown): value is TrashKind {
  return (
    typeof value === 'string' &&
    (TRASH_KINDS as readonly string[]).includes(value)
  );
}

/** Comprueba la forma de un elemento de la papelera. */
export function isTrashItem(value: unknown): value is TrashItem {
  if (!isRecord(value) || !isTrashKind(value.kind)) {
    return false;
  }

  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return false;
  }

  if (!isTimestamp(value.deletedAt)) {
    return false;
  }

  if (value.kind === 'world') {
    return true;
  }

  return (
    typeof value.worldId === 'string' &&
    typeof value.worldName === 'string' &&
    (value.worldDeletedAt === null || isTimestamp(value.worldDeletedAt)) &&
    (value.kind === 'entity'
      ? typeof value.typeName === 'string'
      : typeof value.key === 'string')
  );
}

/** Comprueba la forma de una página de papelera. */
export function isTrashPage(value: unknown): value is TrashPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isTrashItem) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  );
}

/** Comprueba la forma del resultado de restaurar. */
export function isTrashRestoreResult(
  value: unknown,
): value is TrashRestoreResult {
  if (!isRecord(value) || typeof value.restored !== 'boolean') {
    return false;
  }

  if (value.restored) {
    return true;
  }

  return (
    value.reason === 'not-found' ||
    value.reason === 'already-restored' ||
    value.reason === 'world-in-trash' ||
    value.reason === 'type-unavailable'
  );
}

/** Comprueba la forma del resultado de purgar. */
export function isTrashPurgeResult(value: unknown): value is TrashPurgeResult {
  if (!isRecord(value) || typeof value.purged !== 'boolean') {
    return false;
  }

  if (value.purged) {
    return true;
  }

  return (
    value.reason === 'not-found' ||
    value.reason === 'already-purged' ||
    value.reason === 'type-in-use' ||
    value.reason === 'assets-in-use' ||
    value.reason === 'backup-failed'
  );
}

/** Comprueba la forma del resultado del vaciado. */
export function isTrashEmptyResult(value: unknown): value is TrashEmptyResult {
  if (!isRecord(value) || !isRecord(value.purged)) {
    return false;
  }

  return (
    (value.backup === 'created' || value.backup === 'failed') &&
    typeof value.skipped === 'number' &&
    Number.isInteger(value.skipped) &&
    value.skipped >= 0 &&
    typeof value.purged.worlds === 'number' &&
    typeof value.purged.entities === 'number' &&
    typeof value.purged.entityTypes === 'number'
  );
}
