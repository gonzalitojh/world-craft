import type { EntityCountSnapshot } from '../../lib/entity-count';
import { useI18n } from '../../i18n/provider';
import { Badge } from '../badge';

export interface WorldModuleNavProps {
  readonly entityCount: EntityCountSnapshot;
  readonly onOpenEntities: () => void;
}

/**
 * Navegación modular del mundo.
 *
 * `Resumen` es la sección actual (`aria-current="page"`) y `Fichas` el único
 * módulo implementado al que se puede navegar. Mapas, Manuscrito y Grafo siguen
 * como texto estático con la insignia «Previsto»: no son botones, no entran en
 * el orden de tabulación y no generan enlaces muertos.
 *
 * El recuento solo aparece cuando la lectura terminó bien; en carga o error se
 * omite sin bloquear la página.
 */
export function WorldModuleNav({
  entityCount,
  onOpenEntities,
}: WorldModuleNavProps) {
  const { messages } = useI18n();
  const modules = messages.worlds.detail.modules;
  const count = entityCount.state === 'ready' ? entityCount.count : null;
  const countLabel =
    count === null
      ? null
      : entityCount.capped
        ? messages.entities.list.countAtLeast(count)
        : messages.entities.list.count(count);
  const plannedModules = [modules.maps, modules.manuscript, modules.graph];

  return (
    <div className="wc-world-modules">
      <nav aria-label={modules.label}>
        <ul className="wc-world-modules__list">
          <li className="wc-world-modules__item">
            <button
              type="button"
              className="wc-world-modules__button"
              aria-current="page"
            >
              <span className="wc-world-modules__label">{modules.summary}</span>
            </button>
          </li>
          <li className="wc-world-modules__item">
            <button
              type="button"
              className="wc-world-modules__button"
              onClick={onOpenEntities}
            >
              <span className="wc-world-modules__label">
                {modules.entities}
              </span>
              {countLabel === null ? null : (
                <span className="wc-world-modules__meta">{countLabel}</span>
              )}
            </button>
          </li>
          {plannedModules.map((label) => (
            <li
              key={label}
              className="wc-world-modules__item wc-world-modules__item--planned"
            >
              <span className="wc-world-modules__label">{label}</span>
              <Badge tone="neutral">{modules.planned}</Badge>
            </li>
          ))}
        </ul>
      </nav>
      <p className="wc-page__note">{modules.plannedNote}</p>
    </div>
  );
}
