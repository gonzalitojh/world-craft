import { useEffect, useMemo, useState } from 'react';

import {
  RELATION_LABEL_MAX_LENGTH,
  RELATION_NOTES_MAX_LENGTH,
  RELATION_STRENGTH_MAX,
  RELATION_STRENGTH_MIN,
  type RelationCreateInput,
  type RelationEdge,
  type RelationType,
  type RelationUpdateInput,
} from '../../../shared/contracts/relations';
import type { EntitySummary } from '../../../shared/contracts/entities';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SelectField } from '../select-field';
import { TextAreaField } from '../text-area-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityRelationDialogProps {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly worldId: string;
  readonly entityId: string;
  readonly relation: RelationEdge | null;
  readonly types: readonly RelationType[];
  readonly candidates: readonly EntitySummary[];
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (
    input: RelationCreateInput | RelationUpdateInput,
  ) => Promise<boolean>;
}

/**
 * Diálogo para crear o editar una relación desde la ficha actual.
 *
 * Al crear, la ficha actual es siempre el origen y se elige el destino. Al
 * editar se conservan origen y destino y se pueden cambiar el tipo, las
 * etiquetas, las notas y la fuerza. Las etiquetas vacías delegan en el tipo.
 */
export function EntityRelationDialog({
  open,
  mode,
  worldId,
  entityId,
  relation,
  types,
  candidates,
  pending,
  onClose,
  onSubmit,
}: EntityRelationDialogProps) {
  const { messages } = useI18n();
  const other =
    relation === null
      ? null
      : relation.source.id === entityId
        ? relation.target
        : relation.source;
  const [typeId, setTypeId] = useState(relation?.typeId ?? types[0]?.id ?? '');
  const [targetId, setTargetId] = useState(other?.id ?? '');
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState(relation?.label ?? '');
  const [inverseLabel, setInverseLabel] = useState(
    relation?.inverseLabel ?? '',
  );
  const [notes, setNotes] = useState(relation?.notes ?? '');
  const [strength, setStrength] = useState(
    String(relation?.strength ?? RELATION_STRENGTH_MIN),
  );
  const [error, setError] = useState<string | undefined>();
  const [targetError, setTargetError] = useState<string | undefined>();

  const filteredCandidates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');

    if (term.length === 0) {
      return candidates;
    }

    return candidates.filter(
      (candidate) =>
        candidate.name.toLocaleLowerCase('es').includes(term) ||
        candidate.aliases.some((alias) =>
          alias.toLocaleLowerCase('es').includes(term),
        ),
    );
  }, [candidates, search]);

  const selectedType = types.find((type) => type.id === typeId) ?? null;
  const otherRelation = other;

  // Mientras la petición está en curso el botón pulsado se deshabilita y el
  // foco caería en `body`; se mueve al cuerpo del diálogo (C4). Al fallar, el
  // foco vuelve al primer campo inválido o a la alerta de envío.
  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');

    if (dialog === null) {
      return;
    }

    if (pending) {
      dialog.querySelector<HTMLElement>('.wc-dialog__body')?.focus();
      return;
    }

    if (error === undefined && targetError === undefined) {
      return;
    }

    if (targetError !== undefined) {
      document.getElementById('wc-relation-target')?.focus();
    } else {
      dialog
        .querySelector<HTMLElement>('[data-relation-dialog-error]')
        ?.focus();
    }
  }, [error, open, pending, targetError]);

  const submit = async (): Promise<void> => {
    if (typeId.length === 0) {
      setError(messages.entities.relations.error);
      return;
    }

    if (mode === 'create' && targetId.length === 0) {
      setTargetError(messages.components.form.requiredField);
      document.getElementById('wc-relation-target')?.focus();
      return;
    }

    if (mode === 'create' && targetId === entityId) {
      setTargetError(messages.entities.relations.error);
      document.getElementById('wc-relation-target')?.focus();
      return;
    }

    setError(undefined);
    setTargetError(undefined);

    const shared = {
      typeId,
      label: label.trim().length === 0 ? null : label.trim(),
      inverseLabel:
        inverseLabel.trim().length === 0 ? null : inverseLabel.trim(),
      notes: notes.trim().length === 0 ? null : notes.trim(),
      strength: Number(strength),
    };

    const result =
      mode === 'create'
        ? await onSubmit({
            worldId,
            sourceId: entityId,
            targetId,
            ...shared,
          })
        : relation !== null
          ? await onSubmit({
              worldId,
              id: relation.id,
              ...shared,
              metadata: relation.metadata,
            })
          : false;

    if (!result) {
      setError(messages.entities.relations.error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={
        mode === 'create'
          ? messages.entities.relations.createTitle
          : messages.entities.relations.editTitle
      }
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.entities.relations.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              void submit();
            }}
          >
            {mode === 'create'
              ? messages.entities.relations.submitCreate
              : messages.entities.relations.submitEdit}
          </Button>
        </>
      }
    >
      <p className="wc-dialog__lead">
        {mode === 'create'
          ? messages.entities.relations.createLead
          : messages.entities.relations.editLead}
      </p>

      <div className="wc-relation-form">
        <SelectField
          id="wc-relation-type"
          label={messages.entities.relations.typeLabel}
          value={typeId}
          onChange={(event) => {
            setTypeId(event.target.value);
            setError(undefined);
          }}
          options={types.map((type) => ({
            value: type.id,
            label: `${type.name} / ${type.inverseName}`,
          }))}
          disabled={types.length === 0}
          required
          autoFocus
        />

        {selectedType !== null ? (
          <p className="wc-field__hint">
            {messages.entities.relations.typeHint(
              selectedType.name,
              selectedType.inverseName,
            )}
          </p>
        ) : null}

        {mode === 'create' ? (
          <>
            <TextField
              label={messages.entities.relations.searchLabel}
              placeholder={messages.entities.relations.searchPlaceholder}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
            <SelectField
              id="wc-relation-target"
              label={messages.entities.relations.targetLabel}
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
                setTargetError(undefined);
              }}
              options={[
                {
                  value: '',
                  label: messages.entities.relations.targetPlaceholder,
                },
                ...filteredCandidates.map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.name} · ${candidate.typeName}`,
                })),
              ]}
              error={targetError}
              disabled={filteredCandidates.length === 0}
              required
            />
            {candidates.length === 0 ? (
              <p className="wc-field__hint">
                {messages.entities.relations.noCandidates}
              </p>
            ) : filteredCandidates.length === 0 ? (
              <p className="wc-field__hint">
                {messages.entities.relations.noMatches}
              </p>
            ) : null}
          </>
        ) : (
          <p className="wc-field__hint">
            {otherRelation === null
              ? ''
              : messages.entities.relations.relationWith(otherRelation.name)}
          </p>
        )}

        <TextField
          label={messages.entities.relations.labelLabel}
          hint={messages.entities.relations.labelHint}
          value={label}
          maxLength={RELATION_LABEL_MAX_LENGTH}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
        />

        <TextField
          label={messages.entities.relations.inverseLabelLabel}
          hint={messages.entities.relations.inverseLabelHint}
          value={inverseLabel}
          maxLength={RELATION_LABEL_MAX_LENGTH}
          onChange={(event) => {
            setInverseLabel(event.target.value);
          }}
        />

        <SelectField
          label={messages.entities.relations.strengthLabel}
          value={strength}
          onChange={(event) => {
            setStrength(event.target.value);
          }}
          options={Array.from(
            { length: RELATION_STRENGTH_MAX - RELATION_STRENGTH_MIN + 1 },
            (_, index) => {
              const value = String(RELATION_STRENGTH_MIN + index);

              return {
                value,
                label:
                  messages.entities.relations.strengthOptions[
                    value as '1' | '2' | '3' | '4' | '5'
                  ],
              };
            },
          )}
        />

        <TextAreaField
          label={messages.entities.relations.notesLabel}
          value={notes}
          maxLength={RELATION_NOTES_MAX_LENGTH}
          rows={3}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
      </div>

      {error !== undefined ? (
        <p
          className="wc-alert wc-alert--inline"
          role="alert"
          tabIndex={-1}
          data-relation-dialog-error="true"
        >
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
