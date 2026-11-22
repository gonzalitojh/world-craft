import { Fragment } from 'react';

import type { EntityFieldDefinition } from '../../../shared/contracts/entity-types';
import type { EntitySummary } from '../../../shared/contracts/entities';
import type { EntityFieldValue } from '../../../shared/entity-types/fields';
import { useI18n } from '../../i18n/provider';

export interface EntityAttributesViewProps {
  readonly fields: readonly EntityFieldDefinition[];
  readonly values: Readonly<Record<string, EntityFieldValue>>;
  readonly candidates: readonly EntitySummary[];
  readonly onOpenEntity: (entityId: string) => void;
}

function isEmptyValue(value: EntityFieldValue | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.length === 0)
  );
}

/**
 * Ficha técnica de los campos del tipo.
 *
 * Se lee como una lista de datos (`dl`), no como una tabla ni un formulario:
 * los números, fechas y opciones se formatean con `Intl` y las referencias se
 * convierten en enlaces internos navegables. Una referencia rota se explica en
 * lugar de quedar como un identificador sin salida.
 */
export function EntityAttributesView({
  fields,
  values,
  candidates,
  onOpenEntity,
}: EntityAttributesViewProps) {
  const { messages, formats } = useI18n();
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  const formatDateValue = (value: string): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const date = new Date(`${value}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    // Las fechas de campo son días sin hora: se formatean en UTC para que el
    // día no cambie según la zona del equipo (C11). `dateStyle` se repite
    // porque las opciones pasadas sustituyen a las de reserva.
    return formats.formatDate(date, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
  };

  return (
    <dl className="wc-attributes-view">
      {fields.map((field) => {
        const value = values[field.key];

        if (isEmptyValue(value)) {
          return (
            <Fragment key={field.key}>
              <dt>{field.label}</dt>
              <dd className="wc-attributes-view__empty">
                {messages.entities.detail.emptyValue}
              </dd>
            </Fragment>
          );
        }

        if (field.type === 'reference' && typeof value === 'string') {
          const candidate = candidateMap.get(value);

          return (
            <Fragment key={field.key}>
              <dt>{field.label}</dt>
              <dd>
                {candidate === undefined ? (
                  <span className="wc-attributes-view__missing">
                    {messages.entities.detail.referenceMissing}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="wc-attributes-view__reference"
                    onClick={() => {
                      onOpenEntity(candidate.id);
                    }}
                  >
                    {candidate.name}
                  </button>
                )}
              </dd>
            </Fragment>
          );
        }

        let rendered: string;

        if (field.type === 'number' && typeof value === 'number') {
          rendered = formats.formatNumber(value);
        } else if (field.type === 'date' && typeof value === 'string') {
          rendered = formatDateValue(value) ?? value;
        } else if (field.type === 'select' && typeof value === 'string') {
          rendered =
            field.options.find((option) => option.value === value)?.label ??
            value;
        } else {
          rendered = String(value);
        }

        return (
          <Fragment key={field.key}>
            <dt>{field.label}</dt>
            <dd>{rendered}</dd>
          </Fragment>
        );
      })}
    </dl>
  );
}
