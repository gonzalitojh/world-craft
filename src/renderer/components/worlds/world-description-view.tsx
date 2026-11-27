/**
 * Descripción del mundo en modo lectura.
 *
 * Reutiliza el editor compartido sin barra, sin popover y sin atributos de
 * formulario. Los enlaces internos navegan con un clic normal o Enter desde la
 * página del mundo. El vacío no monta un editor y remite al menú «⋯» → Editar.
 */
import type { WorldRichTextDocument } from '../../../shared/contracts/worlds';
import { useMessages } from '../../i18n/provider';
import { RichTextEditor } from '../editor/rich-text-editor';
import { worldDescriptionText } from './world-description-editor';

export interface WorldDescriptionViewProps {
  readonly document: WorldRichTextDocument | null;
  readonly onOpenEntity: (entityId: string) => void;
}

const noop = (): void => {};

/** Lectura de la descripción enriquecida del mundo. */
export function WorldDescriptionView({
  document,
  onOpenEntity,
}: WorldDescriptionViewProps) {
  const messages = useMessages();

  if (worldDescriptionText(document).trim().length === 0) {
    return (
      <p className="wc-world-description wc-world-description--empty">
        {messages.worlds.detail.noDescription}
      </p>
    );
  }

  return (
    <div className="wc-world-description">
      <RichTextEditor
        document={document}
        label={messages.worlds.detail.summaryTitle}
        candidates={[]}
        readOnly
        entityLinks="off"
        onChange={noop}
        onOpenEntity={onOpenEntity}
      />
    </div>
  );
}
