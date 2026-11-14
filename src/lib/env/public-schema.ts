/**
 * Esquema de las variables de entorno **públicas**.
 *
 * Este módulo debe poder importarse desde cualquier sitio, incluido código que
 * se envía al navegador. Por eso solo contiene claves con prefijo
 * `NEXT_PUBLIC_`: Next.js las incrusta en el bundle y nunca son secretos.
 *
 * Las claves de servidor (Supabase, base de datos y R2) viven en
 * `server-schema.ts` y se leen solo desde `server.ts`.
 */
import { z } from 'zod';

/**
 * Convierte una cadena vacía o solo con espacios en `undefined`.
 *
 * Los archivos `.env` suelen declarar la clave sin valor (`SUPABASE_URL=`) y
 * eso debe tratarse como «ausente», no como un valor inválido.
 */
export const emptyAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Variable de texto opcional que trata la cadena vacía como ausente. */
export const optionalText = z.preprocess(
  emptyAsUndefined,
  z.string().min(1).optional(),
);

/** Variable de URL opcional que trata la cadena vacía como ausente. */
export const optionalUrl = z.preprocess(emptyAsUndefined, z.url().optional());

/**
 * URL absoluta servida por `http` o `https`.
 *
 * Zod compara el protocolo sin los dos puntos, así que `/^https?$/` acepta
 * `http:` y `https:`. Descarta `javascript:`, `mailto:`, `data:` o `ftp:`,
 * que nunca pueden ser el origen de `metadataBase`.
 */
const optionalHttpUrl = z.preprocess(
  emptyAsUndefined,
  z.url({ protocol: /^https?$/ }).optional(),
);

/**
 * Esquema de variables de entorno públicas.
 *
 * `NEXT_PUBLIC_SITE_URL` es el origen canónico del despliegue y debe usar
 * http o https. En local y en las previews de Vercel puede faltar:
 * `src/lib/site-url.ts` resuelve el valor de respaldo.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalHttpUrl,
});

/** Variables públicas ya validadas. */
export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Valida las variables públicas a partir de una fuente.
 *
 * Es una función pura y **solo copia claves públicas**: aunque reciba el
 * `process.env` completo, el resultado no contiene secretos. Así un error de
 * importación no puede filtrar claves de servidor al bundle del cliente.
 */
export function parsePublicEnv(
  source: Record<string, string | undefined> = {},
): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL,
  });
}
