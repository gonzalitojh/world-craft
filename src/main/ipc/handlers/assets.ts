/**
 * Handlers IPC de assets.
 *
 * El diálogo nativo vive en el proceso principal y la ruta elegida no cruza el
 * IPC: el renderer solo recibe metadatos. Cualquier fallo del servicio se
 * traduce a `INVALID_INPUT`; el router oculta el resto.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { AssetsService } from '../../assets/service';
import { AssetError } from '../../assets/errors';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  assetsImportPayloadSchema,
  assetsListPayloadSchema,
  type AssetsImportPayload,
  type AssetsListPayload,
} from '../schemas/assets';

/** Canales que atiende este módulo. */
export type AssetsIpcHandlers = Pick<
  IpcHandlers,
  typeof IPC_CHANNELS.assetsList | typeof IPC_CHANNELS.assetsImport
>;

/** Dependencias del módulo; el selector se inyecta para probarlo sin Electron. */
export interface AssetsIpcDependencies {
  readonly service: AssetsService;
  /** Abre el diálogo nativo y devuelve las rutas elegidas; vacío al cancelar. */
  readonly pickImages: () => Promise<readonly string[]>;
}

async function runAssetOperation<T>(
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AssetError) {
      throw new IpcInputError();
    }

    throw error;
  }
}

/** Construye los handlers de los canales de assets. */
export function createAssetIpcHandlers(
  dependencies: AssetsIpcDependencies,
): AssetsIpcHandlers {
  return {
    [IPC_CHANNELS.assetsList]: defineIpcHandler<AssetsListPayload>({
      schema: assetsListPayloadSchema,
      handle: (payload) =>
        runAssetOperation(() => dependencies.service.list(payload.worldId)),
    }),

    [IPC_CHANNELS.assetsImport]: defineIpcHandler<AssetsImportPayload>({
      schema: assetsImportPayloadSchema,
      handle: async (payload) => {
        // En modo seguro no se abre el diálogo: el usuario no debe elegir
        // archivos para recibir después un error de servicio no disponible.
        await runAssetOperation(() =>
          dependencies.service.assertAvailable(payload.worldId),
        );

        const files = await dependencies.pickImages();

        if (files.length === 0) {
          return { imported: [] };
        }

        return runAssetOperation(async () => ({
          imported: await dependencies.service.importFiles(
            payload.worldId,
            files,
            payload.alt,
          ),
        }));
      },
    }),
  };
}
