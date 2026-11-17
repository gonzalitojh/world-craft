import { describe, expect, it } from 'vitest';

import { DatabaseEnvError } from '@/lib/db/env';
import {
  buildHealthPayload,
  classifyDatabaseFailure,
  healthStatusCode,
  probeDatabase,
} from '@/lib/health';

/** Error con la forma mínima que devuelve el driver de PostgreSQL. */
function driverError(code: string, message = 'fallo simulado'): Error {
  const error = new Error(message);
  return Object.assign(error, { code });
}

describe('buildHealthPayload', () => {
  it('devuelve ok cuando la base está disponible', () => {
    const now = new Date('2026-11-17T10:00:00.000Z');

    expect(buildHealthPayload('available', now)).toEqual({
      status: 'ok',
      database: 'available',
      timestamp: '2026-11-17T10:00:00.000Z',
    });
  });

  it.each(['paused', 'error'] as const)(
    'devuelve degradado cuando la base está en %s',
    (database) => {
      const payload = buildHealthPayload(
        database,
        new Date('2026-11-17T10:00:00.000Z'),
      );

      expect(payload.status).toBe('degraded');
      expect(payload.database).toBe(database);
    },
  );

  it('usa la hora actual por defecto', () => {
    const before = Date.now();
    const payload = buildHealthPayload('available');
    const after = Date.now();

    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);

    const timestamp = Date.parse(payload.timestamp);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('solo expone estado, base de datos y marca de tiempo', () => {
    expect(Object.keys(buildHealthPayload('available')).sort()).toEqual([
      'database',
      'status',
      'timestamp',
    ]);
  });
});

describe('classifyDatabaseFailure', () => {
  it('clasifica un fallo de DNS como posible pausa', () => {
    expect(classifyDatabaseFailure(driverError('ENOTFOUND'))).toBe('paused');
  });

  it('clasifica un timeout de conexión como posible pausa', () => {
    expect(classifyDatabaseFailure(driverError('ETIMEDOUT'))).toBe('paused');
  });

  it('recorre la cadena de causas del error', () => {
    const error = new Error('fallo de conexión', {
      cause: driverError('ECONNREFUSED'),
    });

    expect(classifyDatabaseFailure(error)).toBe('paused');
  });

  it('reconoce el mensaje de tenant ausente de Supabase', () => {
    expect(
      classifyDatabaseFailure(new Error('FATAL: Tenant or user not found')),
    ).toBe('paused');
  });

  it('considera un error de configuración como error, no como pausa', () => {
    expect(
      classifyDatabaseFailure(new DatabaseEnvError('DATABASE_URL', 'Falta')),
    ).toBe('error');
  });

  it('considera un fallo de credenciales como error', () => {
    expect(classifyDatabaseFailure(driverError('28P01'))).toBe('error');
  });

  it('no filtra el mensaje del error en el estado', () => {
    const status = classifyDatabaseFailure(
      new Error('password authentication failed for user "postgres"'),
    );

    expect(status).toBe('error');
  });
});

describe('probeDatabase', () => {
  it('devuelve disponible si la consulta termina', async () => {
    await expect(probeDatabase(async () => undefined)).resolves.toBe(
      'available',
    );
  });

  it('devuelve pausa si la conexión no se puede abrir', async () => {
    await expect(
      probeDatabase(async () => {
        throw driverError('ENOTFOUND');
      }),
    ).resolves.toBe('paused');
  });

  it('devuelve error si la consulta falla con la conexión abierta', async () => {
    await expect(
      probeDatabase(async () => {
        throw driverError('42501');
      }),
    ).resolves.toBe('error');
  });

  it('corta una consulta que supera el tiempo máximo', async () => {
    await expect(
      probeDatabase(() => new Promise(() => undefined), 10),
    ).resolves.toBe('paused');
  });
});

describe('healthStatusCode', () => {
  it('devuelve 200 solo cuando la base está disponible', () => {
    expect(healthStatusCode('available')).toBe(200);
    expect(healthStatusCode('paused')).toBe(503);
    expect(healthStatusCode('error')).toBe(503);
  });
});
