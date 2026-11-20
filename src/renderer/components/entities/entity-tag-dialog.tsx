import { useState } from 'react';

import {
  ENTITY_TAG_NAME_MAX_LENGTH,
  type EntityTag,
  type EntityTagColor,
} from '../../../shared/contracts/entities';
import { ENTITY_TYPE_COLORS } from '../../../shared/contracts/entity-types';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SelectField } from '../select-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityTagDialogProps {
  readonly open: boolean;
  readonly worldId: string;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onCreate: (input: {
    readonly worldId: string;
    readonly name: string;
    readonly color: EntityTagColor;
  }) => Promise<EntityTag | null>;
}

/** Diálogo para crear una etiqueta de color del mundo actual. */
export function EntityTagDialog({
  open,
  worldId,
  pending,
  onClose,
  onCreate,
}: EntityTagDialogProps) {
  const { messages } = useI18n();
  const [name, setName] = useState('');
  const [color, setColor] = useState<EntityTagColor>('moss');
  const [error, setError] = useState<string | undefined>();

  const submit = async (): Promise<void> => {
    if (name.trim().length === 0) {
      setError(messages.components.form.requiredField);
      return;
    }

    const tag = await onCreate({ worldId, name, color });

    if (tag === null) {
      setError(messages.entities.tags.error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.entities.tags.title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.entities.tags.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              void submit();
            }}
          >
            {messages.entities.tags.submit}
          </Button>
        </>
      }
    >
      <p className="wc-dialog__lead">{messages.entities.tags.lead}</p>

      <TextField
        label={messages.entities.tags.nameLabel}
        placeholder={messages.entities.tags.namePlaceholder}
        value={name}
        maxLength={ENTITY_TAG_NAME_MAX_LENGTH}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        error={error}
        required
        autoFocus
      />

      <SelectField
        label={messages.entities.tags.colorLabel}
        value={color}
        onChange={(event) => {
          setColor(event.target.value as EntityTagColor);
        }}
        options={ENTITY_TYPE_COLORS.map((token) => ({
          value: token,
          label: messages.entities.tags.colors[token],
        }))}
      />

      <p className="wc-tag-preview">
        <span className={`wc-tag wc-tag--${color}`}>
          {name.trim().length > 0 ? name : messages.entities.tags.nameLabel}
        </span>
      </p>
    </Dialog>
  );
}
