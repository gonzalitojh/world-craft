import { useMessages } from '../../i18n/provider';
import { Badge } from '../badge';
import { SettingsSection } from './settings-section';

/**
 * Idioma informativo.
 *
 * No hay selector ni opción deshabilitada: se muestra el idioma actual y una
 * nota para no prometer más idiomas de los que existen (D4/C8).
 */
export function LanguageSettings() {
  const messages = useMessages();

  return (
    <SettingsSection id="idioma" title={messages.settings.language.title}>
      <div className="wc-settings__row">
        <span className="wc-settings__label">
          {messages.settings.language.label}
        </span>
        <Badge tone="neutral">{messages.settings.language.current}</Badge>
      </div>
      <p className="wc-settings__note">{messages.settings.language.note}</p>
    </SettingsSection>
  );
}
