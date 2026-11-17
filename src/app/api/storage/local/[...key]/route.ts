/**
 * Ruta interna del adaptador local de almacenamiento.
 *
 * Existe **solo en desarrollo y pruebas**: en producción devuelve 404 aunque
 * alguien conozca la ruta. Sustituye al endpoint de R2 cuando el driver efectivo
 * es local, con la misma idea: una URL firmada de corta duración autoriza una
 * única operación (`get` o `put`) sobre una clave concreta.
 *
 * La firma HMAC se verifica en tiempo constante y cubre operación, caducidad y
 * clave. Nunca se registra la URL ni el secreto.
 */
import { NextResponse } from 'next/server';

import {
  isLocalStorageOperation,
  type LocalStorageOperation,
} from '@/lib/storage/local-signature';
import { LOCAL_STORAGE_MAX_BYTES } from '@/lib/storage/local-adapter';
import { getLocalRouteAdapter } from '@/lib/storage/server';
import { StorageError } from '@/lib/storage/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ key: string[] }>;
}

/** Respuesta opaca para no revelar si la ruta existe. */
function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

/** Traduce un error de dominio a una respuesta HTTP sin filtrar detalles. */
function fromStorageError(error: StorageError): NextResponse {
  const status =
    error.code === 'invalid_key'
      ? 400
      : error.code === 'not_found'
        ? 404
        : error.code === 'too_large'
          ? 413
          : 503;

  return new NextResponse(null, { status });
}

/** Lee y valida los parámetros de firma de la URL. */
function readSignatureParams(url: URL):
  | {
      operation: LocalStorageOperation;
      expiresAt: number;
      signature: string;
    }
  | undefined {
  const operation = url.searchParams.get('operation');
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('sig');

  if (
    operation === null ||
    !isLocalStorageOperation(operation) ||
    expires === null ||
    !/^\d{1,12}$/.test(expires) ||
    signature === null ||
    !/^[0-9a-f]{64}$/i.test(signature)
  ) {
    return undefined;
  }

  return { operation, expiresAt: Number(expires), signature };
}

async function handle(request: Request, context: RouteContext) {
  const adapter = getLocalRouteAdapter();

  if (adapter === undefined) {
    return notFound();
  }

  const { key: segments } = await context.params;

  if (segments.length === 0) {
    return notFound();
  }

  const key = segments.join('/');
  const params = readSignatureParams(new URL(request.url));

  if (params === undefined) {
    return new NextResponse(null, { status: 403 });
  }

  try {
    const check = await adapter.verifyRequest({ key, ...params });

    if (check !== 'ok') {
      return new NextResponse(null, { status: 403 });
    }

    if (request.method === 'GET') {
      if (params.operation !== 'get') {
        return new NextResponse(null, { status: 403 });
      }

      const object = await adapter.readObject(key, {
        maxBytes: LOCAL_STORAGE_MAX_BYTES,
      });

      return new NextResponse(object.body as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': object.contentType,
          'Content-Length': String(object.body.byteLength),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    if (request.method === 'PUT') {
      if (params.operation !== 'put') {
        return new NextResponse(null, { status: 403 });
      }

      const declared = request.headers.get('content-length');

      if (declared !== null && Number(declared) > LOCAL_STORAGE_MAX_BYTES) {
        return new NextResponse(null, { status: 413 });
      }

      const body = new Uint8Array(await request.arrayBuffer());

      if (body.byteLength > LOCAL_STORAGE_MAX_BYTES) {
        return new NextResponse(null, { status: 413 });
      }

      await adapter.upload({
        key,
        body,
        contentType:
          request.headers.get('content-type') ?? 'application/octet-stream',
      });

      return new NextResponse(null, { status: 200 });
    }

    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'GET, PUT' },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return fromStorageError(error);
    }

    return new NextResponse(null, { status: 503 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handle(request, context);
}
