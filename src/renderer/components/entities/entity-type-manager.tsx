import { useEffect, useRef, useState } from 'react';

import {
  ENTITY_FIELD_KEY_MAX_LENGTH,
  ENTITY_FIELD_LABEL_MAX_LENGTH,
  ENTITY_SELECT_OPTIONS_MAX,
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_FIELDS_MAX,
  ENTITY_TYPE_ICONS,
  ENTITY_TYPE_NAME_MAX_LENGTH,
  type EntityFieldDefinition,
  type EntityFieldType,
  type EntityTypeColor,
  type EntityTypeIcon,
  type EntityTypeSummary,
} from '../../../shared/contracts/entity-types';
import { Badge } from '../badge';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { SelectField } from '../select-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';
import { TypeIcon } from './type-icon';

type ManagerMode = 'list' | 'create' | 'edit' | 'duplicate';

interface FieldDraft {
  readonly id: string;
  key: string;
  label: string;
  type: EntityFieldType;
  required: boolean;
  textMaxLength: string;
  numberMin: string;
  numberMax: string;
  optionsText: string;
  targetTypeKey: string;
}

interface TypeDraft {
  name: string;
  key: string;
  icon: EntityTypeIcon;
  color: EntityTypeColor;
  fields: readonly FieldDraft[];
}

export interface EntityTypeManagerProps {
  readonly open: boolean;
  readonly worldId: string;
  readonly types: readonly EntityTypeSummary[];
  readonly onClose: () => void;
  readonly onChanged: () => Promise<void>;
  readonly onNotify: (tone: 'success' | 'error', message: string) => void;
}

/**
 * Gestión visual de los tipos de ficha.
 *
 * Los tipos del sistema se pueden duplicar en el mundo pero no editar ni
 * borrar. Los personalizados permiten ajustar nombre, icono, color y la
 * plantilla de campos; el backend vuelve a validar todo con Zod.
 */
export function EntityTypeManager({
  open,
  worldId,
  types,
  onClose,
  onChanged,
  onNotify,
}: EntityTypeManagerProps) {
  const { messages } = useI18n();
  const [mode, setMode] = useState<ManagerMode>('list');
  const [source, setSource] = useState<EntityTypeSummary | null>(null);
  const [draft, setDraft] = useState<TypeDraft>(emptyDraft());
  const [pending, setPending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EntityTypeSummary | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const deleteErrorRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (deleteError !== undefined) {
      deleteErrorRef.current?.focus();
    }
  }, [deleteError]);

  const handleClose = (): void => {
    setPendingDelete(null);
    setDeleteError(undefined);
    setMode('list');
    setSource(null);
    setDraft(emptyDraft());
    setError(undefined);
    onClose();
  };

  const startCreate = (): void => {
    setSource(null);
    setDraft(emptyDraft());
    setError(undefined);
    setPendingDelete(null);
    setDeleteError(undefined);
    setMode('create');
  };

  const startEdit = (type: EntityTypeSummary): void => {
    setSource(type);
    setDraft(fromType(type));
    setError(undefined);
    setPendingDelete(null);
    setDeleteError(undefined);
    setMode('edit');
  };

  const startDuplicate = (type: EntityTypeSummary): void => {
    setSource(type);
    setDraft({
      ...fromType(type),
      name: `${type.name} copia`,
      key: '',
    });
    setError(undefined);
    setPendingDelete(null);
    setDeleteError(undefined);
    setMode('duplicate');
  };

  const toFields = (): readonly EntityFieldDefinition[] | null => {
    const result: EntityFieldDefinition[] = [];
    const usedKeys = new Set<string>();

    for (const field of draft.fields) {
      const label = field.label.trim();
      const key =
        field.key.trim().length > 0 ? field.key.trim() : slugifyKey(label);

      if (label.length === 0 || key.length === 0) {
        return null;
      }

      if (usedKeys.has(key) || key.length > ENTITY_FIELD_KEY_MAX_LENGTH) {
        return null;
      }

      usedKeys.add(key);

      switch (field.type) {
        case 'text': {
          const maxLength =
            field.textMaxLength.trim().length === 0
              ? undefined
              : Number(field.textMaxLength);
          result.push({
            key,
            label,
            type: 'text',
            required: field.required,
            ...(maxLength === undefined || !Number.isFinite(maxLength)
              ? {}
              : { maxLength }),
          });
          break;
        }

        case 'number': {
          const min =
            field.numberMin.trim().length === 0
              ? undefined
              : Number(field.numberMin);
          const max =
            field.numberMax.trim().length === 0
              ? undefined
              : Number(field.numberMax);

          if (
            (min !== undefined && !Number.isFinite(min)) ||
            (max !== undefined && !Number.isFinite(max))
          ) {
            return null;
          }

          result.push({
            key,
            label,
            type: 'number',
            required: field.required,
            ...(min === undefined ? {} : { min }),
            ...(max === undefined ? {} : { max }),
          });
          break;
        }

        case 'date':
          result.push({ key, label, type: 'date', required: field.required });
          break;

        case 'select': {
          const options = parseOptions(field.optionsText);

          if (
            options.length === 0 ||
            options.length > ENTITY_SELECT_OPTIONS_MAX
          ) {
            return null;
          }

          result.push({
            key,
            label,
            type: 'select',
            required: field.required,
            options,
          });
          break;
        }

        case 'reference':
          result.push({
            key,
            label,
            type: 'reference',
            required: field.required,
            ...(field.targetTypeKey.length === 0
              ? {}
              : { targetTypeKey: field.targetTypeKey }),
          });
          break;
      }
    }

    return result;
  };

  const save = async (): Promise<void> => {
    const name = draft.name.trim();

    if (name.length === 0) {
      setError(messages.components.form.requiredField);
      return;
    }

    const fields = toFields();

    if (fields === null) {
      setError(messages.entities.types.error);
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      if (mode === 'create') {
        const result = await window.worldCraft.entityTypes.create({
          worldId,
          name,
          ...(draft.key.trim().length === 0 ? {} : { key: draft.key }),
          icon: draft.icon,
          color: draft.color,
          fields,
        });

        if (!result.ok) {
          setError(messages.entities.types.error);
          return;
        }

        onNotify('success', messages.entities.types.created(result.data.name));
      } else if (mode === 'duplicate' && source !== null) {
        const result = await window.worldCraft.entityTypes.duplicate({
          worldId,
          id: source.id,
          name,
        });

        if (!result.ok || result.data === null) {
          setError(messages.entities.types.error);
          return;
        }

        // La copia parte de la plantilla del origen y después aplica los
        // cambios hechos en el formulario, para que editar icono, color o
        // campos al duplicar no se pierda en silencio.
        const updated = await window.worldCraft.entityTypes.update({
          worldId,
          id: result.data.id,
          name,
          icon: draft.icon,
          color: draft.color,
          fields,
        });

        if (!updated.ok || updated.data === null) {
          onNotify(
            'success',
            messages.entities.types.created(result.data.name),
          );
          await onChanged();
          setMode('list');
          return;
        }

        onNotify('success', messages.entities.types.created(updated.data.name));
      } else if (mode === 'edit' && source !== null) {
        const result = await window.worldCraft.entityTypes.update({
          worldId,
          id: source.id,
          name,
          icon: draft.icon,
          color: draft.color,
          fields,
        });

        if (!result.ok || result.data === null) {
          setError(messages.entities.types.error);
          return;
        }

        onNotify('success', messages.entities.types.updated(result.data.name));
      }

      await onChanged();
      setMode('list');
    } finally {
      setPending(false);
    }
  };

  const remove = async (type: EntityTypeSummary): Promise<void> => {
    setPending(true);
    setDeleteError(undefined);

    try {
      const result = await window.worldCraft.entityTypes.remove({
        worldId,
        id: type.id,
      });

      if (!result.ok || !result.data.deleted) {
        // El toast queda bajo la top layer del diálogo modal: el aviso de
        // borrado bloqueado se muestra dentro de la propia confirmación.
        setDeleteError(messages.entities.types.removeBlocked);
        return;
      }

      onNotify('success', messages.entities.types.removed(type.name));
      setPendingDelete(null);
      setDeleteError(undefined);
      await onChanged();
    } finally {
      setPending(false);
    }
  };

  const title =
    mode === 'list'
      ? messages.entities.types.title
      : mode === 'create'
        ? messages.entities.types.create
        : mode === 'edit'
          ? messages.entities.types.edit
          : messages.entities.types.duplicateTitle(source?.name ?? '');

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      className="wc-dialog--wide"
      actions={
        <Button variant="ghost" onClick={handleClose} disabled={pending}>
          {messages.entities.types.close}
        </Button>
      }
    >
      {mode === 'list' ? (
        <div className="wc-type-manager">
          <p className="wc-dialog__lead">{messages.entities.types.lead}</p>
          <div className="wc-type-manager__toolbar">
            <Button size="sm" onClick={startCreate}>
              {messages.entities.types.create}
            </Button>
          </div>
          <ul className="wc-type-list">
            {types.map((type) => (
              <li className="wc-type-list__item" key={type.id}>
                <span
                  className={`wc-type-list__icon wc-type-color--${type.color}`}
                  aria-hidden="true"
                >
                  <TypeIcon name={type.icon} />
                </span>
                <span className="wc-type-list__body">
                  <span className="wc-type-list__name">{type.name}</span>
                  <span className="wc-type-list__meta">
                    {messages.entities.types.fieldCount(type.fields.length)}
                  </span>
                </span>
                <Badge tone={type.isSystem ? 'accent' : 'neutral'}>
                  {type.isSystem
                    ? messages.entities.types.systemBadge
                    : messages.entities.types.customBadge}
                </Badge>
                <span className="wc-type-list__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      startDuplicate(type);
                    }}
                    aria-label={messages.entities.types.duplicateNamed(
                      type.name,
                    )}
                  >
                    {messages.entities.types.duplicate}
                  </Button>
                  {type.isSystem ? null : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          startEdit(type);
                        }}
                        aria-label={messages.entities.types.editNamed(
                          type.name,
                        )}
                      >
                        {messages.entities.types.edit}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setPendingDelete(type);
                          setDeleteError(undefined);
                        }}
                        aria-label={messages.entities.types.removeNamed(
                          type.name,
                        )}
                      >
                        {messages.entities.types.remove}
                      </Button>
                    </>
                  )}
                </span>
                {pendingDelete?.id === type.id ? (
                  <div className="wc-inline-confirm" role="group">
                    <p>{messages.entities.types.removeBody}</p>
                    {deleteError === undefined ? null : (
                      <p role="alert" tabIndex={-1} ref={deleteErrorRef}>
                        {deleteError}
                      </p>
                    )}
                    <div className="wc-inline-confirm__actions">
                      {deleteError === undefined ? (
                        <Button
                          variant="danger"
                          size="sm"
                          loading={pending}
                          onClick={() => {
                            void remove(type);
                          }}
                        >
                          {messages.entities.types.removeSubmit}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPendingDelete(null);
                          setDeleteError(undefined);
                        }}
                      >
                        {messages.entities.types.cancel}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="wc-type-form">
          <div className="wc-form-grid">
            <TextField
              label={messages.entities.types.nameLabel}
              value={draft.name}
              maxLength={ENTITY_TYPE_NAME_MAX_LENGTH}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }));
                setError(undefined);
              }}
              error={error}
              required
              autoFocus
              disabled={pending}
            />
            <TextField
              label={messages.entities.types.keyLabel}
              hint={messages.entities.types.keyHint}
              value={draft.key}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  key: event.target.value,
                }));
              }}
              disabled={pending || mode !== 'create'}
            />
            <SelectField
              label={messages.entities.types.iconLabel}
              value={draft.icon}
              options={ENTITY_TYPE_ICONS.map((icon) => ({
                value: icon,
                label: messages.entities.types.icons[icon],
              }))}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  icon: event.target.value as EntityTypeIcon,
                }));
              }}
              disabled={pending}
            />
            <SelectField
              label={messages.entities.types.colorLabel}
              value={draft.color}
              options={ENTITY_TYPE_COLORS.map((color) => ({
                value: color,
                label: messages.entities.tags.colors[color],
              }))}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  color: event.target.value as EntityTypeColor,
                }));
              }}
              disabled={pending}
            />
          </div>

          <section className="wc-type-fields">
            <div className="wc-type-fields__heading">
              <div>
                <h3 className="wc-page__section-title">
                  {messages.entities.types.fieldsTitle}
                </h3>
                <p className="wc-page__section-lead">
                  {messages.entities.types.fieldsLockedHint}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft((current) => ({
                    ...current,
                    fields: [...current.fields, emptyField()],
                  }));
                }}
                disabled={
                  pending || draft.fields.length >= ENTITY_TYPE_FIELDS_MAX
                }
              >
                {messages.entities.types.addField}
              </Button>
            </div>

            {draft.fields.length === 0 ? (
              <p className="wc-page__section-lead">
                {messages.entities.types.fieldsEmpty}
              </p>
            ) : (
              <ol className="wc-field-list">
                {draft.fields.map((field, index) => (
                  <li className="wc-field-group" key={field.id}>
                    <div className="wc-form-grid">
                      <TextField
                        label={messages.entities.types.fieldLabel}
                        value={field.label}
                        maxLength={ENTITY_FIELD_LABEL_MAX_LENGTH}
                        onChange={(event) => {
                          updateField(index, { label: event.target.value });
                        }}
                        disabled={pending}
                        required
                      />
                      <TextField
                        label={messages.entities.types.fieldKey}
                        value={field.key}
                        maxLength={ENTITY_FIELD_KEY_MAX_LENGTH}
                        onChange={(event) => {
                          updateField(index, { key: event.target.value });
                        }}
                        disabled={pending}
                      />
                      <SelectField
                        label={messages.entities.types.fieldType}
                        value={field.type}
                        options={(
                          [
                            'text',
                            'number',
                            'date',
                            'select',
                            'reference',
                          ] as const
                        ).map((type) => ({
                          value: type,
                          label: messages.entities.types.fieldTypeNames[type],
                        }))}
                        onChange={(event) => {
                          updateField(index, {
                            type: event.target.value as EntityFieldType,
                          });
                        }}
                        disabled={pending}
                      />
                      <label className="wc-check">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={pending}
                          onChange={(event) => {
                            updateField(index, {
                              required: event.target.checked,
                            });
                          }}
                        />
                        <span>{messages.entities.types.fieldRequired}</span>
                      </label>
                    </div>

                    {field.type === 'text' ? (
                      <TextField
                        label={messages.entities.types.fieldMax}
                        type="number"
                        value={field.textMaxLength}
                        onChange={(event) => {
                          updateField(index, {
                            textMaxLength: event.target.value,
                          });
                        }}
                        disabled={pending}
                      />
                    ) : null}

                    {field.type === 'number' ? (
                      <div className="wc-form-grid">
                        <TextField
                          label={messages.entities.types.fieldMin}
                          type="number"
                          value={field.numberMin}
                          onChange={(event) => {
                            updateField(index, {
                              numberMin: event.target.value,
                            });
                          }}
                          disabled={pending}
                        />
                        <TextField
                          label={messages.entities.types.fieldMax}
                          type="number"
                          value={field.numberMax}
                          onChange={(event) => {
                            updateField(index, {
                              numberMax: event.target.value,
                            });
                          }}
                          disabled={pending}
                        />
                      </div>
                    ) : null}

                    {field.type === 'select' ? (
                      <label className="wc-field">
                        <span className="wc-field__label">
                          {messages.entities.types.fieldOptions}
                        </span>
                        <textarea
                          className="wc-field__control wc-field__control--textarea"
                          rows={4}
                          value={field.optionsText}
                          disabled={pending}
                          onChange={(event) => {
                            updateField(index, {
                              optionsText: event.target.value,
                            });
                          }}
                        />
                        <span className="wc-field__hint">
                          {messages.entities.types.fieldOptionsHint}
                        </span>
                      </label>
                    ) : null}

                    {field.type === 'reference' ? (
                      <SelectField
                        label={messages.entities.types.fieldTarget}
                        value={field.targetTypeKey}
                        options={[
                          {
                            value: '',
                            label: messages.entities.types.fieldTargetAny,
                          },
                          ...types.map((type) => ({
                            value: type.key,
                            label: type.name,
                          })),
                        ]}
                        onChange={(event) => {
                          updateField(index, {
                            targetTypeKey: event.target.value,
                          });
                        }}
                        disabled={pending}
                      />
                    ) : null}

                    <div className="wc-field-group__actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            fields: current.fields.filter(
                              (entry) => entry.id !== field.id,
                            ),
                          }));
                        }}
                        disabled={pending}
                        aria-label={messages.entities.types.removeFieldNamed(
                          field.label || messages.entities.types.fieldLabel,
                        )}
                      >
                        {messages.entities.types.removeField}
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="wc-dialog__actions">
            <Button
              variant="ghost"
              onClick={() => {
                setMode('list');
                setError(undefined);
              }}
              disabled={pending}
            >
              {messages.entities.types.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                void save();
              }}
            >
              {mode === 'edit'
                ? messages.entities.types.save
                : mode === 'duplicate'
                  ? messages.entities.types.duplicateSubmit
                  : messages.entities.types.createSubmit}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );

  function updateField(index: number, patch: Partial<FieldDraft>): void {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field, currentIndex) =>
        currentIndex === index ? { ...field, ...patch } : field,
      ),
    }));
    setError(undefined);
  }
}

function emptyDraft(): TypeDraft {
  return {
    name: '',
    key: '',
    icon: 'book-open',
    color: 'moss',
    fields: [],
  };
}

let fieldCounter = 0;

function emptyField(): FieldDraft {
  fieldCounter += 1;

  return {
    id: `wc-field-draft-${fieldCounter}`,
    key: '',
    label: '',
    type: 'text',
    required: false,
    textMaxLength: '',
    numberMin: '',
    numberMax: '',
    optionsText: '',
    targetTypeKey: '',
  };
}

function fromType(type: EntityTypeSummary): TypeDraft {
  return {
    name: type.name,
    key: type.key,
    icon: type.icon,
    color: type.color,
    fields: type.fields.map((field) => ({
      ...emptyField(),
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      ...(field.type === 'text' && field.maxLength !== undefined
        ? { textMaxLength: String(field.maxLength) }
        : {}),
      ...(field.type === 'number' && field.min !== undefined
        ? { numberMin: String(field.min) }
        : {}),
      ...(field.type === 'number' && field.max !== undefined
        ? { numberMax: String(field.max) }
        : {}),
      ...(field.type === 'select'
        ? {
            optionsText: field.options
              .map((option) => `${option.value}: ${option.label}`)
              .join('\n'),
          }
        : {}),
      ...(field.type === 'reference' && field.targetTypeKey !== undefined
        ? { targetTypeKey: field.targetTypeKey }
        : {}),
    })),
  };
}

function slugifyKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, ENTITY_FIELD_KEY_MAX_LENGTH)
    .replace(/-+$/, '');
}

function parseOptions(
  raw: string,
): readonly { readonly value: string; readonly label: string }[] {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const separator = trimmed.indexOf(':');
    const rawValue = separator === -1 ? trimmed : trimmed.slice(0, separator);
    const value = slugifyKey(rawValue);
    const label =
      separator === -1
        ? trimmed
        : trimmed.slice(separator + 1).trim() || trimmed;

    if (value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    options.push({ value, label });
  }

  return options;
}
