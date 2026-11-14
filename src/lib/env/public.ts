/**
 * Variables de entorno públicas ya validadas.
 *
 * Seguro de importar desde componentes cliente: solo contiene claves
 * `NEXT_PUBLIC_*` y se leen con acceso literal para que Next.js las incruste
 * en el bundle en tiempo de compilación.
 */
import { parsePublicEnv } from './public-schema';

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
