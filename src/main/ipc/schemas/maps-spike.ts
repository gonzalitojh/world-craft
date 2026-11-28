/**
 * Esquema Zod del canal de exportación del laboratorio de mapas.
 *
 * Solo se aceptan el tipo y los bytes. El objeto es estricto: cualquier ruta,
 * nombre o extensión enviada por el renderer se rechaza antes del handler.
 */
import { z } from 'zod';

import {
  SPIKE_EXPORT_KINDS,
  SPIKE_EXPORT_MAX_BYTES,
  SPIKE_EXPORT_MIN_BYTES,
} from '../../../shared/contracts/maps-spike';

/** Payload de `mapsSpike:saveExport`. */
export const mapsSpikeSaveExportPayloadSchema = z.strictObject({
  kind: z.enum(SPIKE_EXPORT_KINDS),
  content: z
    .instanceof(Uint8Array)
    .refine(
      (content) =>
        content.byteLength >= SPIKE_EXPORT_MIN_BYTES &&
        content.byteLength <= SPIKE_EXPORT_MAX_BYTES,
      { message: 'El contenido no tiene un tamaño admitido.' },
    ),
});

export type MapsSpikeSaveExportPayload = z.infer<
  typeof mapsSpikeSaveExportPayloadSchema
>;
