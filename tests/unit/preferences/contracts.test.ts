import { describe, expect, it } from 'vitest';

import {
  DEFAULT_UI_PREFERENCES,
  PROPERTIES_WIDTH_DEFAULT,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  applyEntityViewPatch,
  applyUiPreferencesPatch,
  clampPropertiesWidth,
  createDefaultUiPreferences,
  isPersistedAppView,
  isUiPreferences,
  type UiPreferences,
} from '@/shared/contracts/preferences';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';

function createPreferences(
  overrides: Partial<UiPreferences> = {},
): UiPreferences {
  return { ...createDefaultUiPreferences(), ...overrides };
}

describe('contrato de preferencias', () => {
  it('congela los valores por defecto y devuelve copias mutables', () => {
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES.entityView)).toBe(true);
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES.entityView.sections)).toBe(
      true,
    );

    const copy = createDefaultUiPreferences();

    expect(copy).toEqual(DEFAULT_UI_PREFERENCES);
    expect(copy).not.toBe(DEFAULT_UI_PREFERENCES);
    expect(copy.entityView).not.toBe(DEFAULT_UI_PREFERENCES.entityView);
    expect(copy.entityView.sections).not.toBe(
      DEFAULT_UI_PREFERENCES.entityView.sections,
    );
  });

  it('parte de densidad cómoda y tamaño normal', () => {
    expect(DEFAULT_UI_PREFERENCES.density).toBe('comfortable');
    expect(DEFAULT_UI_PREFERENCES.fontScale).toBe('normal');
    expect(createDefaultUiPreferences()).toMatchObject({
      density: 'comfortable',
      fontScale: 'normal',
    });
  });

  it('normaliza el ancho con redondeo y límites', () => {
    expect(clampPropertiesWidth(279)).toBe(PROPERTIES_WIDTH_MIN);
    expect(clampPropertiesWidth(361)).toBe(PROPERTIES_WIDTH_MAX);
    expect(clampPropertiesWidth(320.4)).toBe(320);
    expect(clampPropertiesWidth(319.6)).toBe(320);
    expect(clampPropertiesWidth(Number.NaN)).toBe(PROPERTIES_WIDTH_DEFAULT);
    expect(clampPropertiesWidth(Number.POSITIVE_INFINITY)).toBe(
      PROPERTIES_WIDTH_DEFAULT,
    );
  });

  it('fusiona parches sin mutar el estado actual', () => {
    const current = createPreferences();
    const snapshot = structuredClone(current);
    const next = applyUiPreferencesPatch(current, {
      theme: 'dark',
      entityView: {
        propertiesOpen: false,
        propertiesWidth: 999,
        sections: { relations: true },
      },
      lastView: 'world',
      recentLocation: { kind: 'world', worldId: WORLD_ID },
    });

    expect(next.theme).toBe('dark');
    expect(next.railCollapsed).toBe(false);
    expect(next.density).toBe('comfortable');
    expect(next.fontScale).toBe('normal');
    expect(next.entityView.propertiesOpen).toBe(false);
    expect(next.entityView.propertiesWidth).toBe(PROPERTIES_WIDTH_MAX);
    expect(next.entityView.sections).toEqual({
      description: true,
      attributes: false,
      relations: true,
      resources: false,
    });
    expect(next.lastView).toBe('world');
    expect(next.recentLocation).toEqual({ kind: 'world', worldId: WORLD_ID });
    expect(current).toEqual(snapshot);
  });

  it('fusiona densidad y tamaño de texto sin tocar el resto', () => {
    const current = createPreferences();
    const next = applyUiPreferencesPatch(current, {
      density: 'compact',
      fontScale: 'large',
    });

    expect(next.density).toBe('compact');
    expect(next.fontScale).toBe('large');
    expect(next.theme).toBe(current.theme);
    expect(next.entityView).toBe(current.entityView);
  });

  it('distingue un destino borrado de una clave ausente', () => {
    const current = createPreferences({
      recentLocation: { kind: 'world', worldId: WORLD_ID },
    });

    expect(
      applyUiPreferencesPatch(current, { railCollapsed: true }).recentLocation,
    ).toEqual({ kind: 'world', worldId: WORLD_ID });
    expect(
      applyUiPreferencesPatch(current, { recentLocation: null }).recentLocation,
    ).toBeNull();
  });

  it('fusiona la vista de ficha sin mutar secciones', () => {
    const current = createDefaultUiPreferences().entityView;
    const next = applyEntityViewPatch(current, {
      sections: { description: false, resources: true },
    });

    expect(next.sections).toEqual({
      description: false,
      attributes: false,
      relations: false,
      resources: true,
    });
    expect(current.sections.description).toBe(true);
  });

  it('reconoce solo vistas persistibles', () => {
    for (const view of [
      'home',
      'worlds',
      'search',
      'world',
      'entities',
      'entity',
      'trash',
      'settings',
    ]) {
      expect(isPersistedAppView(view), view).toBe(true);
    }

    expect(isPersistedAppView('samples')).toBe(false);
    expect(isPersistedAppView('desconocida')).toBe(false);
    expect(isPersistedAppView(null)).toBe(false);
  });

  it('acepta un snapshot completo y rechaza claves extra o valores inválidos', () => {
    const valid = createPreferences();

    expect(isUiPreferences(valid)).toBe(true);
    expect(
      isUiPreferences({
        ...valid,
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: null,
        },
      }),
    ).toBe(true);

    for (const invalid of [
      null,
      [],
      { ...valid, extra: true },
      { ...valid, theme: 'sepia' },
      { ...valid, railCollapsed: 'yes' },
      { ...valid, density: 'amplia' },
      { ...valid, fontScale: 'gigante' },
      { ...valid, lastView: 'samples' },
      {
        ...valid,
        entityView: { ...valid.entityView, propertiesWidth: 999 },
      },
      {
        ...valid,
        entityView: {
          ...valid.entityView,
          sections: { description: true },
        },
      },
      {
        ...valid,
        entityView: {
          ...valid.entityView,
          sections: { ...valid.entityView.sections, extra: true },
        },
      },
      { ...valid, recentLocation: { kind: 'world', worldId: 'world-1' } },
      {
        ...valid,
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
        },
      },
      {
        ...valid,
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: '',
        },
      },
      {
        ...valid,
        recentLocation: {
          kind: 'entity',
          worldId: WORLD_ID,
          entityId: ENTITY_ID,
          entityName: 'x'.repeat(121),
        },
      },
    ]) {
      expect(isUiPreferences(invalid), JSON.stringify(invalid)).toBe(false);
    }
  });
});
