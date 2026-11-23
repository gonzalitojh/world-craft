/**
 * Modelo de vista de las relaciones de una ficha.
 *
 * Es un módulo puro: no importa React, Electron ni Node. Separa las aristas
 * salientes de los backlinks, elige la contraparte correcta, agrupa por tipo
 * con la etiqueta efectiva en esta ficha y ordena de forma determinista con
 * `Intl.Collator`. El componente solo pinta lo que este módulo resuelve; los
 * textos de interfaz viven en el catálogo de mensajes.
 */
import { toIntlLocale, type Locale } from '../../shared/contracts/locale';
import {
  relationBackwardLabel,
  relationForwardLabel,
  type RelationColor,
  type RelationEdge,
  type RelationEntityRef,
} from '../../shared/contracts/relations';

export type RelationDirection = 'outgoing' | 'incoming';

/** Entrada de relación ya resuelta para pintar en una lista. */
export interface RelationViewItem {
  readonly relation: RelationEdge;
  readonly direction: RelationDirection;
  /** Ficha de la otra punta: destino en salientes y origen en backlinks. */
  readonly counterpart: RelationEntityRef;
  /** Etiqueta que se lee en esta ficha. */
  readonly effectiveLabel: string;
  /** Etiqueta que se lee en la ficha contraparte. */
  readonly reciprocalLabel: string;
  readonly isBacklink: boolean;
}

/** Grupo de relaciones del mismo tipo y la misma pareja de etiquetas. */
export interface RelationTypeGroup {
  readonly key: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly typeColor: RelationColor;
  readonly effectiveLabel: string;
  readonly reciprocalLabel: string;
  /** La etiqueta efectiva es una sobrescritura del nombre del tipo. */
  readonly showTypeName: boolean;
  readonly items: readonly RelationViewItem[];
}

export interface RelationDirectionView {
  readonly direction: RelationDirection;
  readonly groups: readonly RelationTypeGroup[];
  readonly count: number;
}

export interface RelationView {
  readonly outgoing: RelationDirectionView;
  readonly incoming: RelationDirectionView;
  readonly total: number;
}

interface MutableGroup {
  readonly key: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly typeColor: RelationColor;
  readonly effectiveLabel: string;
  readonly reciprocalLabel: string;
  readonly showTypeName: boolean;
  readonly items: RelationViewItem[];
}

/**
 * Clasifica una arista respecto de la ficha actual.
 *
 * Una autorelación (`source.id === target.id === entityId`) se clasifica solo
 * como saliente para no contarla dos veces (C14). Cualquier arista que no toque
 * la ficha se ignora.
 */
function resolveItem(
  relation: RelationEdge,
  entityId: string,
): RelationViewItem | null {
  if (relation.source.id === entityId) {
    return {
      relation,
      direction: 'outgoing',
      counterpart: relation.target,
      effectiveLabel: relationForwardLabel(relation),
      reciprocalLabel: relationBackwardLabel(relation),
      isBacklink: false,
    };
  }

  if (relation.target.id === entityId) {
    return {
      relation,
      direction: 'incoming',
      counterpart: relation.source,
      effectiveLabel: relationBackwardLabel(relation),
      reciprocalLabel: relationForwardLabel(relation),
      isBacklink: true,
    };
  }

  return null;
}

/** Etiqueta del tipo que se leería en esta dirección sin sobrescritura. */
function directionTypeLabel(
  relation: RelationEdge,
  direction: RelationDirection,
): string {
  return direction === 'outgoing'
    ? relation.typeName
    : relation.typeInverseName;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Proyecta una lista de aristas en dos direcciones con sus grupos de tipo.
 *
 * - No muta la lista original.
 * - El orden de grupos y entradas no depende de `updatedAt`.
 * - Dos grupos pueden compartir etiqueta efectiva: la clave incluye también la
 *   recíproca, el tipo y la dirección, de modo que nunca se mezclan relaciones
 *   que se leen distinto.
 */
export function buildRelationView(
  relations: readonly RelationEdge[],
  entityId: string,
  locale: Locale,
): RelationView {
  const collator = new Intl.Collator(toIntlLocale(locale), {
    sensitivity: 'base',
    numeric: true,
  });
  const groups: Record<RelationDirection, Map<string, MutableGroup>> = {
    outgoing: new Map(),
    incoming: new Map(),
  };

  for (const relation of relations) {
    const item = resolveItem(relation, entityId);

    if (item === null) {
      continue;
    }

    const key = JSON.stringify([
      item.direction,
      relation.typeId,
      item.effectiveLabel,
      item.reciprocalLabel,
    ]);
    const existing = groups[item.direction].get(key);

    if (existing !== undefined) {
      existing.items.push(item);
      continue;
    }

    groups[item.direction].set(key, {
      key,
      typeId: relation.typeId,
      typeName: relation.typeName,
      typeColor: relation.typeColor,
      effectiveLabel: item.effectiveLabel,
      reciprocalLabel: item.reciprocalLabel,
      showTypeName:
        item.effectiveLabel !== directionTypeLabel(relation, item.direction),
      items: [item],
    });
  }

  const finalize = (direction: RelationDirection): RelationDirectionView => {
    const directionGroups = [...groups[direction].values()]
      .map<RelationTypeGroup>((group) => ({
        ...group,
        items: [...group.items].sort(
          (left, right) =>
            collator.compare(left.counterpart.name, right.counterpart.name) ||
            compareText(left.relation.id, right.relation.id),
        ),
      }))
      .sort(
        (left, right) =>
          collator.compare(left.effectiveLabel, right.effectiveLabel) ||
          collator.compare(left.typeName, right.typeName) ||
          compareText(left.key, right.key),
      );

    return {
      direction,
      groups: directionGroups,
      count: directionGroups.reduce(
        (count, group) => count + group.items.length,
        0,
      ),
    };
  };

  const outgoing = finalize('outgoing');
  const incoming = finalize('incoming');

  return {
    outgoing,
    incoming,
    total: outgoing.count + incoming.count,
  };
}

/**
 * Orden visible aplanado: salientes (grupos y entradas en orden) y después
 * backlinks. Es la base para calcular el foco siguiente o anterior al borrar.
 */
export function flattenRelationItems(
  view: RelationView,
): readonly RelationViewItem[] {
  return [view.outgoing, view.incoming].flatMap((direction) =>
    direction.groups.flatMap((group) => group.items),
  );
}
