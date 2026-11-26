import { useState } from 'react';

import type {
  UiPreferences,
  UiPreferencesPatch,
} from '../../../shared/contracts/preferences';
import { useMessages } from '../../i18n/provider';
import { Button } from '../button';
import { Radio, RadioGroup } from '../radio';
import { SettingsSection } from './settings-section';
import { useAnnounce } from './settings-announcer';

export interface AppearanceSettingsProps {
  readonly preferences: UiPreferences;
  readonly onUpdate: (patch: UiPreferencesPatch) => void;
}

// Los valores nativos de los radios no son texto visible: se referencian para
// que la guarda de i18n no los confunda con cadenas de interfaz.
const THEME_VALUES = { light: 'light', dark: 'dark' } as const;
const DENSITY_VALUES = {
  comfortable: 'comfortable',
  compact: 'compact',
} as const;
const FONT_SCALE_VALUES = {
  small: 'small',
  normal: 'normal',
  large: 'large',
} as const;

/**
 * Apariencia: tema, densidad y tamaño de texto.
 *
 * Cada grupo es un `fieldset` con `legend`; los cambios se aplican al instante
 * a través del hook de preferencias. «Restablecer apariencia» usa `update` con
 * los valores por defecto, nunca `reset`, para no tocar el resto de ajustes.
 */
export function AppearanceSettings({
  preferences,
  onUpdate,
}: AppearanceSettingsProps) {
  const messages = useMessages();
  const announce = useAnnounce();
  const [resetMessage, setResetMessage] = useState('');

  return (
    <SettingsSection
      id="apariencia"
      title={messages.settings.appearance.title}
      lead={messages.settings.appearance.lead}
    >
      <div className="wc-settings__appearance-grid">
        <RadioGroup
          legend={messages.settings.appearance.theme.legend}
          name="wc-settings-theme"
        >
          <Radio
            label={messages.settings.appearance.theme.light}
            value={THEME_VALUES.light}
            checked={preferences.theme === 'light'}
            onChange={() => {
              onUpdate({ theme: 'light' });
            }}
          />
          <Radio
            label={messages.settings.appearance.theme.dark}
            value={THEME_VALUES.dark}
            checked={preferences.theme === 'dark'}
            onChange={() => {
              onUpdate({ theme: 'dark' });
            }}
          />
        </RadioGroup>

        <RadioGroup
          legend={messages.settings.appearance.density.legend}
          name="wc-settings-density"
        >
          <Radio
            label={messages.settings.appearance.density.comfortable}
            value={DENSITY_VALUES.comfortable}
            checked={preferences.density === 'comfortable'}
            onChange={() => {
              onUpdate({ density: 'comfortable' });
            }}
          />
          <Radio
            label={messages.settings.appearance.density.compact}
            value={DENSITY_VALUES.compact}
            checked={preferences.density === 'compact'}
            onChange={() => {
              onUpdate({ density: 'compact' });
            }}
          />
        </RadioGroup>

        <RadioGroup
          legend={messages.settings.appearance.fontScale.legend}
          name="wc-settings-font-scale"
        >
          <Radio
            label={messages.settings.appearance.fontScale.small}
            value={FONT_SCALE_VALUES.small}
            checked={preferences.fontScale === 'small'}
            onChange={() => {
              onUpdate({ fontScale: 'small' });
            }}
          />
          <Radio
            label={messages.settings.appearance.fontScale.normal}
            value={FONT_SCALE_VALUES.normal}
            checked={preferences.fontScale === 'normal'}
            onChange={() => {
              onUpdate({ fontScale: 'normal' });
            }}
          />
          <Radio
            label={messages.settings.appearance.fontScale.large}
            value={FONT_SCALE_VALUES.large}
            checked={preferences.fontScale === 'large'}
            onChange={() => {
              onUpdate({ fontScale: 'large' });
            }}
          />
        </RadioGroup>
      </div>

      <footer className="wc-settings__footer">
        <Button
          variant="ghost"
          onClick={() => {
            onUpdate({
              theme: 'light',
              density: 'comfortable',
              fontScale: 'normal',
            });
            setResetMessage(messages.settings.appearance.resetDone);
            announce(messages.settings.appearance.resetDone);
          }}
        >
          {messages.settings.appearance.reset}
        </Button>
        <p className="wc-settings__hint">
          {messages.settings.appearance.resetHint}
        </p>
      </footer>
      <p className="wc-settings__status">{resetMessage}</p>
    </SettingsSection>
  );
}
