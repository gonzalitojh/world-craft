import type { TrashItem } from '../../../shared/contracts/trash';
import { Badge } from '../badge';
import { Button } from '../button';
import { useI18n } from '../../i18n/provider';

function TrashKindIcon({ kind }: { readonly kind: TrashItem['kind'] }) {
  if (kind === 'world') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4a13 13 0 0 1 0 16a13 13 0 0 1 0-16Z" />
      </svg>
    );
  }

  if (kind === 'entityType') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 4h9l3 3v13H6Z" />
      <path d="M15 4v3h3M9 11h6M9 15h6" />
    </svg>
  );
}

export interface TrashRowProps {
  readonly item: TrashItem;
  readonly pending: boolean;
  readonly notice: string | undefined;
  readonly onRestore: () => void;
  readonly onPurge: () => void;
}

/** Fila de un elemento de la papelera con sus acciones siempre visibles. */
export function TrashRow({
  item,
  pending,
  notice,
  onRestore,
  onPurge,
}: TrashRowProps) {
  const { messages, formats } = useI18n();
  const origin =
    item.kind === 'entity'
      ? messages.trash.row.entityOrigin(item.worldName, item.typeName)
      : item.kind === 'entityType'
        ? messages.trash.row.typeOrigin(item.worldName)
        : null;
  const worldName = item.kind === 'world' ? null : item.worldName;
  const worldDeleted =
    worldName !== null && item.kind !== 'world' && item.worldDeletedAt !== null;

  return (
    <li
      className="wc-trash-row"
      data-trash-row-id={item.id}
      data-trash-kind={item.kind}
    >
      <span className="wc-trash-row__icon" aria-hidden="true">
        <TrashKindIcon kind={item.kind} />
      </span>
      <div className="wc-trash-row__body">
        <div className="wc-trash-row__identity">
          <span className="wc-trash-row__name">{item.name}</span>
          {origin === null ? null : (
            <span className="wc-trash-row__origin">{origin}</span>
          )}
        </div>
        <div className="wc-trash-row__meta">
          <time dateTime={new Date(item.deletedAt).toISOString()}>
            {messages.trash.row.deletedAt(
              formats.formatDateTime(item.deletedAt),
            )}
          </time>
          {worldDeleted ? (
            <Badge tone="warning">{messages.trash.row.worldInTrash}</Badge>
          ) : null}
        </div>
        {worldDeleted && worldName !== null ? (
          <p className="wc-trash-row__notice">
            {messages.trash.row.worldInTrashNotice(worldName)}
          </p>
        ) : null}
        {notice === undefined ? null : (
          <p
            className="wc-trash-row__notice wc-trash-row__notice--error"
            role="alert"
          >
            {notice}
          </p>
        )}
      </div>
      <div className="wc-trash-row__actions">
        <Button
          variant="secondary"
          size="sm"
          data-trash-restore={item.id}
          disabled={pending}
          aria-label={messages.trash.row.restoreNamed(item.name)}
          onClick={onRestore}
        >
          {messages.trash.row.restore}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="wc-trash-row__purge"
          disabled={pending}
          aria-label={messages.trash.row.purgeNamed(item.name)}
          onClick={onPurge}
        >
          {messages.trash.row.purge}
        </Button>
      </div>
    </li>
  );
}
