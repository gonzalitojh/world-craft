/**
 * Servicio de assets expuesto al renderer.
 *
 * Solo lista imágenes de un mundo e importa archivos elegidos con el diálogo
 * nativo. La ruta del archivo original nunca sale del proceso principal y el
 * renderer recibe únicamente identificadores y metadatos.
 *
 * La importación reutiliza el servicio de #66: valida por contenido, convierte
 * a WebP, crea la miniatura, escribe de forma atómica y compensa si falla la
 * base. En modo seguro no existe instancia y las llamadas devuelven error.
 */
import type { AssetSummary } from '../../shared/contracts/assets';
import { resolveDataPaths } from '../db/paths';
import { generateUuidv7 } from '../db/ids';
import { AssetError } from './errors';
import { importAsset } from './import-asset';
import { createAssetLogger, type AssetLogger } from './logger';
import { createAssetRepository, type AssetRecord } from './store';

/** Servicio de assets para el IPC. */
export interface AssetsService {
  /** Comprueba que el servicio y el mundo están disponibles antes de abrir el diálogo. */
  assertAvailable(worldId: string): void;
  list(worldId: string): readonly AssetSummary[];
  importFiles(
    worldId: string,
    paths: readonly string[],
    alt?: string,
  ): Promise<readonly AssetSummary[]>;
}

/** Opciones del servicio; la carpeta de datos y el reloj se inyectan. */
export interface AssetsServiceOptions {
  readonly userDataDir: string;
  readonly repository: ReturnType<typeof createAssetRepository>;
  readonly now?: () => number;
  readonly generateId?: () => string;
  readonly logger?: AssetLogger;
}

/** Crea el servicio de assets sobre la base compartida. */
export function createAssetsService(
  options: AssetsServiceOptions,
): AssetsService {
  const paths = resolveDataPaths(options.userDataDir);
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;

  const requireWorld = (worldId: string): void => {
    if (!options.repository.worldExists(worldId)) {
      throw new AssetError('ASSET_INPUT_INVALID');
    }
  };

  return {
    assertAvailable(worldId) {
      requireWorld(worldId);
    },

    list(worldId) {
      requireWorld(worldId);

      return options.repository
        .listByWorld(worldId)
        .map((record) => toSummary(record));
    },

    async importFiles(worldId, files, alt) {
      requireWorld(worldId);
      const imported: AssetSummary[] = [];

      for (const path of files) {
        const result = await importAsset(
          {
            userDataDir: paths.userDataDir,
            assetsDir: paths.assetsDir,
            assetsTempDir: paths.assetsTempDir,
            repository: options.repository,
            now,
            generateId,
            ...(options.logger === undefined ? {} : { logger: options.logger }),
          },
          {
            worldId,
            kind: 'image',
            ...(alt === undefined ? {} : { alt }),
            source: { kind: 'path', path },
          },
        );

        imported.push(toSummary(result.asset));
      }

      return imported;
    },
  };
}

/**
 * Servicio de sustitución en modo seguro.
 *
 * Cualquier llamada lanza y el router devuelve `INTERNAL_ERROR`; la interfaz
 * muestra un aviso en lugar de imágenes inventadas.
 */
export function createUnavailableAssetsService(): AssetsService {
  const unavailable = (): never => {
    throw new Error('Los assets no están disponibles en modo seguro.');
  };

  return {
    assertAvailable: unavailable,
    list: unavailable,
    importFiles: unavailable,
  };
}

/** Crea el logger del servicio con la ruta de datos ya validada. */
export function createAssetsLogger(userDataDir: string): AssetLogger {
  return createAssetLogger(resolveDataPaths(userDataDir).assetsLogFile);
}

function toSummary(record: AssetRecord): AssetSummary {
  return {
    id: record.id,
    worldId: record.worldId,
    width: record.width,
    height: record.height,
    alt: record.alt,
    createdAt: record.createdAt,
  };
}
