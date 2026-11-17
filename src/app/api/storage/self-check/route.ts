/**
 * Diagnosis de almacenamiento para previews y desarrollo.
 *
 * No toca la base de datos ni devuelve claves, objetos o URLs firmadas: solo
 * booleanos y el nombre del driver. Está protegido por `STORAGE_SMOKE_TOKEN`
 * (cabecera `x-storage-smoke-token`) y devuelve 404 en producción real. En una
 * preview de Vercel (`VERCEL_ENV === 'preview'`) sigue disponible porque allí
 * `NODE_ENV` también es `production`. Si el token no está configurado, la ruta
 * tampoco existe.
 *
 * El ciclo completo (subida, rechazo sin firma, lectura firmada y borrado) lo
 * ejecuta `runStorageSelfCheck`. El smoke real contra R2 es
 * `pnpm storage:smoke`; este endpoint sirve para comprobar rápido que el
 * driver, sharp y la conectividad están vivos en una preview.
 */
import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { resolveStorageDriverName } from '@/lib/storage/driver';
import { resolveStorageEnv } from '@/lib/storage/env';
import {
  isSelfCheckEnabled,
  runStorageSelfCheck,
  type StorageSelfCheckResult,
} from '@/lib/storage/self-check';
import { getStorage } from '@/lib/storage/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compara el token en tiempo constante. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Genera un PNG pequeño para el ciclo de almacenamiento.
 *
 * Devuelve `undefined` si sharp no puede codificar o decodificar.
 */
async function createProbePng(): Promise<Uint8Array | undefined> {
  try {
    const buffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();
    const metadata = await sharp(buffer).metadata();

    return metadata.format === 'png' ? new Uint8Array(buffer) : undefined;
  } catch {
    return undefined;
  }
}

/** Resultado vacío cuando sharp no puede generar el objeto de prueba. */
const EMPTY_STORAGE_RESULT: StorageSelfCheckResult = {
  uploaded: false,
  unsignedRejected: false,
  signedRead: false,
  deleted: false,
};

export async function GET(request: Request) {
  const env = resolveStorageEnv();

  if (!isSelfCheckEnabled(env) || env.STORAGE_SMOKE_TOKEN === undefined) {
    return new NextResponse(null, { status: 404 });
  }

  const provided = request.headers.get('x-storage-smoke-token');

  if (provided === null || !tokenMatches(provided, env.STORAGE_SMOKE_TOKEN)) {
    return new NextResponse(null, { status: 401 });
  }

  const driver = resolveStorageDriverName(env);
  const probe = await createProbePng();
  const sharpOk = probe !== undefined;
  const storage =
    probe === undefined
      ? EMPTY_STORAGE_RESULT
      : await runStorageSelfCheck({
          storage: getStorage(),
          body: probe,
          ...(driver === 'local'
            ? {
                baseUrl:
                  env.STORAGE_LOCAL_BASE_URL ?? new URL(request.url).origin,
              }
            : {}),
        });
  const storageOk =
    storage.uploaded &&
    storage.unsignedRejected &&
    storage.signedRead &&
    storage.deleted;

  return NextResponse.json(
    {
      driver,
      sharp: sharpOk,
      storage,
      ok: sharpOk && storageOk,
    },
    {
      status: sharpOk && storageOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
