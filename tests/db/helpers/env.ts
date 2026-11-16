/**
 * Carga del entorno para las pruebas de integración.
 *
 * `pnpm test:db` exige `DIRECT_URL` (pooler de sesión). Sin credenciales falla
 * con un mensaje claro en vez de omitir las pruebas: una suite de RLS que se
 * salta en silencio no demuestra nada.
 */
import { existsSync } from 'node:fs';

const ENV_FILES = ['.env.local', '.env'];

let loaded = false;

/** Carga `.env.local` o `.env` una sola vez. */
export function loadDatabaseEnv(): void {
  if (loaded) {
    return;
  }

  loaded = true;

  for (const file of ENV_FILES) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

/** Devuelve `DIRECT_URL` o lanza con instrucciones. */
export function readDirectUrlForTests(): string {
  loadDatabaseEnv();

  const url = process.env.DIRECT_URL?.trim();

  if (!url) {
    throw new Error(
      'Falta DIRECT_URL para pnpm test:db. Copia .env.example a .env.local y pega la cadena del pooler de sesión del proyecto de Supabase de desarrollo.',
    );
  }

  return url;
}

/** SSL obligatorio salvo en un PostgreSQL local sin TLS. */
export function sslForTests(url: string): false | 'require' {
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('sslmode=disable')
  ) {
    return false;
  }

  return 'require';
}
