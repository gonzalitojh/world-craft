import { describe, expect, it } from 'vitest';

import {
  DatabaseEnvError,
  parseDatabaseEnv,
  readDatabaseUrl,
  readDirectUrl,
} from '@/lib/db/env';

const DATABASE_URL =
  'postgresql://postgres.example:secret@db.example.invalid:6543/postgres?sslmode=require';
const DIRECT_URL =
  'postgresql://postgres.example:secret@db.example.invalid:5432/postgres?sslmode=require';

describe('readDatabaseUrl', () => {
  it('devuelve una cadena válida de la aplicación', () => {
    expect(readDatabaseUrl({ DATABASE_URL })).toBe(DATABASE_URL);
  });

  it('acepta también el protocolo postgres://', () => {
    const url = 'postgres://user:secret@db.example.invalid:5432/postgres';
    expect(readDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('falla con un error claro si falta DATABASE_URL', () => {
    expect(() => readDatabaseUrl({})).toThrow(DatabaseEnvError);
    expect(() => readDatabaseUrl({})).toThrow(/Falta DATABASE_URL/);
  });

  it('trata la cadena vacía como ausente', () => {
    expect(() => readDatabaseUrl({ DATABASE_URL: '   ' })).toThrow(
      /Falta DATABASE_URL/,
    );
  });

  it('rechaza un protocolo que no sea PostgreSQL', () => {
    expect(() =>
      readDatabaseUrl({ DATABASE_URL: 'mysql://user:secret@host/db' }),
    ).toThrow(/no es válida/);
  });

  it('rechaza una cadena con espacios', () => {
    expect(() =>
      readDatabaseUrl({ DATABASE_URL: 'postgresql://host/db con espacio' }),
    ).toThrow(/no es válida/);
  });

  it('expone la variable implicada en el error', () => {
    try {
      readDatabaseUrl({});
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseEnvError);
      expect((error as DatabaseEnvError).variable).toBe('DATABASE_URL');
    }
  });
});

describe('readDirectUrl', () => {
  it('devuelve la cadena del tooling', () => {
    expect(readDirectUrl({ DIRECT_URL })).toBe(DIRECT_URL);
  });

  it('falla con un error claro si falta DIRECT_URL', () => {
    expect(() => readDirectUrl({})).toThrow(DatabaseEnvError);
    expect(() => readDirectUrl({})).toThrow(/Falta DIRECT_URL/);
  });

  it('no confunde DATABASE_URL con DIRECT_URL', () => {
    expect(() => readDirectUrl({ DATABASE_URL })).toThrow(/Falta DIRECT_URL/);
  });
});

describe('parseDatabaseEnv', () => {
  it('no lanza si faltan las dos cadenas: la obligatoriedad es perezosa', () => {
    expect(parseDatabaseEnv({})).toEqual({
      DATABASE_URL: undefined,
      DIRECT_URL: undefined,
    });
  });

  it('valida las dos cadenas cuando existen', () => {
    expect(parseDatabaseEnv({ DATABASE_URL, DIRECT_URL })).toEqual({
      DATABASE_URL,
      DIRECT_URL,
    });
  });

  it('rechaza una cadena inválida al parsear', () => {
    expect(() => parseDatabaseEnv({ DATABASE_URL: 'no-es-una-url' })).toThrow(
      /postgres/,
    );
  });
});
