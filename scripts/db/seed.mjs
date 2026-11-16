/**
 * `db:seed` — aplica el catálogo del sistema de forma idempotente.
 *
 * Los tipos de entidad y de relación del sistema se identifican por `key` con
 * `world_id is null`, la misma clave del índice único parcial. El `upsert`
 * actualiza nombre, icono y campos, pero **nunca borra** filas: si un tipo
 * desaparece del catálogo, se decide en una migración posterior para no romper
 * referencias.
 *
 * La validación completa del catálogo (iconos permitidos, sin correos, forma
 * exacta) vive en `src/lib/db/seed/catalog.ts` y corre en las pruebas. Aquí se
 * comprueba lo mínimo para no insertar datos incoherentes si alguien edita el
 * JSON a mano.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertNotProduction,
  closeConnection,
  connectDirect,
  printDetail,
  printOk,
  printTitle,
  redactUrl,
  runScript,
} from './lib.mjs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXPECTED_ENTITY_TYPES = 12;
const EXPECTED_RELATION_TYPES = 15;

/** Comprueba la estructura mínima del catálogo antes de tocar la base de datos. */
function assertCatalog(catalog) {
  const problems = [];

  if (catalog?.version !== 1) {
    problems.push('version debe ser 1');
  }

  const collections = [
    ['entityTypes', EXPECTED_ENTITY_TYPES],
    ['relationTypes', EXPECTED_RELATION_TYPES],
  ];

  for (const [name, expected] of collections) {
    const items = catalog?.[name];

    if (!Array.isArray(items) || items.length !== expected) {
      problems.push(`${name} debe tener ${expected} elementos`);
      continue;
    }

    const ids = new Set();
    const keys = new Set();

    for (const item of items) {
      if (!UUID_PATTERN.test(item?.id ?? '')) {
        problems.push(`${name}: id no válido en «${item?.key}»`);
      }

      if (ids.has(item.id)) {
        problems.push(`${name}: id repetido (${item.id})`);
      }

      if (keys.has(item.key)) {
        problems.push(`${name}: clave repetida (${item.key})`);
      }

      if (item.worldId !== null || item.isSystem !== true) {
        problems.push(`${name}: «${item.key}» debe ser del sistema`);
      }

      if (typeof item.name !== 'string' || item.name.trim() === '') {
        problems.push(`${name}: «${item.key}» no tiene nombre`);
      }

      ids.add(item.id);
      keys.add(item.key);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Catálogo del sistema inválido:\n- ${problems.join('\n- ')}`,
    );
  }
}

await runScript('db:seed', async () => {
  assertNotProduction();

  const catalog = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'src/lib/db/seed/system-catalog.json'),
      'utf8',
    ),
  );

  assertCatalog(catalog);

  const { sql, url } = connectDirect();

  printTitle('Seed del catálogo del sistema');
  printDetail(`Destino: ${redactUrl(url)}`);

  try {
    await sql.begin(async (tx) => {
      for (const type of catalog.entityTypes) {
        await tx`
          insert into public.entity_types (
            id, world_id, key, name, icon, color, fields, is_system
          )
          values (
            ${type.id}::uuid, null, ${type.key}, ${type.name}, ${type.icon},
            null, ${JSON.stringify(type.fields)}::jsonb, true
          )
          on conflict (key) where world_id is null
          do update set
            name = excluded.name,
            icon = excluded.icon,
            color = excluded.color,
            fields = excluded.fields,
            is_system = excluded.is_system
        `;
      }

      for (const type of catalog.relationTypes) {
        await tx`
          insert into public.relation_types (
            id, world_id, key, name, inverse_name, color, is_system
          )
          values (
            ${type.id}::uuid, null, ${type.key}, ${type.name},
            ${type.inverseName}, null, true
          )
          on conflict (key) where world_id is null
          do update set
            name = excluded.name,
            inverse_name = excluded.inverse_name,
            color = excluded.color,
            is_system = excluded.is_system
        `;
      }
    });

    const [entityCount] = await sql`
      select count(*)::int as count
      from public.entity_types
      where world_id is null
    `;
    const [relationCount] = await sql`
      select count(*)::int as count
      from public.relation_types
      where world_id is null
    `;

    printOk(`${entityCount.count} tipos de entidad del sistema`);
    printOk(`${relationCount.count} tipos de relación del sistema`);
    printDetail(
      'El seed es idempotente: puedes ejecutarlo de nuevo sin duplicar.',
    );
  } finally {
    await closeConnection(sql);
  }
});
