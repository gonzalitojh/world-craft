import { useState } from 'react';

import { ENTITY_NAME_MAX_LENGTH } from '../../../shared/contracts/entities';
import type { WorldSummary } from '../../../shared/contracts/worlds';
import type { EntityTypeSummary } from '../../../shared/contracts/entity-types';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SelectField } from '../select-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityQuickCreateDialogProps {
  readonly open: boolean;
  readonly worlds: readonly WorldSummary[];
  readonly defaultWorldId: string | null;
  readonly pending: boolean;
  readonly types: readonly EntityTypeSummary[];
  readonly typesLoading: boolean;
  readonly onWorldChange: (worldId: string) => void;
  readonly onClose: () => void;
  readonly onSubmit: (input: {
    readonly worldId: string;
    readonly typeId: string;
    readonly name: string;
  }) => Promise<boolean>;
}

/**
 * Creación rápida disponible desde cualquier pantalla.
 *
 * Elige mundo, tipo y nombre; la ficha se abre después para completar la
 * descripción, la imagen y el resto de campos.
 */
export function EntityQuickCreateDialog({
  open,
  worlds,
  defaultWorldId,
  pending,
  types,
  typesLoading,
  onWorldChange,
  onClose,
  onSubmit,
}: EntityQuickCreateDialogProps) {
  const { messages } = useI18n();
  const [worldId, setWorldId] = useState(defaultWorldId ?? worlds[0]?.id ?? '');
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  // Al cambiar de mundo, el tipo anterior deja de existir: se usa el primero
  // del mundo nuevo en lugar de enviar un id ajeno.
  const selectedTypeId = types.some((type) => type.id === typeId)
    ? typeId
    : (types[0]?.id ?? '');

  const submit = async (): Promise<void> => {
    if (
      worldId.length === 0 ||
      selectedTypeId.length === 0 ||
      name.trim().length === 0
    ) {
      setError(messages.entities.quick.error);
      return;
    }

    const ok = await onSubmit({ worldId, typeId: selectedTypeId, name });

    if (!ok) {
      setError(messages.entities.quick.error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.entities.quick.title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.entities.quick.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              void submit();
            }}
          >
            {messages.entities.quick.submit}
          </Button>
        </>
      }
    >
      <p className="wc-dialog__lead">{messages.entities.quick.lead}</p>

      <SelectField
        label={messages.entities.quick.worldLabel}
        value={worldId}
        onChange={(event) => {
          const next = event.target.value;
          setWorldId(next);
          onWorldChange(next);
        }}
        options={worlds.map((world) => ({
          value: world.id,
          label: world.name,
        }))}
        disabled={pending || worlds.length === 0}
        required
        autoFocus
      />

      <SelectField
        label={messages.entities.create.typeLabel}
        value={selectedTypeId}
        onChange={(event) => {
          setTypeId(event.target.value);
        }}
        options={
          typesLoading
            ? [{ value: '', label: messages.entities.quick.typesLoading }]
            : types.map((type) => ({ value: type.id, label: type.name }))
        }
        disabled={pending || typesLoading || types.length === 0}
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
      />
    </Dialog>
  );
}
