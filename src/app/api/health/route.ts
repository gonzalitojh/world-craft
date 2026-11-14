import { NextResponse } from 'next/server';

import { buildHealthPayload } from '@/lib/health';

// Comprobación de disponibilidad: nunca se cachea ni se prerenderiza.
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(buildHealthPayload(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
