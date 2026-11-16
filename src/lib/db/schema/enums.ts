/**
 * Enums de PostgreSQL del modelo de datos.
 *
 * Los valores van en inglés (regla 11 de `AGENTS.md`); las etiquetas visibles
 * viven en los mensajes de la interfaz y llegan con M1. Los valores de estado
 * son **provisionales**: las issues de producto pueden añadir valores con una
 * migración nueva, nunca editando una ya aplicada.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

/** Rol de un usuario dentro de un mundo. `owner` se gestiona con transferencia. */
export const worldRoleEnum = pgEnum('world_role', [
  'owner',
  'editor',
  'viewer',
]);

/** Rol ofrecido en una invitación: el `owner` no se invita, se transfiere. */
export const invitationRoleEnum = pgEnum('invitation_role', [
  'editor',
  'viewer',
]);

/** Preferencia de tema del perfil (ADR 0010). */
export const themePreferenceEnum = pgEnum('theme_preference', [
  'light',
  'dark',
  'system',
]);

/** Estado de un mundo (provisional). */
export const worldStatusEnum = pgEnum('world_status', [
  'draft',
  'active',
  'archived',
]);

/** Estado editorial de fichas, manuscritos, capítulos y escenas (provisional). */
export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'in_progress',
  'done',
  'archived',
]);

/** Tipo de obra de un manuscrito. */
export const manuscriptKindEnum = pgEnum('manuscript_kind', [
  'novel',
  'novella',
  'short',
  'saga',
]);

/** Categoría de una tabla del juego creativo. */
export const gameTableCategoryEnum = pgEnum('game_table_category', [
  'container',
  'subgenre',
  'trigger',
  'trope',
  'custom',
]);
