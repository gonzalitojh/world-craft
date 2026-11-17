'use client';

import { useI18n } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * Isla interactiva del patrón de formulario.
 *
 * `Field` recibe una función hija para entregar al control su `id`, su
 * `aria-describedby` y su `aria-invalid`: el componente no adivina qué control
 * hay dentro y no clona nodos. Por eso este patrón necesita ser cliente.
 *
 * El segundo campo muestra el estado de error: el mensaje sustituye a la ayuda,
 * se asocia al control y el borde cambia de token.
 */
export function FormDemo() {
  const { messages, t } = useI18n();
  const form = messages.design.patterns.form;
  const field = messages.design.components.field;

  return (
    <form
      className="grid w-full min-w-0 max-w-(--prose-max) gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h4 className="min-w-0 font-display text-lg tracking-display text-foreground">
        {form.heading}
      </h4>

      <Field label={form.name} description={form.nameDescription}>
        {(control) => (
          <Input {...control} name="name" placeholder={form.namePlaceholder} />
        )}
      </Field>

      <Field label={form.role}>
        {(control) => (
          <Select {...control} name="role" defaultValue="protagonista">
            <option value="protagonista">{form.rolePrimary}</option>
            <option value="secundario">{form.roleSecondary}</option>
          </Select>
        )}
      </Field>

      <Field label={form.summary}>
        {(control) => (
          <Textarea
            {...control}
            name="summary"
            rows={3}
            placeholder={form.summaryPlaceholder}
          />
        )}
      </Field>

      <Field label={field.errorLabel} error={field.error}>
        {(control) => (
          <Input {...control} name="name-error" defaultValue={field.label} />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">{form.submit}</Button>
        <Button type="reset" variant="ghost">
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
