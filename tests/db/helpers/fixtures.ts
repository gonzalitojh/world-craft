/**
 * Fixtures de las pruebas de integración y RLS.
 *
 * Se crean con la conexión privilegiada (que salta RLS) y se limpian al
 * terminar. Las pruebas de permisos solo usan `asUser`; los triggers del
 * esquema siguen activos, así que las fixtures también comprueban la
 * integridad (por ejemplo, la membresía `owner` la crea el trigger del mundo).
 */
import { randomUUID } from 'node:crypto';

import { first, getClient } from './client';

export type WorldRole = 'owner' | 'editor' | 'viewer';

export interface TestUser {
  id: string;
  email: string;
}

export interface TestWorld {
  id: string;
  ownerId: string;
  slug: string;
}

const TEST_EMAIL_DOMAIN = 'world-craft.invalid';

/** Identificador corto para slugs únicos. */
function shortId(): string {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

/** Crea un usuario de prueba en `auth.users` con su perfil. */
export async function createTestUser(label = 'user'): Promise<TestUser> {
  const sql = getClient();
  const id = randomUUID();
  const email = `test-${label}-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;

  await sql.begin(async (tx) => {
    await tx`
      insert into auth.users (id, email, email_confirmed_at, created_at, updated_at)
      values (${id}::uuid, ${email}, now(), now(), now())
    `;
    await tx`
      insert into public.profiles (id, display_name)
      values (${id}::uuid, ${label})
      on conflict (id) do nothing
    `;
  });

  return { id, email };
}

/** Borra un usuario de prueba y los mundos que posee. */
export async function deleteTestUser(user: TestUser): Promise<void> {
  const sql = getClient();

  await sql`delete from public.worlds where owner_id = ${user.id}::uuid`;
  await sql`delete from auth.users where id = ${user.id}::uuid`;
}

/** Crea un mundo; el trigger añade la membresía `owner`. */
export async function createTestWorld(
  ownerId: string,
  options: { name?: string } = {},
): Promise<TestWorld> {
  const sql = getClient();
  const slug = `world-${shortId()}`;
  const name = options.name ?? 'Mundo de prueba';
  const rows = await sql<{ id: string }[]>`
    insert into public.worlds (owner_id, name, slug)
    values (${ownerId}::uuid, ${name}, ${slug})
    returning id
  `;

  return { id: first(rows).id, ownerId, slug };
}

/** Borra un mundo y, en cascada, su contenido. */
export async function deleteTestWorld(worldId: string): Promise<void> {
  await getClient()`delete from public.worlds where id = ${worldId}::uuid`;
}

/** Añade un miembro a un mundo con el rol indicado. */
export async function addWorldMember(
  worldId: string,
  userId: string,
  role: WorldRole,
): Promise<void> {
  await getClient()`
    insert into public.world_members (world_id, user_id, role)
    values (${worldId}::uuid, ${userId}::uuid, ${role}::world_role)
    on conflict (world_id, user_id) do update set role = excluded.role
  `;
}

/** Id de un tipo de entidad del sistema (requiere el seed aplicado). */
export async function getSystemEntityTypeId(
  key = 'character',
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    select id from public.entity_types
    where world_id is null and key = ${key}
  `;

  return first(rows).id;
}

/** Id de un tipo de relación del sistema (requiere el seed aplicado). */
export async function getSystemRelationTypeId(key = 'family'): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    select id from public.relation_types
    where world_id is null and key = ${key}
  `;

  return first(rows).id;
}

/** Crea una ficha de prueba. */
export async function createTestEntity(
  worldId: string,
  typeId: string,
  options: { name?: string; summary?: string } = {},
): Promise<{ id: string; slug: string }> {
  const sql = getClient();
  const slug = `entity-${shortId()}`;
  const name = options.name ?? 'Entidad de prueba';
  const rows = await sql<{ id: string; slug: string }[]>`
    insert into public.entities (world_id, type_id, name, slug, summary)
    values (${worldId}::uuid, ${typeId}::uuid, ${name}, ${slug}, ${options.summary ?? ''})
    returning id, slug
  `;

  return first(rows);
}

/** Crea una etiqueta de prueba. */
export async function createTestTag(
  worldId: string,
  name = 'Etiqueta',
): Promise<{ id: string; slug: string }> {
  const sql = getClient();
  const slug = `tag-${shortId()}`;
  const rows = await sql<{ id: string; slug: string }[]>`
    insert into public.tags (world_id, name, slug)
    values (${worldId}::uuid, ${name}, ${slug})
    returning id, slug
  `;

  return first(rows);
}

/** Etiqueta una ficha. */
export async function linkEntityTag(
  entityId: string,
  tagId: string,
): Promise<void> {
  await getClient()`
    insert into public.entity_tags (entity_id, tag_id)
    values (${entityId}::uuid, ${tagId}::uuid)
  `;
}

/** Crea una relación entre dos fichas. */
export async function createTestRelation(
  worldId: string,
  sourceId: string,
  targetId: string,
  typeId: string,
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.relations (world_id, source_id, target_id, type_id)
    values (${worldId}::uuid, ${sourceId}::uuid, ${targetId}::uuid, ${typeId}::uuid)
    returning id
  `;

  return first(rows).id;
}

/** Crea un asset con metadatos; permite forzar una `path` inválida. */
export async function createTestAsset(
  worldId: string,
  uploaderId: string,
  options: { path?: string; alt?: string } = {},
): Promise<{ id: string; path: string }> {
  const assetId = randomUUID();
  const path = options.path ?? `world/${worldId}/${assetId}.png`;
  const sql = getClient();
  const rows = await sql<{ id: string; path: string }[]>`
    insert into public.assets (
      id, world_id, uploader_id, bucket, path, mime, size, alt
    )
    values (
      ${assetId}::uuid, ${worldId}::uuid, ${uploaderId}::uuid,
      'world-craft-assets', ${path}, 'image/png', 1024, ${options.alt ?? ''}
    )
    returning id, path
  `;

  return first(rows);
}

/** Crea un mapa de prueba. */
export async function createTestMap(
  worldId: string,
  name = 'Mapa de prueba',
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.maps (world_id, name)
    values (${worldId}::uuid, ${name})
    returning id
  `;

  return first(rows).id;
}

/** Crea un manuscrito de prueba. */
export async function createTestManuscript(
  worldId: string,
  title = 'Manuscrito de prueba',
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.manuscripts (world_id, title, kind)
    values (${worldId}::uuid, ${title}, 'novel')
    returning id
  `;

  return first(rows).id;
}

/** Crea un libro dentro de un manuscrito. */
export async function createTestBook(
  manuscriptId: string,
  title = 'Libro',
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.books (manuscript_id, title)
    values (${manuscriptId}::uuid, ${title})
    returning id
  `;

  return first(rows).id;
}

/** Crea un capítulo dentro de un libro. */
export async function createTestChapter(
  bookId: string,
  title = 'Capítulo',
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.chapters (book_id, title)
    values (${bookId}::uuid, ${title})
    returning id
  `;

  return first(rows).id;
}

/** Crea una escena dentro de un capítulo. */
export async function createTestScene(
  chapterId: string,
  title = 'Escena',
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.scenes (chapter_id, title)
    values (${chapterId}::uuid, ${title})
    returning id
  `;

  return first(rows).id;
}

/** Crea un pack de contenido de juego. */
export async function createTestGamePack(
  worldId: string,
  createdBy: string,
  name = `Pack ${shortId()}`,
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.game_content_packs (world_id, name, created_by)
    values (${worldId}::uuid, ${name}, ${createdBy}::uuid)
    returning id
  `;

  return first(rows).id;
}

/** Crea una tabla de juego dentro de un pack. */
export async function createTestGameTable(
  packId: string,
  worldId: string,
  createdBy: string,
  key = `table_${shortId()}`,
): Promise<string> {
  const sql = getClient();
  const rows = await sql<{ id: string }[]>`
    insert into public.game_tables (
      world_id, pack_id, key, name, category, created_by
    )
    values (
      ${worldId}::uuid, ${packId}::uuid, ${key}, 'Tabla de prueba',
      'custom', ${createdBy}::uuid
    )
    returning id
  `;

  return first(rows).id;
}
