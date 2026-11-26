/** Constantes internas del formato `world-craft-library` v1. */
import { DATA_LIBRARY_SETTINGS_FORMAT } from '../../../shared/contracts/data';

export const LIBRARY_MANIFEST_FILE = 'manifest.json';
export const LIBRARY_SETTINGS_FILE = 'settings.json';
export const LIBRARY_DATABASE_DIR = 'database';
export const LIBRARY_DATABASE_FILE = 'world-craft.sqlite';
export const LIBRARY_DATABASE_PATH = `${LIBRARY_DATABASE_DIR}/${LIBRARY_DATABASE_FILE}`;
export const LIBRARY_WORLDS_DIR = 'worlds';
export const LIBRARY_WORLD_SUFFIX = '.zip';

export const LIBRARY_SETTINGS_FORMAT = DATA_LIBRARY_SETTINGS_FORMAT.id;
export const LIBRARY_SETTINGS_FORMAT_VERSION =
  DATA_LIBRARY_SETTINGS_FORMAT.version;

/** Límite del manifiesto de la biblioteca (puede listar miles de mundos). */
export const LIBRARY_MANIFEST_MAX_BYTES = 16 * 1024 ** 2;

/** `settings.json` solo guarda preferencias de interfaz. */
export const LIBRARY_SETTINGS_MAX_BYTES = 64 * 1024;

/** Número máximo de paquetes de mundo en una biblioteca. */
export const LIBRARY_MAX_WORLDS = 5_000;
