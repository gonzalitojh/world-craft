/**
 * Configuración de Drizzle Kit.
 *
 * Solo la usan los scripts `db:*`; nunca se importa desde la aplicación.
 *
 * - `dialect: 'postgresql'` y driver `postgres` (ADR 0002).
 * - `schema` apunta al índice del esquema, que es la única fuente de verdad de
 *   tablas, enums, claves, restricciones e índices.
 * - `out: './drizzle'` guarda las migraciones versionadas. Las migraciones
 *   personalizadas (extensiones, funciones, triggers, RLS y privilegios) viven
 *   en la misma cadena y en el mismo journal, para que el orden sea explícito.
 * - `dbCredentials.url` usa `DIRECT_URL` (pooler de sesión) si existe y, si no,
 *   `DATABASE_URL`. `db:generate` y `db:check` no abren conexión, así que la CI
 *   funciona sin credenciales.
 *
 * `drizzle-kit push` está **prohibido** en este repositorio: el esquema solo se
 * aplica con migraciones versionadas y revisadas (ver `CONTRIBUTING.md`).
 */
import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

// Carga `.env.local` si existe, sin sobrescribir el entorno del proceso. Los
// scripts de base de datos hacen lo mismo; aquí se repite para que `db:generate`
// y `db:migrate` funcionen sin exportar variables a mano.
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
