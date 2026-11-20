/**
 * Mapa completo de handlers IPC.
 *
 * El objeto está tipado como `IpcHandlers`, así que añadir un canal a
 * `IPC_CHANNELS` sin atenderlo aquí rompe el typecheck.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { UpdatesService } from '../../updates/service';
import type { IpcHandlers } from '../registry';
import { createShellOpenExternalHandler } from './shell';
import { createUpdateIpcHandlers } from './updates';

/** Dependencias externas que los handlers necesitan del proceso principal. */
export interface IpcDependencies {
  readonly openExternal: (url: string) => Promise<void>;
  readonly updates: UpdatesService;
}

/** Construye el mapa de handlers con las dependencias del proceso principal. */
export function createIpcHandlers(dependencies: IpcDependencies): IpcHandlers {
  return {
    [IPC_CHANNELS.shellOpenExternal]:
      createShellOpenExternalHandler(dependencies),
    ...createUpdateIpcHandlers(dependencies.updates),
  };
}
