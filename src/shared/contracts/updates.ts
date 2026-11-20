/**
 * Contrato compartido del servicio de actualizaciones.
 *
 * Es un módulo puro: no importa Electron, Node ni Zod, porque el renderer lo
 * usa para tipar y validar los snapshots que llegan por el preload. El proceso
 * principal es la frontera de confianza, pero el preload no debe reenviar una
 * forma inesperada aunque venga del proceso principal (ADR 0004).
 */

/** Estados posibles del actualizador. */
export const UPDATE_PHASES = [
  'unavailable',
  'idle',
  'checking',
  'up-to-date',
  'available',
  'downloading',
  'downloaded',
  'installing',
  'error',
] as const;

export type UpdatePhase = (typeof UPDATE_PHASES)[number];

const UPDATE_PHASE_SET: ReadonlySet<string> = new Set(UPDATE_PHASES);

/** Motivos por los que el actualizador no está disponible. */
export const UPDATE_UNAVAILABLE_REASONS = [
  'not-packaged',
  'safe-mode',
  'not-configured',
  'module-missing',
] as const;

export type UpdateUnavailableReason =
  (typeof UPDATE_UNAVAILABLE_REASONS)[number];

const UPDATE_UNAVAILABLE_REASON_SET: ReadonlySet<string> = new Set(
  UPDATE_UNAVAILABLE_REASONS,
);

/** Códigos de error estables, sin mensajes crudos ni detalles internos. */
export const UPDATE_ERROR_CODES = [
  'UPDATE_CHECK_FAILED',
  'UPDATE_DOWNLOAD_FAILED',
  'UPDATE_INSTALL_FAILED',
  'UPDATE_INVALID_STATE',
] as const;

export type UpdateErrorCode = (typeof UPDATE_ERROR_CODES)[number];

const UPDATE_ERROR_CODE_SET: ReadonlySet<string> = new Set(UPDATE_ERROR_CODES);

/**
 * Canal del evento de cambio de estado.
 *
 * No forma parte de la allowlist de `invoke`: es un evento unidireccional que
 * el preload escucha y valida antes de entregarlo al renderer.
 */
export const UPDATE_STATE_CHANGED_CHANNEL = 'updates:stateChanged' as const;

/** Fotografía completa del actualizador, apta para la interfaz. */
export interface UpdateSnapshot {
  readonly phase: UpdatePhase;
  readonly currentVersion: string;
  readonly availableVersion: string | null;
  readonly unavailableReason: UpdateUnavailableReason | null;
  readonly errorCode: UpdateErrorCode | null;
  /** Porcentaje de descarga entre 0 y 100; solo en `downloading`. */
  readonly progressPercent: number | null;
  /** Última comprobación completada, en ISO 8601, o `null`. */
  readonly lastCheckedAt: string | null;
}

/** Snapshot inicial y seguro para un servicio todavía sin comprobar. */
export function createIdleUpdateSnapshot(
  currentVersion: string,
): UpdateSnapshot {
  return Object.freeze({
    phase: 'idle',
    currentVersion,
    availableVersion: null,
    unavailableReason: null,
    errorCode: null,
    progressPercent: null,
    lastCheckedAt: null,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Valida estructuralmente un snapshot.
 *
 * Además de los tipos, comprueba la coherencia mínima de cada fase: una fase
 * `unavailable` debe explicar el motivo, una fase de descarga debe tener una
 * versión disponible y un error debe llevar su código. El preload descarta lo
 * que no cumpla esta forma.
 */
export function isUpdateSnapshot(value: unknown): value is UpdateSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const {
    phase,
    currentVersion,
    availableVersion,
    unavailableReason,
    errorCode,
    progressPercent,
    lastCheckedAt,
  } = value;

  if (typeof phase !== 'string' || !UPDATE_PHASE_SET.has(phase)) {
    return false;
  }

  if (!isNonEmptyString(currentVersion)) {
    return false;
  }

  if (availableVersion !== null && !isNonEmptyString(availableVersion)) {
    return false;
  }

  if (
    unavailableReason !== null &&
    (typeof unavailableReason !== 'string' ||
      !UPDATE_UNAVAILABLE_REASON_SET.has(unavailableReason))
  ) {
    return false;
  }

  if (
    errorCode !== null &&
    (typeof errorCode !== 'string' || !UPDATE_ERROR_CODE_SET.has(errorCode))
  ) {
    return false;
  }

  if (
    progressPercent !== null &&
    (typeof progressPercent !== 'number' ||
      !Number.isFinite(progressPercent) ||
      progressPercent < 0 ||
      progressPercent > 100)
  ) {
    return false;
  }

  if (
    lastCheckedAt !== null &&
    (typeof lastCheckedAt !== 'string' ||
      Number.isNaN(Date.parse(lastCheckedAt)))
  ) {
    return false;
  }

  if (phase === 'unavailable' && unavailableReason === null) {
    return false;
  }

  if (
    (phase === 'available' ||
      phase === 'downloading' ||
      phase === 'downloaded') &&
    availableVersion === null
  ) {
    return false;
  }

  if (phase === 'error' && errorCode === null) {
    return false;
  }

  if (phase === 'downloading' && progressPercent === null) {
    return false;
  }

  return true;
}
