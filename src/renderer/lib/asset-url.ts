/**
 * URLs de assets locales para el renderer.
 *
 * El protocolo `wc-asset://` lo atiende el proceso principal y solo acepta el
 * ID del asset; la ruta del archivo nunca sale de SQLite. El renderer no puede
 * construir rutas del sistema ni leer archivos por su cuenta (ADR 0005).
 */

/** Variante servida: el archivo principal o su miniatura. */
export type AssetVariant = 'asset' | 'thumb';

/** Construye la URL de un asset validado por el proceso principal. */
export function assetUrl(
  assetId: string,
  variant: AssetVariant = 'asset',
): string {
  return `wc-asset://${variant}/${assetId}`;
}
