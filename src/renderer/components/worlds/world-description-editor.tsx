/**
 * Campo de descripción del mundo en el formulario de crear/editar.
 *
 * Es un envoltorio fino sobre `RichTextEditor`: aporta etiqueta, contador sobre
 * el texto plano, ayuda, estado de candidatas y errores. No duplica barra,
 * menciones ni enlaces. En creación no existen fichas y los enlaces quedan
 * apagados; en edición se habilitan cuando la lista de candidatas está lista.
 */
import type { Editor } from '@tiptap/react';
import { useId, type Ref } from 'react';

import {
  WORLD_DESCRIPTION_TEXT_MAX_LENGTH,
  type WorldRichTextDocument,
} from '../../../shared/contracts/worlds';
import type { EntitySummary } from '../../../shared/contracts/entities';
import { extractEntityDescriptionText } from '../../../shared/entities/description';
import { useI18n } from '../../i18n/provider';
import { cx } from '../../lib/class-names';
import { Button } from '../button';
import { RichTextEditor } from '../editor/rich-text-editor';

export interface WorldDescriptionFieldProps {
  readonly mode: 'create' | 'edit';
  readonly document: WorldRichTextDocument | null;
  readonly candidates: readonly EntitySummary[];
  readonly candidatesState: 'loading' | 'ready' | 'error';
  readonly pending: boolean;
  readonly error?: string | undefined;
  readonly onChange: (document: WorldRichTextDocument | null) => void;
  readonly onRetryCandidates?: (() => void) | undefined;
  readonly editorRef?: Ref<Editor | null> | undefined;
}

const noop = (): void => {};

/** Texto visible de una descripción, ya normalizado. */
export function worldDescriptionText(
  document: WorldRichTextDocument | null,
): string {
  return document === null ? '' : extractEntityDescriptionText(document);
}

/** Indica si la descripción supera el límite vigente de 4.000 caracteres. */
export function isWorldDescriptionTooLong(
  document: WorldRichTextDocument | null,
): boolean {
  return worldDescriptionText(document).length > WORLD_DESCRIPTION_TEXT_MAX_LENGTH;
}

/** Campo de formulario de la descripción enriquecida del mundo. */
export function WorldDescriptionField({
  mode,
  document,
  candidates,
  candidatesState,
  pending,
  error,
  onChange,
  onRetryCandidates,
  editorRef,
}: WorldDescriptionFieldProps) {
  const { messages, formats } = useI18n();
  const labelId = useId();
  const hintId = useId();
  const statusId = useId();
  const errorId = useId();
  const text = worldDescriptionText(document);
  const count = text.length;
  const over = count > WORLD_DESCRIPTION_TEXT_MAX_LENGTH;
  const formatCount = (value: number): string =>
    formats.formatNumber(value, { useGrouping: true });
  const max = formatCount(WORLD_DESCRIPTION_TEXT_MAX_LENGTH);
  const countText = formatCount(count);
  const countLabel = over
    ? messages.worlds.form.descriptionCountOver(countText, max)
    : messages.worlds.form.descriptionCount(countText, max);
  const displayError =
    error ?? (over ? messages.worlds.form.descriptionTooLong(max) : undefined);
  const hint =
    mode === 'create'
      ? messages.worlds.form.descriptionHintCreate
      : messages.worlds.form.descriptionHint;
  const entityLinks =
    mode === 'create'
      ? 'off'
      : candidatesState === 'ready'
        ? 'enabled'
        : 'disabled';
  const describedBy = [
    hintId,
    candidatesState === 'ready' ? null : statusId,
    displayError === undefined ? null : errorId,
  ]
    .filter((value): value is string => value !== null)
    .join(' ');

  const handleChange = (next: WorldRichTextDocument | null): void => {
    onChange(worldDescriptionText(next).trim().length === 0 ? null : next);
  };

  return (
    <div
      className={cx(
        'wc-field',
        'wc-world-form__description',
        displayError !== undefined && 'wc-field--invalid',
      )}
      data-field="description"
    >
      <div className="wc-field__label-row">
        <span className="wc-field__label" id={labelId}>
          {messages.worlds.form.descriptionLabel}
        </span>
        <span
          className={cx(
            'wc-editor-field__count',
            over && 'wc-editor-field__count--over',
          )}
        >
          {countLabel}
        </span>
      </div>

      <RichTextEditor
        document={document}
        label={messages.worlds.form.descriptionLabel}
        labelledBy={labelId}
        describedBy={describedBy}
        invalid={displayError !== undefined}
        candidates={mode === 'create' ? [] : candidates}
        disabled={pending}
        entityLinks={entityLinks}
        navigateLinks={false}
        onChange={handleChange}
        onOpenEntity={noop}
        editorRef={editorRef}
      />

      <p className="wc-field__hint" id={hintId}>
        {hint}
      </p>

      {candidatesState === 'loading' ? (
        <div
          className="wc-editor-field__status"
          id={statusId}
          role="status"
        >
          {messages.worlds.form.mentionsLoading}
        </div>
      ) : candidatesState === 'error' ? (
        <div
          className="wc-editor-field__status"
          id={statusId}
          role="status"
          aria-live="polite"
        >
          <span>{messages.worlds.form.mentionsError}</span>
          <Button variant="ghost" size="sm" onClick={onRetryCandidates}>
            {messages.worlds.form.mentionsRetry}
          </Button>
        </div>
      ) : null}

      {displayError === undefined ? null : (
        <p className="wc-field__error" id={errorId} role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
