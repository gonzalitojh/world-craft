/**
 * Variables de entorno de servidor ya validadas.
 *
 * `server-only` hace fallar la compilación si algún módulo cliente importa
 * este archivo, de modo que los secretos no pueden acabar en el bundle.
 */
import 'server-only';

import { parseServerEnv } from './server-schema';

export const serverEnv = parseServerEnv(process.env);
