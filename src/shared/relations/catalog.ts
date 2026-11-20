/**
 * Catálogo de los tipos de relación del sistema.
 *
 * Es contenido editable en código, no datos remotos. Las filas se siembran en
 * la migración `0005_relations` con los mismos identificadores, claves, nombres
 * directo e inverso y colores; una prueba de integración comprueba que la base
 * y este catálogo coinciden literalmente.
 *
 * Los nombres están en español porque son contenido del catálogo, no textos de
 * la interfaz: la interfaz los recibe como datos. Las claves son estables y en
 * inglés para exportaciones y referencias.
 *
 * Un tipo con el mismo nombre directo e inverso es simétrico: la interfaz lo
 * presenta como «Relacionado con» y el servicio rechaza la relación inversa
 * duplicada. Los tipos del sistema no se editan ni se borran desde la
 * aplicación.
 */
import type { RelationColor } from '../contracts/relations';

/**
 * Marca de tiempo simbólica del seed (2026-11-20).
 *
 * Los tipos del sistema no tienen una fecha de creación de usuario; se fija un
 * valor estable para que la interfaz no muestre 1970.
 */
export const SYSTEM_RELATION_TYPE_CREATED_AT = 1_795_132_800_000;

/** Forma de un tipo de relación del sistema. */
export interface SystemRelationTypeDefinition {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: RelationColor;
}

/** Los 18 tipos de relación del sistema, en el orden en que se muestran. */
export const SYSTEM_RELATION_TYPES: readonly SystemRelationTypeDefinition[] = [
  {
    id: '018f0000-0000-7000-8000-000000000101',
    key: 'related-to',
    name: 'Relacionado con',
    inverseName: 'Relacionado con',
    color: 'moss',
  },
  {
    id: '018f0000-0000-7000-8000-000000000102',
    key: 'ally-of',
    name: 'Aliado de',
    inverseName: 'Tiene como aliado a',
    color: 'moss',
  },
  {
    id: '018f0000-0000-7000-8000-000000000103',
    key: 'enemy-of',
    name: 'Enemigo de',
    inverseName: 'Tiene como enemigo a',
    color: 'danger',
  },
  {
    id: '018f0000-0000-7000-8000-000000000104',
    key: 'parent-of',
    name: 'Progenitor de',
    inverseName: 'Hijo de',
    color: 'ochre',
  },
  {
    id: '018f0000-0000-7000-8000-000000000105',
    key: 'sibling-of',
    name: 'Hermano de',
    inverseName: 'Hermano de',
    color: 'ochre',
  },
  {
    id: '018f0000-0000-7000-8000-000000000106',
    key: 'spouse-of',
    name: 'Cónyuge de',
    inverseName: 'Cónyuge de',
    color: 'danger',
  },
  {
    id: '018f0000-0000-7000-8000-000000000107',
    key: 'member-of',
    name: 'Miembro de',
    inverseName: 'Tiene como miembro a',
    color: 'prussian',
  },
  {
    id: '018f0000-0000-7000-8000-000000000108',
    key: 'leads',
    name: 'Dirige',
    inverseName: 'Está dirigido por',
    color: 'prussian',
  },
  {
    id: '018f0000-0000-7000-8000-000000000109',
    key: 'located-in',
    name: 'Ubicado en',
    inverseName: 'Contiene',
    color: 'prussian',
  },
  {
    id: '018f0000-0000-7000-8000-000000000110',
    key: 'part-of',
    name: 'Parte de',
    inverseName: 'Incluye',
    color: 'moss',
  },
  {
    id: '018f0000-0000-7000-8000-000000000111',
    key: 'owns',
    name: 'Posee',
    inverseName: 'Pertenece a',
    color: 'ochre',
  },
  {
    id: '018f0000-0000-7000-8000-000000000112',
    key: 'created',
    name: 'Creó',
    inverseName: 'Fue creado por',
    color: 'ochre',
  },
  {
    id: '018f0000-0000-7000-8000-000000000113',
    key: 'participated-in',
    name: 'Participó en',
    inverseName: 'Tuvo como participante a',
    color: 'danger',
  },
  {
    id: '018f0000-0000-7000-8000-000000000114',
    key: 'worships',
    name: 'Adora a',
    inverseName: 'Recibe culto de',
    color: 'ochre',
  },
  {
    id: '018f0000-0000-7000-8000-000000000115',
    key: 'caused',
    name: 'Causó',
    inverseName: 'Fue causado por',
    color: 'danger',
  },
  {
    id: '018f0000-0000-7000-8000-000000000116',
    key: 'protects',
    name: 'Protege a',
    inverseName: 'Está protegido por',
    color: 'moss',
  },
  {
    id: '018f0000-0000-7000-8000-000000000117',
    key: 'serves',
    name: 'Sirve a',
    inverseName: 'Tiene al servicio a',
    color: 'prussian',
  },
  {
    id: '018f0000-0000-7000-8000-000000000118',
    key: 'knows',
    name: 'Conoce a',
    inverseName: 'Es conocido por',
    color: 'moss',
  },
];

/** Posición de un tipo del sistema en el catálogo; -1 si no existe. */
export function systemRelationTypeOrder(key: string): number {
  return SYSTEM_RELATION_TYPES.findIndex((type) => type.key === key);
}

/** Indica si una clave pertenece a un tipo de relación del sistema. */
export function isSystemRelationTypeKey(key: string): boolean {
  return SYSTEM_RELATION_TYPES.some((type) => type.key === key);
}
