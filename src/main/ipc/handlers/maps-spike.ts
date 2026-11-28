/**
 * Handler IPC de exportación del laboratorio de mapas (#80).
 *
 * El store de dominio decide carpeta y nombre. Una entrada inválida se traduce
 * a `INVALID_INPUT`; un fallo de escritura o de disponibilidad se deja como
 * excepción para que el router devuelva `INTERNAL_ERROR` sin filtrar rutas,
 * mensajes ni causas.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { SpikeExportResult } from '../../../shared/contracts/maps-spike';
import type { SpikeExportStore } from '../../spike-maps/export-store';
import { SpikeExportError } from '../../spike-maps/export-store';
import { IpcInputError } from '../errors';
import type { IpcHandlers } from '../registry';
import { defineIpcHandler } from '../registry';
import {
  mapsSpikeSaveExportPayloadSchema,
  type MapsSpikeSaveExportPayload,
} from '../schemas/maps-spike';

/** Canal que atiende este módulo. */
export type MapsSpikeIpcHandlers = Pick<
  IpcHandlers,
  typeof IPC_CHANNELS.mapsSpikeSaveExport
>;

/** Construye el handler a partir del store. */
export function createMapsSpikeIpcHandlers(
  store: SpikeExportStore,
): MapsSpikeIpcHandlers {
  return {
    [IPC_CHANNELS.mapsSpikeSaveExport]:
      defineIpcHandler<MapsSpikeSaveExportPayload>({
        schema: mapsSpikeSaveExportPayloadSchema,
        handle: (payload): Promise<SpikeExportResult> =>
          saveExport(store, payload),
      }),
  };
}

async function saveExport(
  store: SpikeExportStore,
  payload: MapsSpikeSaveExportPayload,
): Promise<SpikeExportResult> {
  try {
    return await store.saveExport({
      kind: payload.kind,
      content: payload.content,
    });
  } catch (error) {
    if (
      error instanceof SpikeExportError &&
      error.code === 'SPIKE_EXPORT_INVALID_INPUT'
    ) {
      throw new IpcInputError();
    }

    throw new Error('No se pudo guardar la exportación del laboratorio.', {
      cause: error,
    });
  }
}
