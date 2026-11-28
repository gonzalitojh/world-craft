import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  DEVELOPMENT_CONTENT_SECURITY_POLICY,
  PRODUCTION_CONTENT_SECURITY_POLICY,
  REQUIRED_PRODUCTION_DIRECTIVES,
} from '@/main/security/content-security-policy';

describe('content-security-policy', () => {
  it('prohíbe por defecto y solo permite recursos locales en producción', () => {
    for (const directive of REQUIRED_PRODUCTION_DIRECTIVES) {
      expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain(directive);
    }

    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toMatch(/https?:\/\//);
  });

  it('permite el worker local y las previsualizaciones blob sin abrir la red', () => {
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain("worker-src 'self'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain(
      'worker-src blob:',
    );
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain(
      "img-src 'self' data: blob: wc-asset:",
    );
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain('worker-src *');
  });

  it('relaja la CSP de desarrollo solo para loopback y HMR', () => {
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).toContain("'unsafe-inline'");
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).toContain('http://localhost:*');
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).toContain('ws://localhost:*');
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).toContain("worker-src 'self'");
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).toContain(
      "img-src 'self' data: blob: wc-asset:",
    );
    expect(DEVELOPMENT_CONTENT_SECURITY_POLICY).not.toMatch(
      /https?:\/\/(?!localhost|127\.0\.0\.1)/,
    );
  });

  it('elige la política según el modo de ejecución', () => {
    expect(buildContentSecurityPolicy({ development: false })).toBe(
      PRODUCTION_CONTENT_SECURITY_POLICY,
    );
    expect(buildContentSecurityPolicy({ development: true })).toBe(
      DEVELOPMENT_CONTENT_SECURITY_POLICY,
    );
  });
});
