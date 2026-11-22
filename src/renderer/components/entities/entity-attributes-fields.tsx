import type {
  EntityFieldDefinition,
  EntitySelectOption,
} from '../../../shared/contracts/entity-types';
import type { EntitySummary } from '../../../shared/contracts/entities';
import type { EntityFieldValue } from '../../../shared/entity-types/fields';
import { SelectField } from '../select-field';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityAttributesFieldsProps {
  readonly fields: readonly EntityFieldDefinition[];
  readonly values: Readonly<Record<string, EntityFieldValue>>;
  readonly candidates: readonly EntitySummary[];
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled: boolean;
  readonly onChange: (key: string, value: EntityFieldValue | undefined) => void;
}

/**
 * Campos dinámicos de la plantilla del tipo.
 *
 * Cada control reutiliza los componentes accesibles del sistema de diseño. Los
 * campos `reference` solo ofrecen fichas vivas del mismo mundo y, si el campo
 * declara un tipo de destino, se limita a ese tipo.
 */
export function EntityAttributesFields({
  fields,
  values,
  candidates,
  errors,
  disabled,
  onChange,
}: EntityAttributesFieldsProps) {
  const { messages } = useI18n();

  if (fields.length === 0) {
    return (
      <p className="wc-page__section-lead">
        {messages.entities.detail.attributesEmpty}
      </p>
    );
  }

  return (
    <div className="wc-form-grid">
      {fields.map((field) => {
        const value = values[field.key];
        const error = errors[field.key];

        switch (field.type) {
          case 'text':
            return (
              <TextField
                key={field.key}
                id={`wc-attribute-${field.key}`}
                label={field.label}
                hint={
                  field.maxLength === undefined
                    ? undefined
                    : messages.entities.attributes.textMax(field.maxLength)
                }
                value={typeof value === 'string' ? value : ''}
                {...(field.maxLength === undefined
                  ? {}
                  : { maxLength: field.maxLength })}
                error={error}
                disabled={disabled}
                required={field.required}
                onChange={(event) => {
                  onChange(
                    field.key,
                    event.target.value.length === 0
                      ? undefined
                      : event.target.value,
                  );
                }}
              />
            );

          case 'number':
            return (
              <TextField
                key={field.key}
                id={`wc-attribute-${field.key}`}
                label={field.label}
                type="number"
                value={typeof value === 'number' ? String(value) : ''}
                error={error}
                disabled={disabled}
                required={field.required}
                onChange={(event) => {
                  const raw = event.target.value;
                  onChange(
                    field.key,
                    raw.length === 0 ? undefined : Number(raw),
                  );
                }}
              />
            );

          case 'date':
            return (
              <TextField
                key={field.key}
                id={`wc-attribute-${field.key}`}
                label={field.label}
                type="date"
                value={typeof value === 'string' ? value : ''}
                error={error}
                disabled={disabled}
                required={field.required}
                onChange={(event) => {
                  onChange(
                    field.key,
                    event.target.value.length === 0
                      ? undefined
                      : event.target.value,
                  );
                }}
              />
            );

          case 'select':
            return (
              <SelectField
                key={field.key}
                id={`wc-attribute-${field.key}`}
                label={field.label}
                value={typeof value === 'string' ? value : ''}
                error={error}
                disabled={disabled}
                required={field.required}
                options={[
                  {
                    value: '',
                    label: messages.entities.attributes.emptyOption,
                  },
                  ...field.options.map((option: EntitySelectOption) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
                onChange={(event) => {
                  onChange(
                    field.key,
                    event.target.value.length === 0
                      ? undefined
                      : event.target.value,
                  );
                }}
              />
            );

          case 'reference': {
            const filtered = candidates.filter(
              (candidate) =>
                field.targetTypeKey === undefined ||
                candidate.typeKey === field.targetTypeKey,
            );
            const options = [
              {
                value: '',
                label: messages.entities.attributes.referenceEmpty,
              },
              ...filtered.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.name} · ${candidate.typeName}`,
              })),
            ];

            return (
              <SelectField
                key={field.key}
                id={`wc-attribute-${field.key}`}
                label={field.label}
                value={typeof value === 'string' ? value : ''}
                hint={
                  filtered.length === 0
                    ? messages.entities.attributes.referenceNone
                    : undefined
                }
                error={error}
                disabled={disabled || filtered.length === 0}
                required={field.required}
                options={options}
                onChange={(event) => {
                  onChange(
                    field.key,
                    event.target.value.length === 0
                      ? undefined
                      : event.target.value,
                  );
                }}
              />
            );
          }
        }
      })}
    </div>
  );
}
