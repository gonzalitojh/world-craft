/**
 * Protocolo `wc-asset://` para el renderer.
 *
 * El esquema se registra como `standard`, `secure` y `stream` antes de que la
 * aplicación esté lista; el handler se instala solo si el arranque de la base
 * terminó en `ready`. El ID de la URL es la única entrada: la ruta relativa
 * sale de SQLite, se valida contra la lista blanca y se resuelve dentro de
 * `assets/`. Ninguna respuesta de error contiene rutas, IDs ni detalles
 * internos.
 */
import { readFile } from 'node:fs/promises';

import {
  ASSET_ALLOWED_MIME_TYPES,
  ASSET_MAX_FILE_BYTES,
  ASSET_MIME_WEBP,
  ASSET_URL_SCHEME,
} from './constants';
import { AssetError, type AssetErrorCode } from './errors';
import type { AssetLogger } from './logger';
import {
  parseAssetUrl,
  resolveAssetFile,
  toThumbnailRelativePath,
} from './paths';
import type { AssetRepository } from './store';

/** Privilegios del esquema; coinciden con los de Electron. */
export interface AssetSchemePrivileges {
  readonly standard?: boolean;
  readonly secure?: boolean;
  readonly bypassCSP?: boolean;
  readonly supportFetchAPI?: boolean;
  readonly corsEnabled?: boolean;
  readonly stream?: boolean;
}

/** Registro del esquema ante Electron. */
export interface AssetSchemeRegistration {
  readonly scheme: string;
  readonly privileges?: AssetSchemePrivileges;
}

/** Petición mínima que necesita el handler. */
export interface AssetProtocolRequest {
  readonly url: string;
}

/**
 * Host del protocolo.
 *
 * Es estructural para poder probar el registro sin Electron; la composición
 * envuelve el `protocol` real.
 */
export interface AssetProtocolHost {
  registerSchemesAsPrivileged(schemes: AssetSchemeRegistration[]): void;
  handle(
    scheme: string,
    handler: (request: AssetProtocolRequest) => Promise<Response>,
  ): void;
}

/** Respuesta normalizada del handler, antes de construir el `Response`. */
export interface AssetProtocolResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
}

/** Dependencias del handler. */
export interface AssetRequestDependencies {
  readonly assetsDir: string;
  readonly repository: Pick<AssetRepository, 'findById'>;
  readonly logger?: AssetLogger;
  /** Límite del archivo servido; por defecto el de importación. */
  readonly maxFileBytes?: number;
}

/** Cabeceras de una respuesta correcta. */
const SUCCESS_HEADERS: Readonly<Record<string, string>> = {
  'content-type': ASSET_MIME_WEBP,
  'x-content-type-options': 'nosniff',
  'cache-control': 'private, max-age=31536000, immutable',
  'content-security-policy': "default-src 'none'",
};

/** Cabeceras de una respuesta de error. */
const ERROR_HEADERS: Readonly<Record<string, string>> = {
  'content-type': 'text/plain; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'",
};

const ERROR_BODIES: Readonly<Record<number, string>> = {
  400: 'Solicitud no válida.',
  403: 'Acceso denegado.',
  404: 'No encontrado.',
  413: 'Archivo demasiado grande.',
  415: 'Tipo de archivo no admitido.',
  500: 'Error interno.',
  503: 'Servicio no disponible.',
};

/**
 * Traduce un código de fallo a estado HTTP.
 *
 * La URL malformada es 400; una ruta que sale de `assets/`, un enlace o un
 * mundo que no coincide es 403; un archivo ausente es 404.
 */
export function statusForAssetErrorCode(code: AssetErrorCode): number {
  switch (code) {
    case 'ASSET_URL_INVALID':
    case 'ASSET_INPUT_INVALID':
      return 400;
    case 'ASSET_PATH_INVALID':
      return 403;
    case 'ASSET_NOT_FOUND':
      return 404;
    case 'ASSET_TOO_LARGE':
      return 413;
    case 'ASSET_UNSUPPORTED_FORMAT':
    case 'ASSET_UNSUPPORTED_MEDIA_TYPE':
      return 415;
    default:
      return 500;
  }
}

/**
 * Registra `wc-asset` como esquema estándar, seguro y con streaming.
 *
 * Nunca se permite saltarse la CSP, usar `fetch` desde el renderer ni CORS: el
 * canal es exclusivamente para `<img src>` de la propia ventana.
 */
export function registerAssetScheme(host: AssetProtocolHost): void {
  host.registerSchemesAsPrivileged([
    {
      scheme: ASSET_URL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        bypassCSP: false,
        supportFetchAPI: false,
        corsEnabled: false,
      },
    },
  ]);
}

/** Instala el handler del protocolo en el host. */
export function registerAssetProtocol(
  host: AssetProtocolHost,
  dependencies: AssetRequestDependencies,
): void {
  host.handle(ASSET_URL_SCHEME, async (request) =>
    toAssetResponse(await handleAssetRequest(dependencies, request.url)),
  );
}

/**
 * Atiende una petición de asset y devuelve estado, cabeceras y cuerpo.
 *
 * Función casi pura: solo lee el archivo ya validado. Se prueba directamente,
 * sin levantar una petición real de Electron.
 */
export async function handleAssetRequest(
  dependencies: AssetRequestDependencies,
  url: string,
): Promise<AssetProtocolResponse> {
  try {
    const parsed = parseAssetUrl(url);
    const record = dependencies.repository.findById(parsed.assetId);

    if (record === null) {
      throw new AssetError('ASSET_NOT_FOUND');
    }

    if (record.id !== parsed.assetId) {
      // La URL identifica una fila; una fila manipulada que apunte a otra no se
      // sirve aunque su ruta sea válida.
      throw new AssetError('ASSET_PATH_INVALID');
    }

    if (!ASSET_ALLOWED_MIME_TYPES.some((mime) => mime === record.mime)) {
      throw new AssetError('ASSET_UNSUPPORTED_MEDIA_TYPE');
    }

    const maxFileBytes = dependencies.maxFileBytes ?? ASSET_MAX_FILE_BYTES;

    if (record.size > maxFileBytes) {
      throw new AssetError('ASSET_TOO_LARGE');
    }

    const relativePath =
      parsed.variant === 'thumb'
        ? toThumbnailRelativePath(record.relativePath)
        : record.relativePath;
    const resolved = resolveAssetFile({
      assetsDir: dependencies.assetsDir,
      relativePath,
      worldId: record.worldId,
      assetId: record.id,
      variant: parsed.variant,
    });

    if (resolved.size > maxFileBytes) {
      throw new AssetError('ASSET_TOO_LARGE');
    }

    const data = await readFile(resolved.absolutePath);

    dependencies.logger?.log({
      event: 'asset.request',
      outcome: 'served',
      status: 200,
    });

    return {
      status: 200,
      headers: {
        ...SUCCESS_HEADERS,
        'content-length': String(data.byteLength),
      },
      body: data,
    };
  } catch (error) {
    const assetError =
      error instanceof AssetError
        ? error
        : new AssetError('ASSET_STORAGE_FAILED', { cause: error });
    const status = statusForAssetErrorCode(assetError.code);

    dependencies.logger?.log({
      event: 'asset.request',
      outcome: 'rejected',
      status,
      code: assetError.code,
    });

    return errorResponse(status);
  }
}

/** Convierte la respuesta normalizada en un `Response` del handler. */
export function toAssetResponse(response: AssetProtocolResponse): Response {
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

function errorResponse(status: number): AssetProtocolResponse {
  return {
    status,
    headers: ERROR_HEADERS,
    body: ERROR_BODIES[status] ?? ERROR_BODIES[500] ?? 'Error interno.',
  };
}
