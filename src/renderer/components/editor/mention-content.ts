/**
 * Construcción del contenido de una mención.
 *
 * Una mención es un enlace interno normal: un nodo `text` con la marca `link`
 * `wc-entity://<uuid>` y, opcionalmente, un espacio sin marca para que el texto
 * que se escriba después no herede el enlace. Se construye con el esquema de
 * ProseMirror, nunca con HTML, así que un nombre con `<`, `&` o comillas se
 * guarda como texto literal.
 */
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';

import {
  ENTITY_LINK_PREFIX,
  type EntityRichTextNode,
  type EntitySummary,
} from '../../../shared/contracts/entities';

/** Entidad mínima necesaria para construir una mención. */
export type MentionEntity = Pick<EntitySummary, 'id' | 'name'>;

/** `href` interno de una mención a la ficha indicada. */
export function mentionHref(entityId: string): string {
  return `${ENTITY_LINK_PREFIX}${entityId}`;
}

/**
 * Nodos de ProseMirror de una mención: el nombre enlazado y el espacio sin
 * marca que lo separa de lo siguiente.
 */
export function buildMentionNodes(
  schema: Schema,
  entity: MentionEntity,
): { readonly mention: ProseMirrorNode; readonly space: ProseMirrorNode } {
  const link = schema.marks.link;

  if (link === undefined) {
    throw new Error('El esquema no declara la marca de enlace interna.');
  }

  const href = mentionHref(entity.id);
  const mention = schema.text(entity.name, [link.create({ href })]);
  const space = schema.text(' ');

  return { mention, space };
}

/**
 * Contenido serializable de una mención para insertarlo en el documento.
 *
 * `trailingSpace: false` se usa cuando el texto siguiente ya empieza por un
 * espacio: se evita duplicarlo sin dejar el cursor dentro del enlace.
 */
export function buildMentionContent(
  schema: Schema,
  entity: MentionEntity,
  options: { readonly trailingSpace?: boolean } = {},
): readonly EntityRichTextNode[] {
  const { mention, space } = buildMentionNodes(schema, entity);
  const nodes: EntityRichTextNode[] = [mention.toJSON() as EntityRichTextNode];

  if (options.trailingSpace !== false) {
    nodes.push(space.toJSON() as EntityRichTextNode);
  }

  return nodes;
}
