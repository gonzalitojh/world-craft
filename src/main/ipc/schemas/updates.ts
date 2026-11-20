/**
 * Esquema de entrada de los canales de actualizaciones.
 *
 * Todas las órdenes son sin parámetros: el renderer no puede elegir versión,
 * canal, URL ni ruta. Un objeto estricto vacío rechaza cualquier campo extra.
 */
import { z } from 'zod';

export const updateCommandSchema = z.strictObject({});

export type UpdateCommandPayload = z.infer<typeof updateCommandSchema>;
