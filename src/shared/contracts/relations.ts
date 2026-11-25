/**
 * Contrato compartido de las relaciones entre fichas.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida la entrada con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * Una relación es una arista dirigida entre dos fichas del mismo mundo. Su tipo
 * define la etiqueta directa y la inversa; la relación puede sobrescribirlas.
 * La ficha de destino muestra la arista entrante con la etiqueta inversa, que es
 * el backlink navegable.
 */
import type { IpcResult } from './result';
import {
  isEntityTypeColor,
  isEntityTypeIcon,
  type EntityTypeColor,
  type EntityTypeIcon,
} from './entity-types';

/** Tokens de color admitidos en los tipos de relación. */
export type RelationColor = EntityTypeColor;

/** Límites compartidos por la validación del main y la interfaz. */
export const RELATION_TYPE_NAME_MAX_LENGTH = 80;
export const RELATION_TYPE_KEY_MAX_LENGTH = 60;
export const RELATION_LABEL_MAX_LENGTH = 80;
export const RELATION_NOTES_MAX_LENGTH = 2_000;
export const RELATION_STRENGTH_MIN = 1;
export const RELATION_STRENGTH_MAX = 5;
export const RELATION_METADATA_MAX_KEYS = 20;
export const RELATION_METADATA_KEY_MAX_LENGTH = 40;
export const RELATION_METADATA_VALUE_MAX_LENGTH = 500;
export const RELATION_METADATA_JSON_MAX_LENGTH = 10_000;
export const RELATION_LIST_LIMIT_DEFAULT = 500;
export const RELATION_LIST_LIMIT_MAX = 2_000;

/** Versión del formato de transferencia de tipos de relación de un mundo. */
export const RELATION_TYPE_TRANSFER_VERSION = 1;

/** Patrón de la clave de un tipo de relación: minúsculas, números y guiones. */
export const RELATION_TYPE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Tipo de relación del sistema o personalizado de un mundo. */
export interface RelationType {
  readonly id: string;
  /** `null` en los tipos del sistema; el mundo en los personalizados. */
  readonly worldId: string | null;
  readonly key: string;
  /** Etiqueta directa, la que se lee desde la ficha de origen. */
  readonly name: string;
  /** Etiqueta inversa, la que se lee desde la ficha de destino. */
  readonly inverseName: string;
  readonly color: RelationColor;
  readonly isSystem: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Datos para crear un tipo de relación personalizado. */
export interface RelationTypeCreateInput {
  readonly worldId: string;
  readonly name: string;
  readonly inverseName: string;
  readonly key?: string | undefined;
  readonly color: RelationColor;
}

/** Datos para actualizar un tipo de relación personalizado; la clave no cambia. */
export interface RelationTypeUpdateInput {
  readonly worldId: string;
  readonly id: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: RelationColor;
}

/** Datos para borrar un tipo de relación personalizado. */
export interface RelationTypeRemoveInput {
  readonly worldId: string;
  readonly id: string;
}

/** Resultado de borrar un tipo de relación personalizado. */
export interface RelationTypeDeleteResult {
  readonly deleted: boolean;
}

/** Referencia mínima de una ficha dentro de una arista. */
export interface RelationEntityRef {
  readonly id: string;
  readonly name: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeIcon: EntityTypeIcon;
  readonly typeColor: EntityTypeColor;
}

/** Valor admitido en los metadatos de una relación. */
export type RelationMetadataValue = string | number | boolean;

/** Arista resuelta entre dos fichas, con su tipo y sus etiquetas. */
export interface RelationEdge {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeInverseName: string;
  readonly typeColor: RelationColor;
  readonly isSystemType: boolean;
  /** Sobrescritura de la etiqueta directa; si es `null`, se usa `typeName`. */
  readonly label: string | null;
  /** Sobrescritura de la etiqueta inversa; si es `null`, se usa `typeInverseName`. */
  readonly inverseLabel: string | null;
  readonly notes: string | null;
  readonly strength: number;
  readonly metadata: Readonly<Record<string, RelationMetadataValue>>;
  readonly source: RelationEntityRef;
  readonly target: RelationEntityRef;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Filtro de la lista de relaciones de un mundo. */
export interface RelationListFilter {
  readonly entityId?: string | undefined;
  readonly typeId?: string | undefined;
  readonly limit?: number | undefined;
}

/** Datos para listar las relaciones de un mundo. */
export interface RelationListInput {
  readonly worldId: string;
  readonly filter?: RelationListFilter | undefined;
}

/**
 * Datos para crear una relación.
 *
 * Origen y destino son fichas vivas del mismo mundo. `strength` es la fuerza o
 * importancia de 1 a 5; si falta, se usa 1. Las etiquetas y los metadatos son
 * opcionales.
 */
export interface RelationCreateInput {
  readonly worldId: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly typeId: string;
  readonly label?: string | null | undefined;
  readonly inverseLabel?: string | null | undefined;
  readonly notes?: string | null | undefined;
  readonly strength?: number | undefined;
  readonly metadata?:
    Readonly<Record<string, RelationMetadataValue>> | undefined;
}

/**
 * Datos para actualizar una relación.
 *
 * Es un reemplazo completo de los campos editables; el origen y el destino no
 * cambian. El tipo sí puede cambiar y se vuelve a validar la duplicidad.
 */
export interface RelationUpdateInput {
  readonly worldId: string;
  readonly id: string;
  readonly typeId: string;
  readonly label: string | null;
  readonly inverseLabel: string | null;
  readonly notes: string | null;
  readonly strength: number;
  readonly metadata: Readonly<Record<string, RelationMetadataValue>>;
}

/** Datos para eliminar una relación. */
export interface RelationDeleteInput {
  readonly worldId: string;
  readonly id: string;
}

/** Resultado de eliminar una relación. */
export interface RelationDeleteResult {
  readonly deleted: boolean;
}

/** Tipo de relación exportable, sin identificadores internos ni mundo. */
export interface RelationTypeTransferEntry {
  readonly key: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: RelationColor;
}

/** Formato versionado para exportar e importar los tipos de relación. */
export interface RelationTypeTransfer {
  readonly version: typeof RELATION_TYPE_TRANSFER_VERSION;
  readonly types: readonly RelationTypeTransferEntry[];
}

/** Etiqueta directa efectiva de una arista. */
export function relationForwardLabel(edge: RelationEdge): string {
  return edge.label ?? edge.typeName;
}

/** Etiqueta inversa efectiva de una arista: la que ve la ficha de destino. */
export function relationBackwardLabel(edge: RelationEdge): string {
  return edge.inverseLabel ?? edge.typeInverseName;
}

/** API tipada de tipos de relación expuesta por el preload. */
export interface WorldCraftRelationTypesApi {
  readonly list: (
    worldId: string,
  ) => Promise<IpcResult<readonly RelationType[]>>;
  readonly create: (
    input: RelationTypeCreateInput,
  ) => Promise<IpcResult<RelationType>>;
  readonly update: (
    input: RelationTypeUpdateInput,
  ) => Promise<IpcResult<RelationType | null>>;
  readonly remove: (
    input: RelationTypeRemoveInput,
  ) => Promise<IpcResult<RelationTypeDeleteResult>>;
}

/** API tipada de relaciones expuesta por el preload. */
export interface WorldCraftRelationsApi {
  readonly list: (
    input: RelationListInput,
  ) => Promise<IpcResult<readonly RelationEdge[]>>;
  readonly create: (
    input: RelationCreateInput,
  ) => Promise<IpcResult<RelationEdge>>;
  readonly update: (
    input: RelationUpdateInput,
  ) => Promise<IpcResult<RelationEdge | null>>;
  readonly remove: (
    input: RelationDeleteInput,
  ) => Promise<IpcResult<RelationDeleteResult>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isMetadataValue(value: unknown): value is RelationMetadataValue {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** Comprueba la forma de los metadatos de una relación. */
export function isRelationMetadata(
  value: unknown,
): value is Readonly<Record<string, RelationMetadataValue>> {
  return (
    isRecord(value) &&
    Object.keys(value).length <= RELATION_METADATA_MAX_KEYS &&
    Object.entries(value).every(
      ([key, entry]) =>
        key.length <= RELATION_METADATA_KEY_MAX_LENGTH &&
        isMetadataValue(entry),
    )
  );
}

/** Comprueba la forma de un tipo de relación. */
export function isRelationType(value: unknown): value is RelationType {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.worldId === null || typeof value.worldId === 'string') &&
    typeof value.key === 'string' &&
    typeof value.name === 'string' &&
    typeof value.inverseName === 'string' &&
    isEntityTypeColor(value.color) &&
    typeof value.isSystem === 'boolean' &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

/** Comprueba la forma de una lista de tipos de relación. */
export function isRelationTypeList(
  value: unknown,
): value is readonly RelationType[] {
  return Array.isArray(value) && value.every(isRelationType);
}

/** Comprueba la forma de la referencia a una ficha dentro de una arista. */
export function isRelationEntityRef(
  value: unknown,
): value is RelationEntityRef {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.typeKey === 'string' &&
    typeof value.typeName === 'string' &&
    isEntityTypeIcon(value.typeIcon) &&
    isEntityTypeColor(value.typeColor)
  );
}

/** Comprueba la forma de una arista de relación. */
export function isRelationEdge(value: unknown): value is RelationEdge {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.worldId === 'string' &&
    typeof value.typeId === 'string' &&
    typeof value.typeKey === 'string' &&
    typeof value.typeName === 'string' &&
    typeof value.typeInverseName === 'string' &&
    isEntityTypeColor(value.typeColor) &&
    typeof value.isSystemType === 'boolean' &&
    (value.label === null || typeof value.label === 'string') &&
    (value.inverseLabel === null || typeof value.inverseLabel === 'string') &&
    (value.notes === null || typeof value.notes === 'string') &&
    typeof value.strength === 'number' &&
    Number.isInteger(value.strength) &&
    value.strength >= RELATION_STRENGTH_MIN &&
    value.strength <= RELATION_STRENGTH_MAX &&
    isRelationMetadata(value.metadata) &&
    isRelationEntityRef(value.source) &&
    isRelationEntityRef(value.target) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

/** Comprueba la forma de una lista de aristas. */
export function isRelationEdgeList(
  value: unknown,
): value is readonly RelationEdge[] {
  return Array.isArray(value) && value.every(isRelationEdge);
}

/** Comprueba la forma de una entrada de transferencia de tipos de relación. */
export function isRelationTypeTransferEntry(
  value: unknown,
): value is RelationTypeTransferEntry {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.name === 'string' &&
    typeof value.inverseName === 'string' &&
    isEntityTypeColor(value.color)
  );
}

/** Comprueba la forma del bloque de transferencia de tipos de relación. */
export function isRelationTypeTransfer(
  value: unknown,
): value is RelationTypeTransfer {
  return (
    isRecord(value) &&
    value.version === RELATION_TYPE_TRANSFER_VERSION &&
    Array.isArray(value.types) &&
    value.types.every(isRelationTypeTransferEntry)
  );
}

/** Comprueba la forma del resultado de borrar un tipo de relación. */
export function isRelationTypeDeleteResult(
  value: unknown,
): value is RelationTypeDeleteResult {
  return isRecord(value) && typeof value.deleted === 'boolean';
}

/** Comprueba la forma del resultado de eliminar una relación. */
export function isRelationDeleteResult(
  value: unknown,
): value is RelationDeleteResult {
  return isRecord(value) && typeof value.deleted === 'boolean';
}
