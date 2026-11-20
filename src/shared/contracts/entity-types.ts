/**
 * Contrato compartido de los tipos de entidad.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida las entradas con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * Un tipo puede ser del sistema (`worldId` nulo e `isSystem` verdadero) o
 * personalizado de un mundo. Los tipos del sistema se definen en código y se
 * siembran en la base; nunca se editan ni se borran desde la aplicación.
 *
 * Los valores variables de una ficha se guardan como JSON y se validan con la
 * plantilla del tipo (`fields`). Aquí solo viven la forma y los límites.
 */
import type { IpcResult } from './result';

/** Tipos de campo admitidos en una plantilla. */
export const ENTITY_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'reference',
] as const;

export type EntityFieldType = (typeof ENTITY_FIELD_TYPES)[number];

/**
 * Iconos Lucide admitidos.
 *
 * La lista es cerrada para que un tipo no pueda pedir un icono que la interfaz
 * no sabe dibujar y para que la exportación sea portable entre versiones.
 */
export const ENTITY_TYPE_ICONS = [
  'book-open',
  'building-2',
  'calendar-days',
  'church',
  'compass',
  'cpu',
  'crown',
  'dna',
  'flag',
  'gem',
  'languages',
  'leaf',
  'lightbulb',
  'map-pin',
  'package',
  'palette',
  'paw-print',
  'scroll',
  'shield',
  'skull',
  'sparkles',
  'star',
  'sun',
  'swords',
  'tent',
  'user-round',
  'users',
  'waves',
  'wind',
  'zap',
] as const;

export type EntityTypeIcon = (typeof ENTITY_TYPE_ICONS)[number];

/**
 * Tokens de color admitidos.
 *
 * No se guardan colores libres: la interfaz los resuelve con la paleta del
 * sistema de diseño, que ya está verificada en los dos temas. El color nunca es
 * el único indicador de un tipo; siempre acompaña a icono y nombre.
 */
export const ENTITY_TYPE_COLORS = [
  'moss',
  'ochre',
  'danger',
  'prussian',
] as const;

export type EntityTypeColor = (typeof ENTITY_TYPE_COLORS)[number];

/** Límites compartidos por la validación del main y la interfaz. */
export const ENTITY_TYPE_NAME_MAX_LENGTH = 80;
export const ENTITY_TYPE_KEY_MAX_LENGTH = 60;
export const ENTITY_TYPE_FIELDS_MAX = 30;
export const ENTITY_FIELD_KEY_MAX_LENGTH = 40;
export const ENTITY_FIELD_LABEL_MAX_LENGTH = 80;
export const ENTITY_SELECT_OPTIONS_MAX = 30;
export const ENTITY_SELECT_OPTION_VALUE_MAX_LENGTH = 40;
export const ENTITY_SELECT_OPTION_LABEL_MAX_LENGTH = 80;
export const ENTITY_TEXT_MAX_LENGTH = 4_000;
export const ENTITY_REFERENCE_VALUE_MAX_LENGTH = 64;

/** Versión del formato de transferencia de tipos de un mundo. */
export const ENTITY_TYPE_TRANSFER_VERSION = 1;

/** Patrón de una clave de tipo o de campo: minúsculas, números y guiones. */
export const ENTITY_TYPE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Base común de todos los campos. */
export interface EntityFieldBase {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
}

/** Campo de texto libre. */
export interface EntityTextFieldDefinition extends EntityFieldBase {
  readonly type: 'text';
  readonly maxLength?: number | undefined;
}

/** Campo numérico con rango opcional. */
export interface EntityNumberFieldDefinition extends EntityFieldBase {
  readonly type: 'number';
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

/** Campo de fecha ISO (`AAAA-MM-DD`). */
export interface EntityDateFieldDefinition extends EntityFieldBase {
  readonly type: 'date';
}

/** Opción visible de un campo de selección. */
export interface EntitySelectOption {
  readonly value: string;
  readonly label: string;
}

/** Campo de selección con opciones cerradas. */
export interface EntitySelectFieldDefinition extends EntityFieldBase {
  readonly type: 'select';
  readonly options: readonly EntitySelectOption[];
}

/** Campo que referencia otra ficha por su identificador. */
export interface EntityReferenceFieldDefinition extends EntityFieldBase {
  readonly type: 'reference';
  /** Clave del tipo de destino; si falta, se admite cualquier tipo. */
  readonly targetTypeKey?: string | undefined;
}

/** Unión de todos los campos de una plantilla. */
export type EntityFieldDefinition =
  | EntityTextFieldDefinition
  | EntityNumberFieldDefinition
  | EntityDateFieldDefinition
  | EntitySelectFieldDefinition
  | EntityReferenceFieldDefinition;

/** Tipo de entidad tal como lo consume la interfaz. */
export interface EntityTypeSummary {
  readonly id: string;
  /** `null` en los tipos del sistema; el mundo en los personalizados. */
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly isSystem: boolean;
  readonly fields: readonly EntityFieldDefinition[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Datos para crear un tipo personalizado. */
export interface EntityTypeCreateInput {
  readonly worldId: string;
  readonly name: string;
  readonly key?: string | undefined;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
}

/** Datos para actualizar un tipo personalizado; la clave no cambia. */
export interface EntityTypeUpdateInput {
  readonly worldId: string;
  readonly id: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
}

/** Datos para duplicar un tipo en un mundo con otro nombre. */
export interface EntityTypeDuplicateInput {
  readonly worldId: string;
  readonly id: string;
  readonly name: string;
}

/** Datos para borrar un tipo personalizado. */
export interface EntityTypeRemoveInput {
  readonly worldId: string;
  readonly id: string;
}

/** Resultado de borrar un tipo personalizado. */
export interface EntityTypeDeleteResult {
  readonly deleted: boolean;
}

/** Tipo exportable, sin identificadores internos ni mundo de origen. */
export interface EntityTypeTransferEntry {
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
}

/** Formato versionado para exportar e importar los tipos de un mundo. */
export interface EntityTypeTransfer {
  readonly version: typeof ENTITY_TYPE_TRANSFER_VERSION;
  readonly types: readonly EntityTypeTransferEntry[];
}

/** API tipada de tipos de entidad expuesta por el preload. */
export interface WorldCraftEntityTypesApi {
  readonly list: (
    worldId: string,
  ) => Promise<IpcResult<readonly EntityTypeSummary[]>>;
  readonly create: (
    input: EntityTypeCreateInput,
  ) => Promise<IpcResult<EntityTypeSummary>>;
  readonly update: (
    input: EntityTypeUpdateInput,
  ) => Promise<IpcResult<EntityTypeSummary | null>>;
  readonly duplicate: (
    input: EntityTypeDuplicateInput,
  ) => Promise<IpcResult<EntityTypeSummary | null>>;
  readonly remove: (
    input: EntityTypeRemoveInput,
  ) => Promise<IpcResult<EntityTypeDeleteResult>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Indica si un valor es un tipo de campo admitido. */
export function isEntityFieldType(value: unknown): value is EntityFieldType {
  return (
    typeof value === 'string' &&
    (ENTITY_FIELD_TYPES as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un icono admitido. */
export function isEntityTypeIcon(value: unknown): value is EntityTypeIcon {
  return (
    typeof value === 'string' &&
    (ENTITY_TYPE_ICONS as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un token de color admitido. */
export function isEntityTypeColor(value: unknown): value is EntityTypeColor {
  return (
    typeof value === 'string' &&
    (ENTITY_TYPE_COLORS as readonly string[]).includes(value)
  );
}

/** Comprueba una opción de selección. */
export function isEntitySelectOption(
  value: unknown,
): value is EntitySelectOption {
  return (
    isRecord(value) &&
    typeof value.value === 'string' &&
    typeof value.label === 'string'
  );
}

/**
 * Comprueba la forma de un campo.
 *
 * No sustituye a la validación Zod del proceso principal: solo impide que una
 * respuesta manipulada o de otra versión llegue al renderer con una forma
 * distinta de la esperada.
 */
export function isEntityFieldDefinition(
  value: unknown,
): value is EntityFieldDefinition {
  if (
    !isRecord(value) ||
    typeof value.key !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.required !== 'boolean' ||
    !isEntityFieldType(value.type)
  ) {
    return false;
  }

  switch (value.type) {
    case 'text':
      return (
        value.maxLength === undefined || typeof value.maxLength === 'number'
      );
    case 'number':
      return (
        (value.min === undefined || typeof value.min === 'number') &&
        (value.max === undefined || typeof value.max === 'number')
      );
    case 'date':
      return true;
    case 'select':
      return (
        Array.isArray(value.options) &&
        value.options.every(isEntitySelectOption)
      );
    case 'reference':
      return (
        value.targetTypeKey === undefined ||
        typeof value.targetTypeKey === 'string'
      );
    default:
      return false;
  }
}

/** Comprueba la forma de un tipo de entidad. */
export function isEntityTypeSummary(
  value: unknown,
): value is EntityTypeSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    (value.worldId === null || typeof value.worldId === 'string') &&
    typeof value.key === 'string' &&
    typeof value.name === 'string' &&
    isEntityTypeIcon(value.icon) &&
    isEntityTypeColor(value.color) &&
    typeof value.isSystem === 'boolean' &&
    Array.isArray(value.fields) &&
    value.fields.every(isEntityFieldDefinition) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

/** Comprueba la forma de una lista de tipos de entidad. */
export function isEntityTypeList(
  value: unknown,
): value is readonly EntityTypeSummary[] {
  return Array.isArray(value) && value.every(isEntityTypeSummary);
}

/** Comprueba la forma del resultado de borrado. */
export function isEntityTypeDeleteResult(
  value: unknown,
): value is EntityTypeDeleteResult {
  return isRecord(value) && typeof value.deleted === 'boolean';
}
