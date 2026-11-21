import { assetUrl } from '../../lib/asset-url';
import { worldMarkVariant } from '../../lib/world-mark';

export interface WorldMarkProps {
  readonly worldId: string;
  readonly coverAssetId: string | null;
}

/**
 * Portada o marca procedural decorativa de un mundo.
 *
 * La información real vive en el título contiguo, así que el contenedor va con
 * `aria-hidden` y la imagen con `alt=""`. Sin portada se pinta un sello de mapa
 * determinista: la variante depende solo del `id` y el CSS la resuelve con los
 * pares `--entity-*`, legibles en Claro y Oscuro.
 */
export function WorldMark({ worldId, coverAssetId }: WorldMarkProps) {
  const { motif, tone } = worldMarkVariant(worldId);

  if (coverAssetId !== null) {
    return (
      <span className="wc-world-mark wc-world-mark--cover" aria-hidden="true">
        <img
          className="wc-world-mark__image"
          src={assetUrl(coverAssetId, 'thumb')}
          alt=""
        />
      </span>
    );
  }

  return (
    <span
      className="wc-world-mark"
      data-motif={motif}
      data-tone={tone}
      aria-hidden="true"
    />
  );
}
