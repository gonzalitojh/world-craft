/**
 * Mapa completo de handlers IPC.
 *
 * El objeto está tipado como `IpcHandlers`, así que añadir un canal a
 * `IPC_CHANNELS` sin atenderlo aquí rompe el typecheck.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { AssetsService } from '../../assets/service';
import type { EntitiesService } from '../../entities/service';
import type { EntityTypesService } from '../../entity-types/service';
import type { UpdatesService } from '../../updates/service';
import type { WorldsService } from '../../worlds/service';
import type { IpcHandlers } from '../registry';
import { createAssetIpcHandlers } from './assets';
import { createEntityIpcHandlers } from './entities';
import { createEntityTypeIpcHandlers } from './entity-types';
import { createShellOpenExternalHandler } from './shell';
import { createUpdateIpcHandlers } from './updates';
import { createWorldIpcHandlers } from './worlds';

/** Dependencias externas que los handlers necesitan del proceso principal. */
export interface IpcDependencies {
  readonly openExternal: (url: string) => Promise<void>;
  readonly updates: UpdatesService;
  readonly worlds: WorldsService;
  readonly entityTypes: EntityTypesService;
  readonly entities: EntitiesService;
  readonly assets: AssetsService;
  readonly pickImages: () => Promise<readonly string[]>;
}

/** Construye el mapa de handlers con las dependencias del proceso principal. */
export function createIpcHandlers(dependencies: IpcDependencies): IpcHandlers {
  return {
    [IPC_CHANNELS.shellOpenExternal]:
      createShellOpenExternalHandler(dependencies),
    ...createUpdateIpcHandlers(dependencies.updates),
    ...createWorldIpcHandlers(dependencies.worlds),
    ...createEntityTypeIpcHandlers(dependencies.entityTypes),
    ...createEntityIpcHandlers(dependencies.entities),
    ...createAssetIpcHandlers({
      service: dependencies.assets,
      pickImages: dependencies.pickImages,
    }),
  };
}
