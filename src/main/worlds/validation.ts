/**
 * Normalización y validación de los campos de un mundo.
 *
 * La interfaz valida para dar mensajes por campo, pero el proceso principal es
 * la frontera de confianza: repite todas las reglas antes de escribir. Los
 * textos se recortan, los espacios repetidos se colapsan y los géneros se
 * deduplican sin distinguir mayúsculas.
 */
import {
  isWorldLanguage,
  WORLD_DESCRIPTION_MAX_LENGTH,
  WORLD_GENRE_MAX_LENGTH,
  WORLD_GENRES_MAX,
  WORLD_NAME_MAX_LENGTH,
  WORLD_SUMMARY_MAX_LENGTH,
  type WorldLanguage,
} from '../../shared/contracts/worlds';
import { WorldInputError } from './errors';

/**
 * Normaliza el nombre visible.
 *
 * Es obligatorio y no puede quedar compuesto solo por espacios; el límite
 * coincide con el `CHECK` de SQLite para que el error llegue antes de escribir.
 */
export function normalizeWorldName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new WorldInputError('El nombre del mundo es obligatorio.');
  }

  if (name.length > WORLD_NAME_MAX_LENGTH) {
    throw new WorldInputError('El nombre del mundo es demasiado largo.');
  }

  return name;
}

/** Normaliza el resumen de una línea; vacío se guarda como `null`. */
export function normalizeWorldSummary(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const summary = raw.trim().replace(/\s+/g, ' ');

  if (summary.length === 0) {
    return null;
  }

  if (summary.length > WORLD_SUMMARY_MAX_LENGTH) {
    throw new WorldInputError('El resumen es demasiado largo.');
  }

  return summary;
}

/** Normaliza la descripción en texto plano; vacía se guarda como `null`. */
export function normalizeWorldDescription(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const description = raw.trim();

  if (description.length === 0) {
    return null;
  }

  if (description.length > WORLD_DESCRIPTION_MAX_LENGTH) {
    throw new WorldInputError('La descripción es demasiado larga.');
  }

  return description;
}

/**
 * Normaliza la lista de géneros.
 *
 * Se recortan, se descartan los vacíos y se eliminan duplicados sin distinguir
 * mayúsculas; el primero conserva su forma visible. Los límites coinciden con
 * los de la interfaz para que un cliente manipulado no pueda saltárselos.
 */
export function normalizeWorldGenres(
  raw: readonly string[] | undefined,
): readonly string[] {
  if (raw === undefined) {
    return [];
  }

  const genres: string[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    const genre = value.trim().replace(/\s+/g, ' ');

    if (genre.length === 0) {
      continue;
    }

    if (genre.length > WORLD_GENRE_MAX_LENGTH) {
      throw new WorldInputError('Un género es demasiado largo.');
    }

    const key = genre.toLocaleLowerCase('es');

    if (!seen.has(key)) {
      seen.add(key);
      genres.push(genre);
    }
  }

  if (genres.length > WORLD_GENRES_MAX) {
    throw new WorldInputError('Hay demasiados géneros.');
  }

  return genres;
}

/** Normaliza el idioma del contenido; el de reserva es el español. */
export function normalizeWorldLanguage(raw: string | undefined): WorldLanguage {
  if (raw === undefined) {
    return 'es';
  }

  if (!isWorldLanguage(raw)) {
    throw new WorldInputError('El idioma del mundo no está admitido.');
  }

  return raw;
}
