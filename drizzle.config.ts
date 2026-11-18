/**
 * Configuración de Drizzle Kit.
 *
 * Solo se usa para generar y revisar migraciones (`db:generate`, `db:check`).
 * Las migraciones nunca se aplican con `drizzle-kit push` ni `drizzle-kit
 * migrate`: el runner propio de la aplicación las ejecuta en una transacción y
 * con copia previa (ADR 0002).
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
