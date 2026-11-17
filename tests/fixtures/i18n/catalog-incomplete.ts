/**
 * Catálogo incompleto de mentira para probar el detector de claves.
 *
 * No se registra en la aplicación: solo demuestra que `diffCatalogs` encuentra
 * la hoja ausente (`home.title`) antes de que exista un idioma real a medias.
 */
import { es } from '@/messages/es';

/** Copia del catálogo con una sola hoja eliminada. */
export const catalogWithoutHomeTitle: unknown = {
  ...es,
  home: {
    ...es.home,
    title: undefined,
  },
};

/** Catálogo mínimo: casi todo falta y el detector debe señalarlo. */
export const tinyCatalog: unknown = {
  meta: { title: 'Título de prueba' },
  home: { title: 'Inicio de prueba' },
};
