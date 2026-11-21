import { Fragment } from 'react';

import {
  SEARCH_HIGHLIGHT_END,
  SEARCH_HIGHLIGHT_START,
} from '../../../shared/contracts/search';

export interface SearchHighlightProps {
  /** Texto con marcadores de control generados por FTS5. */
  readonly text: string;
}

interface Segment {
  readonly text: string;
  readonly highlighted: boolean;
}

function toSegments(text: string): readonly Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf(SEARCH_HIGHLIGHT_START, cursor);

    if (start === -1) {
      segments.push({ text: text.slice(cursor), highlighted: false });
      break;
    }

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlighted: false });
    }

    const end = text.indexOf(SEARCH_HIGHLIGHT_END, start + 1);

    if (end === -1) {
      segments.push({ text: text.slice(start + 1), highlighted: false });
      break;
    }

    segments.push({ text: text.slice(start + 1, end), highlighted: true });
    cursor = end + 1;
  }

  return segments;
}

/**
 * Pinta el resaltado de FTS5 sin interpretar HTML.
 *
 * El proceso principal envía marcadores de control alrededor de las
 * coincidencias. Aquí se dividen y se crean nodos de React; nunca se usa
 * `dangerouslySetInnerHTML`.
 */
export function SearchHighlight({ text }: SearchHighlightProps) {
  return (
    <>
      {toSegments(text).map((segment, index) =>
        segment.highlighted ? (
          <mark className="wc-search-hit__mark" key={index}>
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
