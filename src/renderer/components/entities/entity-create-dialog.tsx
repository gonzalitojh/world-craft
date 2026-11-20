import { useState } from 'react';

import {
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SUMMARY_MAX_LENGTH,
  type EntityCreateInput,
} from '../../../shared/contracts/entities';
import type { EntityTypeSummary } from '../../../shared/contracts/entity-types';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SelectField } from '../select-field';
import { TextAreaField } from '../text-area-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityCreateDialogProps {
  readonly open: boolean;
  readonly worldId: string;
  readonly types: readonly EntityTypeSummary[];
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (
    input: Pick<EntityCreateInput, 'worldId' | 'typeId' | 'name' | 'summary'>,
  ) => Promise<boolean>;
}

/**
 * Diálogo de creación de una ficha.
 *
 * Solo pide tipo, nombre y resumen: el resto se completa en la ficha y se
 * autoguarda. El tipo se elige entre los del sistema y los del mundo.
 */
export function EntityCreateDialog({
  open,
  worldId,
  types,
  pending,
  onClose,
  onSubmit,
}: EntityCreateDialogProps) {
  const { messages } = useI18n();
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async (): Promise<void> => {
    if (name.trim().length === 0) {
      setError(messages.components.form.requiredField);
      return;
    }

    if (typeId.length === 0) {
      setError(messages.entities.list.noTypes);
      return;
    }

    const ok = await onSubmit({
      worldId,
      typeId,
      name,
      summary: summary.trim().length === 0 ? null : summary,
    });

    if (!ok) {
      setError(messages.entities.notices.invalid);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.entities.create.title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.entities.create.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              void submit();
            }}
          >
            {messages.entities.create.submit}
          </Button>
        </>
      }
    >
      <p className="wc-dialog__lead">{messages.entities.create.lead}</p>

      <SelectField
        label={messages.entities.create.typeLabel}
        value={typeId}
        onChange={(event) => {
          setTypeId(event.target.value);
        }}
        options={types.map((type) => ({
          value: type.id,
          label: type.name,
        }))}
        disabled={pending || types.length === 0}
        required
      />

      <TextField
        label={messages.entities.create.nameLabel}
        placeholder={messages.entities.create.namePlaceholder}
        value={name}
        maxLength={ENTITY_NAME_MAX_LENGTH}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        error={error}
        disabled={pending}
        required
        autoFocus
      />

      <TextAreaField
        label={messages.entities.create.summaryLabel}
        placeholder={messages.entities.create.summaryPlaceholder}
        value={summary}
        maxLength={ENTITY_SUMMARY_MAX_LENGTH}
        rows={2}
        onChange={(event) => {
          setSummary(event.target.value);
        }}
        disabled={pending}
      />
    </Dialog>
  );
}
