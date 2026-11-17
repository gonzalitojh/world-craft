/**
 * Persistencia de los metadatos de assets con Drizzle.
 *
 * Todas las consultas pasan por `withUserSession`: el rol `authenticated` y los
 * claims del usuario activan la RLS. El servicio comprueba el rol antes, pero la
 * base de datos vuelve a decidir.
 *
 * La inserción declara el contexto de servidor (`app.asset_write = 'on'`) que
 * exige la guarda de la migración 0007. Sin ese GUC, un `authenticated` no puede
 * insertar un asset ni aunque tenga el privilegio de tabla.
 */
import { and, desc, eq, lt, or } from 'drizzle-orm';

import { assets, worldMembers } from '@/lib/db/schema';
import { withUserSession } from '@/lib/db/session';

import type { WorldRole } from './policy';

/** Fila de `assets` tal y como la devuelve Drizzle. */
interface AssetRow {
  id: string;
  worldId: string;
  uploaderId: string | null;
  bucket: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  createdAt: Date;
}

/** Metadatos de un asset dentro del servidor. */
export interface AssetRecord {
  id: string;
  worldId: string;
  uploaderId: string | null;
  bucket: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  createdAt: Date;
}

/** Datos que inserta el servicio tras procesar la imagen. */
export interface NewAssetRecord {
  id: string;
  worldId: string;
  uploaderId: string;
  bucket: string;
  path: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  alt: string;
}

/** Opciones de paginación de `listAssets`. */
export interface AssetListOptions {
  cursor?: string;
  limit?: number;
}

/**
 * Contrato del almacén de metadatos.
 *
 * Es una interfaz pequeña para poder usar un doble en las pruebas del servicio
 * sin base de datos. El actor viaja siempre explícito: M1-01 lo sacará de la
 * cookie y aquí ya está listo.
 */
export interface AssetStore {
  /** Rol del usuario en el mundo, o `null` si no es miembro. */
  getRole(actorId: string, worldId: string): Promise<WorldRole | null>;
  /** Inserta los metadatos con el contexto de escritura del servidor. */
  insert(actorId: string, input: NewAssetRecord): Promise<AssetRecord>;
  /** Busca un asset por mundo e id; la RLS limita a miembros. */
  find(
    actorId: string,
    worldId: string,
    assetId: string,
  ): Promise<AssetRecord | null>;
  /** Lista assets del mundo, del más reciente al más antiguo. */
  list(
    actorId: string,
    worldId: string,
    options?: AssetListOptions,
  ): Promise<AssetRecord[]>;
  /** Borra la fila y la devuelve; `null` si no existía o no era visible. */
  remove(
    actorId: string,
    worldId: string,
    assetId: string,
  ): Promise<AssetRecord | null>;
}

/** Convierte una fila de Drizzle al tipo del dominio. */
function toRecord(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    uploaderId: row.uploaderId,
    bucket: row.bucket,
    path: row.path,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    createdAt: row.createdAt,
  };
}

/** Codifica el cursor estable de paginación (`createdAt` + `id`). */
export function encodeAssetCursor(row: AssetRecord): string {
  return Buffer.from(
    `${row.createdAt.toISOString()}|${row.id}`,
    'utf8',
  ).toString('base64url');
}

/** UUID canónico, para no enviar ids arbitrarios a PostgreSQL. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decodifica un cursor; devuelve `undefined` si no es válido. */
export function decodeAssetCursor(
  cursor: string,
): { createdAt: Date; id: string } | undefined {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url')
      .toString('utf8')
      .split('|');

    if (iso === undefined || id === undefined || !UUID_PATTERN.test(id)) {
      return undefined;
    }

    const createdAt = new Date(iso);

    if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
      return undefined;
    }

    return { createdAt, id };
  } catch {
    return undefined;
  }
}

/** Implementación de `AssetStore` sobre PostgreSQL + Drizzle. */
export function createAssetStore(): AssetStore {
  return {
    async getRole(actorId, worldId) {
      const rows = await withUserSession(actorId, (db) =>
        db
          .select({ role: worldMembers.role })
          .from(worldMembers)
          .where(
            and(
              eq(worldMembers.worldId, worldId),
              eq(worldMembers.userId, actorId),
            ),
          )
          .limit(1),
      );

      return rows[0]?.role ?? null;
    },

    async insert(actorId, input) {
      return withUserSession(
        actorId,
        async (db) => {
          const [row] = await db
            .insert(assets)
            .values({
              id: input.id,
              worldId: input.worldId,
              uploaderId: input.uploaderId,
              bucket: input.bucket,
              path: input.path,
              mime: input.mime,
              size: input.size,
              width: input.width,
              height: input.height,
              alt: input.alt,
            })
            .returning();

          if (row === undefined) {
            throw new Error('La inserción de assets no devolvió fila');
          }

          return toRecord(row);
        },
        {
          settings: {
            'app.asset_write': 'on',
            'app.asset_bucket': input.bucket,
          },
        },
      );
    },

    async find(actorId, worldId, assetId) {
      return withUserSession(actorId, async (db) => {
        const [row] = await db
          .select()
          .from(assets)
          .where(and(eq(assets.worldId, worldId), eq(assets.id, assetId)))
          .limit(1);

        return row === undefined ? null : toRecord(row);
      });
    },

    async list(actorId, worldId, options = {}) {
      const limit = options.limit ?? 50;
      const decoded =
        options.cursor === undefined
          ? undefined
          : decodeAssetCursor(options.cursor);

      return withUserSession(actorId, async (db) => {
        const rows = await db
          .select()
          .from(assets)
          .where(
            decoded === undefined
              ? eq(assets.worldId, worldId)
              : and(
                  eq(assets.worldId, worldId),
                  or(
                    lt(assets.createdAt, decoded.createdAt),
                    and(
                      eq(assets.createdAt, decoded.createdAt),
                      lt(assets.id, decoded.id),
                    ),
                  ),
                ),
          )
          .orderBy(desc(assets.createdAt), desc(assets.id))
          .limit(limit);

        return rows.map(toRecord);
      });
    },

    async remove(actorId, worldId, assetId) {
      return withUserSession(actorId, async (db) => {
        const [row] = await db
          .delete(assets)
          .where(and(eq(assets.worldId, worldId), eq(assets.id, assetId)))
          .returning();

        return row === undefined ? null : toRecord(row);
      });
    },
  };
}
