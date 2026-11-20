/**
 * Normalización de los campos de una ficha y sus etiquetas.
 *
 * La interfaz valida para dar mensajes por campo, pero el proceso principal es
 * la frontera de confianza: repite todas las reglas antes de escribir.
 */
import {
  ENTITY_ALIAS_MAX_LENGTH,
  ENTITY_ALIASES_MAX,
  ENTITY_LIST_LIMIT_DEFAULT,
  ENTITY_LIST_LIMIT_MAX,
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SEARCH_MAX_LENGTH,
  ENTITY_SLUG_MAX_LENGTH,
  ENTITY_STATUSES,
  ENTITY_SUMMARY_MAX_LENGTH,
  ENTITY_TAG_NAME_MAX_LENGTH,
  isEntityStatus,
  type EntityListFilter,
  type EntityStatus,
} from '../../shared/contracts/entities';
import {
  isEntityTypeColor,
  type EntityTypeColor,
} from '../../shared/contracts/entity-types';
import { EntityInputError } from './errors';

const MAX_SLUG_SUFFIX = 9_999;

/** Normaliza el nombre visible. */
export function normalizeEntityName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new EntityInputError('El nombre de la ficha es obligatorio.');
  }

  if (name.length > ENTITY_NAME_MAX_LENGTH) {
    throw new EntityInputError('El nombre de la ficha es demasiado largo.');
  }

  return name;
}

/** Normaliza la lista de alias y elimina duplicados sin distinguir mayúsculas. */
export function normalizeEntityAliases(
  raw: readonly string[] | undefined,
): readonly string[] {
  if (raw === undefined) {
    return [];
  }

  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    const alias = value.trim().replace(/\s+/g, ' ');

    if (alias.length === 0) {
      continue;
    }

    if (alias.length > ENTITY_ALIAS_MAX_LENGTH) {
      throw new EntityInputError('Un alias es demasiado largo.');
    }

    const key = alias.toLocaleLowerCase('es');

    if (!seen.has(key)) {
      seen.add(key);
      aliases.push(alias);
    }
  }

  if (aliases.length > ENTITY_ALIASES_MAX) {
    throw new EntityInputError('La ficha tiene demasiados alias.');
  }

  return aliases;
}

/** Normaliza el resumen de una línea; vacío se guarda como `null`. */
export function normalizeEntitySummary(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const summary = raw.trim().replace(/\s+/g, ' ');

  if (summary.length === 0) {
    return null;
  }

  if (summary.length > ENTITY_SUMMARY_MAX_LENGTH) {
    throw new EntityInputError('El resumen de la ficha es demasiado largo.');
  }

  return summary;
}

/** Normaliza el estado; sin valor se usa `active`. */
export function normalizeEntityStatus(raw: string | undefined): EntityStatus {
  if (raw === undefined) {
    return 'active';
  }

  if (!isEntityStatus(raw)) {
    throw new EntityInputError('El estado de la ficha no está admitido.');
  }

  return raw;
}

/** Normaliza el filtro de la lista y acota el límite. */
export function normalizeEntityFilter(raw: EntityListFilter | undefined): {
  readonly typeId?: string | undefined;
  readonly tagId?: string | undefined;
  readonly favorite?: boolean | undefined;
  readonly status?: EntityStatus | undefined;
  readonly search?: string | undefined;
  readonly limit: number;
} {
  const search = raw?.search?.trim();

  if (search !== undefined && search.length > ENTITY_SEARCH_MAX_LENGTH) {
    throw new EntityInputError('La búsqueda es demasiado larga.');
  }

  if (raw?.status !== undefined && !isEntityStatus(raw.status)) {
    throw new EntityInputError('El estado del filtro no está admitido.');
  }

  const requested = raw?.limit ?? ENTITY_LIST_LIMIT_DEFAULT;

  return {
    typeId: raw?.typeId,
    tagId: raw?.tagId,
    favorite: raw?.favorite,
    status: raw?.status,
    search: search !== undefined && search.length > 0 ? search : undefined,
    limit: Math.min(Math.max(Math.trunc(requested), 1), ENTITY_LIST_LIMIT_MAX),
  };
}

/** Normaliza el nombre visible de una etiqueta. */
export function normalizeTagName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new EntityInputError('El nombre de la etiqueta es obligatorio.');
  }

  if (name.length > ENTITY_TAG_NAME_MAX_LENGTH) {
    throw new EntityInputError('El nombre de la etiqueta es demasiado largo.');
  }

  return name;
}

/** Normaliza el token de color de una etiqueta. */
export function normalizeTagColor(raw: string): EntityTypeColor {
  if (!isEntityTypeColor(raw)) {
    throw new EntityInputError('El color de la etiqueta no está admitido.');
  }

  return raw;
}

/** Convierte un nombre en un slug canónico. */
export function slugifyEntityName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, ENTITY_SLUG_MAX_LENGTH)
    .replace(/-+$/, '');

  if (slug.length === 0) {
    throw new EntityInputError(
      'El nombre no permite generar un identificador; usa letras o números.',
    );
  }

  return slug;
}

/** Devuelve un slug libre dentro del mundo, incluidas las fichas en papelera. */
export function uniqueEntitySlug(
  base: string,
  exists: (slug: string) => boolean,
): string {
  if (!exists(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
    const suffixText = `-${suffix}`;
    const head = base
      .slice(0, ENTITY_SLUG_MAX_LENGTH - suffixText.length)
      .replace(/-+$/, '');
    const candidate = `${head}${suffixText}`;

    if (!exists(candidate)) {
      return candidate;
    }
  }

  throw new EntityInputError(
    'No hay ningún identificador libre para la ficha.',
  );
}

/** Estados admitidos, exportados para las pruebas y la interfaz. */
export const ENTITY_STATUS_VALUES = ENTITY_STATUSES;
