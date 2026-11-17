'use client';

import { useI18n } from '@/components/i18n/locale-provider';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/**
 * Isla interactiva del campo con etiqueta.
 *
 * Muestra los dos estados que importan: ayuda visible y error. `Field` entrega
 * al control su `id`, su `aria-describedby` y su `aria-invalid`; por eso la
 * composición vive en cliente y no se puede serializar desde el servidor.
 */
export function FieldDemo() {
  const { messages } = useI18n();
  const field = messages.design.components.field;

  return (
    <div className="grid w-full min-w-0 max-w-(--prose-max) gap-4 sm:grid-cols-2">
      <Field label={field.label} description={field.description}>
        {(control) => <Input {...control} name="field-help" />}
      </Field>
      <Field label={field.errorLabel} error={field.error}>
        {(control) => (
          <Input {...control} name="field-error" defaultValue={field.label} />
        )}
      </Field>
    </div>
  );
}
