/**
 * Editor de la descripción de una ficha.
 *
 * Envoltorio fino sobre `RichTextEditor`: conserva la firma que usa la página de
 * la ficha y aporta los textos y la etiqueta de entidad. La lógica reutilizable
 * (barra mínima, menciones, enlaces y accesibilidad) vive en
 * `components/editor` para que el manuscrito de M3 la comparta.
 */
import type {
  EntityRichTextDocument,
  EntitySummary,
} from '../../../shared/contracts/entities';
import { useMessages } from '../../i18n/provider';
import { RichTextEditor } from '../editor/rich-text-editor';

export interface EntityDescriptionEditorProps {
  readonly document: EntityRichTextDocument | null;
  readonly candidates: readonly EntitySummary[];
  readonly disabled: boolean;
  /** Modo lectura: sin toolbar, sin ayuda y sin rol de formulario. */
  readonly readOnly?: boolean;
  readonly onChange: (document: EntityRichTextDocument | null) => void;
  readonly onOpenEntity: (entityId: string) => void;
}

/** Editor de la descripción enriquecida de una ficha. */
export function EntityDescriptionEditor({
  document,
  candidates,
  disabled,
  readOnly = false,
  onChange,
  onOpenEntity,
}: EntityDescriptionEditorProps) {
  const messages = useMessages();

  return (
    <RichTextEditor
      document={document}
      label={messages.entities.detail.descriptionLabel}
      candidates={candidates}
      hint={messages.entities.detail.descriptionHint}
      disabled={disabled}
      readOnly={readOnly}
      onChange={onChange}
      onOpenEntity={onOpenEntity}
    />
  );
}
