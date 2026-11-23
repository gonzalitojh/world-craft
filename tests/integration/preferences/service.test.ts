import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseClient } from '../../../src/main/db/client';
import type { DataPaths } from '../../../src/main/db/paths';
import { initializeDatabase } from '../../../src/main/db/startup';
import {
  createPreferencesRepository,
  type PreferencesRepository,
} from '../../../src/main/preferences/repository';
import { PreferencesInputError } from '../../../src/main/preferences/errors';
import { UI_PREFERENCE_KEYS } from '../../../src/main/preferences/keys';
import {
  createPreferencesService,
  createUnavailablePreferencesService,
  type PreferencesService,
} from '../../../src/main/preferences/service';
import {
  createDefaultUiPreferences,
  type UiPreferencesPatch,
} from '../../../src/shared/contracts/preferences';
import {
  createTestDatabase,
  type TempDatabase,
} from '../helpers/temp-db';

const NOW = 1_760_000_000_000;
const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const TARGET_ID = '01900000-0000-7000-8000-000000000003';
const ASSET_ID = '01900000-0000-7000-8000-000000000004';
const RELATION_TYPE_ID = '01900000-0000-7000-8000-000000000005';
const RELATION_ID = '01900000-0000-7000-8000-000000000006';

interface Context {
  readonly temp: TempDatabase;
  readonly client: DatabaseClient;
  readonly paths: DataPaths;
  readonly repository: PreferencesRepository;
  readonly service: PreferencesService;
  readonly onThemeChanged: ReturnType<typeof vi.fn>;
  setClock(value: number): void;
}

let context: Context | null = null;

afterEach(async () => {
  if (context !== null) {
    const { client, temp } = context;
    context = null;
    client.sqlite.close();
    await temp.cleanup();
  }
});

async function createContext(): Promise<Context> {
  const temp = await createTestDatabase();
  const startup = await initializeDatabase({
    userDataDir: temp.userDataDir,
    migrationsDir: temp.migrationsDir,
    now: () => NOW,
  });

  if (startup.status !== 'ready') {
    throw new Error(`La base de prueba no arrancó: ${startup.code}`);
  }

  const repository = createPreferencesRepository(
    startup.client.orm,
    startup.client.sqlite,
  );
  const onThemeChanged = vi.fn();
  let clock = NOW;
  const service = createPreferencesService({
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    repository,
    now: () => clock,
    onThemeChanged,
  });

  context = {
    temp,
    client: startup.client,
    paths: startup.paths,
    repository,
    service,
    onThemeChanged,
    setClock: (value) => {
      clock = value;
    },
  };

  return context;
}

function count(database: DatabaseClient, table: string): number {
  const row = database.sqlite
    .prepare(`select count(*) as total from ${table}`)
    .get() as { readonly total: number };

  return row.total;
}

function seedDomain(database: DatabaseClient): void {
  const type = database.sqlite
    .prepare('select id from entity_types where world_id is null limit 1')
    .get() as { readonly id: string };

  database.sqlite
    .prepare(
      `insert into worlds (id, name, slug, genres, status, language, settings, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      WORLD_ID,
      'Las Mareas Grises',
      'las-mareas-grises',
      '[]',
      'active',
      'es',
      '{}',
      NOW,
      NOW,
    );
  database.sqlite
    .prepare(
      `insert into assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
       values (?, ?, 'image', ?, 'image/png', 12, ?, ?)`,
    )
    .run(ASSET_ID, WORLD_ID, `${WORLD_ID}/a.png`, 'a'.repeat(64), NOW);
  database.sqlite
    .prepare(
      `insert into entities (id, world_id, type_id, name, slug, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ENTITY_ID, WORLD_ID, type.id, 'Mara Viento', 'mara-viento', NOW, NOW);
  database.sqlite
    .prepare(
      `insert into entities (id, world_id, type_id, name, slug, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(TARGET_ID, WORLD_ID, type.id, 'Puerto Sal', 'puerto-sal', NOW, NOW);
  database.sqlite
    .prepare(
      `insert into relation_types (id, world_id, key, name, inverse_name, color, is_system, created_at, updated_at)
       values (?, null, ?, ?, ?, 'prussian', 1, ?, ?)`,
    )
    .run(
      RELATION_TYPE_ID,
      'prueba-preferencias',
      'Prueba',
      'Prueba inversa',
      NOW,
      NOW,
    );
  database.sqlite
    .prepare(
      `insert into relations (id, world_id, source_id, target_id, type_id, strength, metadata, created_at, updated_at)
       values (?, ?, ?, ?, ?, 1, '{}', ?, ?)`,
    )
    .run(RELATION_ID, WORLD_ID, ENTITY_ID, TARGET_ID, RELATION_TYPE_ID, NOW, NOW);
  database.sqlite
    .prepare(
      `insert into app_settings (key, value, updated_at) values ('locale', '"es"', ?)`,
    )
    .run(NOW);
}

describe('servicio de preferencias', () => {
  it('lee defaults sin crear filas', async () => {
    const ctx = await createContext();

    expect(ctx.service.get()).toEqual(createDefaultUiPreferences());
    expect(ctx.repository.readAll().size).toBe(0);
  });

  it('escribe solo las claves cambiadas y usa el reloj inyectado', async () => {
    const ctx = await createContext();

    ctx.setClock(1234);
    ctx.service.update({ theme: 'dark' });

    const rows = ctx.repository.readAll();

    expect(JSON.parse(rows.get(UI_PREFERENCE_KEYS.theme) ?? '')).toBe('dark');
    expect(rows.has(UI_PREFERENCE_KEYS.theme)).toBe(true);
    expect(rows.has(UI_PREFERENCE_KEYS.railCollapsed)).toBe(false);
    expect(rows.has(UI_PREFERENCE_KEYS.entityView)).toBe(false);
    expect(rows.has(UI_PREFERENCE_KEYS.lastView)).toBe(false);

    const timestamps = ctx.client.sqlite
      .prepare('select updated_at from app_settings where key = ?')
      .all(UI_PREFERENCE_KEYS.theme) as readonly {
      readonly updated_at: number;
    }[];

    expect(timestamps).toEqual([{ updated_at: 1234 }]);
  });

  it('fusiona la vista de ficha y conserva el resto', async () => {
    const ctx = await createContext();

    ctx.service.update({
      entityView: {
        propertiesWidth: 360,
        sections: { relations: true, description: false },
      },
    });

    expect(ctx.service.get().entityView).toEqual({
      propertiesOpen: true,
      propertiesWidth: 360,
      sections: {
        description: false,
        attributes: false,
        relations: true,
        resources: false,
      },
    });
  });

  it('borra la fila cuando recentLocation es null', async () => {
    const ctx = await createContext();

    ctx.service.update({
      recentLocation: { kind: 'world', worldId: WORLD_ID },
    });
    expect(
      ctx.repository.readAll().has(UI_PREFERENCE_KEYS.recentLocation),
    ).toBe(true);

    ctx.service.update({ recentLocation: null });
    expect(
      ctx.repository.readAll().has(UI_PREFERENCE_KEYS.recentLocation),
    ).toBe(false);
    expect(ctx.service.get().recentLocation).toBeNull();
  });

  it('no reescribe ni cambia updated_at al repetir el mismo valor', async () => {
    const ctx = await createContext();

    ctx.setClock(1000);
    ctx.service.update({ theme: 'dark' });
    const first = ctx.client.sqlite
      .prepare('select updated_at from app_settings where key = ?')
      .get(UI_PREFERENCE_KEYS.theme) as { readonly updated_at: number };

    ctx.setClock(2000);
    ctx.service.update({ theme: 'dark' });
    const second = ctx.client.sqlite
      .prepare('select updated_at from app_settings where key = ?')
      .get(UI_PREFERENCE_KEYS.theme) as { readonly updated_at: number };

    expect(first.updated_at).toBe(1000);
    expect(second.updated_at).toBe(1000);
  });

  it('tolera filas inválidas sin reescribirlas', async () => {
    const ctx = await createContext();
    const insert = ctx.client.sqlite.prepare(
      `insert into app_settings (key, value, updated_at) values (?, ?, ?)`,
    );

    insert.run(UI_PREFERENCE_KEYS.theme, '"sepia"', NOW);
    insert.run(UI_PREFERENCE_KEYS.railCollapsed, '"yes"', NOW);
    insert.run(
      UI_PREFERENCE_KEYS.entityView,
      JSON.stringify({ propertiesWidth: 999, sections: { relations: true } }),
      NOW,
    );
    insert.run(UI_PREFERENCE_KEYS.recentLocation, '{"kind":"entity"}', NOW);

    const preferences = ctx.service.get();

    expect(preferences.theme).toBe('light');
    expect(preferences.railCollapsed).toBe(false);
    expect(preferences.entityView.propertiesWidth).toBe(320);
    expect(preferences.entityView.sections.relations).toBe(true);
    expect(preferences.recentLocation).toBeNull();
    expect(ctx.repository.readAll().get(UI_PREFERENCE_KEYS.theme)).toBe(
      '"sepia"',
    );
  });

  it('reset borra solo ui.* y preserva dominio, copias y claves ajenas', async () => {
    const ctx = await createContext();

    seedDomain(ctx.client);
    ctx.service.update({
      theme: 'dark',
      railCollapsed: true,
      recentLocation: { kind: 'world', worldId: WORLD_ID },
    });

    const backupFile = join(ctx.paths.dailyBackupsDir, 'copia-test.txt');
    writeFileSync(backupFile, 'copia verificable', 'utf8');

    const before = {
      worlds: count(ctx.client, 'worlds'),
      entities: count(ctx.client, 'entities'),
      assets: count(ctx.client, 'assets'),
      relations: count(ctx.client, 'relations'),
      migrations: count(ctx.client, 'schema_migrations'),
    };

    const reset = ctx.service.reset();

    expect(reset).toEqual(createDefaultUiPreferences());
    expect(ctx.repository.readAll().size).toBe(0);
    expect(
      ctx.client.sqlite
        .prepare(
          "select value from app_settings where key = 'locale'",
        )
        .get(),
    ).toEqual({ value: '"es"' });
    expect({
      worlds: count(ctx.client, 'worlds'),
      entities: count(ctx.client, 'entities'),
      assets: count(ctx.client, 'assets'),
      relations: count(ctx.client, 'relations'),
      migrations: count(ctx.client, 'schema_migrations'),
    }).toEqual(before);
    expect(existsSync(backupFile)).toBe(true);
    expect(readFileSync(backupFile, 'utf8')).toBe('copia verificable');
  });

  it('revierte toda la transacción si una escritura falla', async () => {
    const ctx = await createContext();
    const failing: PreferencesRepository = {
      readAll: () => ctx.repository.readAll(),
      upsert: (key, value, at) => {
        if (key === UI_PREFERENCE_KEYS.lastView) {
          throw new Error('fallo forzado');
        }

        ctx.repository.upsert(key, value, at);
      },
      deleteKeys: (keys) => ctx.repository.deleteKeys(keys),
      deleteUiKeys: () => ctx.repository.deleteUiKeys(),
      transaction: (operation) => ctx.repository.transaction(operation),
    };
    const service = createPreferencesService({
      database: ctx.client.orm,
      sqlite: ctx.client.sqlite,
      repository: failing,
      now: () => NOW,
    });

    expect(() =>
      service.update({ theme: 'dark', lastView: 'world' }),
    ).toThrow('fallo forzado');
    expect(ctx.repository.readAll().size).toBe(0);
  });

  it('aplica el tema al cromo aunque falle la escritura (C2)', async () => {
    const ctx = await createContext();
    const onThemeChanged = vi.fn();
    const failing: PreferencesRepository = {
      readAll: () => ctx.repository.readAll(),
      upsert: (key) => {
        if (key === UI_PREFERENCE_KEYS.theme) {
          throw new Error('base bloqueada');
        }

        ctx.repository.upsert(key, '{}', NOW);
      },
      deleteKeys: (keys) => ctx.repository.deleteKeys(keys),
      deleteUiKeys: () => ctx.repository.deleteUiKeys(),
      transaction: (operation) => ctx.repository.transaction(operation),
    };
    const service = createPreferencesService({
      database: ctx.client.orm,
      sqlite: ctx.client.sqlite,
      repository: failing,
      now: () => NOW,
      onThemeChanged,
    });

    expect(() => service.update({ theme: 'dark' })).toThrow('base bloqueada');
    expect(onThemeChanged).toHaveBeenCalledWith('dark');
    expect(ctx.repository.readAll().size).toBe(0);
  });

  it('invoca el callback de tema solo tras un cambio confirmado', async () => {
    const ctx = await createContext();

    ctx.service.update({ theme: 'dark' });
    expect(ctx.onThemeChanged.mock.calls).toEqual([['dark']]);

    ctx.service.update({ theme: 'dark' });
    ctx.service.update({ railCollapsed: true });
    expect(ctx.onThemeChanged).toHaveBeenCalledTimes(1);

    ctx.service.reset();
    expect(ctx.onThemeChanged.mock.calls).toEqual([['dark'], ['light']]);
  });

  it('en modo seguro mantiene el tema de sesión y lo repinta al resetear', () => {
    const onThemeChanged = vi.fn();
    const service = createUnavailablePreferencesService({ onThemeChanged });

    expect(service.get()).toEqual(createDefaultUiPreferences());

    // Un parche inválido no repinta y se rechaza como entrada, no como error
    // genérico de disponibilidad.
    expect(() =>
      service.update({ theme: 'sepia' } as unknown as UiPreferencesPatch),
    ).toThrow(PreferencesInputError);
    expect(onThemeChanged).not.toHaveBeenCalled();

    expect(() => service.update({ theme: 'dark' })).toThrow();
    expect(onThemeChanged).toHaveBeenLastCalledWith('dark');

    // Reset desde el tema de sesión Oscuro: repinta Claro aunque falle.
    expect(() => service.reset()).toThrow();
    expect(onThemeChanged).toHaveBeenLastCalledWith('light');
    expect(onThemeChanged.mock.calls).toEqual([['dark'], ['light']]);

    // Ya en Claro, un update sin cambio y otro reset no vuelven a avisar.
    expect(() => service.update({ theme: 'light' })).toThrow();
    expect(() => service.reset()).toThrow();
    expect(onThemeChanged).toHaveBeenCalledTimes(2);
  });

  it('trata el prefijo ui. como sensible a mayúsculas en lectura y reset', async () => {
    const ctx = await createContext();
    const insert = ctx.client.sqlite.prepare(
      'insert into app_settings (key, value, updated_at) values (?, ?, ?)',
    );

    insert.run('ui.theme', '"dark"', NOW);
    insert.run('ui.extra', '{}', NOW);
    insert.run('UI.foo', '"x"', NOW);
    insert.run('uix', '"x"', NOW);
    insert.run('locale', '"es"', NOW);

    expect([...ctx.repository.readAll().keys()].sort()).toEqual([
      'ui.extra',
      'ui.theme',
    ]);

    ctx.service.reset();

    const remaining = ctx.client.sqlite
      .prepare('select key from app_settings order by key')
      .all() as readonly { readonly key: string }[];

    expect(remaining.map((row) => row.key)).toEqual([
      'UI.foo',
      'locale',
      'uix',
    ]);
  });
});
