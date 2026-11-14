/**
 * Respuesta del endpoint de salud.
 *
 * Es una función pura para poder probarla sin levantar el servidor HTTP: el
 * route handler de `/api/health` solo la envuelve en `NextResponse`.
 */
export type HealthPayload = {
  status: 'ok';
  timestamp: string;
};

export function buildHealthPayload(now: Date = new Date()): HealthPayload {
  return {
    status: 'ok',
    timestamp: now.toISOString(),
  };
}
