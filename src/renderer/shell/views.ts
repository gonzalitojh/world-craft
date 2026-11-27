/**
 * Tipos de navegación del shell.
 *
 * Viven en un módulo `.ts` sin JSX para que las pruebas unitarias de Node
 * puedan importarlos sin arrastrar el renderer de React.
 */
export type AppView =
  | 'home'
  | 'search'
  | 'worlds'
  | 'world'
  | 'entities'
  | 'entity'
  | 'trash'
  | 'settings'
  | 'samples'
  | 'maps-spike';

/** Vistas con entrada propia en la navegación del rail. */
export type AppNavView = 'home' | 'worlds' | 'trash' | 'settings';

/** Acción primaria contextual de la barra superior. */
export interface ShellPrimaryAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
}
