import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn', () => {
  it('une clases sueltas', () => {
    expect(cn('inline-flex', 'rounded-md')).toBe('inline-flex rounded-md');
  });

  it('resuelve conflictos con la última clase', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('bg-accent', 'bg-danger')).toBe('bg-danger');
  });

  it('ignora valores falsos', () => {
    expect(cn('text-foreground', false, undefined, null, '')).toBe(
      'text-foreground',
    );
  });

  it('acepta condicionales con la clase de un componente', () => {
    const isActive = true;

    expect(cn('bg-accent', isActive && 'bg-danger')).toBe('bg-danger');
  });
});
