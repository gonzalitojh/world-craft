/**
 * Política cerrada de nombres de entrada del ZIP.
 *
 * El formato solo admite tres formas canónicas:
 *
 * - `manifest.json`
 * - `world.json`
 * - `assets/<uuidv7>.webp`
 *
 * Cualquier otra entrada se rechaza antes de extraer: rutas absolutas, unidades
 * de Windows, UNC, separadores `\`, ADS (`:`), segmentos `.` o `..`, nombres
 * reservados de Windows, mayúsculas, duplicados, directorios y enlaces. El
 * nombre canónico se compara con la ruta original para que una entrada como
 * `Assets/x.webp` no pase por una comparación insensible a mayúsculas.
 */
import { isUuidV7 } from '../../db/ids';
import { TRANSFER_MAX_PATH_LENGTH } from '../../../shared/contracts/transfer';
import {
  TRANSFER_ASSETS_DIR,
  TRANSFER_ASSET_SUFFIX,
  TRANSFER_MANIFEST_FILE,
  TRANSFER_WORLD_FILE,
} from '../constants';
import { TransferError } from '../errors';

/** Tipo de una entrada admitida. */
export type TransferEntryKind = 'manifest' | 'world' | 'asset';

/** Entrada interpretada por la política. */
export interface ParsedTransferEntry {
  readonly kind: TransferEntryKind;
  readonly path: string;
  /** UUIDv7 del asset; solo en `kind === 'asset'`. */
  readonly assetId: string | null;
}

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;

/** Nombres reservados de Windows, sin extensión y en minúsculas. */
const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

/** Indica si un segmento es un nombre reservado de Windows. */
export function isWindowsReservedName(segment: string): boolean {
  const base = segment.split('.')[0] ?? '';

  return WINDOWS_RESERVED_NAMES.has(base.toLowerCase());
}

/**
 * Interpreta una entrada del ZIP o lanza `TRANSFER_ENTRY_REJECTED`.
 *
 * La comprobación es sintáctica y cerrada; no toca el sistema de archivos.
 */
export function parseTransferEntryPath(path: unknown): ParsedTransferEntry {
  if (typeof path !== 'string') {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  if (
    path.length === 0 ||
    path.length > TRANSFER_MAX_PATH_LENGTH ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.includes(':') ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path !== path.toLowerCase() ||
    WINDOWS_DRIVE_PATTERN.test(path)
  ) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  if (path === TRANSFER_MANIFEST_FILE) {
    return { kind: 'manifest', path, assetId: null };
  }

  if (path === TRANSFER_WORLD_FILE) {
    return { kind: 'world', path, assetId: null };
  }

  const segments = path.split('/');

  for (const segment of segments) {
    if (
      segment.length === 0 ||
      segment === '.' ||
      segment === '..' ||
      isWindowsReservedName(segment)
    ) {
      throw new TransferError('TRANSFER_ENTRY_REJECTED');
    }
  }

  if (
    segments.length !== 2 ||
    segments[0] !== TRANSFER_ASSETS_DIR ||
    segments[1] === undefined
  ) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  const fileName = segments[1];

  if (!fileName.endsWith(TRANSFER_ASSET_SUFFIX)) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  const assetId = fileName.slice(0, -TRANSFER_ASSET_SUFFIX.length);

  if (!isUuidV7(assetId)) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  return { kind: 'asset', path, assetId };
}

/** Construye el nombre canónico de un asset dentro del ZIP. */
export function buildTransferAssetPath(assetId: string): string {
  if (!isUuidV7(assetId)) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  return `${TRANSFER_ASSETS_DIR}/${assetId}${TRANSFER_ASSET_SUFFIX}`;
}
