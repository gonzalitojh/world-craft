/**
 * Validación y texto plano de la descripción enriquecida de una ficha.
 *
 * La descripción se guarda como JSON de ProseMirror, no como HTML. El esquema
 * es una lista cerrada de nodos y marcas: párrafos, títulos de nivel 1–3,
 * listas, citas, texto, saltos y enlaces internos a otra ficha. Cualquier otro
 * nodo, atributo o protocolo se rechaza antes de escribir en la base.
 *
 * El texto plano se calcula con el mismo documento y se guarda aparte para la
 * búsqueda; no se usa para renderizar.
 */
import { z } from 'zod';

import {
  ENTITY_DESCRIPTION_JSON_MAX_LENGTH,
  ENTITY_DESCRIPTION_TEXT_MAX_LENGTH,
  ENTITY_LINK_PREFIX,
  type EntityRichTextDocument,
  type EntityRichTextNode,
} from '../contracts/entities';
import { UUID_V7_SOURCE } from './uuid';

const MAX_NODES = 2_000;
const MAX_INLINE_CONTENT = 2_000;
const MAX_LIST_ITEMS = 500;

const entityLinkPattern = new RegExp(
  `^${ENTITY_LINK_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${UUID_V7_SOURCE}$`,
);

const markSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bold') }),
  z.strictObject({ type: z.literal('italic') }),
  z
    .strictObject({
      type: z.literal('link'),
      attrs: z.strictObject({
        href: z.string().max(80).regex(entityLinkPattern),
        // Tiptap añade estos atributos con valor nulo por defecto. Se aceptan
        // solo para descartarlos: el documento guardado conserva `href`.
        target: z.string().max(20).nullable().optional(),
        rel: z.string().max(40).nullable().optional(),
        class: z.string().max(40).nullable().optional(),
      }),
    })
    .transform((mark) => ({
      type: 'link' as const,
      attrs: { href: mark.attrs.href },
    })),
]);

const inlineNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('text'),
      text: z.string().min(1).max(ENTITY_DESCRIPTION_TEXT_MAX_LENGTH),
      marks: z.array(markSchema).max(8).optional(),
    }),
    z.strictObject({
      type: z.literal('hardBreak'),
    }),
  ]),
);

const blockNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('paragraph'),
      content: z.array(inlineNodeSchema).max(MAX_INLINE_CONTENT).optional(),
    }),
    z.strictObject({
      type: z.literal('heading'),
      attrs: z.strictObject({
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      }),
      content: z.array(inlineNodeSchema).max(MAX_INLINE_CONTENT).optional(),
    }),
    z.strictObject({
      type: z.literal('bulletList'),
      content: z.array(listItemSchema).max(MAX_LIST_ITEMS),
    }),
    z.strictObject({
      type: z.literal('orderedList'),
      attrs: z
        .strictObject({
          start: z.number().int().min(1).max(10_000).optional(),
          type: z.null().optional(),
        })
        .optional(),
      content: z.array(listItemSchema).max(MAX_LIST_ITEMS),
    }),
    z.strictObject({
      type: z.literal('blockquote'),
      content: z.array(blockNodeSchema).max(MAX_INLINE_CONTENT),
    }),
  ]),
);

const listItemSchema: z.ZodType<unknown> = z.lazy(() =>
  z.strictObject({
    type: z.literal('listItem'),
    content: z.array(blockNodeSchema).min(1).max(MAX_INLINE_CONTENT),
  }),
);

/**
 * Esquema público del documento de descripción.
 *
 * Lo usan los esquemas IPC y la validación del servicio. No acepta HTML ni
 * nodos fuera de la lista cerrada.
 */
export const entityDescriptionDocumentSchema = z.strictObject({
  type: z.literal('doc'),
  content: z.array(blockNodeSchema).max(MAX_NODES).optional(),
});

/** Error de descripción enriquecida. */
export interface EntityDescriptionError {
  readonly code: 'invalid-description';
}

/** Resultado de validar y normalizar una descripción. */
export type EntityDescriptionResult =
  | {
      readonly ok: true;
      readonly document: EntityRichTextDocument | null;
      readonly text: string | null;
      readonly json: string | null;
    }
  | { readonly ok: false; readonly error: EntityDescriptionError };

/**
 * Valida una descripción, la normaliza y calcula su texto plano.
 *
 * `null` y `undefined` representan una descripción vacía. Una descripción con
 * solo párrafos vacíos también se normaliza a `null` para no guardar ruido.
 */
export function validateEntityDescription(
  raw: unknown,
): EntityDescriptionResult {
  if (raw === null || raw === undefined) {
    return { ok: true, document: null, text: null, json: null };
  }

  const parsed = entityDescriptionDocumentSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid-description' } };
  }

  const document = parsed.data as unknown as EntityRichTextDocument;
  const json = JSON.stringify(document);

  if (json.length > ENTITY_DESCRIPTION_JSON_MAX_LENGTH) {
    return { ok: false, error: { code: 'invalid-description' } };
  }

  const text = extractEntityDescriptionText(document);

  if (text.length > ENTITY_DESCRIPTION_TEXT_MAX_LENGTH) {
    return { ok: false, error: { code: 'invalid-description' } };
  }

  return text.length === 0
    ? { ok: true, document: null, text: null, json: null }
    : { ok: true, document, text, json };
}

/**
 * Devuelve los identificadores de las fichas enlazadas desde la descripción.
 *
 * El servicio comprueba que cada destino existe, está vivo y pertenece al
 * mismo mundo, igual que hace con los campos de tipo `reference`.
 */
export function collectEntityLinkIds(
  document: EntityRichTextDocument,
): readonly string[] {
  const ids = new Set<string>();

  const visit = (nodes: readonly EntityRichTextNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'text' && node.marks !== undefined) {
        for (const mark of node.marks) {
          const href = mark.attrs?.href;

          if (
            mark.type === 'link' &&
            typeof href === 'string' &&
            href.startsWith(ENTITY_LINK_PREFIX)
          ) {
            ids.add(href.slice(ENTITY_LINK_PREFIX.length));
          }
        }
      }

      if (node.content !== undefined) {
        visit(node.content);
      }
    }
  };

  visit(document.content ?? []);

  return [...ids];
}

/**
 * Extrae el texto plano de un documento de ProseMirror ya validado.
 *
 * Los bloques se separan con saltos de línea; las listas se leen en orden. El
 * resultado se usa para buscar y para el resumen de longitud, nunca como HTML.
 */
export function extractEntityDescriptionText(
  document: EntityRichTextDocument,
): string {
  const blocks: string[] = [];

  appendBlockText(document.content ?? [], blocks);

  return blocks
    .map((block) => block.replace(/[ \t]+/g, ' ').trim())
    .filter((block) => block.length > 0)
    .join('\n');
}

function appendBlockText(nodes: readonly unknown[], blocks: string[]): void {
  for (const node of nodes) {
    const candidate = node as {
      readonly type?: unknown;
      readonly text?: unknown;
      readonly content?: readonly unknown[];
    };

    if (candidate.type === 'text' && typeof candidate.text === 'string') {
      continue;
    }

    if (candidate.type === 'paragraph' || candidate.type === 'heading') {
      blocks.push(inlineText(candidate.content ?? []));
      continue;
    }

    if (candidate.type === 'listItem' || candidate.type === 'blockquote') {
      appendBlockText(candidate.content ?? [], blocks);
      continue;
    }

    if (candidate.type === 'bulletList' || candidate.type === 'orderedList') {
      let index = 1;

      for (const item of candidate.content ?? []) {
        const itemCandidate = item as { readonly content?: readonly unknown[] };
        const text = inlineBlockText(itemCandidate.content ?? []);

        blocks.push(
          candidate.type === 'orderedList' ? `${index}. ${text}` : `• ${text}`,
        );
        index += 1;
      }
    }
  }
}

function inlineBlockText(nodes: readonly unknown[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    const candidate = node as {
      readonly type?: unknown;
      readonly content?: readonly unknown[];
    };

    if (
      candidate.type === 'paragraph' ||
      candidate.type === 'heading' ||
      candidate.type === 'blockquote'
    ) {
      const text = inlineText(candidate.content ?? []);

      if (text.length > 0) {
        parts.push(text);
      }
    }
  }

  return parts.join(' ');
}

function inlineText(nodes: readonly unknown[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    const candidate = node as {
      readonly type?: unknown;
      readonly text?: unknown;
    };

    if (candidate.type === 'text' && typeof candidate.text === 'string') {
      parts.push(candidate.text);
    } else if (candidate.type === 'hardBreak') {
      parts.push('\n');
    }
  }

  return parts.join('');
}
