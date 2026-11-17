/**
 * Registro seguro de fallos de limpieza de objetos.
 *
 * Nunca incluye la respuesta cruda del proveedor, URLs firmadas, cuerpos ni
 * credenciales: solo la clave y un código estable. Así un fallo al borrar un
 * huérfano no se pierde y tampoco filtra datos.
 */
import { StorageError } from '@/lib/storage';

/** Evento de limpieza fallida. */
export interface CleanupErrorEvent {
  key: string;
  error: unknown;
}

/**
 * Extrae un código seguro de un error de limpieza.
 *
 * Prioriza el código de dominio y, si no existe, acepta un `code` corto de
 * Node o el estado HTTP del proveedor. Descarta mensajes y cuerpos.
 */
export function cleanupErrorCode(error: unknown): string {
  if (error instanceof StorageError) {
    return error.code;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      code?: unknown;
      $metadata?: { httpStatusCode?: unknown };
    };

    if (typeof candidate.code === 'string' && candidate.code.length <= 64) {
      return candidate.code;
    }

    if (typeof candidate.$metadata?.httpStatusCode === 'number') {
      return `http_${candidate.$metadata.httpStatusCode}`;
    }
  }

  return 'unknown';
}

/** Registra un fallo de limpieza sin filtrar detalles del proveedor. */
export function logCleanupError(event: CleanupErrorEvent): void {
  console.warn('storage.cleanup_failed', {
    key: event.key,
    code: cleanupErrorCode(event.error),
  });
}
