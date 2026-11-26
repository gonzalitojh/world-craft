/**
 * Constantes del servicio de datos de la aplicación (#79).
 *
 * Los enums, tokens, formatos y códigos compartidos viven en
 * `shared/contracts/data.ts`; aquí solo quedan los límites internos de medición
 * y las reexportaciones que ya consumían los módulos de datos.
 */
export {
  DATA_DELETE_ALL_CONFIRMATION,
  DATA_DELETE_CATEGORIES,
  DATA_ERROR_CODES,
  DATA_FOLDERS,
  DATA_LIBRARY_FORMAT,
  DATA_ORPHAN_PURGE_CONFIRMATION,
  DATA_PRE_DELETE_FORMAT,
  DATA_USAGE_CATEGORIES,
  isDataErrorCode,
  isDataFolder,
  type DataDeleteCategory,
  type DataErrorCode,
  type DataFolder,
  type DataUsageCategory,
} from '../../shared/contracts/data';

/** Límite de entradas que recorre una medición antes de marcarse parcial. */
export const DATA_MEASUREMENT_MAX_ENTRIES = 100_000;

/** Tiempo máximo de una medición antes de marcarse parcial (4 s). */
export const DATA_MEASUREMENT_MAX_DURATION_MS = 4_000;
