/**
 * Normalización de la entrada de la papelera.
 *
 * El cursor es opaco para el renderer (`${deletedAt}:${id}`). Aquí se convierte
 * a un par tipado y se acota el límite: el IPC ya valida la forma, pero el
 * servicio no confía en valores fuera de rango.
 */
import {
  TRASH_PAGE_LIMIT_DEFAULT,
  TRASH_PAGE_LIMIT_MAX,
} from '../../shared/contracts/trash';

/** Cursor ya normalizado. */
export interface TrashCursor {
  readonly deletedAt: number;
  readonly id: string;
}

/** Acota el límite de una página entre 1 y el máximo admitido. */
export function normalizeTrashLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return TRASH_PAGE_LIMIT_DEFAULT;
  }

  return Math.min(TRASH_PAGE_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
}

/** Convierte un cursor opaco en su par ordenado; `null` si no es válido. */
export function parseTrashCursor(raw: string | undefined): TrashCursor | null {
  if (raw === undefined) {
    return null;
  }

  const separator = raw.indexOf(':');

  if (separator <= 0) {
    return null;
  }

  const deletedAt = Number(raw.slice(0, separator));
  const id = raw.slice(separator + 1);

  if (
    !Number.isSafeInteger(deletedAt) ||
    deletedAt < 0 ||
    !/^[0-9a-f-]{36}$/.test(id)
  ) {
    return null;
  }

  return { deletedAt, id };
}

/** Codifica el cursor opaco de la última fila de una página. */
export function encodeTrashCursor(cursor: TrashCursor): string {
  return `${cursor.deletedAt}:${cursor.id}`;
}

/** Calcula el cursor siguiente a partir de las filas devueltas. */
export function nextTrashCursor(
  rows: readonly { readonly deletedAt: number; readonly id: string }[],
  limit: number,
): string | null {
  if (rows.length < limit) {
    return null;
  }

  const last = rows[rows.length - 1];

  if (last === undefined) {
    return null;
  }

  return encodeTrashCursor({ deletedAt: last.deletedAt, id: last.id });
}
