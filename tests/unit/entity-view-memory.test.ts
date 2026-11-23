import { describe, expect, it } from 'vitest';

import {
  PROPERTIES_WIDTH_DEFAULT,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  clampPropertiesWidth,
} from '../../src/renderer/lib/entity-view-memory';
import {
  DEFAULT_UI_PREFERENCES,
  createDefaultUiPreferences,
} from '../../src/shared/contracts/preferences';

describe('límites compartidos de la vista de ficha', () => {
  it('parte del panel abierto a 320 px y solo Descripción desplegada', () => {
    expect(createDefaultUiPreferences().entityView).toEqual({
      propertiesOpen: true,
      propertiesWidth: 320,
      sections: {
        description: true,
        attributes: false,
        relations: false,
        resources: false,
      },
    });
  });

  it('redondea y limita el ancho al intervalo 280–360', () => {
    expect(clampPropertiesWidth(279)).toBe(PROPERTIES_WIDTH_MIN);
    expect(clampPropertiesWidth(361)).toBe(PROPERTIES_WIDTH_MAX);
    expect(clampPropertiesWidth(320.4)).toBe(320);
    expect(clampPropertiesWidth(319.6)).toBe(320);
    expect(clampPropertiesWidth(Number.NaN)).toBe(PROPERTIES_WIDTH_DEFAULT);
    expect(clampPropertiesWidth(Number.POSITIVE_INFINITY)).toBe(
      PROPERTIES_WIDTH_DEFAULT,
    );
  });

  it('congela los valores por defecto canónicos', () => {
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES.entityView)).toBe(true);
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES.entityView.sections)).toBe(
      true,
    );
  });
});
