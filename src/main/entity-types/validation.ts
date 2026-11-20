/**
 * Normalización y validación de los tipos de entidad.
 *
 * La interfaz valida para dar mensajes por campo, pero el proceso principal es
 * la frontera de confianza: repite todas las reglas antes de escribir. La
 * plantilla se valida con el mismo esquema Zod que usa la interfaz, de modo que
 * una clave repetida o una opción inválida no llega a la base.
 */
import { isSystemEntityTypeKey } from '../../shared/entity-types/catalog';
import { entityFieldTemplateSchema } from '../../shared/entity-types/fields';
import {
  ENTITY_TYPE_FIELDS_MAX,
  ENTITY_TYPE_KEY_MAX_LENGTH,
  ENTITY_TYPE_KEY_PATTERN,
  ENTITY_TYPE_NAME_MAX_LENGTH,
  isEntityTypeColor,
  isEntityTypeIcon,
  type EntityFieldDefinition,
  type EntityTypeColor,
  type EntityTypeIcon,
} from '../../shared/contracts/entity-types';
import { EntityTypeInputError } from './errors';

/** Normaliza el nombre visible de un tipo. */
export function normalizeEntityTypeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new EntityTypeInputError('El nombre del tipo es obligatorio.');
  }

  if (name.length > ENTITY_TYPE_NAME_MAX_LENGTH) {
    throw new EntityTypeInputError('El nombre del tipo es demasiado largo.');
  }

  return name;
}

/** Convierte un nombre en una clave canónica de tipo. */
export function slugifyEntityTypeName(name: string): string {
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, ENTITY_TYPE_KEY_MAX_LENGTH)
    .replace(/-+$/, '');

  if (key.length === 0) {
    throw new EntityTypeInputError(
      'El nombre no permite generar una clave; usa letras o números.',
    );
  }

  return key;
}

/** Comprueba y normaliza una clave escrita o importada. */
export function normalizeEntityTypeKey(raw: string): string {
  const key = raw.trim().toLowerCase();

  if (key.length === 0 || key.length > ENTITY_TYPE_KEY_MAX_LENGTH) {
    throw new EntityTypeInputError(
      'La clave del tipo no tiene una longitud válida.',
    );
  }

  if (!ENTITY_TYPE_KEY_PATTERN.test(key)) {
    throw new EntityTypeInputError(
      'La clave solo admite minúsculas, números y guiones simples.',
    );
  }

  if (isSystemEntityTypeKey(key)) {
    throw new EntityTypeInputError(
      'Esa clave pertenece a un tipo del sistema; elige otra.',
    );
  }

  return key;
}

/**
 * Devuelve una clave libre dentro del mundo.
 *
 * Las claves del sistema se consideran ocupadas para que una ficha y una
 * exportación no confundan un tipo personalizado con un tipo del catálogo.
 */
export function uniqueEntityTypeKey(
  base: string,
  exists: (key: string) => boolean,
): string {
  const isTaken = (candidate: string): boolean =>
    isSystemEntityTypeKey(candidate) || exists(candidate);

  if (!isTaken(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= 9_999; suffix += 1) {
    const suffixText = `-${suffix}`;
    const head = base
      .slice(0, ENTITY_TYPE_KEY_MAX_LENGTH - suffixText.length)
      .replace(/-+$/, '');
    const candidate = `${head}${suffixText}`;

    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  throw new EntityTypeInputError('No hay ninguna clave libre para el tipo.');
}

/** Normaliza el icono contra la lista cerrada. */
export function normalizeEntityTypeIcon(raw: string): EntityTypeIcon {
  if (!isEntityTypeIcon(raw)) {
    throw new EntityTypeInputError('El icono del tipo no está admitido.');
  }

  return raw;
}

/** Normaliza el token de color contra la paleta cerrada. */
export function normalizeEntityTypeColor(raw: string): EntityTypeColor {
  if (!isEntityTypeColor(raw)) {
    throw new EntityTypeInputError('El color del tipo no está admitido.');
  }

  return raw;
}

/** Valida la plantilla de campos y devuelve una copia normalizada. */
export function normalizeEntityFieldTemplate(
  raw: readonly EntityFieldDefinition[],
): readonly EntityFieldDefinition[] {
  const parsed = entityFieldTemplateSchema.safeParse(raw);

  if (!parsed.success) {
    throw new EntityTypeInputError(
      'La plantilla de campos del tipo no es válida.',
    );
  }

  // El límite vive también en Zod; se repite aquí para que un cambio de
  // esquema no permita una plantilla gigantesca por accidente.
  if (parsed.data.length > ENTITY_TYPE_FIELDS_MAX) {
    throw new EntityTypeInputError('El tipo tiene demasiados campos.');
  }

  return parsed.data as readonly EntityFieldDefinition[];
}

/** Campos editables de un tipo personalizado. */
export interface EditableEntityTypeFields {
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
}

/** Normaliza todos los campos editables de una entrada. */
export function normalizeEditableEntityType(
  input: EditableEntityTypeFields,
): EditableEntityTypeFields {
  return {
    name: normalizeEntityTypeName(input.name),
    icon: normalizeEntityTypeIcon(input.icon),
    color: normalizeEntityTypeColor(input.color),
    fields: normalizeEntityFieldTemplate(input.fields),
  };
}
