/**
 * Cuarentena de metadatos de assets.
 *
 * Este módulo no conoce Electron ni el sistema de archivos: solo mueve filas
 * entre `assets` y `assets_quarantine`. Los archivos no se renombran ni se
 * borran; la ruta relativa original se conserva para que el flujo de huérfanos
 * pueda localizarlos y el usuario decida si los elimina con copia previa.
 *
 * `quarantineWorldAssets` se ejecuta dentro de la transacción de purga del
 * mundo. `countQuarantine` es tolerante a bases antiguas sin las tablas de
 * cuarentena y devuelve ceros en ese caso.
 */
import type { SqliteDatabase } from '../db/connection';

/** Motivos admitidos por el CHECK de `assets_quarantine.reason`. */
export type QuarantineReason = 'world-missing' | 'world-purged';

/** Recuentos de la cuarentena, sin rutas ni identificadores. */
export interface QuarantineCounts {
  readonly assets: number;
  readonly references: number;
}

const ZERO_COUNTS: QuarantineCounts = { assets: 0, references: 0 };

/**
 * Mueve a cuarentena todas las filas de `assets` de un mundo.
 *
 * Devuelve cuántas filas se movieron. El llamador debe haber comprobado antes
 * que ninguna fila superviviente de otro mundo referencia esos assets. No se
 * tocan los archivos del equipo.
 */
export function quarantineWorldAssets(
  sqlite: SqliteDatabase,
  worldId: string,
  at: number,
): number {
  const quarantinedAt = Math.max(0, Math.trunc(at));

  const move = sqlite.transaction((): number => {
    const inserted = sqlite
      .prepare(
        `INSERT INTO assets_quarantine (
           id, world_id, kind, relative_path, mime, size, width, height, alt,
           hash, created_at, reason, quarantined_at
         )
         SELECT
           id, world_id, kind, relative_path, mime, size, width, height, alt,
           hash, created_at, 'world-purged', ?
         FROM assets
         WHERE world_id = ?`,
      )
      .run(quarantinedAt, worldId);

    sqlite.prepare('DELETE FROM assets WHERE world_id = ?').run(worldId);

    return inserted.changes;
  });

  return move();
}

/**
 * Cuenta las filas y referencias auditadas de la cuarentena.
 *
 * En una base anterior a la migración 0009 las tablas no existen; una base de
 * prueba o una restauración parcial no debe romper el resumen de Ajustes.
 */
export function countQuarantine(sqlite: SqliteDatabase): QuarantineCounts {
  if (!hasTable(sqlite, 'assets_quarantine')) {
    return ZERO_COUNTS;
  }

  if (!hasTable(sqlite, 'assets_quarantine_references')) {
    return ZERO_COUNTS;
  }

  const assets = sqlite
    .prepare('SELECT count(*) AS total FROM assets_quarantine')
    .get() as { readonly total: number } | undefined;
  const references = sqlite
    .prepare('SELECT count(*) AS total FROM assets_quarantine_references')
    .get() as { readonly total: number } | undefined;

  return {
    assets: assets?.total ?? 0,
    references: references?.total ?? 0,
  };
}

function hasTable(sqlite: SqliteDatabase, name: string): boolean {
  return (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name) !== undefined
  );
}
