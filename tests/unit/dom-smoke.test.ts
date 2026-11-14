// @vitest-environment jsdom
import { getByRole } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

/**
 * Test de humo del tooling con DOM: comprueba que jsdom y Testing Library
 * funcionan juntos. No prueba código de producto porque aún no existe UI
 * (llega con M0-06, issue #7).
 */
describe('Testing Library + jsdom', () => {
  it('encuentra un heading en el DOM', () => {
    document.body.innerHTML = '<main><h1>World Craft</h1></main>';

    const heading = getByRole(document.body, 'heading', { level: 1 });

    expect(heading.textContent).toBe('World Craft');
  });
});
