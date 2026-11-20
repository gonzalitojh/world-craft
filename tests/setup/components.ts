/**
 * Setup de las pruebas de componentes.
 *
 * Extiende `expect` con los matchers de jest-dom (`toBeInTheDocument`,
 * `toBeDisabled`...) y limpia el DOM entre pruebas. Testing Library registra su
 * propio `cleanup` automático cuando existen los globales de Vitest; aquí los
 * globales están desactivados, así que se llama de forma explícita.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
