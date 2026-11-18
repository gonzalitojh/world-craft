import { describe, expect, it } from 'vitest';

import {
  createWorldCraftApi,
  WORLD_CRAFT_API_KEY,
} from '@/shared/contracts/world-craft-api';

describe('world-craft-api', () => {
  it('expone únicamente la identidad de la aplicación', () => {
    const api = createWorldCraftApi();

    expect(WORLD_CRAFT_API_KEY).toBe('worldCraft');
    expect(Object.keys(api)).toEqual(['appInfo']);
    expect(api.appInfo).toEqual({ name: 'World Craft', version: '0.0.0' });
  });

  it('congela la API y su información para que el renderer no las altere', () => {
    const api = createWorldCraftApi();

    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.isFrozen(api.appInfo)).toBe(true);

    expect(() => {
      (api.appInfo as { version: string }).version = '9.9.9';
    }).toThrow(TypeError);
  });
});
