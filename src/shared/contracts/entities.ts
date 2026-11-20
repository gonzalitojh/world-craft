/**
 * Contrato compartido de las fichas y sus etiquetas.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida la entrada con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * Una ficha vive siempre dentro de un mundo, usa un tipo del sistema o uno
 * personalizado de ese mismo mundo y nunca puede referenciar imágenes,
 * etiquetas o fichas de otro mundo.
 */
import type { IpcResult } from './result';
import {
  isEntityTypeColor,
  isEntityTypeIcon,
  type EntityFieldDefinition,
  type EntityTypeColor,
  type EntityTypeIcon,
} from './entity-types';

/** Estados visibles de una ficha. La papelera se guarda con `deleted_at`. */
export const ENTITY_STATUSES = ['active', 'draft', 'archived'] as const;

export type EntityStatus = (typeof ENTITY_STATUSES)[number];

/** Tokens de color admitidos en las etiquetas. */
export type EntityTagColor = EntityTypeColor;

/** Límites compartidos por la validación del main y la interfaz. */
export const ENTITY_NAME_MAX_LENGTH = 120;
export const ENTITY_SLUG_MAX_LENGTH = 80;
export const ENTITY_ALIASES_MAX = 10;
export const ENTITY_ALIAS_MAX_LENGTH = 80;
export const ENTITY_SUMMARY_MAX_LENGTH = 280;
export const ENTITY_DESCRIPTION_TEXT_MAX_LENGTH = 50_000;
export const ENTITY_DESCRIPTION_JSON_MAX_LENGTH = 200_000;
export const ENTITY_TAGS_MAX = 12;
export const ENTITY_TAG_NAME_MAX_LENGTH = 40;
export const ENTITY_GALLERY_MAX = 20;
export const ENTITY_SEARCH_MAX_LENGTH = 200;
export const ENTITY_LIST_LIMIT_DEFAULT = 200;
export const ENTITY_LIST_LIMIT_MAX = 500;

/** Patrón del slug de una ficha: minúsculas, números y guiones simples. */
export const ENTITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Prefijo de los enlaces internos entre fichas dentro del editor. */
export const ENTITY_LINK_PREFIX = 'wc-entity://';

/** Etiqueta de color de un mundo. */
export interface EntityTag {
  readonly id: string;
  readonly worldId: string;
  readonly name: string;
  readonly color: EntityTagColor;
  readonly createdAt: number;
}

/** Imagen de la galería o imagen principal ya resuelta por el proceso principal. */
export interface EntityGalleryItem {
  readonly assetId: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
}

/** Documento de ProseMirror que representa la descripción enriquecida. */
export interface EntityRichTextMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
}

/** Nodo de ProseMirror. Solo se admiten los nodos de la lista cerrada. */
export interface EntityRichTextNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
  readonly content?: readonly EntityRichTextNode[] | undefined;
  readonly text?: string | undefined;
  readonly marks?: readonly EntityRichTextMark[] | undefined;
}

/** Documento raíz de una descripción. */
export interface EntityRichTextDocument {
  readonly type: 'doc';
  readonly content?: readonly EntityRichTextNode[] | undefined;
}

/** Resumen de una ficha para listas y tarjetas. */
export interface EntitySummary {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeIcon: EntityTypeIcon;
  readonly typeColor: EntityTypeColor;
  readonly name: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly summary: string | null;
  readonly imageAssetId: string | null;
  readonly isFavorite: boolean;
  readonly status: EntityStatus;
  readonly tags: readonly EntityTag[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Ficha completa para su detalle y edición. */
export interface EntityDetail extends EntitySummary {
  readonly description: EntityRichTextDocument | null;
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly gallery: readonly EntityGalleryItem[];
}

/** Filtro de la lista de fichas de un mundo. */
export interface EntityListFilter {
  readonly typeId?: string | undefined;
  readonly tagId?: string | undefined;
  readonly favorite?: boolean | undefined;
  readonly status?: EntityStatus | undefined;
  readonly search?: string | undefined;
  readonly limit?: number | undefined;
}

/** Datos para listar fichas de un mundo. */
export interface EntityListInput {
  readonly worldId: string;
  readonly filter?: EntityListFilter | undefined;
}

/** Datos editables al crear una ficha. */
export interface EntityCreateInput {
  readonly worldId: string;
  readonly typeId: string;
  readonly name: string;
  readonly aliases?: readonly string[] | undefined;
  readonly summary?: string | null | undefined;
  readonly description?: EntityRichTextDocument | null | undefined;
  readonly attributes?: Readonly<Record<string, unknown>> | undefined;
  readonly imageAssetId?: string | null | undefined;
  readonly galleryAssetIds?: readonly string[] | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly status?: EntityStatus | undefined;
  readonly isFavorite?: boolean | undefined;
}

/**
 * Datos editables al actualizar una ficha; el tipo no cambia.
 *
 * La actualización es un reemplazo completo: la interfaz de autoguardado envía
 * siempre todos los campos y el esquema IPC los exige. Así un payload
 * incompleto no puede vaciar la imagen, la galería o las etiquetas por error.
 */
export interface EntityUpdateInput {
  readonly worldId: string;
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly summary: string | null;
  readonly description: EntityRichTextDocument | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly imageAssetId: string | null;
  readonly galleryAssetIds: readonly string[];
  readonly tagIds: readonly string[];
  readonly status: EntityStatus;
}

/** Cambio de favorito. */
export interface EntitySetFavoriteInput {
  readonly worldId: string;
  readonly id: string;
  readonly favorite: boolean;
}

/** Datos para consultar una ficha. */
export interface EntityGetInput {
  readonly worldId: string;
  readonly id: string;
}

/** Datos para mover una ficha a la papelera. */
export interface EntityRemoveInput {
  readonly worldId: string;
  readonly id: string;
}

/** Resultado de mover una ficha a la papelera. */
export interface EntityDeleteResult {
  readonly deleted: boolean;
}

/** Datos para crear una etiqueta de un mundo. */
export interface EntityTagCreateInput {
  readonly worldId: string;
  readonly name: string;
  readonly color: EntityTagColor;
}

/** API tipada de fichas expuesta por el preload. */
export interface WorldCraftEntitiesApi {
  readonly list: (
    input: EntityListInput,
  ) => Promise<IpcResult<readonly EntitySummary[]>>;
  readonly get: (
    input: EntityGetInput,
  ) => Promise<IpcResult<EntityDetail | null>>;
  readonly create: (
    input: EntityCreateInput,
  ) => Promise<IpcResult<EntityDetail>>;
  readonly update: (
    input: EntityUpdateInput,
  ) => Promise<IpcResult<EntityDetail | null>>;
  readonly setFavorite: (
    input: EntitySetFavoriteInput,
  ) => Promise<IpcResult<EntityDetail | null>>;
  readonly remove: (
    input: EntityRemoveInput,
  ) => Promise<IpcResult<EntityDeleteResult>>;
}

/** API tipada de etiquetas expuesta por el preload. */
export interface WorldCraftTagsApi {
  readonly list: (worldId: string) => Promise<IpcResult<readonly EntityTag[]>>;
  readonly create: (
    input: EntityTagCreateInput,
  ) => Promise<IpcResult<EntityTag>>;
}

/** Tipo de un mundo resuelto para el formulario de ficha. */
export interface EntityTypeOption {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly isSystem: boolean;
  readonly fields: readonly EntityFieldDefinition[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Indica si un valor es un estado de ficha admitido. */
export function isEntityStatus(value: unknown): value is EntityStatus {
  return (
    typeof value === 'string' &&
    (ENTITY_STATUSES as readonly string[]).includes(value)
  );
}

/** Comprueba la forma de una etiqueta de color. */
export function isEntityTag(value: unknown): value is EntityTag {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.worldId === 'string' &&
    typeof value.name === 'string' &&
    isEntityTypeColor(value.color) &&
    isTimestamp(value.createdAt)
  );
}

/** Comprueba la forma de una lista de etiquetas. */
export function isEntityTagList(value: unknown): value is readonly EntityTag[] {
  return Array.isArray(value) && value.every(isEntityTag);
}

/** Comprueba la forma de una imagen de galería resuelta. */
export function isEntityGalleryItem(
  value: unknown,
): value is EntityGalleryItem {
  return (
    isRecord(value) &&
    typeof value.assetId === 'string' &&
    (value.width === null || typeof value.width === 'number') &&
    (value.height === null || typeof value.height === 'number') &&
    (value.alt === null || typeof value.alt === 'string')
  );
}

/** Comprueba la forma de un resumen de ficha. */
export function isEntitySummary(value: unknown): value is EntitySummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.worldId === 'string' &&
    typeof value.typeId === 'string' &&
    typeof value.typeKey === 'string' &&
    typeof value.typeName === 'string' &&
    isEntityTypeIcon(value.typeIcon) &&
    isEntityTypeColor(value.typeColor) &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string' &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === 'string') &&
    (value.summary === null || typeof value.summary === 'string') &&
    (value.imageAssetId === null || typeof value.imageAssetId === 'string') &&
    typeof value.isFavorite === 'boolean' &&
    isEntityStatus(value.status) &&
    Array.isArray(value.tags) &&
    value.tags.every(isEntityTag) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

/** Comprueba la forma de una ficha completa. */
export function isEntityDetail(value: unknown): value is EntityDetail {
  if (!isEntitySummary(value)) {
    return false;
  }

  const candidate = value as unknown as Record<string, unknown>;

  return (
    (candidate.description === null ||
      (isRecord(candidate.description) &&
        candidate.description.type === 'doc')) &&
    isRecord(candidate.attributes) &&
    Object.values(candidate.attributes).every(
      (entry) => typeof entry === 'string' || typeof entry === 'number',
    ) &&
    Array.isArray(candidate.gallery) &&
    candidate.gallery.every(isEntityGalleryItem)
  );
}

/** Comprueba la forma de una lista de fichas. */
export function isEntityList(
  value: unknown,
): value is readonly EntitySummary[] {
  return Array.isArray(value) && value.every(isEntitySummary);
}

/** Comprueba la forma del resultado de borrado. */
export function isEntityDeleteResult(
  value: unknown,
): value is EntityDeleteResult {
  return isRecord(value) && typeof value.deleted === 'boolean';
}
