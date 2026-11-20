/**
 * Generación y normalización de slugs de mundo.
 *
 * Un slug es estable, legible y seguro en rutas y exportaciones: solo
 * minúsculas, números y guiones simples. La unicidad se resuelve con un sufijo
 * numérico (`-2`, `-3`...) que nunca deja el slug por encima del límite.
 */
import {
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
} from '../../shared/contracts/worlds';
import { WorldInputError } from './errors';

const MAX_SLUG_SUFFIX = 9_999;

/**
 * Convierte un nombre en un slug canónico.
 *
 * Los diacríticos se separan con NFD y se eliminan, de modo que «Crónica de
 * las Mareas» se convierte en `cronica-de-las-mareas`. Si el resultado queda
 * vacío (solo signos o emojis) se lanza un error de entrada.
 */
export function slugifyWorldName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, WORLD_SLUG_MAX_LENGTH)
    .replace(/-+$/, '');

  if (slug.length === 0) {
    throw new WorldInputError(
      'El nombre no permite generar un identificador; usa letras o números.',
    );
  }

  return slug;
}

/** Comprueba y normaliza un slug escrito por el usuario. */
export function normalizeWorldSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();

  if (slug.length === 0 || slug.length > WORLD_SLUG_MAX_LENGTH) {
    throw new WorldInputError('El identificador no tiene una longitud válida.');
  }

  if (!WORLD_SLUG_PATTERN.test(slug)) {
    throw new WorldInputError(
      'El identificador solo admite minúsculas, números y guiones simples.',
    );
  }

  return slug;
}

/**
 * Devuelve un slug libre a partir de uno base.
 *
 * `exists` consulta la base, incluidas las filas archivadas y en papelera: el
 * identificador de un mundo nunca se reutiliza.
 */
export function uniqueWorldSlug(
  base: string,
  exists: (slug: string) => boolean,
): string {
  if (!exists(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
    const suffixText = `-${suffix}`;
    const head = base
      .slice(0, WORLD_SLUG_MAX_LENGTH - suffixText.length)
      .replace(/-+$/, '');
    const candidate = `${head}${suffixText}`;

    if (!exists(candidate)) {
      return candidate;
    }
  }

  throw new WorldInputError('No hay ningún identificador libre para el mundo.');
}
