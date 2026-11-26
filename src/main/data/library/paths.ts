/**
 * Lista blanca cerrada de entradas del ZIP de la biblioteca.
 *
 * Solo existen cuatro formas canónicas: `manifest.json`, `settings.json`,
 * `database/world-craft.sqlite` y `worlds/<slug>.zip`. Se rechazan rutas
 * absolutas, `\`, `:` (ADS de Windows), NUL, segmentos `.`/`..`, nombres
 * reservados, mayúsculas, barras finales y slugs fuera del patrón canónico.
 */
import { TRANSFER_MAX_PATH_LENGTH } from '../../../shared/contracts/transfer';
import {
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
} from '../../../shared/contracts/worlds';
import { isWindowsReservedName } from '../../transfer/format/paths';
import { DataError } from '../errors';
import {
  LIBRARY_DATABASE_PATH,
  LIBRARY_MANIFEST_FILE,
  LIBRARY_SETTINGS_FILE,
  LIBRARY_WORLDS_DIR,
  LIBRARY_WORLD_SUFFIX,
} from './constants';

export type LibraryEntryKind = 'manifest' | 'settings' | 'database' | 'world';

/** Entrada interpretada de la biblioteca. */
export interface ParsedLibraryEntry {
  readonly kind: LibraryEntryKind;
  readonly path: string;
  /** Slug del mundo; solo en `kind === 'world'`. */
  readonly slug: string | null;
}

/** Convierte cualquier valor no válido en el código estable de entrada. */
function reject(): never {
  throw new DataError('DATA_LIBRARY_ENTRY_INVALID');
}

/** Interpreta una entrada del ZIP de la biblioteca o lanza un DataError. */
export function parseLibraryEntryPath(path: unknown): ParsedLibraryEntry {
  if (typeof path !== 'string') {
    return reject();
  }

  if (
    path.length === 0 ||
    path.length > TRANSFER_MAX_PATH_LENGTH ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.includes(':') ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path !== path.toLowerCase()
  ) {
    return reject();
  }

  if (path === LIBRARY_MANIFEST_FILE) {
    return { kind: 'manifest', path, slug: null };
  }

  if (path === LIBRARY_SETTINGS_FILE) {
    return { kind: 'settings', path, slug: null };
  }

  if (path === LIBRARY_DATABASE_PATH) {
    return { kind: 'database', path, slug: null };
  }

  const segments = path.split('/');

  for (const segment of segments) {
    if (
      segment.length === 0 ||
      segment === '.' ||
      segment === '..' ||
      isWindowsReservedName(segment)
    ) {
      return reject();
    }
  }

  if (
    segments.length !== 2 ||
    segments[0] !== LIBRARY_WORLDS_DIR ||
    segments[1] === undefined
  ) {
    return reject();
  }

  const fileName = segments[1];

  if (!fileName.endsWith(LIBRARY_WORLD_SUFFIX)) {
    return reject();
  }

  const slug = fileName.slice(0, -LIBRARY_WORLD_SUFFIX.length);

  if (
    slug.length === 0 ||
    slug.length > WORLD_SLUG_MAX_LENGTH ||
    !WORLD_SLUG_PATTERN.test(slug) ||
    isWindowsReservedName(slug)
  ) {
    return reject();
  }

  return { kind: 'world', path, slug };
}

/** Construye la ruta canónica de un paquete de mundo. */
export function buildLibraryWorldPath(slug: string): string {
  const path = `${LIBRARY_WORLDS_DIR}/${slug}${LIBRARY_WORLD_SUFFIX}`;
  const parsed = parseLibraryEntryPath(path);

  if (parsed.kind !== 'world') {
    throw new DataError('DATA_LIBRARY_ENTRY_INVALID');
  }

  return path;
}
