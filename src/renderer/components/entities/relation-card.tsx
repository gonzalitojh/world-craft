import {
  relationForwardLabel,
  relationBackwardLabel,
} from '../../../shared/contracts/relations';
import type { RelationEdge } from '../../../shared/contracts/relations';
import type { RelationViewItem } from '../../lib/relation-groups';
import { useI18n } from '../../i18n/provider';
import { Badge } from '../badge';
import { Button } from '../button';
import { Menu, type MenuItem } from '../menu';
import { TypeIcon } from './type-icon';

export interface RelationCardProps {
  readonly item: RelationViewItem;
  readonly pending: boolean;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onEdit: (relation: RelationEdge) => void;
  readonly onRemove: (relation: RelationEdge) => void;
}

function OutgoingIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function IncomingIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16 10H5M9 6l-4 4 4 4" />
    </svg>
  );
}

/**
 * Etiqueta efectiva y recíproca de una arista para la ficha actual.
 *
 * Se expone porque el diálogo de borrado necesita el mismo par de textos que
 * muestra la entrada, sin recalcular la regla en cada sitio.
 */
export function relationLabels(
  relation: RelationEdge,
  entityId: string,
): { readonly effective: string; readonly reciprocal: string } {
  return relation.source.id === entityId
    ? {
        effective: relationForwardLabel(relation),
        reciprocal: relationBackwardLabel(relation),
      }
    : {
        effective: relationBackwardLabel(relation),
        reciprocal: relationForwardLabel(relation),
      };
}

/**
 * Entrada de relación: unidad de lista separada por un divisor.
 *
 * No es una tarjeta ni una fila de tabla. La acción principal es abrir la
 * contraparte; editar y eliminar viven en el menú «⋯». La fuerza se comunica
 * con forma y nombre accesible, y la dirección lleva siempre palabra e icono.
 */
export function RelationCard({
  item,
  pending,
  onOpenEntity,
  onEdit,
  onRemove,
}: RelationCardProps) {
  const { messages } = useI18n();
  const relations = messages.entities.relations;
  const { relation, counterpart, isBacklink, effectiveLabel } = item;
  const strength = relation.strength;
  const menuItems: readonly MenuItem[] = [
    {
      id: 'edit',
      label: relations.editMenuItem,
      disabled: pending,
      onSelect: () => {
        onEdit(relation);
      },
    },
    {
      id: 'remove',
      label: relations.removeMenuItem,
      tone: 'danger',
      disabled: pending,
      onSelect: () => {
        onRemove(relation);
      },
    },
  ];

  return (
    <li
      className="wc-relation-item"
      data-relation-id={relation.id}
      data-direction={item.direction}
    >
      <div className="wc-relation-item__head">
        <div className="wc-relation-item__identity">
          <Badge
            tone={isBacklink ? 'accent' : 'neutral'}
            className="wc-relation-item__direction"
          >
            <span className="wc-relation-item__direction-icon">
              {isBacklink ? <IncomingIcon /> : <OutgoingIcon />}
            </span>
            <span>
              {isBacklink
                ? relations.directionIncoming
                : relations.directionOutgoing}
            </span>
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            className="wc-relation-item__target"
            aria-label={relations.openEntityNamed(counterpart.name)}
            onClick={() => {
              onOpenEntity(counterpart.id);
            }}
          >
            <span className="wc-relation-item__type-icon" aria-hidden="true">
              <TypeIcon name={counterpart.typeIcon} />
            </span>
            <span className="wc-relation-item__name">{counterpart.name}</span>
          </Button>

          <span className="wc-relation-item__sep" aria-hidden="true">
            ·
          </span>
          <span className="wc-relation-item__entity-type">
            {counterpart.typeName}
          </span>
        </div>

        <div className="wc-relation-item__side">
          <span
            className="wc-relation-strength"
            role="img"
            aria-label={relations.strength(strength)}
          >
            <span aria-hidden="true">
              {'●'.repeat(strength)}
              {'○'.repeat(5 - strength)}
            </span>
          </span>
          <Menu
            label={relations.menuLabel(effectiveLabel, counterpart.name)}
            align="end"
            items={menuItems}
          />
        </div>
      </div>

      {relation.notes === null ? null : (
        <p className="wc-relation-item__notes">{relation.notes}</p>
      )}
    </li>
  );
}
