/**
 * Handler del canal `shell:openExternal`.
 *
 * La URL ya llega con la forma validada por Zod; aquí se aplica la política de
 * destinos (solo https, sin credenciales, sin hosts privados) y se abre con el
 * `shell.openExternal` inyectado, que en producción es el de Electron.
 */
import { resolveExternalUrl } from '../../security/external-links';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlerDefinition } from '../registry';
import {
  shellOpenExternalPayloadSchema,
  type ShellOpenExternalPayload,
} from '../schemas/shell';

/** Dependencias del handler, inyectables para poder probarlo sin Electron. */
export interface ShellIpcDependencies {
  readonly openExternal: (url: string) => Promise<void>;
}

/** Construye el handler de apertura de enlaces externos. */
export function createShellOpenExternalHandler(
  dependencies: ShellIpcDependencies,
): IpcHandlerDefinition {
  return defineIpcHandler<ShellOpenExternalPayload>({
    schema: shellOpenExternalPayloadSchema,

    async handle(payload) {
      const decision = resolveExternalUrl(payload.url);

      if (decision.kind === 'deny') {
        throw new IpcInputError();
      }

      await dependencies.openExternal(decision.url);

      return { opened: true };
    },
  });
}
