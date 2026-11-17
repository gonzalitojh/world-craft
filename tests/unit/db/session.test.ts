import { describe, expect, it } from 'vitest';

import { isUserSessionSettingName } from '@/lib/db/session';

describe('nombres de GUC de withUserSession', () => {
  it('acepta solo el espacio app. del servidor', () => {
    for (const name of [
      'app.asset_write',
      'app.asset_bucket',
      'app.x',
      'app.a1_2',
    ]) {
      expect(isUserSessionSettingName(name), name).toBe(true);
    }
  });

  it('rechaza roles, claims y nombres fuera del espacio app.', () => {
    for (const name of [
      'role',
      'request.jwt.claim.sub',
      'request.jwt.claim.role',
      'app.',
      'app.ASSET_WRITE',
      'app.asset-write',
      'app.asset write',
      'App.asset_write',
      `app.${'a'.repeat(56)}`,
    ]) {
      expect(isUserSessionSettingName(name), name).toBe(false);
    }
  });
});
