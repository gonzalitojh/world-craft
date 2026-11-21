import type { SearchKind } from '../../../shared/contracts/search';

export interface SearchKindIconProps {
  readonly kind: SearchKind;
  readonly className?: string;
}

function WorldGlyph() {
  return (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4a13 13 0 0 1 0 16a13 13 0 0 1 0-16Z" />
    </>
  );
}

function EntityGlyph() {
  return (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z" />
      <path d="M8 4v16M11 8h5M11 12h5" />
    </>
  );
}

function RelationGlyph() {
  return (
    <>
      <circle cx="7" cy="12" r="2.5" />
      <circle cx="17" cy="12" r="2.5" />
      <path d="M9.5 12h5" />
    </>
  );
}

/** Icono decorativo del tipo de documento encontrado. */
export function SearchKindIcon({ kind, className }: SearchKindIconProps) {
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
      {kind === 'world' ? <WorldGlyph /> : null}
      {kind === 'entity' ? <EntityGlyph /> : null}
      {kind === 'relation' ? <RelationGlyph /> : null}
    </svg>
  );
}
