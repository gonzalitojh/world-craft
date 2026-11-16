/**
 * Esquema Drizzle completo de World Craft (24 tablas).
 *
 * Se importa desde `drizzle.config.ts` y desde los módulos de datos. No lleva
 * `server-only`: Drizzle Kit lo carga en Node y los módulos de dominio lo
 * importan como tipos. La conexión sí está marcada (`client.ts`).
 *
 * El orden de los re-exports importa poco porque las referencias son perezosas,
 * pero se mantiene el de dependencias para que el esquema se lea como un modelo.
 */
export * from './enums';
export * from './profiles';
export * from './worlds';
export * from './taxonomy';
export * from './assets';
export * from './entities';
export * from './maps';
export * from './writing';
export * from './game';
export * from './activity';
