/**
 * Sustituto de `server-only` para las pruebas.
 *
 * El paquete original lanza al importarse fuera del servidor de Next.js. Los
 * módulos de servidor (`client.ts`, `session.ts`) lo importan para que Next
 * impida usarlos en el cliente; en Vitest basta un módulo vacío.
 */
export {};
