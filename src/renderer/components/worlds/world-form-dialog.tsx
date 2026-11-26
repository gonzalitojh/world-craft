import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Editor } from '@tiptap/react';

import {
  isWorldLanguage,
  WORLD_GENRE_MAX_LENGTH,
  WORLD_GENRES_MAX,
  WORLD_LANGUAGES,
  WORLD_DESCRIPTION_TEXT_MAX_LENGTH,
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
  WORLD_SUMMARY_MAX_LENGTH,
  type WorldCreateInput,
  type WorldDetail,
  type WorldLanguage,
  type WorldRichTextDocument,
  type WorldUpdateInput,
} from '../../../shared/contracts/worlds';
import type { EntitySummary } from '../../../shared/contracts/entities';
import { collectEntityLinkIds } from '../../../shared/entities/description';
import { useEntityCandidates } from '../../hooks/use-entity-candidates';
import { useI18n } from '../../i18n/provider';
import { Dialog } from '../dialog';
import { Button } from '../button';
import { SelectField } from '../select-field';
import { TextAreaField } from '../text-area-field';
import { TextField } from '../text-field';
import {
  WorldDescriptionField,
  isWorldDescriptionTooLong,
} from './world-description-editor';

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
  readonly mentionCandidates?: readonly EntitySummary[] | undefined;
  readonly mentionCandidatesState?: 'loading' | 'ready' | 'error' | undefined;
  readonly mentionCandidatesComplete?: boolean | undefined;
  readonly onRetryMentionCandidates?: (() => void) | undefined;
}

interface FormValues {
  readonly name: string;
  readonly slug: string;
  readonly summary: string;
  readonly description: WorldRichTextDocument | null;
  readonly genres: string;
  readonly language: WorldLanguage;
}

interface FormErrors {
  name?: string;
  slug?: string;
  genres?: string;
  description?: string;
  form?: string;
}

const EMPTY_VALUES: FormValues = {
  name: '',
  slug: '',
  summary: '',
  description: null,
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
    description: world.description,
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
  mentionCandidates,
  mentionCandidatesState,
  mentionCandidatesComplete,
  onRetryMentionCandidates,
}: WorldFormDialogProps) {
  const { messages, formats } = useI18n();
  const formId = useId();
  const nameId = useId();
  const slugId = useId();
  const genresId = useId();
  const formErrorRef = useRef<HTMLParagraphElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [values, setValues] = useState<FormValues>(() => toFormValues(world));
  const [errors, setErrors] = useState<FormErrors>({});
  const candidatesFallback = useEntityCandidates(
    mode === 'edit' ? (world?.id ?? null) : null,
    open,
  );
  const candidates = mentionCandidates ?? candidatesFallback.candidates;
  const candidatesState =
    mentionCandidatesState ?? candidatesFallback.state;
  const candidatesComplete =
    mentionCandidatesComplete ?? candidatesFallback.complete;
  const retryCandidates =
    onRetryMentionCandidates ?? candidatesFallback.retry;

  useEffect(() => {
    if (errors.form !== undefined) {
      formErrorRef.current?.focus();
    }
  }, [errors.form]);

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
    const nextErrors: FormErrors = {};

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

    if (isWorldDescriptionTooLong(values.description)) {
      nextErrors.description = messages.worlds.form.descriptionTooLong(
        formats.formatNumber(WORLD_DESCRIPTION_TEXT_MAX_LENGTH, {
          useGrouping: true,
        }),
      );
    } else if (values.description !== null) {
      const linkedIds = collectEntityLinkIds(values.description);

      if (linkedIds.length > 0) {
        // En creación no hay fichas; en edición solo se puede validar antes de
        // enviar si la lista de candidatas llegó completa. Si está truncada, el
        // proceso principal sigue siendo la autoridad.
        const candidateIds = new Set(candidates.map((entity) => entity.id));
        const canValidate =
          mode === 'create' ||
          (candidatesState === 'ready' && candidatesComplete);

        if (
          mode === 'create' ||
          (canValidate && linkedIds.some((id) => !candidateIds.has(id)))
        ) {
          nextErrors.description =
            messages.worlds.form.descriptionLinkInvalid;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);

      if (nextErrors.name !== undefined) {
        document.getElementById(nameId)?.focus();
      } else if (nextErrors.slug !== undefined) {
        document.getElementById(slugId)?.focus();
      } else if (nextErrors.description !== undefined) {
        editorRef.current?.commands.focus();
      } else if (nextErrors.genres !== undefined) {
        document.getElementById(genresId)?.focus();
      }

      return;
    }

    const common = {
      name,
      slug: slug.length > 0 ? slug : undefined,
      summary: values.summary.trim().length > 0 ? values.summary : null,
      description: values.description,
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
      dismissible={!pending}
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
      <form
        className="wc-form wc-world-form"
        id={formId}
        onSubmit={handleSubmit}
        noValidate
      >
        <TextField
          id={nameId}
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
          id={slugId}
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

        <WorldDescriptionField
          mode={mode}
          document={values.description}
          candidates={candidates}
          candidatesState={candidatesState}
          pending={pending}
          error={errors.description}
          onChange={(description) => {
            setValue('description', description);
          }}
          onRetryCandidates={retryCandidates}
          editorRef={editorRef}
        />

        <TextField
          id={genresId}
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
          <p
            className="wc-form__error"
            role="alert"
            tabIndex={-1}
            ref={formErrorRef}
          >
            {errors.form}
          </p>
        ) : null}

        {pending ? (
          <p className="wc-visually-hidden" role="status" aria-live="polite">
            {messages.worlds.form.saving}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
