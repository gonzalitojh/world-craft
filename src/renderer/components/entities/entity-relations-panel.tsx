import { useMemo, useState } from 'react';

import {
  relationBackwardLabel,
  relationForwardLabel,
  type RelationEdge,
  type RelationType,
} from '../../../shared/contracts/relations';
import type { EntitySummary } from '../../../shared/contracts/entities';
import { Button } from '../button';
import { useI18n } from '../../i18n/provider';

export interface EntityRelationsPanelProps {
  readonly entityId: string;
  readonly relations: readonly RelationEdge[];
  readonly types: readonly RelationType[];
  readonly candidates: readonly EntitySummary[];
  readonly state: 'loading' | 'ready' | 'error';
  readonly pending: boolean;
  readonly onAdd: () => void;
  readonly onEdit: (relation: RelationEdge) => void;
  readonly onRemove: (relation: RelationEdge) => Promise<boolean>;
  readonly onManageTypes: () => void;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onRetry: () => void;
}

/**
 * Sección de relaciones de una ficha.
 *
 * Separa las aristas salientes (la ficha actual es el origen) de los backlinks
 * (la ficha actual es el destino). Las salientes se leen con la etiqueta
 * directa y los backlinks con la inversa; ambos permiten navegar a la otra
 * ficha y editar o eliminar la relación con confirmación explícita.
 */
export function EntityRelationsPanel({
  entityId,
  relations,
  types,
  candidates,
  state,
  pending,
  onAdd,
  onEdit,
  onRemove,
  onManageTypes,
  onOpenEntity,
  onRetry,
}: EntityRelationsPanelProps) {
  const { messages } = useI18n();
  const [removing, setRemoving] = useState<RelationEdge | null>(null);
  const [removeError, setRemoveError] = useState(false);

  const outgoing = useMemo(
    () => relations.filter((relation) => relation.source.id === entityId),
    [entityId, relations],
  );
  const incoming = useMemo(
    () => relations.filter((relation) => relation.target.id === entityId),
    [entityId, relations],
  );

  const counterpartOf = (relation: RelationEdge) =>
    relation.source.id === entityId ? relation.target : relation.source;

  const effectiveLabel = (relation: RelationEdge): string =>
    relation.source.id === entityId
      ? relationForwardLabel(relation)
      : relationBackwardLabel(relation);

  const confirmRemove = async (): Promise<void> => {
    if (removing === null) {
      return;
    }

    const removed = await onRemove(removing);

    if (!removed) {
      setRemoveError(true);
      return;
    }

    setRemoving(null);
    setRemoveError(false);
  };

  const renderStrength = (relation: RelationEdge) => (
    <span
      className="wc-relation-strength"
      role="img"
      aria-label={messages.entities.relations.strength(relation.strength)}
    >
      <span aria-hidden="true">
        {'●'.repeat(relation.strength)}
        {'○'.repeat(5 - relation.strength)}
      </span>
    </span>
  );

  const renderRelation = (
    relation: RelationEdge,
    direction: 'outgoing' | 'incoming',
  ) => {
    const counterpart = counterpartOf(relation);
    const label =
      direction === 'outgoing'
        ? relationForwardLabel(relation)
        : relationBackwardLabel(relation);

    return (
      <li className="wc-relation-item" key={relation.id}>
        <div className="wc-relation-item__head">
          <span className={`wc-tag wc-tag--${relation.typeColor}`}>
            {label}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="wc-relation-item__target"
            onClick={() => {
              onOpenEntity(counterpart.id);
            }}
          >
            {counterpart.name}
          </Button>
          <span className="wc-relation-item__type">{counterpart.typeName}</span>
          {renderStrength(relation)}
        </div>

        {direction === 'incoming' ? (
          <p className="wc-relation-item__hint">
            {messages.entities.relations.backlinkHint(counterpart.name)}
          </p>
        ) : null}

        {relation.notes !== null ? (
          <p className="wc-relation-item__notes">{relation.notes}</p>
        ) : null}

        <div className="wc-relation-item__actions">
          <Button
            variant="ghost"
            size="sm"
            aria-label={messages.entities.relations.editNamed(
              label,
              counterpart.name,
            )}
            onClick={() => {
              onEdit(relation);
            }}
            disabled={pending}
          >
            {messages.entities.relations.edit}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={messages.entities.relations.removeNamed(
              label,
              counterpart.name,
            )}
            onClick={() => {
              setRemoving(relation);
              setRemoveError(false);
            }}
            disabled={pending}
          >
            {messages.entities.relations.remove}
          </Button>
        </div>
      </li>
    );
  };

  return (
    <section className="wc-page__section">
      <div className="wc-relation-head">
        <h3 className="wc-page__section-title">
          {messages.entities.relations.title}
        </h3>
        <div className="wc-relation-head__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={onAdd}
            disabled={types.length === 0 || candidates.length === 0}
          >
            {messages.entities.relations.add}
          </Button>
          <Button variant="ghost" size="sm" onClick={onManageTypes}>
            {messages.entities.relations.manageTypes}
          </Button>
        </div>
      </div>
      <p className="wc-page__section-lead">
        {messages.entities.relations.lead}
      </p>

      {state === 'loading' ? (
        <p className="wc-page__status" role="status">
          {messages.entities.relations.loading}
        </p>
      ) : state === 'error' ? (
        <div className="wc-alert" role="alert">
          <p>{messages.entities.relations.loadError}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {messages.entities.relations.retry}
          </Button>
        </div>
      ) : relations.length === 0 ? (
        <p className="wc-page__section-lead">
          {messages.entities.relations.empty}
        </p>
      ) : (
        <>
          <div className="wc-relation-group">
            <h4 className="wc-relation-group__title">
              {messages.entities.relations.outgoingTitle}
            </h4>
            {outgoing.length === 0 ? (
              <p className="wc-page__section-lead">
                {messages.entities.relations.outgoingEmpty}
              </p>
            ) : (
              <ul className="wc-relation-list">
                {outgoing.map((relation) =>
                  renderRelation(relation, 'outgoing'),
                )}
              </ul>
            )}
          </div>

          <div className="wc-relation-group">
            <h4 className="wc-relation-group__title">
              {messages.entities.relations.incomingTitle}
            </h4>
            <p className="wc-page__section-lead">
              {messages.entities.relations.incomingLead}
            </p>
            {incoming.length === 0 ? (
              <p className="wc-page__section-lead">
                {messages.entities.relations.incomingEmpty}
              </p>
            ) : (
              <ul className="wc-relation-list">
                {incoming.map((relation) =>
                  renderRelation(relation, 'incoming'),
                )}
              </ul>
            )}
          </div>
        </>
      )}

      {removing !== null ? (
        <div className="wc-inline-confirm" role="group">
          <h3 className="wc-page__section-title">
            {messages.entities.relations.removeTitle(
              effectiveLabel(removing),
              counterpartOf(removing).name,
            )}
          </h3>
          <p>{messages.entities.relations.removeBody}</p>
          {removeError ? (
            <p className="wc-field__error">
              {messages.entities.relations.deleteError}
            </p>
          ) : null}
          <div className="wc-inline-confirm__actions">
            <Button
              variant="ghost"
              onClick={() => {
                setRemoving(null);
                setRemoveError(false);
              }}
              disabled={pending}
            >
              {messages.entities.relations.cancel}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              autoFocus
              onClick={() => {
                void confirmRemove();
              }}
            >
              {messages.entities.relations.removeSubmit}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
