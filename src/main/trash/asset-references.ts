/**
 * Referencias a los assets de un mundo desde filas que pueden sobrevivir a su
 * purga.
 *
 * Se consideran referencias actuales `worlds.cover_asset_id`,
 * `entities.image_asset_id` y `entity_gallery.asset_id`. El vaciado de la
 * papelera usa `resolvePurgeableWorlds` para decidir qué mundos pueden
 * purgarse en conjunto y cuáles siguen en uso; las referencias entre mundos
 * que también se van a purgar no bloquean, pero las de cualquier superviviente
 * sí. Así se resuelven cadenas y ciclos sin tocar filas ajenas y sin asumir un
 * orden concreto.
 */
import type { SqliteDatabase } from '../db/connection';

/** Reparto de mundos en papelera para el vaciado. */
export interface PurgeableWorldsPlan {
  readonly purgeable: readonly string[];
  readonly blocked: readonly string[];
}

interface ReferenceRow {
  readonly ownerWorldId: string;
  readonly referencingWorldId: string;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * Cuenta referencias externas a los assets de `worldId`.
 *
 * `allowedWorldIds` son los mundos que también se van a purgar en la misma
 * operación; por defecto solo el propio mundo. Una referencia desde uno de
 * ellos no cuenta porque no sobrevive a la purga.
 */
export function countExternalAssetReferences(
  sqlite: SqliteDatabase,
  worldId: string,
  allowedWorldIds: ReadonlySet<string> = new Set([worldId]),
): number {
  const allowed = [...allowedWorldIds];
  const excludedWorld =
    allowed.length === 0
      ? ''
      : ` AND w.id NOT IN (${placeholders(allowed.length)})`;
  const excludedEntity =
    allowed.length === 0
      ? ''
      : ` AND e.world_id NOT IN (${placeholders(allowed.length)})`;
  // El orden posicional debe coincidir con la SQL: cada subconsulta recibe
  // primero el mundo que se comprueba y después los mundos permitidos.
  const parameters = [
    worldId,
    ...allowed,
    worldId,
    ...allowed,
    worldId,
    ...allowed,
  ];
  const statement = sqlite.prepare(
    `SELECT
       (SELECT count(*)
        FROM worlds w
        JOIN assets a ON a.id = w.cover_asset_id
        WHERE a.world_id = ?${excludedWorld}) +
       (SELECT count(*)
        FROM entities e
        JOIN assets a ON a.id = e.image_asset_id
        WHERE a.world_id = ?${excludedEntity}) +
       (SELECT count(*)
        FROM entity_gallery g
        JOIN entities e ON e.id = g.entity_id
        JOIN assets a ON a.id = g.asset_id
        WHERE a.world_id = ?${excludedEntity}) AS total`,
  );
  const row = statement.get(...parameters) as
    { readonly total: number } | undefined;

  return row?.total ?? 0;
}

/**
 * Calcula qué mundos en papelera pueden purgarse sin dejar referencias rotas.
 *
 * Parte de todos los candidatos y elimina iterativamente los que tienen alguna
 * referencia desde un mundo que sobrevive (fuera de los candidatos o ya
 * bloqueado). El punto fijo resuelve ciclos: dos mundos que solo se
 * referencian entre sí se purgan juntos; si uno queda bloqueado por un tercero,
 * el otro también se conserva.
 */
export function resolvePurgeableWorlds(
  sqlite: SqliteDatabase,
  worldIds: readonly string[],
): PurgeableWorldsPlan {
  const candidates = [...new Set(worldIds)];

  if (candidates.length === 0) {
    return { purgeable: [], blocked: [] };
  }

  const references = listAssetReferences(sqlite, candidates);
  const candidateSet = new Set(candidates);
  const blocked = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;

    for (const owner of candidates) {
      if (blocked.has(owner)) {
        continue;
      }

      for (const referencingWorldId of references.get(owner) ?? []) {
        if (
          !candidateSet.has(referencingWorldId) ||
          blocked.has(referencingWorldId)
        ) {
          blocked.add(owner);
          changed = true;
          break;
        }
      }
    }
  }

  return {
    purgeable: candidates.filter((id) => !blocked.has(id)),
    blocked: candidates.filter((id) => blocked.has(id)),
  };
}

function listAssetReferences(
  sqlite: SqliteDatabase,
  worldIds: readonly string[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const marks = placeholders(worldIds.length);
  const rows = sqlite
    .prepare(
      `SELECT DISTINCT a.world_id AS "ownerWorldId", w.id AS "referencingWorldId"
       FROM assets a
       JOIN worlds w ON w.cover_asset_id = a.id
       WHERE a.world_id IN (${marks})
       UNION
       SELECT DISTINCT a.world_id, e.world_id
       FROM assets a
       JOIN entities e ON e.image_asset_id = a.id
       WHERE a.world_id IN (${marks})
       UNION
       SELECT DISTINCT a.world_id, e.world_id
       FROM assets a
       JOIN entity_gallery g ON g.asset_id = a.id
       JOIN entities e ON e.id = g.entity_id
       WHERE a.world_id IN (${marks})`,
    )
    .all(...worldIds, ...worldIds, ...worldIds) as unknown[];

  const references = new Map<string, Set<string>>();

  for (const row of rows) {
    const parsed = row as Partial<ReferenceRow>;

    if (
      typeof parsed.ownerWorldId !== 'string' ||
      typeof parsed.referencingWorldId !== 'string'
    ) {
      continue;
    }

    const set = references.get(parsed.ownerWorldId) ?? new Set<string>();

    set.add(parsed.referencingWorldId);
    references.set(parsed.ownerWorldId, set);
  }

  return references;
}
