/**
 * Política pura de agrupación, retención y poda de versiones.
 *
 * No conoce la base ni el reloj real: recibe las versiones existentes y el
 * instante actual. Así las reglas se prueban sin preparar SQLite y el servicio
 * solo decide cuándo aplicarlas.
 *
 * Reglas:
 * - una ráfaga de autoguardado abre versión con el estado saliente y agrupa los
 *   cambios siguientes durante cinco minutos;
 * - se conservan como máximo veinte versiones automáticas por ficha y ninguna
 *   automática anterior a noventa días;
 * - la automática más reciente nunca se poda, aunque esté fuera de retención;
 * - las versiones manuales y las de restauración no caducan ni se podan;
 * - el tope de cincuenta manuales es un límite de creación, no una poda.
 */
import {
  AUTO_VERSION_MAX,
  AUTO_VERSION_RETENTION_MS,
  MANUAL_VERSION_MAX,
  VERSION_COALESCE_WINDOW_MS,
  type VersionOrigin,
} from '../../shared/contracts/versions';

/** Entrada mínima para decidir agrupación y poda. */
export interface VersionPolicyEntry {
  readonly id: string;
  readonly origin: VersionOrigin;
  readonly createdAt: number;
}

/**
 * Decide si una edición debe crear una versión automática del estado saliente.
 *
 * Solo se agrupa cuando la última versión de la ficha es automática y está
 * dentro de la ventana. Una manual o de restauración no impide abrir una nueva
 * ráfaga: la siguiente edición vuelve a guardar un punto de partida.
 */
export function shouldCreateAutoVersion(
  lastVersion: Pick<VersionPolicyEntry, 'origin' | 'createdAt'> | null,
  now: number,
  windowMs: number = VERSION_COALESCE_WINDOW_MS,
): boolean {
  if (lastVersion === null || lastVersion.origin !== 'auto') {
    return true;
  }

  return now - lastVersion.createdAt >= windowMs;
}

/** Indica si todavía se puede guardar una versión manual. */
export function canCreateManualVersion(
  versions: readonly VersionPolicyEntry[],
): boolean {
  return (
    versions.filter((version) => version.origin === 'manual').length <
    MANUAL_VERSION_MAX
  );
}

/**
 * Devuelve los IDs de las versiones automáticas que deben podarse.
 *
 * Espera todas las versiones de la ficha. Las manuales y `restore` se ignoran.
 * La automática más reciente queda protegida en cualquier caso.
 */
export function selectExpiredVersionIds(
  versions: readonly VersionPolicyEntry[],
  now: number,
  options: {
    readonly max?: number;
    readonly retentionMs?: number;
  } = {},
): readonly string[] {
  const max = Math.max(1, options.max ?? AUTO_VERSION_MAX);
  const retentionMs = options.retentionMs ?? AUTO_VERSION_RETENTION_MS;
  const cutoff = now - retentionMs;

  const autos = versions
    .filter((version) => version.origin === 'auto')
    .slice()
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt - left.createdAt;
      }

      return right.id.localeCompare(left.id);
    });

  const expired: string[] = [];

  autos.forEach((version, index) => {
    // La más reciente de las automáticas nunca se poda.
    if (index === 0) {
      return;
    }

    if (index >= max || version.createdAt < cutoff) {
      expired.push(version.id);
    }
  });

  // Se devuelven de la más antigua a la más reciente para que el borrado sea
  // predecible en las pruebas y en los registros.
  return expired.reverse();
}
