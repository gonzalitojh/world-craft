import { describe, expect, it } from 'vitest';

import {
  readStoredPreferences,
  uiPreferencesPatchSchema,
} from '@/main/preferences/validation';
import { UI_PREFERENCE_KEYS } from '@/main/preferences/keys';
import { createDefaultUiPreferences } from '@/shared/contracts/preferences';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';

describe('validación estricta de escritura', () => {
  it('acepta parches parciales válidos', () => {
    for (const patch of [
      { theme: 'dark' },
      { railCollapsed: true },
      { density: 'compact' },
      { fontScale: 'large' },
      { entityView: { propertiesWidth: 360 } },
      { entityView: { sections: { relations: true } } },
      { lastView: 'entity' },
      { recentLocation: null },
      { recentLocation: { kind: 'world', worldId: WORLD_ID } },
      {
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: 'Mara Viento',
        },
      },
    ]) {
      expect(
        uiPreferencesPatchSchema.safeParse(patch).success,
        JSON.stringify(patch),
      ).toBe(true);
    }
  });

  it('rechaza parche vacío, claves extra y valores fuera de contrato', () => {
    for (const patch of [
      {},
      { theme: 'sepia' },
      { theme: 'dark', extra: true },
      { railCollapsed: 'yes' },
      { density: 'amplia' },
      { fontScale: 'gigante' },
      { density: null },
      { entityView: { propertiesWidth: 279 } },
      { entityView: { propertiesWidth: 361 } },
      { entityView: { propertiesWidth: 320.5 } },
      { entityView: { extra: true } },
      { entityView: { sections: { desconocida: true } } },
      { lastView: 'samples' },
      { lastView: 'desconocida' },
      { recentLocation: { kind: 'world', worldId: 'world-1' } },
      {
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
        },
      },
      {
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: '',
        },
      },
      {
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: 'x'.repeat(121),
        },
      },
    ]) {
      expect(
        uiPreferencesPatchSchema.safeParse(patch).success,
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
});

describe('lectura tolerante', () => {
  it('devuelve los defectos sin filas y sin tocar el mapa', () => {
    const entries = new Map<string, string>();

    expect(readStoredPreferences(entries)).toEqual(
      createDefaultUiPreferences(),
    );
    expect(entries.size).toBe(0);
  });

  it('cae al defecto por clave ante JSON roto o tipos erróneos', () => {
    const entries = new Map<string, string>([
      [UI_PREFERENCE_KEYS.theme, 'no-json'],
      [UI_PREFERENCE_KEYS.railCollapsed, '"yes"'],
      [UI_PREFERENCE_KEYS.density, '"amplia"'],
      [UI_PREFERENCE_KEYS.fontScale, '"gigante"'],
      [UI_PREFERENCE_KEYS.lastView, '"samples"'],
      [UI_PREFERENCE_KEYS.recentLocation, '{"kind":"entity"}'],
      [UI_PREFERENCE_KEYS.entityView, '{"propertiesWidth":999}'],
    ]);
    const preferences = readStoredPreferences(entries);

    expect(preferences.theme).toBe('light');
    expect(preferences.railCollapsed).toBe(false);
    expect(preferences.density).toBe('comfortable');
    expect(preferences.fontScale).toBe('normal');
    expect(preferences.lastView).toBe('home');
    expect(preferences.recentLocation).toBeNull();
    expect(preferences.entityView.propertiesWidth).toBe(320);
  });

  it('recupera por campo una vista de ficha parcialmente inválida', () => {
    const entries = new Map<string, string>([
      [
        UI_PREFERENCE_KEYS.entityView,
        JSON.stringify({
          propertiesOpen: false,
          propertiesWidth: 999,
          sections: {
            description: false,
            attributes: true,
            relations: 'yes',
            extra: true,
          },
        }),
      ],
    ]);
    const preferences = readStoredPreferences(entries);

    expect(preferences.entityView).toEqual({
      propertiesOpen: false,
      propertiesWidth: 320,
      sections: {
        description: false,
        attributes: true,
        relations: false,
        resources: false,
      },
    });
  });

  it('ignora claves ui.* desconocidas y conserva las válidas', () => {
    const entries = new Map<string, string>([
      [UI_PREFERENCE_KEYS.theme, '"dark"'],
      ['ui.futuro', '{"cualquier":"cosa"}'],
    ]);
    const preferences = readStoredPreferences(entries);

    expect(preferences.theme).toBe('dark');
    expect(preferences.railCollapsed).toBe(false);
    expect(Object.keys(preferences).sort()).toEqual([
      'density',
      'entityView',
      'fontScale',
      'lastView',
      'railCollapsed',
      'recentLocation',
      'theme',
    ]);
  });

  it('lee densidad y tamaño válidos por clave', () => {
    const entries = new Map<string, string>([
      [UI_PREFERENCE_KEYS.density, '"compact"'],
      [UI_PREFERENCE_KEYS.fontScale, '"small"'],
    ]);
    const preferences = readStoredPreferences(entries);

    expect(preferences.density).toBe('compact');
    expect(preferences.fontScale).toBe('small');
  });

  it('normaliza una ficha con nombre nulo y conserva un mundo válido', () => {
    const entries = new Map<string, string>([
      [
        UI_PREFERENCE_KEYS.recentLocation,
        JSON.stringify({
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: null,
        }),
      ],
    ]);

    expect(readStoredPreferences(entries).recentLocation).toEqual({
      kind: 'entity',
      worldId: WORLD_ID,
      entityId: ENTITY_ID,
      entityName: null,
    });
  });
});
