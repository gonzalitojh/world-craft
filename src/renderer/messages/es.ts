/**
 * Mensajes visibles del renderer.
 *
 * Todo el texto de interfaz pasa por aquí para que esté centralizado, tipado y
 * preparado para añadir más idiomas sin tocar los componentes (ADR 0009).
 */
export const messages = {
  app: {
    title: 'World Craft',
  },
  scaffold: {
    heading: 'World Craft',
    description:
      'Base técnica de la aplicación de escritorio. Todavía no hay mundos, fichas ni mapas: esta pantalla solo confirma que Electron, React y TypeScript arrancan con el aislamiento de seguridad activado.',
    version: (version: string): string => `Versión ${version}`,
  },
} as const;
