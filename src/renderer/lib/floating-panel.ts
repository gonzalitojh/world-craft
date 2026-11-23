/**
 * Colocación de paneles flotantes anclados a un punto del borrador.
 *
 * Función pura y sin DOM: recibe el rectángulo del ancla (normalmente el
 * cursor obtenido con `coordsAtPos`), el tamaño medido del panel y el viewport.
 * Devuelve la posición fija con clamp horizontal, volteo vertical y altura
 * máxima. Se prueba por separado para que jsdom no tenga que simular layout.
 */

/** Rectángulo mínimo de un ancla o de un panel. */
export interface FloatingRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Rectángulo del ancla; basta con sus bordes. */
export interface FloatingAnchor {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** Entrada del cálculo de colocación. */
export interface FloatingPanelInput {
  readonly anchor: FloatingAnchor;
  readonly panel: { readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
  /** Separación mínima con los bordes del viewport. Por defecto 24 px. */
  readonly margin?: number;
  /** Separación entre el cursor y el panel. Por defecto 4 px. */
  readonly offset?: number;
  /** Altura máxima preferida del panel. Por defecto 320 px (20rem). */
  readonly maxHeight?: number;
}

/** Resultado de la colocación. */
export interface FloatingPanelPosition {
  readonly top: number;
  readonly left: number;
  readonly maxHeight: number;
  readonly placement: 'above' | 'below';
}

const DEFAULT_MARGIN = 24;
const DEFAULT_OFFSET = 4;
const DEFAULT_MAX_HEIGHT = 320;

/**
 * Calcula la posición de un panel flotante.
 *
 * - Vertical: debajo del ancla si cabe; si no, encima; si tampoco cabe, el
 *   lado con más espacio y altura recortada.
 * - Horizontal: el borde izquierdo se limita al margen y el derecho también,
 *   de modo que nunca sobresale del viewport.
 */
export function placeFloatingPanel({
  anchor,
  panel,
  viewport,
  margin = DEFAULT_MARGIN,
  offset = DEFAULT_OFFSET,
  maxHeight = DEFAULT_MAX_HEIGHT,
}: FloatingPanelInput): FloatingPanelPosition {
  const availableWidth = Math.max(0, viewport.width - margin * 2);
  const panelWidth = Math.min(Math.max(panel.width, 0), availableWidth);
  const preferredLeft = anchor.left;
  const left = Math.min(
    Math.max(preferredLeft, margin),
    Math.max(margin, viewport.width - margin - panelWidth),
  );

  const spaceBelow = viewport.height - margin - (anchor.bottom + offset);
  const spaceAbove = anchor.top - offset - margin;
  const needsHeight = Math.max(panel.height, 0);
  const belowFits = needsHeight <= spaceBelow;
  const aboveFits = needsHeight <= spaceAbove;
  let placement: 'above' | 'below';

  if (belowFits) {
    placement = 'below';
  } else if (aboveFits) {
    placement = 'above';
  } else {
    placement = spaceBelow >= spaceAbove ? 'below' : 'above';
  }

  const available = Math.max(
    0,
    placement === 'below' ? spaceBelow : spaceAbove,
  );
  const resolvedHeight = Math.min(
    maxHeight,
    available,
    needsHeight > 0 ? needsHeight : maxHeight,
  );
  const top =
    placement === 'below'
      ? anchor.bottom + offset
      : Math.max(margin, anchor.top - offset - resolvedHeight);

  return {
    top,
    left,
    maxHeight: Math.max(0, resolvedHeight),
    placement,
  };
}
