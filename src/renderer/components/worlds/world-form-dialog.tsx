import { useId, useState, type FormEvent } from 'react';

import {
  isWorldLanguage,
  WORLD_DESCRIPTION_MAX_LENGTH,
  WORLD_GENRE_MAX_LENGTH,
  WORLD_GENRES_MAX,
  WORLD_LANGUAGES,
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
  WORLD_SUMMARY_MAX_LENGTH,
  type WorldCreateInput,
  type WorldDetail,
  type WorldLanguage,
  type WorldUpdateInput,
} from '../../../shared/contracts/worlds';
import { useMessages } from '../../i18n/provider';
import { Dialog } from '../dialog';
import { Button } from '../button';
import { SelectField } from '../select-field';
import { TextAreaField } from '../text-area-field';
import { TextField } from '../text-field';

export type WorldFormMode = 'create' | 'edit';

export interface WorldFormDialogProps {
  readonly open: boolean;
  readonly mode: WorldFormMode;
  readonly world?: WorldDetail | null;
  readonly pending: boolean;
  readonly onClose: () => void;
  /**
   * Guarda el mundo. Devuelve `true` si se guardó; con `false` el diálogo sigue
   * abierto y muestra el error de formulario sin perder lo escrito.
   */
  readonly onSubmit: (
    input: WorldCreateInput | WorldUpdateInput,
  ) => Promise<boolean>;
}

interface FormValues {
  readonly name: string;
  readonly slug: string;
  readonly summary: string;
  readonly description: string;
  readonly genres: string;
  readonly language: WorldLanguage;
}

interface FormErrors {
  readonly name?: string;
  readonly slug?: string;
  readonly genres?: string;
  readonly form?: string;
}

const EMPTY_VALUES: FormValues = {
  name: '',
  slug: '',
  summary: '',
  description: '',
  genres: '',
  language: 'es',
};

/** Convierte un mundo en los valores del formulario. */
function toFormValues(world: WorldDetail | null | undefined): FormValues {
  if (world === null || world === undefined) {
    return EMPTY_VALUES;
  }

  return {
    name: world.name,
    slug: world.slug,
    summary: world.summary ?? '',
    description: world.description ?? '',
    genres: world.genres.join(', '),
    language: world.language,
  };
}

/** Separa los géneros escritos con comas. */
function splitGenres(raw: string): readonly string[] {
  return raw
    .split(',')
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
}

/**
 * Diálogo de creación y edición de un mundo.
 *
 * La validación de la interfaz da mensajes por campo; el proceso principal
 * repite las reglas antes de escribir. La portada se anuncia como prevista: su
 * selector llega con la galería de imágenes del mundo.
 */
export function WorldFormDialog({
  open,
  mode,
  world,
  pending,
  onClose,
  onSubmit,
}: WorldFormDialogProps) {
  const messages = useMessages();
  const formId = useId();
  const [values, setValues] = useState<FormValues>(() => toFormValues(world));
  const [errors, setErrors] = useState<FormErrors>({});

  const setValue = <K extends keyof FormValues>(
    field: K,
    value: FormValues[K],
  ): void => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = values.name.trim();
    const slug = values.slug.trim();
    const genres = splitGenres(values.genres);
    const nextErrors: {
      name?: string;
      slug?: string;
      genres?: string;
    } = {};

    if (name.length === 0) {
      nextErrors.name = messages.worlds.form.nameRequired;
    }

    if (slug.length > 0 && !WORLD_SLUG_PATTERN.test(slug)) {
      nextErrors.slug = messages.worlds.form.slugInvalid;
    }

    if (
      genres.length > WORLD_GENRES_MAX ||
      genres.some((genre) => genre.length > WORLD_GENRE_MAX_LENGTH)
    ) {
      nextErrors.genres = messages.worlds.form.genresInvalid;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const common = {
      name,
      slug: slug.length > 0 ? slug : undefined,
      summary: values.summary.trim().length > 0 ? values.summary : null,
      description:
        values.description.trim().length > 0 ? values.description : null,
      genres,
      language: values.language,
    };

    const saved =
      mode === 'edit' && world !== null && world !== undefined
        ? await onSubmit({ ...common, id: world.id })
        : await onSubmit(common);

    if (!saved) {
      setErrors({ form: messages.worlds.form.formError });
    }
  };

  const languageOptions = WORLD_LANGUAGES.map((language) => ({
    value: language,
    label: messages.worlds.languages[language],
  }));
  const title =
    mode === 'create'
      ? messages.worlds.form.createTitle
      : messages.worlds.form.editTitle(world?.name ?? '');
  const submitLabel =
    mode === 'create'
      ? messages.worlds.form.submitCreate
      : messages.worlds.form.submitEdit;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="wc-dialog--wide"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {messages.worlds.form.cancel}
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form className="wc-form" id={formId} onSubmit={handleSubmit} noValidate>
        <TextField
          label={messages.worlds.form.nameLabel}
          placeholder={messages.worlds.form.namePlaceholder}
          value={values.name}
          onChange={(event) => {
            setValue('name', event.target.value);
          }}
          autoFocus
          maxLength={WORLD_NAME_MAX_LENGTH}
          required
          error={errors.name}
        />

        <TextField
          label={messages.worlds.form.slugLabel}
          hint={messages.worlds.form.slugHint}
          value={values.slug}
          onChange={(event) => {
            setValue('slug', event.target.value);
          }}
          maxLength={WORLD_SLUG_MAX_LENGTH}
          autoComplete="off"
          error={errors.slug}
        />

        <TextAreaField
          label={messages.worlds.form.summaryLabel}
          hint={messages.worlds.form.summaryHint}
          value={values.summary}
          onChange={(event) => {
            setValue('summary', event.target.value);
          }}
          rows={3}
          maxLength={WORLD_SUMMARY_MAX_LENGTH}
        />

        <TextAreaField
          label={messages.worlds.form.descriptionLabel}
          hint={messages.worlds.form.descriptionHint}
          value={values.description}
          onChange={(event) => {
            setValue('description', event.target.value);
          }}
          rows={6}
          maxLength={WORLD_DESCRIPTION_MAX_LENGTH}
        />

        <TextField
          label={messages.worlds.form.genresLabel}
          hint={messages.worlds.form.genresHint}
          value={values.genres}
          onChange={(event) => {
            setValue('genres', event.target.value);
          }}
          error={errors.genres}
        />

        <SelectField
          label={messages.worlds.form.languageLabel}
          value={values.language}
          onChange={(event) => {
            const value = event.target.value;

            if (isWorldLanguage(value)) {
              setValue('language', value);
            }
          }}
          options={languageOptions}
        />

        <p className="wc-form__note">{messages.worlds.form.coverNote}</p>

        {errors.form !== undefined ? (
          <p className="wc-form__error" role="alert">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
