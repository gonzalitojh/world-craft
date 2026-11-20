import type { ReactElement } from 'react';

import type { EntityTypeIcon } from '../../../shared/contracts/entity-types';

/**
 * Iconos de los tipos de entidad.
 *
 * El catálogo guarda un nombre estable de la lista cerrada de
 * `ENTITY_TYPE_ICONS`; aquí se dibuja con SVG propio para no añadir una
 * librería de iconos al bundle. El nombre siempre acompaña al icono, así que el
 * color nunca es el único indicador del tipo.
 */
export function TypeIcon({
  name,
  className,
}: {
  readonly name: EntityTypeIcon;
  readonly className?: string | undefined;
}): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths(name)}
    </svg>
  );
}

function iconPaths(name: EntityTypeIcon): ReactElement {
  switch (name) {
    case 'user-round':
    case 'users':
      return (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>
      );
    case 'building-2':
      return (
        <>
          <path d="M4 20V6l8-3v17M12 20V9l8 3v8" />
          <path d="M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2" />
        </>
      );
    case 'church':
      return (
        <>
          <path d="M12 3v5M10 5h4M5 20V11l7-3 7 3v9" />
          <path d="M10 20v-5h4v5" />
        </>
      );
    case 'calendar-days':
      return (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16M9 14h1M14 14h1M9 17h1M14 17h1" />
        </>
      );
    case 'compass':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m15 9-2 4-4 2 2-4Z" />
        </>
      );
    case 'map-pin':
      return (
        <>
          <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2" />
        </>
      );
    case 'cpu':
      return (
        <>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
        </>
      );
    case 'crown':
      return <path d="m4 8 3 9h10l3-9-5 3-3-5-3 5Z" />;
    case 'star':
      return (
        <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9Z" />
      );
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </>
      );
    case 'sparkles':
      return (
        <>
          <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" />
          <path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8Z" />
        </>
      );
    case 'dna':
      return (
        <>
          <path d="M7 4c0 6 10 10 10 16M17 4c0 6-10 10-10 16" />
          <path d="M8 7h8M8 17h8M10 12h4" />
        </>
      );
    case 'leaf':
      return (
        <>
          <path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15Z" />
          <path d="M5 20 13 12" />
        </>
      );
    case 'paw-print':
      return (
        <>
          <ellipse cx="12" cy="15" rx="4" ry="3.2" />
          <circle cx="6.5" cy="10" r="1.6" />
          <circle cx="10" cy="7" r="1.6" />
          <circle cx="14" cy="7" r="1.6" />
          <circle cx="17.5" cy="10" r="1.6" />
        </>
      );
    case 'flag':
      return (
        <>
          <path d="M5 21V4M5 5h11l-2 3 2 3H5" />
        </>
      );
    case 'shield':
    case 'swords':
      return (
        <>
          <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" />
          <path d="m9 12 2 2 4-5" />
        </>
      );
    case 'gem':
    case 'package':
      return (
        <>
          <path d="m12 3 8 4v10l-8 4-8-4V7Z" />
          <path d="m4 7 8 4 8-4M12 11v10" />
        </>
      );
    case 'languages':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5a14 14 0 0 1 0 17M12 3.5a14 14 0 0 0 0 17" />
        </>
      );
    case 'lightbulb':
      return (
        <>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
        </>
      );
    case 'palette':
      return (
        <>
          <path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-.5-2 1-2h2a3 3 0 0 0 3-3 9 9 0 0 0-8-11Z" />
          <circle cx="8" cy="11" r="1" />
          <circle cx="12" cy="8" r="1" />
          <circle cx="16" cy="11" r="1" />
        </>
      );
    case 'skull':
      return (
        <>
          <path d="M12 3a7 7 0 0 0-7 7c0 2.5 1 4 2 5v3h10v-3c1-1 2-2.5 2-5a7 7 0 0 0-7-7Z" />
          <circle cx="9.5" cy="11" r="1" />
          <circle cx="14.5" cy="11" r="1" />
          <path d="M10 18v3M14 18v3" />
        </>
      );
    case 'tent':
      return (
        <>
          <path d="m12 4 8 16H4Z" />
          <path d="M12 4v16" />
        </>
      );
    case 'scroll':
    case 'book-open':
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" />
          <path d="M4 5.5v16M8 7h8M8 11h8" />
        </>
      );
    case 'waves':
      return (
        <path d="M3 8c3-2 5-2 8 0s5 2 8 0M3 13c3-2 5-2 8 0s5 2 8 0M3 18c3-2 5-2 8 0s5 2 8 0" />
      );
    case 'wind':
      return <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />;
    case 'zap':
      return <path d="M13 3 5 14h6l-1 7 8-11h-6Z" />;
    default:
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" />
          <path d="M4 5.5v16" />
        </>
      );
  }
}
