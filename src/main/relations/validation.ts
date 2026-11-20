/**
 * Normalización y validación de relaciones y de sus tipos.
 *
 * La interfaz valida para dar mensajes por campo, pero el proceso principal es
 * la frontera de confianza: repite todas las reglas antes de escribir. Las
 * etiquetas vacías se normalizan a `null` para que la interfaz use el nombre
 * del tipo y no muestre un hueco.
 */
import {
  RELATION_LABEL_MAX_LENGTH,
  RELATION_LIST_LIMIT_DEFAULT,
  RELATION_LIST_LIMIT_MAX,
  RELATION_METADATA_JSON_MAX_LENGTH,
  RELATION_METADATA_KEY_MAX_LENGTH,
  RELATION_METADATA_MAX_KEYS,
  RELATION_METADATA_VALUE_MAX_LENGTH,
  RELATION_NOTES_MAX_LENGTH,
  RELATION_STRENGTH_MAX,
  RELATION_STRENGTH_MIN,
  RELATION_TYPE_KEY_MAX_LENGTH,
  RELATION_TYPE_KEY_PATTERN,
  RELATION_TYPE_NAME_MAX_LENGTH,
  isRelationMetadata,
  type RelationColor,
  type RelationListFilter,
  type RelationMetadataValue,
} from '../../shared/contracts/relations';
import { isEntityTypeColor } from '../../shared/contracts/entity-types';
import { isSystemRelationTypeKey } from '../../shared/relations/catalog';
import { RelationInputError } from './errors';

/** Filtro normalizado que recibe el repositorio. */
export interface NormalizedRelationFilter {
  readonly entityId?: string | undefined;
  readonly typeId?: string | undefined;
  readonly limit: number;
}

/** Normaliza el nombre directo de un tipo de relación. */
export function normalizeRelationTypeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new RelationInputError('El nombre del tipo es obligatorio.');
  }

  if (name.length > RELATION_TYPE_NAME_MAX_LENGTH) {
    throw new RelationInputError('El nombre del tipo es demasiado largo.');
  }

  return name;
}

/** Normaliza la etiqueta inversa de un tipo de relación. */
export function normalizeRelationTypeInverseName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new RelationInputError(
      'La etiqueta inversa del tipo es obligatoria.',
    );
  }

  if (name.length > RELATION_TYPE_NAME_MAX_LENGTH) {
    throw new RelationInputError(
      'La etiqueta inversa del tipo es demasiado larga.',
    );
  }

  return name;
}

/** Convierte un nombre en una clave canónica de tipo de relación. */
export function slugifyRelationTypeName(name: string): string {
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, RELATION_TYPE_KEY_MAX_LENGTH)
    .replace(/-+$/, '');

  if (key.length === 0) {
    throw new RelationInputError(
      'El nombre no permite generar una clave; usa letras o números.',
    );
  }

  return key;
}

/** Comprueba y normaliza una clave escrita de tipo de relación. */
export function normalizeRelationTypeKey(raw: string): string {
  const key = raw.trim().toLowerCase();

  if (key.length === 0 || key.length > RELATION_TYPE_KEY_MAX_LENGTH) {
    throw new RelationInputError(
      'La clave del tipo no tiene una longitud válida.',
    );
  }

  if (!RELATION_TYPE_KEY_PATTERN.test(key)) {
    throw new RelationInputError(
      'La clave solo admite minúsculas, números y guiones simples.',
    );
  }

  if (isSystemRelationTypeKey(key)) {
    throw new RelationInputError(
      'Esa clave pertenece a un tipo del sistema; elige otra.',
    );
  }

  return key;
}

/** Devuelve una clave libre dentro del mundo y del catálogo del sistema. */
export function uniqueRelationTypeKey(
  base: string,
  exists: (key: string) => boolean,
): string {
  const isTaken = (candidate: string): boolean =>
    isSystemRelationTypeKey(candidate) || exists(candidate);

  if (!isTaken(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= 9_999; suffix += 1) {
    const suffixText = `-${suffix}`;
    const head = base
      .slice(0, RELATION_TYPE_KEY_MAX_LENGTH - suffixText.length)
      .replace(/-+$/, '');
    const candidate = `${head}${suffixText}`;

    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  throw new RelationInputError('No hay ninguna clave libre para el tipo.');
}

/** Normaliza el token de color contra la paleta cerrada. */
export function normalizeRelationColor(raw: string): RelationColor {
  if (!isEntityTypeColor(raw)) {
    throw new RelationInputError('El color del tipo no está admitido.');
  }

  return raw;
}

/**
 * Normaliza una etiqueta opcional.
 *
 * Una cadena vacía o solo espacios significa «sin sobrescritura» y se guarda
 * como `null`; la interfaz mostrará el nombre del tipo.
 */
export function normalizeRelationLabel(
  raw: string | null | undefined,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const label = raw.trim().replace(/\s+/g, ' ');

  if (label.length === 0) {
    return null;
  }

  if (label.length > RELATION_LABEL_MAX_LENGTH) {
    throw new RelationInputError(
      'La etiqueta de la relación es demasiado larga.',
    );
  }

  return label;
}

/** Normaliza las notas opcionales. */
export function normalizeRelationNotes(
  raw: string | null | undefined,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const notes = raw.trim();

  if (notes.length === 0) {
    return null;
  }

  if (notes.length > RELATION_NOTES_MAX_LENGTH) {
    throw new RelationInputError(
      'Las notas de la relación son demasiado largas.',
    );
  }

  return notes;
}

/** Normaliza la fuerza de la relación al rango 1–5. */
export function normalizeRelationStrength(raw: number | undefined): number {
  if (raw === undefined) {
    return RELATION_STRENGTH_MIN;
  }

  if (
    !Number.isInteger(raw) ||
    raw < RELATION_STRENGTH_MIN ||
    raw > RELATION_STRENGTH_MAX
  ) {
    throw new RelationInputError(
      'La fuerza de la relación debe estar entre 1 y 5.',
    );
  }

  return raw;
}

/**
 * Valida y copia los metadatos.
 *
 * Solo se admiten valores string, number y boolean, con claves acotadas y un
 * JSON resultante que no crezca sin control. No se interpreta ningún HTML.
 */
export function normalizeRelationMetadata(
  raw: Readonly<Record<string, RelationMetadataValue>> | undefined,
): Readonly<Record<string, RelationMetadataValue>> {
  const metadata = raw ?? {};

  if (!isRelationMetadata(metadata)) {
    throw new RelationInputError(
      'Los metadatos de la relación no son válidos.',
    );
  }

  const keys = Object.keys(metadata);

  if (keys.length > RELATION_METADATA_MAX_KEYS) {
    throw new RelationInputError('La relación tiene demasiados metadatos.');
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (
      key.trim().length === 0 ||
      key.length > RELATION_METADATA_KEY_MAX_LENGTH
    ) {
      throw new RelationInputError(
        'Una clave de metadatos no tiene una longitud válida.',
      );
    }

    if (
      typeof value === 'string' &&
      value.length > RELATION_METADATA_VALUE_MAX_LENGTH
    ) {
      throw new RelationInputError('Un valor de metadatos es demasiado largo.');
    }
  }

  if (JSON.stringify(metadata).length > RELATION_METADATA_JSON_MAX_LENGTH) {
    throw new RelationInputError(
      'Los metadatos de la relación son demasiado grandes.',
    );
  }

  return { ...metadata };
}

/** Normaliza el filtro de la lista de relaciones. */
export function normalizeRelationFilter(
  filter: RelationListFilter | undefined,
): NormalizedRelationFilter {
  const limit = filter?.limit ?? RELATION_LIST_LIMIT_DEFAULT;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new RelationInputError('El límite de relaciones no es válido.');
  }

  return {
    entityId: filter?.entityId,
    typeId: filter?.typeId,
    limit: Math.min(limit, RELATION_LIST_LIMIT_MAX),
  };
}
