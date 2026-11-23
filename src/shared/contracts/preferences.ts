/**
 * Contrato compartido de las preferencias de interfaz (#132).
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida las escrituras con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos y la fusión de
 * parches sin duplicar reglas.
 *
 * Las preferencias son de aplicación, no de mundo: viven en `app_settings` con
 * el prefijo reservado `ui.` y nunca se exportan con un mundo.
 */
import { ENTITY_NAME_MAX_LENGTH } from './entities';
import { UUID_V7_PATTERN } from '../entities/uuid';

/** Temas admitidos (ADR 0006). No existe el modo «sistema». */
export const THEME_PREFERENCES = ['light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Secciones plegables de la ficha, con identificadores estables. */
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

/** Estado persistido de la vista de ficha (global, no por ficha). */
export interface EntityViewPreferences {
  readonly propertiesOpen: boolean;
  readonly propertiesWidth: number;
  readonly sections: Readonly<Record<EntitySectionId, boolean>>;
}

/** Cambios parciales admitidos sobre la vista de ficha. */
export interface EntityViewPatch {
  readonly propertiesOpen?: boolean | undefined;
  readonly propertiesWidth?: number | undefined;
  readonly sections?:
    | Partial<Record<EntitySectionId, boolean | undefined>>
    | undefined;
}

/**
 * Vistas que se recuerdan como «última vista».
 *
 * `samples` queda fuera a propósito: es un banco interno de desarrollo y nunca
 * se persiste (regla transversal del contrato UI/UX).
 */
export const PERSISTED_APP_VIEWS = [
  'home',
  'worlds',
  'search',
  'world',
  'entities',
  'entity',
] as const;

export type PersistedAppView = (typeof PERSISTED_APP_VIEWS)[number];

/**
 * Último mundo o ficha abierta para la tarjeta «Continuar».
 *
 * Una ficha se guarda con su nombre resuelto cuando se conoce; `null` indica
 * que todavía no se ha cargado y la interfaz muestra el texto de respaldo.
 */
export type RecentLocationPreference =
  | { readonly kind: 'world'; readonly worldId: string }
  | {
      readonly kind: 'entity';
      readonly worldId: string;
      readonly entityId: string;
      readonly entityName: string | null;
    };

/** Snapshot completo de preferencias de interfaz. */
export interface UiPreferences {
  readonly theme: ThemePreference;
  readonly railCollapsed: boolean;
  readonly entityView: EntityViewPreferences;
  readonly lastView: PersistedAppView;
  readonly recentLocation: RecentLocationPreference | null;
}

/** Parche parcial: las claves ausentes conservan su valor actual. */
export interface UiPreferencesPatch {
  readonly theme?: ThemePreference | undefined;
  readonly railCollapsed?: boolean | undefined;
  readonly entityView?: EntityViewPatch | undefined;
  readonly lastView?: PersistedAppView | undefined;
  readonly recentLocation?: RecentLocationPreference | null | undefined;
}

const DEFAULT_SECTIONS: Readonly<Record<EntitySectionId, boolean>> =
  Object.freeze({
    description: true,
    attributes: false,
    relations: false,
    resources: false,
  });

const DEFAULT_ENTITY_VIEW: EntityViewPreferences = Object.freeze({
  propertiesOpen: true,
  propertiesWidth: PROPERTIES_WIDTH_DEFAULT,
  sections: DEFAULT_SECTIONS,
});

/** Valores por defecto canónicos, congelados para evitar mutaciones. */
export const DEFAULT_UI_PREFERENCES: UiPreferences = Object.freeze({
  theme: 'light',
  railCollapsed: false,
  entityView: DEFAULT_ENTITY_VIEW,
  lastView: 'home',
  recentLocation: null,
});

/** Crea una copia mutable de los valores por defecto. */
export function createDefaultUiPreferences(): UiPreferences {
  return {
    theme: 'light',
    railCollapsed: false,
    entityView: {
      propertiesOpen: true,
      propertiesWidth: PROPERTIES_WIDTH_DEFAULT,
      sections: { ...DEFAULT_SECTIONS },
    },
    lastView: 'home',
    recentLocation: null,
  };
}

/**
 * Normaliza el ancho del panel.
 *
 * Redondea al píxel entero y lo limita a 280–360. Un valor no finito vuelve al
 * ancho por defecto en lugar de propagar `NaN` al estilo.
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

/** Fusiona un parche de la vista de ficha sin mutar el estado actual. */
export function applyEntityViewPatch(
  current: EntityViewPreferences,
  patch: EntityViewPatch,
): EntityViewPreferences {
  const sections: Record<EntitySectionId, boolean> = { ...current.sections };

  if (patch.sections !== undefined) {
    for (const id of ENTITY_SECTION_IDS) {
      const value = patch.sections[id];

      if (value !== undefined) {
        sections[id] = value;
      }
    }
  }

  return {
    propertiesOpen: patch.propertiesOpen ?? current.propertiesOpen,
    propertiesWidth:
      patch.propertiesWidth === undefined
        ? current.propertiesWidth
        : clampPropertiesWidth(patch.propertiesWidth),
    sections,
  };
}

/**
 * Fusiona un parche de preferencias sin mutar el estado actual.
 *
 * `recentLocation: null` es un valor explícito (borra el destino) y no se
 * confunde con una clave ausente.
 */
export function applyUiPreferencesPatch(
  current: UiPreferences,
  patch: UiPreferencesPatch,
): UiPreferences {
  return {
    theme: patch.theme ?? current.theme,
    railCollapsed: patch.railCollapsed ?? current.railCollapsed,
    entityView:
      patch.entityView === undefined
        ? current.entityView
        : applyEntityViewPatch(current.entityView, patch.entityView),
    lastView: patch.lastView ?? current.lastView,
    recentLocation:
      patch.recentLocation === undefined
        ? current.recentLocation
        : patch.recentLocation,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);

  return (
    actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/** Indica si un valor es un tema admitido. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/** Indica si un valor es una vista persistible. */
export function isPersistedAppView(
  value: unknown,
): value is PersistedAppView {
  return (
    typeof value === 'string' &&
    (PERSISTED_APP_VIEWS as readonly string[]).includes(value)
  );
}

/** Comprueba la forma estricta de la vista de ficha. */
export function isEntityViewPreferences(
  value: unknown,
): value is EntityViewPreferences {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['propertiesOpen', 'propertiesWidth', 'sections'])
  ) {
    return false;
  }

  const sections = value.sections;

  if (
    typeof value.propertiesOpen !== 'boolean' ||
    typeof value.propertiesWidth !== 'number' ||
    !Number.isInteger(value.propertiesWidth) ||
    value.propertiesWidth < PROPERTIES_WIDTH_MIN ||
    value.propertiesWidth > PROPERTIES_WIDTH_MAX ||
    !isRecord(sections) ||
    !hasExactKeys(sections, ENTITY_SECTION_IDS)
  ) {
    return false;
  }

  return ENTITY_SECTION_IDS.every(
    (id) => typeof sections[id] === 'boolean',
  );
}

/** Comprueba la forma estricta del último destino. */
export function isRecentLocationPreference(
  value: unknown,
): value is RecentLocationPreference {
  if (!isRecord(value)) {
    return false;
  }

  if (value.kind === 'world') {
    return (
      hasExactKeys(value, ['kind', 'worldId']) &&
      typeof value.worldId === 'string' &&
      UUID_V7_PATTERN.test(value.worldId)
    );
  }

  if (value.kind === 'entity') {
    return (
      hasExactKeys(value, [
        'kind',
        'worldId',
        'entityId',
        'entityName',
      ]) &&
      typeof value.worldId === 'string' &&
      UUID_V7_PATTERN.test(value.worldId) &&
      typeof value.entityId === 'string' &&
      UUID_V7_PATTERN.test(value.entityId) &&
      (value.entityName === null ||
        (typeof value.entityName === 'string' &&
          value.entityName.length > 0 &&
          value.entityName.length <= ENTITY_NAME_MAX_LENGTH))
    );
  }

  return false;
}

/**
 * Guarda estricta del snapshot de preferencias.
 *
 * La usa el preload para no reenviar una respuesta manipulada o de otra
 * versión. Cualquier clave extra o valor fuera de rango se rechaza.
 */
export function isUiPreferences(value: unknown): value is UiPreferences {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasExactKeys(value, [
      'theme',
      'railCollapsed',
      'entityView',
      'lastView',
      'recentLocation',
    ])
  ) {
    return false;
  }

  return (
    isThemePreference(value.theme) &&
    typeof value.railCollapsed === 'boolean' &&
    isEntityViewPreferences(value.entityView) &&
    isPersistedAppView(value.lastView) &&
    (value.recentLocation === null ||
      isRecentLocationPreference(value.recentLocation))
  );
}
