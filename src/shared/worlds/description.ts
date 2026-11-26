/**
 * Validación y lectura de la descripción enriquecida de un mundo.
 *
 * Reutiliza el esquema cerrado de las fichas (`src/shared/entities/description`)
 * para no mantener dos listas de nodos. La diferencia es el límite de texto
 * plano: la descripción del mundo vigente admite 4.000 caracteres, no 50.000.
 *
 * El documento se guarda como JSON de ProseMirror y su texto plano derivado en
 * `worlds.description_text`. La lectura es tolerante: un JSON corrupto no
 * pierde el texto visible porque el servicio lo reconstruye desde el texto
 * plano guardado.
 */
import type { EntityRichTextDocument } from '../contracts/entities';
import {
  WORLD_DESCRIPTION_JSON_MAX_LENGTH,
  WORLD_DESCRIPTION_TEXT_MAX_LENGTH,
} from '../contracts/worlds';
import { validateEntityDescription } from '../entities/description';

/** Resultado de validar y normalizar la descripción de un mundo. */
export type WorldDescriptionResult =
  | {
      readonly ok: true;
      readonly document: EntityRichTextDocument | null;
      readonly text: string | null;
      readonly json: string | null;
    }
  | { readonly ok: false; readonly error: { readonly code: 'invalid-description' } };

/**
 * Valida un documento de descripción de mundo y calcula su texto plano.
 *
 * `null` y `undefined` representan una descripción vacía. Un documento con solo
 * párrafos vacíos también se normaliza a `null`.
 */
export function validateWorldDescription(
  raw: unknown,
): WorldDescriptionResult {
  const result = validateEntityDescription(raw);

  if (!result.ok) {
    return result;
  }

  if (
    result.json !== null &&
    result.json.length > WORLD_DESCRIPTION_JSON_MAX_LENGTH
  ) {
    return { ok: false, error: { code: 'invalid-description' } };
  }

  if (
    result.text !== null &&
    result.text.length > WORLD_DESCRIPTION_TEXT_MAX_LENGTH
  ) {
    return { ok: false, error: { code: 'invalid-description' } };
  }

  return result;
}

/** Resultado de leer el JSON guardado, con distinción de vacío e inválido. */
export type ParsedWorldDescription =
  | {
      readonly ok: true;
      readonly document: EntityRichTextDocument | null;
    }
  | { readonly ok: false };

/**
 * Lee el JSON guardado con el documento validado.
 *
 * `null` o una cadena vacía son una descripción vacía. Un JSON ilegible o fuera
 * del esquema devuelve `ok: false`; el servicio decide reconstruir el documento
 * desde `description_text` en lugar de exponer contenido inválido.
 */
export function parseWorldDescription(
  raw: string | null,
): ParsedWorldDescription {
  if (raw === null || raw.trim().length === 0) {
    return { ok: true, document: null };
  }

  let value: unknown;

  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false };
  }

  const result = validateWorldDescription(value);

  return result.ok
    ? { ok: true, document: result.document }
    : { ok: false };
}
