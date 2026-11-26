import type {
  UiPreferences,
  UiPreferencesPatch,
} from '../../shared/contracts/preferences';
import { useMessages } from '../i18n/provider';
import { AppearanceSettings } from '../components/settings/appearance-settings';
import { DataSettings } from '../components/settings/data-settings';
import { LanguageSettings } from '../components/settings/language-settings';
import { ResetPreferencesSettings } from '../components/settings/reset-preferences-settings';
import { SettingsAnnouncerProvider } from '../components/settings/settings-announcer';
import { ShortcutsSettings } from '../components/settings/shortcuts-settings';
import { UpdatesSettings } from '../components/settings/updates-settings';
import type { ToastTone } from '../components/toast';

export interface SettingsPageProps {
  readonly preferences: UiPreferences;
  readonly onUpdate: (patch: UiPreferencesPatch) => void;
  readonly onReset: () => void;
  readonly onNotify?: ((tone: ToastTone, message: string) => void) | undefined;
}

/**
 * Página de Ajustes de escritorio.
 *
 * Es una página editorial de una columna con el orden acordado: Apariencia,
 * Idioma, Atajos, Actualizaciones, Datos y Restablecer preferencias. Los
 * cambios de apariencia se aplican al momento y la sección de Datos es la UI
 * real de #79 (resumen, carpetas, uso, exportación, huérfanos y borrado).
 */
export function SettingsPage({
  preferences,
  onUpdate,
  onReset,
  onNotify,
}: SettingsPageProps) {
  const messages = useMessages();

  return (
    <SettingsAnnouncerProvider>
      <div className="wc-page wc-page--settings">
        <p className="wc-page__lead">{messages.settings.lead}</p>
        <AppearanceSettings preferences={preferences} onUpdate={onUpdate} />
        <LanguageSettings />
        <ShortcutsSettings />
        <UpdatesSettings />
        <DataSettings onNotify={onNotify} />
        <ResetPreferencesSettings onReset={onReset} />
      </div>
    </SettingsAnnouncerProvider>
  );
}
