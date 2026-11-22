import type { AssetSummary } from '../../../shared/contracts/assets';
import { Badge } from '../badge';
import { Button } from '../button';
import { assetUrl } from '../../lib/asset-url';
import { useI18n } from '../../i18n/provider';

export interface EntityResourcesSectionProps {
  readonly mainAssetId: string | null;
  readonly gallery: readonly AssetSummary[];
  readonly pending: boolean;
  readonly onRemoveImage: (assetId: string) => void;
}

/**
 * Galería de Recursos.
 *
 * La sección solo importa y quita imágenes. Elegir o cambiar la portada es una
 * acción del panel de propiedades; aquí la miniatura que ya es portada muestra
 * una insignia y el nombre accesible del botón advierte de que también se
 * quitará la portada.
 */
export function EntityResourcesSection({
  mainAssetId,
  gallery,
  pending,
  onRemoveImage,
}: EntityResourcesSectionProps) {
  const { messages } = useI18n();

  if (gallery.length === 0) {
    return (
      <p className="wc-entity-resources__empty">
        {messages.entities.detail.galleryEmpty}
      </p>
    );
  }

  return (
    <ul className="wc-gallery">
      {gallery.map((asset, index) => {
        const label =
          asset.alt ?? messages.entities.detail.imageOption(index + 1);
        const isCover = asset.id === mainAssetId;

        return (
          <li className="wc-gallery__item" key={asset.id}>
            <div className="wc-gallery__media">
              <img
                className="wc-gallery__thumb"
                src={assetUrl(asset.id, 'thumb')}
                alt=""
                loading="lazy"
              />
              {isCover ? (
                <Badge tone="accent" className="wc-gallery__badge">
                  {messages.entities.detail.coverBadge}
                </Badge>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              aria-label={
                isCover
                  ? messages.entities.detail.removeCoverNamed(asset.alt ?? '')
                  : messages.entities.detail.removeImageNamed(label)
              }
              onClick={() => {
                onRemoveImage(asset.id);
              }}
            >
              {messages.entities.detail.removeFromGallery}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
