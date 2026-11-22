import { beforeEach, describe, expect, it } from 'vitest';

import {
  PROPERTIES_WIDTH_DEFAULT,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  clampPropertiesWidth,
  readEntityViewMemory,
  resetEntityViewMemory,
  updateEntityViewMemory,
} from '../../src/renderer/lib/entity-view-memory';

describe('memoria de sesión de la ficha', () => {
  beforeEach(() => {
    resetEntityViewMemory();
  });

  it('parte del panel abierto a 320 px y solo Descripción desplegada', () => {
    const memory = readEntityViewMemory();

    expect(memory.propertiesOpen).toBe(true);
    expect(memory.propertiesWidth).toBe(320);
    expect(memory.sections).toEqual({
      description: true,
      attributes: false,
      relations: false,
      resources: false,
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

  it('actualiza solo las claves indicadas y conserva el resto', () => {
    updateEntityViewMemory({
      propertiesOpen: false,
      propertiesWidth: 999,
      sections: { attributes: true },
    });

    const memory = readEntityViewMemory();

    expect(memory.propertiesOpen).toBe(false);
    expect(memory.propertiesWidth).toBe(PROPERTIES_WIDTH_MAX);
    expect(memory.sections).toEqual({
      description: true,
      attributes: true,
      relations: false,
      resources: false,
    });

    updateEntityViewMemory({ sections: { description: false } });

    expect(readEntityViewMemory().sections.description).toBe(false);
    expect(readEntityViewMemory().sections.attributes).toBe(true);
    expect(readEntityViewMemory().propertiesWidth).toBe(PROPERTIES_WIDTH_MAX);
  });

  it('devuelve copias y no muta las instantáneas anteriores', () => {
    const before = readEntityViewMemory();

    updateEntityViewMemory({
      propertiesWidth: 340,
      sections: { relations: true },
    });

    expect(before.propertiesWidth).toBe(320);
    expect(before.sections.relations).toBe(false);
    expect(readEntityViewMemory()).not.toBe(before);
    expect(readEntityViewMemory().sections).not.toBe(before.sections);
  });

  it('vuelve a los valores por defecto con reset', () => {
    updateEntityViewMemory({
      propertiesOpen: false,
      propertiesWidth: 280,
      sections: {
        description: false,
        attributes: true,
        relations: true,
        resources: true,
      },
    });

    resetEntityViewMemory();

    expect(readEntityViewMemory()).toEqual({
      propertiesOpen: true,
      propertiesWidth: PROPERTIES_WIDTH_DEFAULT,
      sections: {
        description: true,
        attributes: false,
        relations: false,
        resources: false,
      },
    });
  });
});
