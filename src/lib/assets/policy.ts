/**
 * Política de acceso a assets.
 *
 * Es una función pura: la RLS de `world_members` y la guarda de escritura son la
 * última línea, pero el servicio decide antes. Traducir el rol a una decisión
 * booleana en un solo sitio evita repetir comparaciones y facilita las pruebas.
 */
export const WORLD_ROLES = ['owner', 'editor', 'viewer'] as const;

/** Rol de una persona en un mundo. */
export type WorldRole = (typeof WORLD_ROLES)[number];

/** Comprueba si un valor es un rol conocido. */
export function isWorldRole(value: unknown): value is WorldRole {
  return (
    typeof value === 'string' &&
    (WORLD_ROLES as readonly string[]).includes(value)
  );
}

/** Owner y editor escriben; viewer solo lee. */
export function canWriteAssets(role: WorldRole | null | undefined): boolean {
  return role === 'owner' || role === 'editor';
}

/** Cualquier miembro puede leer los metadatos y pedir URLs firmadas. */
export function canReadAssets(role: WorldRole | null | undefined): boolean {
  return isWorldRole(role);
}
