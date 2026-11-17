'use server';

/**
 * Server Action para cambiar el idioma de la interfaz.
 *
 * Hoy el único idioma con catálogo es `es`, así que la acción no se usa desde
 * una pantalla: queda lista para el selector de preferencias de M1-06. Aun así
 * valida todo lo que recibe, porque una Server Action es un endpoint más.
 *
 * Escribe una cookie HttpOnly sin datos personales y revalida el layout para
 * que la siguiente petición se pinte en el idioma elegido.
 */
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { availableLocales, type Locale } from '@/messages';

import { LOCALE_COOKIE_NAME, localeCookieOptions } from './cookie';
import { isLocale, MAX_LANGUAGE_TAG_LENGTH } from './locale';

/** Resultado tipado de la acción. */
export type SetLocaleResult =
  | { ok: true; locale: Locale }
  | { ok: false; error: 'invalid' | 'unsupported' };

const localeSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LANGUAGE_TAG_LENGTH)
  .refine(isLocale, { message: 'Idioma desconocido' });

/**
 * Guarda el idioma elegido en la cookie `wc-locale`.
 *
 * Solo acepta idiomas del producto **y con catálogo completo**. Cambiar a un
 * idioma sin catálogo se rechaza en lugar de servir español con la etiqueta
 * equivocada.
 */
export async function setLocale(input: unknown): Promise<SetLocaleResult> {
  const parsed = localeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: 'invalid' };
  }

  if (!availableLocales.includes(parsed.data)) {
    return { ok: false, error: 'unsupported' };
  }

  const cookieStore = await cookies();

  cookieStore.set(
    LOCALE_COOKIE_NAME,
    parsed.data,
    localeCookieOptions(process.env.NODE_ENV === 'production'),
  );

  revalidatePath('/', 'layout');

  return { ok: true, locale: parsed.data };
}
