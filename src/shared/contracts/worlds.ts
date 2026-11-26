/**
 * Contrato compartido de los mundos.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida las entradas con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * Los textos visibles no viven aquí: el renderer los resuelve con su catálogo y
 * el proceso principal solo devuelve datos.
 */
import type {
  EntityRichTextDocument,
  EntityRichTextMark,
  EntityRichTextNode,
} from './entities';
import type { IpcResult } from './result';

/** Estados visibles de un mundo. La papelera se guarda aparte con `deleted_at`. */
export const WORLD_STATUSES = ['active', 'archived'] as const;

export type WorldStatus = (typeof WORLD_STATUSES)[number];

/** Idiomas admitidos para el contenido de un mundo. */
export const WORLD_LANGUAGES = ['es', 'en', 'it'] as const;

export type WorldLanguage = (typeof WORLD_LANGUAGES)[number];

/** Límites compartidos por la validación del main y la interfaz. */
export const WORLD_NAME_MAX_LENGTH = 120;
export const WORLD_SLUG_MAX_LENGTH = 80;
export const WORLD_SUMMARY_MAX_LENGTH = 280;
/** Límite del texto plano extraído de la descripción del mundo. */
export const WORLD_DESCRIPTION_TEXT_MAX_LENGTH = 4_000;
/** Límite del JSON de ProseMirror que guarda la descripción del mundo. */
export const WORLD_DESCRIPTION_JSON_MAX_LENGTH = 200_000;
export const WORLD_GENRES_MAX = 8;
export const WORLD_GENRE_MAX_LENGTH = 40;
export const WORLD_ACTIVITY_LIMIT_DEFAULT = 12;
export const WORLD_ACTIVITY_LIMIT_MAX = 50;

/** Patrón canónico de un slug: minúsculas, números y guiones simples. */
export const WORLD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Acciones que se registran en `activity_log` para un mundo. */
export const WORLD_ACTIVITY_ACTIONS = [
  'world.created',
  'world.updated',
  'world.archived',
  'world.restored',
  'world.duplicated',
  'world.deleted',
  'world.imported',
] as const;

export type WorldActivityAction = (typeof WORLD_ACTIVITY_ACTIONS)[number];

/** Documento ProseMirror de la descripción enriquecida del mundo. */
export type WorldRichTextDocument = EntityRichTextDocument;

/** Resumen de un mundo para listas y tarjetas. */
export interface WorldSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly genres: readonly string[];
  readonly language: WorldLanguage;
  readonly status: WorldStatus;
  readonly coverAssetId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly archivedAt: number | null;
}

/** Mundo completo para su página de detalle. */
export interface WorldDetail extends WorldSummary {
  readonly description: WorldRichTextDocument | null;
}

/** Entrada del registro de actividad, con el nombre del mundo resuelto. */
export interface WorldActivityEntry {
  readonly id: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly action: WorldActivityAction;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly createdAt: number;
}

/** Datos editables al crear un mundo. */
export interface WorldCreateInput {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly summary?: string | null | undefined;
  readonly description?: WorldRichTextDocument | null | undefined;
  readonly genres?: readonly string[] | undefined;
  readonly language?: WorldLanguage | undefined;
}

/** Datos editables al actualizar un mundo. */
export interface WorldUpdateInput extends WorldCreateInput {
  readonly id: string;
}

/** Datos para duplicar un mundo. */
export interface WorldDuplicateInput {
  readonly id: string;
  /** Nombre del mundo nuevo; el slug se genera a partir de él. */
  readonly name: string;
}

/** Cambio de estado de archivo. */
export interface WorldSetArchivedInput {
  readonly id: string;
  readonly archived: boolean;
}

/** Filtro del registro de actividad. */
export interface WorldActivityFilter {
  /** Si falta, se listan las actividades de todos los mundos visibles. */
  readonly worldId?: string | undefined;
  readonly limit?: number | undefined;
}

/** Resultado de mover un mundo a la papelera. */
export interface WorldDeleteResult {
  readonly deleted: boolean;
}

/** API tipada de mundos expuesta por el preload. */
export interface WorldCraftWorldsApi {
  readonly list: () => Promise<IpcResult<readonly WorldSummary[]>>;
  readonly get: (id: string) => Promise<IpcResult<WorldDetail | null>>;
  readonly create: (input: WorldCreateInput) => Promise<IpcResult<WorldDetail>>;
  readonly update: (
    input: WorldUpdateInput,
  ) => Promise<IpcResult<WorldDetail | null>>;
  readonly duplicate: (
    input: WorldDuplicateInput,
  ) => Promise<IpcResult<WorldDetail | null>>;
  readonly setArchived: (
    input: WorldSetArchivedInput,
  ) => Promise<IpcResult<WorldDetail | null>>;
  readonly remove: (id: string) => Promise<IpcResult<WorldDeleteResult>>;
  readonly listActivity: (
    filter?: WorldActivityFilter,
  ) => Promise<IpcResult<readonly WorldActivityEntry[]>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value);
}

/** Indica si un valor es un estado de mundo admitido. */
export function isWorldStatus(value: unknown): value is WorldStatus {
  return (
    typeof value === 'string' &&
    (WORLD_STATUSES as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un idioma de mundo admitido. */
export function isWorldLanguage(value: unknown): value is WorldLanguage {
  return (
    typeof value === 'string' &&
    (WORLD_LANGUAGES as readonly string[]).includes(value)
  );
}

/** Indica si un valor es una acción de actividad de mundo conocida. */
export function isWorldActivityAction(
  value: unknown,
): value is WorldActivityAction {
  return (
    typeof value === 'string' &&
    (WORLD_ACTIVITY_ACTIONS as readonly string[]).includes(value)
  );
}

/** Comprueba la forma de un resumen de mundo. */
export function isWorldSummary(value: unknown): value is WorldSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string' &&
    (value.summary === null || typeof value.summary === 'string') &&
    Array.isArray(value.genres) &&
    value.genres.every((genre) => typeof genre === 'string') &&
    isWorldLanguage(value.language) &&
    isWorldStatus(value.status) &&
    (value.coverAssetId === null || typeof value.coverAssetId === 'string') &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    isNullableTimestamp(value.archivedAt)
  );
}

/** Comprueba la forma de un mundo completo. */
export function isWorldDetail(value: unknown): value is WorldDetail {
  if (!isWorldSummary(value)) {
    return false;
  }

  const description = (value as unknown as Record<string, unknown>).description;

  return description === null || isWorldRichTextDocument(description);
}

/** Comprueba la forma estructural de un documento de descripción de mundo. */
export function isWorldRichTextDocument(
  value: unknown,
): value is WorldRichTextDocument {
  if (!isRecord(value) || value.type !== 'doc') {
    return false;
  }

  if (value.content === undefined) {
    return true;
  }

  return Array.isArray(value.content) && value.content.every(isRichTextNode);
}

function isRichTextNode(value: unknown): value is EntityRichTextNode {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  if (value.text !== undefined && typeof value.text !== 'string') {
    return false;
  }

  if (value.marks !== undefined) {
    if (
      !Array.isArray(value.marks) ||
      !value.marks.every(isRichTextMark)
    ) {
      return false;
    }
  }

  if (value.content !== undefined) {
    if (
      !Array.isArray(value.content) ||
      !value.content.every(isRichTextNode)
    ) {
      return false;
    }
  }

  return true;
}

function isRichTextMark(value: unknown): value is EntityRichTextMark {
  return isRecord(value) && typeof value.type === 'string';
}

/** Comprueba la forma de una entrada de actividad. */
export function isWorldActivityEntry(
  value: unknown,
): value is WorldActivityEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.worldId === 'string' &&
    typeof value.worldName === 'string' &&
    isWorldActivityAction(value.action) &&
    typeof value.entityType === 'string' &&
    (value.entityId === null || typeof value.entityId === 'string') &&
    isTimestamp(value.createdAt)
  );
}

/** Comprueba la forma de una lista de resúmenes de mundo. */
export function isWorldSummaryList(
  value: unknown,
): value is readonly WorldSummary[] {
  return Array.isArray(value) && value.every(isWorldSummary);
}

/** Comprueba la forma de una lista de actividad. */
export function isWorldActivityList(
  value: unknown,
): value is readonly WorldActivityEntry[] {
  return Array.isArray(value) && value.every(isWorldActivityEntry);
}

/** Comprueba la forma del resultado de borrado lógico. */
export function isWorldDeleteResult(
  value: unknown,
): value is WorldDeleteResult {
  return isRecord(value) && typeof value.deleted === 'boolean';
}
