import { useId, useState, type FormEvent } from 'react';

import {
  WORLD_NAME_MAX_LENGTH,
  type WorldSummary,
} from '../../../shared/contracts/worlds';
import { useMessages } from '../../i18n/provider';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { TextField } from '../text-field';

export interface WorldDuplicateDialogProps {
  readonly open: boolean;
  readonly world: WorldSummary | null;
  readonly pending: boolean;
  readonly onClose: () => void;
  /** Devuelve `true` si se duplicó; con `false` el diálogo sigue abierto. */
  readonly onSubmit: (name: string) => Promise<boolean>;
}

/**
 * Diálogo de duplicado.
 *
 * Copia el contenido editable y pide un nombre nuevo; la portada no se copia
 * porque el asset pertenece al mundo original. El slug se genera en el proceso
 * principal a partir del nombre.
 */
export function WorldDuplicateDialog({
  open,
  world,
  pending,
  onClose,
  onSubmit,
}: WorldDuplicateDialogProps) {
  const messages = useMessages();
  const formId = useId();
  const [name, setName] = useState(() =>
    world === null ? '' : messages.worlds.duplicate.defaultName(world.name),
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError(messages.worlds.form.nameRequired);
      return;
    }

    const duplicated = await onSubmit(trimmed);

    if (!duplicated) {
      setFormError(messages.worlds.form.formError);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={messages.worlds.duplicate.title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.worlds.duplicate.cancel}
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {messages.worlds.duplicate.submit}
          </Button>
        </>
      }
    >
      <form className="wc-form" id={formId} onSubmit={handleSubmit} noValidate>
        <p>
          {world === null
            ? messages.worlds.duplicate.title
            : messages.worlds.duplicate.body(world.name)}
        </p>
        <TextField
          label={messages.worlds.duplicate.nameLabel}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
            setFormError(undefined);
          }}
          autoFocus
          maxLength={WORLD_NAME_MAX_LENGTH}
          required
          error={error}
        />
        {formError !== undefined ? (
          <p className="wc-form__error" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
