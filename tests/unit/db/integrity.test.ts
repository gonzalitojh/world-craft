import { describe, expect, it } from 'vitest';

import type { SqliteDatabase } from '@/main/db/connection';
import { DatabaseError } from '@/main/db/errors';
import { checkForeignKeys } from '@/main/db/integrity';

/**
 * Doble mínimo de la conexión: `checkForeignKeys` solo consume el resultado de
 * `PRAGMA foreign_key_check`. Las pruebas de integración cubren la base real;
 * aquí se aísla la normalización y el rechazo de filas malformadas.
 */
function databaseReturning(rows: unknown): SqliteDatabase {
  return { pragma: () => rows } as unknown as SqliteDatabase;
}

describe('checkForeignKeys', () => {
  it('devuelve una lista vacía cuando no hay violaciones', () => {
    expect(checkForeignKeys(databaseReturning([]))).toEqual([]);
  });

  it('normaliza una violación a las claves del contrato', () => {
    const violations = checkForeignKeys(
      databaseReturning([
        { table: 'assets', rowid: 7, parent: 'worlds', fkid: 0 },
      ]),
    );

    expect(violations).toEqual([
      { table: 'assets', rowId: 7, parent: 'worlds', foreignKeyId: 0 },
    ]);
  });

  it('rechaza una fila malformada sin filtrar detalles', () => {
    const database = databaseReturning([
      {
        table: 'tabla-sensible',
        rowid: '7',
        parent: 'parent-sensible',
        fkid: 0,
      },
    ]);

    let caught: unknown;

    try {
      checkForeignKeys(database);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DatabaseError);

    const failure = caught as DatabaseError;

    expect(failure.code).toBe('DB_INTEGRITY_FAILED');
    expect(failure.message).toBe(
      'La comprobación de integridad de la base falló.',
    );
    expect(failure.message).not.toContain('tabla-sensible');
    expect(failure.message).not.toContain('parent-sensible');
    expect(failure.cause).toBeUndefined();
  });
});
