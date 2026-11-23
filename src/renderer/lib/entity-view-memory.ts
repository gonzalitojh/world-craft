/**
 * Compatibilidad del estado de vista de ficha.
 *
 * La memoria global mutable desapareció con #132: el panel, su ancho y las
 * secciones se persisten en `app_settings` y `EntityDetailPage` los recibe
 * controlados desde `App`. Este módulo solo reexporta las constantes y la
 * normalización compartidas para no duplicar límites en el renderer.
 */
export {
  ENTITY_SECTION_IDS,
  PROPERTIES_WIDTH_DEFAULT,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  clampPropertiesWidth,
  type EntitySectionId,
  type EntityViewPatch,
  type EntityViewPreferences,
} from '../../shared/contracts/preferences';
