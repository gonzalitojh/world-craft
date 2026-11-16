import { describe, expect, it } from 'vitest';

import { sslFor } from '@/lib/db/ssl';

describe('sslFor', () => {
  it('exige TLS en un host remoto', () => {
    expect(
      sslFor(
        'postgresql://postgres.ref:secret@db.ref.supabase.co:5432/postgres',
      ),
    ).toBe('require');
  });

  it('exige TLS aunque la cadena no declare sslmode', () => {
    expect(
      sslFor('postgresql://user:secret@db.example.invalid:5432/postgres'),
    ).toBe('require');
  });

  it('lo desactiva en localhost y 127.0.0.1', () => {
    expect(sslFor('postgresql://user:secret@localhost:5432/postgres')).toBe(
      false,
    );
    expect(sslFor('postgresql://user:secret@127.0.0.1:5432/postgres')).toBe(
      false,
    );
  });

  it('respeta sslmode=disable explícito', () => {
    expect(
      sslFor(
        'postgresql://user:secret@db.example.invalid:5432/postgres?sslmode=disable',
      ),
    ).toBe(false);
  });
});
