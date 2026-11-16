/**
 * Arranque de `pnpm test:db`.
 *
 * Exige `DIRECT_URL` y carga `.env.local` antes de la primera prueba. Si falta
 * la credencial, la suite falla aquí con instrucciones en vez de omitirse.
 */
import { readDirectUrlForTests } from './helpers/env';

readDirectUrlForTests();
