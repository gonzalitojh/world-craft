/**
 * Remapeo de identificadores y saneado de referencias.
 *
 * La importación nunca reutiliza IDs del paquete: cada ficha, tipo, etiqueta,
 * relación, versión y asset recibe un UUIDv7 nuevo. Las referencias que viajan
 * dentro del contenido se reescriben con el mapa; las que apuntan a algo que no
 * existe en el paquete se eliminan y generan un aviso.
 *
 * Las descripciones son documentos de ProseMirror ya validados. Los enlaces
 * internos usan `wc-entity://<uuidv7>`; si el destino desaparece se quita la
 * marca de enlace y se conserva el texto.
 */
import {
  ENTITY_LINK_PREFIX,
  type EntityRichTextDocument,
  type EntityRichTextMark,
  type EntityRichTextNode,
} from '../../../shared/contracts/entities';
import type { EntityFieldDefinition } from '../../../shared/contracts/entity-types';
import type { EntityFieldValue } from '../../../shared/entity-types/fields';
import type { TransferWarningCode } from '../../../shared/contracts/transfer';
import type { TransferWarningCollector } from './warnings';

/** Resultado de remapear un documento enriquecido. */
export interface RemappedDescription {
  readonly document: EntityRichTextDocument;
}

/** Resultado de remapear los atributos de una ficha. */
export interface RemappedAttributes {
  readonly attributes: Readonly<Record<string, EntityFieldValue>>;
}

/**
 * Reescribe los enlaces internos de una descripción.
 *
 * Un enlace cuyo destino no está en el paquete pierde la marca y conserva el
 * texto; el aviso se cuenta una vez por enlace roto.
 */
export function remapDescriptionLinks(
  document: EntityRichTextDocument,
  entityIdMap: ReadonlyMap<string, string>,
  warnings: TransferWarningCollector,
): RemappedDescription {
  return {
    document: {
      type: 'doc',
      ...(document.content === undefined
        ? {}
        : {
            content: document.content.map((node) =>
              remapNode(node, entityIdMap, warnings),
            ),
          }),
    },
  };
}

/**
 * Reescribe los valores de los campos `reference` de una ficha.
 *
 * Un valor que no es un ID del paquete se elimina con aviso; un valor que no
 * es una cadena se deja para la validación de la plantilla, que lo descartará
 * como atributo inválido.
 */
export function remapReferenceAttributes(
  attributes: Readonly<Record<string, EntityFieldValue>>,
  fields: readonly EntityFieldDefinition[],
  entityIdMap: ReadonlyMap<string, string>,
  warnings: TransferWarningCollector,
): RemappedAttributes {
  const next: Record<string, EntityFieldValue> = { ...attributes };

  for (const field of fields) {
    if (field.type !== 'reference') {
      continue;
    }

    const value = next[field.key];

    if (typeof value !== 'string') {
      continue;
    }

    const mapped = entityIdMap.get(value);

    if (mapped === undefined) {
      delete next[field.key];
      warnings.add('broken-reference-attribute');
      continue;
    }

    next[field.key] = mapped;
  }

  return { attributes: next };
}

/** Reescribe la galería y descarta assets ausentes. */
export function remapGallery(
  gallery: readonly { readonly assetId: string }[],
  assetIdMap: ReadonlyMap<string, string>,
  warnings: TransferWarningCollector,
): readonly string[] {
  const assetIds: string[] = [];

  for (const item of gallery) {
    const mapped = assetIdMap.get(item.assetId);

    if (mapped === undefined) {
      warnings.add('broken-gallery-asset');
      continue;
    }

    assetIds.push(mapped);
  }

  return assetIds;
}

/** Reescribe la imagen principal o la portada; `null` si no existe. */
export function remapOptionalAssetId(
  assetId: string | null,
  assetIdMap: ReadonlyMap<string, string>,
  warnings: TransferWarningCollector,
  warningCode: Extract<
    TransferWarningCode,
    'missing-entity-image' | 'missing-world-cover'
  >,
): string | null {
  if (assetId === null) {
    return null;
  }

  const mapped = assetIdMap.get(assetId);

  if (mapped === undefined) {
    warnings.add(warningCode);
    return null;
  }

  return mapped;
}

function remapNode(
  node: EntityRichTextNode,
  entityIdMap: ReadonlyMap<string, string>,
  warnings: TransferWarningCollector,
): EntityRichTextNode {
  const marks =
    node.marks === undefined
      ? undefined
      : remapMarks(node.marks, entityIdMap, warnings);

  return {
    type: node.type,
    ...(node.attrs === undefined ? {} : { attrs: node.attrs }),
    ...(node.text === undefined ? {} : { text: node.text }),
    ...(marks === undefined || marks.length === 0 ? {} : { marks }),
    ...(node.content === undefined
      ? {}
      : {
          content: node.content.map((child) =>
            remapNode(child, entityIdMap, warnings),
          ),
        }),
  };
}

function remapMarks(
  marks: readonly EntityRichTextMark[],
  entityIdMap: ReadonlyMap<string, string>,
  warnings: TransferWarningCollector,
): readonly EntityRichTextMark[] {
  const next: EntityRichTextMark[] = [];

  for (const mark of marks) {
    if (mark.type !== 'link') {
      next.push(mark);
      continue;
    }

    const href = mark.attrs?.href;

    if (typeof href !== 'string' || !href.startsWith(ENTITY_LINK_PREFIX)) {
      // El esquema ya rechazó cualquier otro protocolo; aquí solo queda una
      // marca manipulada que se descarta.
      warnings.add('broken-entity-link');
      continue;
    }

    const targetId = href.slice(ENTITY_LINK_PREFIX.length);
    const mapped = entityIdMap.get(targetId);

    if (mapped === undefined) {
      warnings.add('broken-entity-link');
      continue;
    }

    next.push({
      type: 'link',
      attrs: { href: `${ENTITY_LINK_PREFIX}${mapped}` },
    });
  }

  return next;
}
