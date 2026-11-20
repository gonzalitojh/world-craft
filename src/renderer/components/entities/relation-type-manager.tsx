import { useId, useState } from 'react';

import {
  RELATION_TYPE_KEY_MAX_LENGTH,
  RELATION_TYPE_NAME_MAX_LENGTH,
  type RelationColor,
  type RelationType,
  type RelationTypeCreateInput,
  type RelationTypeRemoveInput,
  type RelationTypeUpdateInput,
} from '../../../shared/contracts/relations';
import { ENTITY_TYPE_COLORS } from '../../../shared/contracts/entity-types';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SelectField } from '../select-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface RelationTypeManagerProps {
  readonly open: boolean;
  readonly worldId: string;
  readonly types: readonly RelationType[];
  readonly state: 'loading' | 'ready' | 'error';
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onCreate: (
    input: RelationTypeCreateInput,
  ) => Promise<RelationType | null>;
  readonly onUpdate: (
    input: RelationTypeUpdateInput,
  ) => Promise<RelationType | null>;
  readonly onRemove: (input: RelationTypeRemoveInput) => Promise<boolean>;
}

type ManagerView =
  | { readonly kind: 'list' }
  | { readonly kind: 'form'; readonly relationType: RelationType | null };

/**
 * Gestor de los tipos de relación.
 *
 * Los del sistema se listan en solo lectura. Los personalizados se crean,
 * editan y borran desde el mismo diálogo; borrar un tipo en uso devuelve un
 * error explicativo y no toca las relaciones existentes.
 */
export function RelationTypeManager({
  open,
  worldId,
  types,
  state,
  pending,
  onClose,
  onRetry,
  onCreate,
  onUpdate,
  onRemove,
}: RelationTypeManagerProps) {
  const { messages } = useI18n();
  const nameId = useId();
  const [view, setView] = useState<ManagerView>({ kind: 'list' });
  const [removing, setRemoving] = useState<RelationType | null>(null);
  const [name, setName] = useState('');
  const [inverseName, setInverseName] = useState('');
  const [key, setKey] = useState('');
  const [color, setColor] = useState<RelationColor>('moss');
  const [error, setError] = useState<string | undefined>();

  const openForm = (relationType: RelationType | null): void => {
    setView({ kind: 'form', relationType });
    setName(relationType?.name ?? '');
    setInverseName(relationType?.inverseName ?? '');
    setKey(relationType?.key ?? '');
    setColor(relationType?.color ?? 'moss');
    setError(undefined);
    setRemoving(null);
  };

  const submit = async (): Promise<void> => {
    if (name.trim().length === 0 || inverseName.trim().length === 0) {
      setError(messages.components.form.requiredField);
      return;
    }

    const current = view.kind === 'form' ? view.relationType : null;
    const result =
      current === null
        ? await onCreate({
            worldId,
            name,
            inverseName,
            color,
            ...(key.trim().length === 0 ? {} : { key }),
          })
        : await onUpdate({
            worldId,
            id: current.id,
            name,
            inverseName,
            color,
          });

    if (result === null) {
      setError(messages.entities.relations.types.error);
      return;
    }

    setView({ kind: 'list' });
    setError(undefined);
  };

  const confirmRemove = async (): Promise<void> => {
    if (removing === null) {
      return;
    }

    const removed = await onRemove({ worldId, id: removing.id });

    if (!removed) {
      setError(messages.entities.relations.types.removeBlocked);
      return;
    }

    setRemoving(null);
    setError(undefined);
  };

  const custom = types.filter((type) => !type.isSystem);
  const system = types.filter((type) => type.isSystem);

  const title =
    view.kind === 'form'
      ? view.relationType === null
        ? messages.entities.relations.types.createTitle
        : messages.entities.relations.types.editTitle(view.relationType.name)
      : messages.entities.relations.types.title;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="wc-dialog--wide"
      actions={
        view.kind === 'form' ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setView({ kind: 'list' });
                setError(undefined);
              }}
              disabled={pending}
            >
              {messages.entities.relations.types.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                void submit();
              }}
            >
              {view.relationType === null
                ? messages.entities.relations.types.createSubmit
                : messages.entities.relations.types.save}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {messages.entities.relations.types.close}
            </Button>
            <Button
              onClick={() => {
                openForm(null);
              }}
            >
              {messages.entities.relations.types.create}
            </Button>
          </>
        )
      }
    >
      {view.kind === 'list' ? (
        <>
          <p className="wc-dialog__lead">
            {messages.entities.relations.types.lead}
          </p>

          {state === 'loading' ? (
            <p className="wc-page__section-lead">
              {messages.entities.relations.types.loading}
            </p>
          ) : state === 'error' ? (
            <div className="wc-alert" role="alert">
              <p>{messages.entities.relations.types.errorLoad}</p>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {messages.entities.relations.retry}
              </Button>
            </div>
          ) : types.length === 0 ? (
            <p className="wc-page__section-lead">
              {messages.entities.relations.types.errorLoad}
            </p>
          ) : (
            <>
              <section className="wc-page__section">
                <h3 className="wc-page__section-title">
                  {messages.entities.relations.types.systemBadge}
                </h3>
                <ul className="wc-relation-type-list">
                  {system.map((type) => (
                    <li className="wc-relation-type-item" key={type.id}>
                      <span
                        className={`wc-tag wc-tag--${type.color}`}
                        aria-hidden="true"
                      >
                        {type.name}
                      </span>
                      <span className="wc-relation-type-item__labels">
                        {type.name} / {type.inverseName}
                      </span>
                      <span className="wc-relation-type-item__meta">
                        {messages.entities.relations.types.readOnly}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="wc-page__section">
                <h3 className="wc-page__section-title">
                  {messages.entities.relations.types.customBadge}
                </h3>
                {custom.length === 0 ? (
                  <p className="wc-page__section-lead">
                    {messages.entities.relations.types.lead}
                  </p>
                ) : (
                  <ul className="wc-relation-type-list">
                    {custom.map((type) => (
                      <li className="wc-relation-type-item" key={type.id}>
                        <span
                          className={`wc-tag wc-tag--${type.color}`}
                          aria-hidden="true"
                        >
                          {type.name}
                        </span>
                        <span className="wc-relation-type-item__labels">
                          {type.name} / {type.inverseName}
                        </span>
                        <span className="wc-relation-type-item__actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={messages.entities.relations.types.editNamed(
                              type.name,
                            )}
                            onClick={() => {
                              openForm(type);
                            }}
                          >
                            {messages.entities.relations.types.edit}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={messages.entities.relations.types.removeNamed(
                              type.name,
                            )}
                            onClick={() => {
                              setRemoving(type);
                              setError(undefined);
                            }}
                          >
                            {messages.entities.relations.types.remove}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {removing !== null ? (
            <section className="wc-inline-confirm" role="group">
              <h3 className="wc-page__section-title">
                {messages.entities.relations.types.removeTitle(removing.name)}
              </h3>
              <p>{messages.entities.relations.types.removeBody}</p>
              <div className="wc-inline-confirm__actions">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRemoving(null);
                    setError(undefined);
                  }}
                  disabled={pending}
                >
                  {messages.entities.relations.types.cancel}
                </Button>
                <Button
                  variant="danger"
                  loading={pending}
                  autoFocus
                  onClick={() => {
                    void confirmRemove();
                  }}
                >
                  {messages.entities.relations.types.removeSubmit}
                </Button>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <p className="wc-dialog__lead">
            {view.relationType === null
              ? messages.entities.relations.types.createLead
              : messages.entities.relations.types.editLead}
          </p>

          <div className="wc-relation-form">
            <TextField
              label={messages.entities.relations.types.nameLabel}
              value={name}
              maxLength={RELATION_TYPE_NAME_MAX_LENGTH}
              onChange={(event) => {
                setName(event.target.value);
                setError(undefined);
              }}
              required
              id={nameId}
              autoFocus
            />

            <TextField
              label={messages.entities.relations.types.inverseNameLabel}
              value={inverseName}
              maxLength={RELATION_TYPE_NAME_MAX_LENGTH}
              onChange={(event) => {
                setInverseName(event.target.value);
                setError(undefined);
              }}
              required
            />

            {view.relationType === null ? (
              <TextField
                label={messages.entities.relations.types.keyLabel}
                hint={messages.entities.relations.types.keyHint}
                value={key}
                maxLength={RELATION_TYPE_KEY_MAX_LENGTH}
                onChange={(event) => {
                  setKey(event.target.value);
                  setError(undefined);
                }}
              />
            ) : null}

            <SelectField
              label={messages.entities.relations.types.colorLabel}
              value={color}
              onChange={(event) => {
                setColor(event.target.value as RelationColor);
              }}
              options={ENTITY_TYPE_COLORS.map((token) => ({
                value: token,
                label: messages.entities.relations.types.colors[token],
              }))}
            />

            <p className="wc-tag-preview">
              <span className={`wc-tag wc-tag--${color}`}>
                {name.trim().length > 0
                  ? name
                  : messages.entities.relations.types.nameLabel}
              </span>
              <span aria-hidden="true">→</span>
              <span className={`wc-tag wc-tag--${color}`}>
                {inverseName.trim().length > 0
                  ? inverseName
                  : messages.entities.relations.types.inverseNameLabel}
              </span>
            </p>
          </div>
        </>
      )}

      {error !== undefined ? (
        <p className="wc-alert" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
