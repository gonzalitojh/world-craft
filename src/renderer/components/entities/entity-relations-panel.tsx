import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { RelationEdge } from '../../../shared/contracts/relations';
import { useI18n } from '../../i18n/provider';
import {
  buildRelationView,
  flattenRelationItems,
  type RelationDirection,
  type RelationDirectionView,
  type RelationTypeGroup,
} from '../../lib/relation-groups';
import { Button } from '../button';
import { EmptyState } from '../empty-state';
import { Skeleton } from '../skeleton';
import { RelationCard, relationLabels } from './relation-card';
import { RelationDeleteDialog } from './relation-delete-dialog';

export interface EntityRelationsPanelProps {
  readonly entityId: string;
  readonly relations: readonly RelationEdge[];
  readonly state: 'loading' | 'ready' | 'error';
  readonly pending: boolean;
  /** Relación cuyo diálogo de edición está abierto; permite restaurar el foco. */
  readonly editingRelationId?: string | null;
  readonly onEdit: (relation: RelationEdge) => void;
  readonly onRemove: (relation: RelationEdge) => Promise<boolean>;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onRetry: () => void;
}

export interface EntityRelationsActionsProps {
  readonly onAdd: () => void;
  readonly onManageTypes: () => void;
  readonly addDisabled: boolean;
}

/** Destino de foco pendiente de resolver después del commit del DOM. */
type FocusIntent =
  | { readonly kind: 'relation'; readonly relationId: string }
  | { readonly kind: 'add' }
  | { readonly kind: 'retry-loading' }
  | { readonly kind: 'retry-result' };

function OutgoingIcon() {
  return (
    <svg
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

function IncomingIcon() {
  return (
    <svg
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

function RelationTypeGroupSection({
  group,
  direction,
  pending,
  onOpenEntity,
  onEdit,
  onRemove,
}: {
  readonly group: RelationTypeGroup;
  readonly direction: RelationDirection;
  readonly pending: boolean;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onEdit: (relation: RelationEdge) => void;
  readonly onRemove: (relation: RelationEdge) => void;
}) {
  const { messages } = useI18n();
  const relations = messages.entities.relations;
  const headingId = useId();
  const metaId = useId();
  const showReciprocal = group.effectiveLabel !== group.reciprocalLabel;
  const hasMeta = showReciprocal || group.showTypeName;

  return (
    <section
      className="wc-relation-type-group"
      aria-labelledby={headingId}
      aria-describedby={hasMeta ? metaId : undefined}
    >
      <div className="wc-relation-type-group__head">
        <span
          className={`wc-type-mark wc-type-color--${group.typeColor}`}
          aria-hidden="true"
        />
        <h5 className="wc-relation-type-group__title" id={headingId}>
          {group.effectiveLabel}
        </h5>
        <span className="wc-relation-type-group__count">
          {relations.groupCount(group.items.length)}
        </span>
      </div>

      {hasMeta ? (
        <p className="wc-relation-type-group__meta" id={metaId}>
          {showReciprocal ? (
            <span>
              {direction === 'outgoing'
                ? relations.groupInverse(group.reciprocalLabel)
                : relations.groupForward(group.reciprocalLabel)}
            </span>
          ) : null}
          {showReciprocal && group.showTypeName ? (
            <span aria-hidden="true">·</span>
          ) : null}
          {group.showTypeName ? (
            <span>{relations.groupType(group.typeName)}</span>
          ) : null}
        </p>
      ) : null}

      <ul className="wc-relation-list">
        {group.items.map((item) => (
          <RelationCard
            key={item.relation.id}
            item={item}
            pending={pending}
            onOpenEntity={onOpenEntity}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}

function RelationDirectionSection({
  directionView,
  pending,
  onOpenEntity,
  onEdit,
  onRemove,
}: {
  readonly directionView: RelationDirectionView;
  readonly pending: boolean;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onEdit: (relation: RelationEdge) => void;
  readonly onRemove: (relation: RelationEdge) => void;
}) {
  const { messages } = useI18n();
  const relations = messages.entities.relations;
  const headingId = useId();
  const leadId = useId();
  const direction = directionView.direction;
  const isOutgoing = direction === 'outgoing';
  const heading = isOutgoing
    ? relations.outgoingTitle
    : relations.incomingTitle;
  const lead = isOutgoing ? relations.outgoingLead : relations.incomingLead;
  const empty = isOutgoing ? relations.outgoingEmpty : relations.incomingEmpty;

  return (
    <section
      className="wc-relation-direction"
      data-direction={direction}
      aria-labelledby={headingId}
      aria-describedby={leadId}
    >
      <div className="wc-relation-direction__head">
        <span className="wc-relation-direction__icon" aria-hidden="true">
          {isOutgoing ? <OutgoingIcon /> : <IncomingIcon />}
        </span>
        <h4 className="wc-relation-direction__title" id={headingId}>
          {heading}
        </h4>
        <span className="wc-relation-direction__count">
          {relations.groupCount(directionView.count)}
        </span>
      </div>
      <p className="wc-relation-direction__lead" id={leadId}>
        {lead}
      </p>

      {directionView.groups.length === 0 ? (
        <p className="wc-relation-direction__empty">{empty}</p>
      ) : (
        directionView.groups.map((group) => (
          <RelationTypeGroupSection
            key={group.key}
            group={group}
            direction={direction}
            pending={pending}
            onOpenEntity={onOpenEntity}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))
      )}
    </section>
  );
}

function focusAddRelation(): void {
  const add = document.getElementById('wc-entity-add-relation');

  if (add instanceof HTMLButtonElement && !add.disabled) {
    add.focus();
    return;
  }

  document
    .querySelector<HTMLElement>(
      '#wc-entity-section-relations .wc-disclosure__toggle',
    )
    ?.focus();
}

/**
 * Sección de relaciones de una ficha como red de lore legible.
 *
 * La dirección es el primer nivel y el tipo el segundo; dentro, cada relación
 * es una entrada con su contraparte, fuerza, notas y acciones. El modelo de
 * vista puro resuelve etiquetas, contrapartes y orden. El foco se restaura
 * después del commit con una intención explícita, porque al borrar o cambiar
 * de grupo el disparador que abrió el diálogo se desmonta (C3).
 */
export function EntityRelationsPanel({
  entityId,
  relations,
  state,
  pending,
  editingRelationId = null,
  onEdit,
  onRemove,
  onOpenEntity,
  onRetry,
}: EntityRelationsPanelProps) {
  const { messages, locale } = useI18n();
  const copy = messages.entities.relations;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousEditingRef = useRef<string | null>(null);
  const [removing, setRemoving] = useState<RelationEdge | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const [focusIntent, setFocusIntent] = useState<FocusIntent | null>(null);

  const view = useMemo(
    () => buildRelationView(relations, entityId, locale),
    [entityId, locale, relations],
  );

  // El diálogo de edición se desmonta al guardar o cancelar. Se guarda la
  // intención de volver al «⋯» de la misma relación, ya en su grupo nuevo.
  useEffect(() => {
    const previous = previousEditingRef.current;
    const current = editingRelationId ?? null;
    previousEditingRef.current = current;

    if (previous !== null && current === null) {
      setFocusIntent({ kind: 'relation', relationId: previous });
    }
  }, [editingRelationId]);

  useEffect(() => {
    if (focusIntent === null) {
      return;
    }

    // Si la recarga termina antes del frame de la carga, el intento sigue
    // vigente como resultado del reintento; nunca se queda atascado (C10).
    const intent =
      focusIntent.kind === 'retry-loading' && state !== 'loading'
        ? ({ kind: 'retry-result' } as const)
        : focusIntent;

    if (intent.kind === 'retry-result' && state === 'loading') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;

      switch (intent.kind) {
        case 'relation': {
          const target = document.querySelector<HTMLElement>(
            `li[data-relation-id="${intent.relationId}"] button[aria-haspopup="menu"]`,
          );

          if (target !== null) {
            target.focus();
          } else {
            focusAddRelation();
          }

          break;
        }
        case 'add':
          focusAddRelation();
          break;
        case 'retry-loading': {
          const loading =
            root?.querySelector<HTMLElement>('.wc-relations__loading') ?? null;

          if (loading !== null) {
            loading.focus();
            setFocusIntent({ kind: 'retry-result' });
            return;
          }

          break;
        }
        case 'retry-result': {
          if (state === 'error') {
            root?.querySelector<HTMLElement>('[data-relation-retry]')?.focus();
            break;
          }

          const first =
            root?.querySelector<HTMLElement>('.wc-relation-item__target') ??
            null;

          if (first !== null) {
            first.focus();
          } else {
            focusAddRelation();
          }

          break;
        }
      }

      setFocusIntent(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusIntent, relations, state]);

  const confirmRemove = async (): Promise<void> => {
    if (removing === null) {
      return;
    }

    const flat = flattenRelationItems(view);
    const index = flat.findIndex((item) => item.relation.id === removing.id);
    const next = flat[index + 1] ?? flat[index - 1] ?? null;

    const removed = await onRemove(removing);

    if (!removed) {
      setRemoveError(true);
      return;
    }

    setRemoving(null);
    setRemoveError(false);
    setFocusIntent(
      next === null
        ? { kind: 'add' }
        : { kind: 'relation', relationId: next.relation.id },
    );
  };

  const openRemove = (relation: RelationEdge): void => {
    setRemoving(relation);
    setRemoveError(false);
  };

  const cancelRemove = (): void => {
    const relationId = removing?.id;
    setRemoving(null);
    setRemoveError(false);

    if (relationId !== undefined) {
      setFocusIntent({ kind: 'relation', relationId });
    }
  };

  const retry = (): void => {
    setFocusIntent({ kind: 'retry-loading' });
    onRetry();
  };

  const removingLabels =
    removing === null ? null : relationLabels(removing, entityId);
  const removingName =
    removing === null
      ? ''
      : removing.source.id === entityId
        ? removing.target.name
        : removing.source.name;

  return (
    <div className="wc-relations" ref={rootRef}>
      <p className="wc-page__section-lead">{copy.lead}</p>

      {/* El estado de carga vive fuera del contenedor con `aria-busy`: dentro,
          la región viva no anunciaría el texto (C1). */}
      <p
        className="wc-visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state === 'loading' ? copy.loading : ''}
      </p>

      <div
        className="wc-relations__content"
        aria-busy={state === 'loading' ? true : undefined}
      >
        {state === 'loading' ? (
          <div className="wc-relations__loading" tabIndex={-1}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="55%" />
          </div>
        ) : state === 'error' ? (
          <div className="wc-alert wc-alert--inline" role="alert">
            <p>{copy.loadError}</p>
            <p className="wc-page__note">{copy.loadErrorHint}</p>
            <div className="wc-alert__actions">
              <Button
                variant="secondary"
                size="sm"
                data-relation-retry="true"
                onClick={retry}
              >
                {copy.retry}
              </Button>
            </div>
          </div>
        ) : view.total === 0 ? (
          <EmptyState
            headingLevel={4}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
          />
        ) : (
          <div className="wc-relations__directions">
            <RelationDirectionSection
              directionView={view.outgoing}
              pending={pending}
              onOpenEntity={onOpenEntity}
              onEdit={onEdit}
              onRemove={openRemove}
            />
            <RelationDirectionSection
              directionView={view.incoming}
              pending={pending}
              onOpenEntity={onOpenEntity}
              onEdit={onEdit}
              onRemove={openRemove}
            />
          </div>
        )}
      </div>

      {removing !== null && removingLabels !== null ? (
        <RelationDeleteDialog
          open
          label={removingLabels.effective}
          name={removingName}
          pending={pending}
          error={removeError}
          onCancel={cancelRemove}
          onConfirm={() => {
            void confirmRemove();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Acciones de la sección de relaciones.
 *
 * Viven en la cabecera de `DisclosureSection`, fuera del botón de plegado, para
 * no anidar controles y conservar dos paradas de tabulación claras. El botón de
 * alta lleva un `id` estable para que el panel pueda devolverle el foco cuando
 * desaparece la última relación.
 */
export function EntityRelationsActions({
  onAdd,
  onManageTypes,
  addDisabled,
}: EntityRelationsActionsProps) {
  const { messages } = useI18n();

  return (
    <>
      <Button
        id="wc-entity-add-relation"
        variant="secondary"
        size="sm"
        onClick={onAdd}
        disabled={addDisabled}
      >
        {messages.entities.relations.add}
      </Button>
      <Button variant="ghost" size="sm" onClick={onManageTypes}>
        {messages.entities.relations.manageTypes}
      </Button>
    </>
  );
}
