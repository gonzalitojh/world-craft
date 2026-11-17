import { NextResponse } from 'next/server';

import {
  buildHealthPayload,
  healthStatusCode,
  probeDatabase,
} from '@/lib/health';

// Comprobación de disponibilidad: nunca se cachea ni se prerenderiza.
export const dynamic = 'force-dynamic';

/**
 * Healthcheck con consulta real a Supabase.
 *
 * - `200` y `status: "ok"`: la base acepta la consulta.
 * - `503` y `status: "degraded"`: la base no responde o rechaza la consulta.
 *
 * La respuesta no expone el error original (host, rol, credenciales ni SQL).
 */
export async function GET(): Promise<NextResponse> {
  const database = await probeDatabase();
  const payload = buildHealthPayload(database);

  return NextResponse.json(payload, {
    status: healthStatusCode(database),
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
