import { describe, expect, it } from 'vitest';

import {
  createLibrarySettings,
  parseLibrarySettings,
  parseLibrarySettingsJson,
  serializeLibrarySettings,
} from '@/main/data/library/settings';
import {
  createDefaultUiPreferences,
  type UiPreferences,
} from '@/shared/contracts/preferences';

function preferences(): UiPreferences {
  return {
    ...createDefaultUiPreferences(),
    theme: 'dark',
    density: 'compact',
    fontScale: 'large',
    railCollapsed: true,
    entityView: {
      propertiesOpen: false,
      propertiesWidth: 340,
      sections: {
        description: false,
        attributes: true,
        relations: true,
        resources: false,
      },
    },
  };
}

describe('settings.json de la biblioteca', () => {
  it('incluye apariencia, rail y vista de ficha sin lastView ni recentLocation', () => {
    const settings = createLibrarySettings(preferences());

    expect(settings).toEqual({
      format: 'world-craft-library-settings',
      formatVersion: 1,
      theme: 'dark',
      density: 'compact',
      fontScale: 'large',
      railCollapsed: true,
      entityView: {
        propertiesOpen: false,
        propertiesWidth: 340,
        sections: {
          description: false,
          attributes: true,
          relations: true,
          resources: false,
        },
      },
    });
    expect(settings).not.toHaveProperty('lastView');
    expect(settings).not.toHaveProperty('recentLocation');
  });

  it('serializa, parsea y rechaza claves extra', () => {
    const settings = createLibrarySettings(preferences());
    const text = serializeLibrarySettings(settings);

    expect(parseLibrarySettingsJson(text)).toEqual(settings);
    expect(parseLibrarySettings(settings)).toEqual(settings);

    expect(() =>
      parseLibrarySettings({ ...settings, lastView: 'entity' }),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_SETTINGS_INVALID' }),
    );
    expect(() =>
      parseLibrarySettings({ ...settings, recentLocation: null }),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_SETTINGS_INVALID' }),
    );
    expect(() =>
      parseLibrarySettings({ ...settings, theme: 'sepia' }),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_SETTINGS_INVALID' }),
    );
    expect(() =>
      parseLibrarySettings({
        ...settings,
        entityView: { ...settings.entityView, propertiesWidth: 999 },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_SETTINGS_INVALID' }),
    );
  });
});
