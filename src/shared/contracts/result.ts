/**
 * Contrato de resultado de una llamada IPC.
 *
 * Es un módulo puro compartido por el preload, el proceso principal y los
 * tests: no importa Electron, Node ni Zod. El renderer nunca recibe un error
 * interno, una ruta ni un stack; solo un código estable de esta lista.
 */

/** Códigos de error estables que puede devolver un canal IPC. */
export type IpcErrorCode =
  'INVALID_INPUT' | 'UNKNOWN_CHANNEL' | 'INTERNAL_ERROR' | 'UNTRUSTED_SENDER';

/** Error tipado y sin detalles internos. */
export interface IpcError {
  readonly code: IpcErrorCode;
}

/** Resultado discriminado de una llamada IPC. */
export type IpcResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: IpcError };

/** Lista única de códigos válidos, usada para validar respuestas. */
export const IPC_ERROR_CODES: readonly IpcErrorCode[] = Object.freeze([
  'INVALID_INPUT',
  'UNKNOWN_CHANNEL',
  'INTERNAL_ERROR',
  'UNTRUSTED_SENDER',
]);

const IPC_ERROR_CODE_SET: ReadonlySet<string> = new Set(IPC_ERROR_CODES);

/** Construye un resultado correcto. */
export function ipcOk<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

/**
 * Construye un resultado fallido.
 *
 * El genérico existe para poder devolver un fallo donde se espera
 * `IpcResult<T>` sin inventar un valor de `T`.
 */
export function ipcErr<T = never>(code: IpcErrorCode): IpcResult<T> {
  return { ok: false, error: { code } };
}

/** Indica si un valor es un código de error IPC conocido. */
export function isIpcErrorCode(value: unknown): value is IpcErrorCode {
  return typeof value === 'string' && IPC_ERROR_CODE_SET.has(value);
}

/**
 * Comprueba estructuralmente que un valor es un `IpcResult` bien formado.
 *
 * Lo usa el preload para no confiar en una respuesta con otra forma: si no
 * encaja, se convierte en `INTERNAL_ERROR`. No valida el contenido de `data`,
 * que es responsabilidad de cada función del contrato.
 */
export function isIpcResult(value: unknown): value is IpcResult<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    readonly ok?: unknown;
    readonly error?: unknown;
  };

  if (candidate.ok === true) {
    return 'data' in candidate;
  }

  if (candidate.ok === false) {
    const error = candidate.error;

    return (
      typeof error === 'object' &&
      error !== null &&
      isIpcErrorCode((error as { readonly code?: unknown }).code)
    );
  }

  return false;
}
