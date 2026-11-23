/**
 * Diálogo para enlazar una ficha desde la barra del editor.
 *
 * Se extrae del editor de descripción para reutilizarlo en el manuscrito. La
 * inserción la ejecuta el editor que lo abre; el diálogo solo filtra y elige.
 */
import { useMemo, useState } from 'react';

import type { EntitySummary } from '../../../shared/contracts/entities';
import { useMessages } from '../../i18n/provider';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { TextField } from '../text-field';

import { rankMentionCandidates } from './mention-query';

export interface LinkDialogProps {
  readonly open: boolean;
  readonly candidates: readonly EntitySummary[];
  readonly onSelect: (entity: EntitySummary) => void;
  readonly onClose: () => void;
}

/** Selector de ficha para insertar un enlace interno. */
export function LinkDialog({
  open,
  candidates,
  onSelect,
  onClose,
}: LinkDialogProps) {
  const messages = useMessages();
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => rankMentionCandidates(candidates, search),
    [candidates, search],
  );

  const close = (): void => {
    setSearch('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={messages.entities.editor.linkTitle}
      actions={
        <Button variant="ghost" onClick={close}>
          {messages.entities.editor.linkCancel}
        </Button>
      }
    >
      <p className="wc-dialog__lead">{messages.entities.editor.linkLead}</p>
      <TextField
        label={messages.entities.editor.linkSearch}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
        autoFocus
      />
      {filtered.length === 0 ? (
        <p className="wc-dialog__lead">{messages.entities.editor.linkEmpty}</p>
      ) : (
        <ul className="wc-link-list">
          {filtered.map((candidate) => (
            <li key={candidate.id}>
              <Button
                variant="secondary"
                size="sm"
                className="wc-link-list__item"
                onClick={() => {
                  close();
                  onSelect(candidate);
                }}
              >
                <span className="wc-link-list__name">{candidate.name}</span>
                <span className="wc-link-list__type">{candidate.typeName}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
