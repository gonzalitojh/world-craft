/**
 * Memoria de sesión de la vista de ficha.
 *
 * Guarda el estado del panel de propiedades y de las secciones plegables
 * mientras la aplicación sigue abierta. Es un módulo puro: no importa React, no
 * usa `localStorage` ni IPC y se pierde al recargar. #132 será quien persista
 * estas preferencias en `app_settings`; este módulo es la sutura.
 */

/** Identificadores estables de las secciones plegables de la ficha. */
export const ENTITY_SECTION_IDS = [
  'description',
  'attributes',
  'relations',
  'resources',
] as const;

export type EntitySectionId = (typeof ENTITY_SECTION_IDS)[number];

/** Ancho mínimo, máximo y por defecto del panel de propiedades, en píxeles. */
export const PROPERTIES_WIDTH_MIN = 280;
export const PROPERTIES_WIDTH_MAX = 360;
export const PROPERTIES_WIDTH_DEFAULT = 320;

/** Estado recordado durante la sesión para la vista de una ficha. */
export interface EntityViewMemory {
  readonly propertiesOpen: boolean;
  readonly propertiesWidth: number;
  readonly sections: Readonly<Record<EntitySectionId, boolean>>;
}

/** Cambios parciales admitidos por `updateEntityViewMemory`. */
export interface EntityViewMemoryPatch {
  readonly propertiesOpen?: boolean;
  readonly propertiesWidth?: number;
  readonly sections?: Partial<Record<EntitySectionId, boolean>>;
}

function defaultSections(): Readonly<Record<EntitySectionId, boolean>> {
  return {
    description: true,
    attributes: false,
    relations: false,
    resources: false,
  };
}

const DEFAULT_ENTITY_VIEW_MEMORY: EntityViewMemory = {
  propertiesOpen: true,
  propertiesWidth: PROPERTIES_WIDTH_DEFAULT,
  sections: defaultSections(),
};

let memory: EntityViewMemory = DEFAULT_ENTITY_VIEW_MEMORY;

/**
 * Normaliza un ancho de panel.
 *
 * Redondea al píxel entero y limita a 280–360. Un valor no finito vuelve al
 * ancho por defecto en vez de propagar `NaN` al estilo.
 */
export function clampPropertiesWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return PROPERTIES_WIDTH_DEFAULT;
  }

  return Math.min(
    PROPERTIES_WIDTH_MAX,
    Math.max(PROPERTIES_WIDTH_MIN, Math.round(value)),
  );
}

/** Devuelve una copia del estado actual, sin exponer la referencia interna. */
export function readEntityViewMemory(): EntityViewMemory {
  return {
    propertiesOpen: memory.propertiesOpen,
    propertiesWidth: memory.propertiesWidth,
    sections: { ...memory.sections },
  };
}

/** Actualiza solo las claves indicadas; el resto se conserva. */
export function updateEntityViewMemory(patch: EntityViewMemoryPatch): void {
  const sections = { ...memory.sections };

  for (const section of ENTITY_SECTION_IDS) {
    const value = patch.sections?.[section];

    if (value !== undefined) {
      sections[section] = value;
    }
  }

  memory = {
    propertiesOpen: patch.propertiesOpen ?? memory.propertiesOpen,
    propertiesWidth:
      patch.propertiesWidth === undefined
        ? memory.propertiesWidth
        : clampPropertiesWidth(patch.propertiesWidth),
    sections,
  };
}

/** Restaura los valores por defecto. Solo lo usan las pruebas. */
export function resetEntityViewMemory(): void {
  memory = DEFAULT_ENTITY_VIEW_MEMORY;
}
