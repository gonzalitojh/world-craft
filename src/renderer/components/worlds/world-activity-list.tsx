import type {
  WorldActivityAction,
  WorldActivityEntry,
} from '../../../shared/contracts/worlds';
import { useI18n } from '../../i18n/provider';
import { Button } from '../button';

export type WorldActivityState = 'loading' | 'ready' | 'error';
export interface WorldActivityListProps {
  readonly entries: readonly WorldActivityEntry[];
  readonly state: WorldActivityState;
  readonly emptyMessage: string;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  /** La página de un mundo ya conoce su nombre; en Inicio se muestra. */
  readonly showWorldName?: boolean;
}

/**
 * Lista de actividad reciente.
 *
 * Cada fila lleva el nombre del mundo y la acción, de modo que en Inicio nunca
 * se atribuye una acción al mundo equivocado. La fecha se muestra con `Intl` y
 * el `datetime` conserva el valor ISO para lectores y pruebas.
 */
export function WorldActivityList({
  entries,
  state,
  emptyMessage,
  errorMessage,
  onRetry,
  showWorldName = true,
}: WorldActivityListProps) {
  const { messages, formats } = useI18n();
  const actionLabels: Record<WorldActivityAction, string> = {
    'world.created': messages.worlds.activity.actions.created,
    'world.updated': messages.worlds.activity.actions.updated,
    'world.archived': messages.worlds.activity.actions.archived,
    'world.restored': messages.worlds.activity.actions.restored,
    'world.duplicated': messages.worlds.activity.actions.duplicated,
    'world.deleted': messages.worlds.activity.actions.deleted,
    'world.imported': messages.worlds.activity.actions.imported,
  };

  if (state === 'loading') {
    return (
      <p className="wc-activity__status" role="status">
        {messages.worlds.activity.loading}
      </p>
    );
  }

  if (state === 'error') {
    return (
      <div className="wc-activity__error" role="alert">
        <p>{errorMessage}</p>
        {onRetry !== undefined ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {messages.worlds.activity.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="wc-activity__status">{emptyMessage}</p>;
  }

  return (
    <ul className="wc-activity">
      {entries.map((entry) => (
        <li className="wc-activity__item" key={entry.id}>
          <div className="wc-activity__body">
            <p className="wc-activity__action">{actionLabels[entry.action]}</p>
            {showWorldName ? (
              <p className="wc-activity__world">{entry.worldName}</p>
            ) : null}
          </div>
          <time
            className="wc-activity__time"
            dateTime={new Date(entry.createdAt).toISOString()}
          >
            {formats.formatDateTime(entry.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
