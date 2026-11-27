import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  TRASH_GROUPS,
  type TrashEmptyResult,
  type TrashGroup,
  type TrashItem,
  type TrashPage,
} from '../../shared/contracts/trash';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { Skeleton } from '../components/skeleton';
import { TrashEmptyDialog } from '../components/trash/trash-empty-dialog';
import { TrashPurgeDialog } from '../components/trash/trash-purge-dialog';
import { TrashRow } from '../components/trash/trash-row';
import { useI18n } from '../i18n/provider';

type GroupStatus = 'loading' | 'ready' | 'error';

interface GroupState {
  readonly status: GroupStatus;
  readonly items: readonly TrashItem[];
  readonly nextCursor: string | null;
  readonly loadingMore: boolean;
  readonly moreError: boolean;
}

type GroupsState = Readonly<Record<TrashGroup, GroupState>>;

type NotifyTone = 'success' | 'error' | 'info';

export interface TrashPageProps {
  readonly onNotify: (tone: NotifyTone, message: string) => void;
  /** Recarga la biblioteca de mundos y revalida el destino recordado. */
  readonly onLibraryChanged: () => void | Promise<void>;
}

const EMPTY_GROUP: GroupState = {
  status: 'loading',
  items: [],
  nextCursor: null,
  loadingMore: false,
  moreError: false,
};

function createInitialGroups(): GroupsState {
  return {
    worlds: EMPTY_GROUP,
    entities: EMPTY_GROUP,
    entityTypes: EMPTY_GROUP,
  };
}

function rowKey(item: TrashItem): string {
  return `${item.kind}:${item.id}`;
}

/**
 * Vista global de la papelera.
 *
 * Carga los tres grupos por cursor, restaura a su contexto original y purga
 * con copia previa. Las mutaciones de un mundo recargan los tres grupos y
 * avisan a `App` para refrescar la biblioteca; el resto recarga solo su grupo.
 */
export function TrashPage({ onNotify, onLibraryChanged }: TrashPageProps) {
  const { messages, formats } = useI18n();
  const api = window.worldCraft.trash;
  const [groups, setGroups] = useState<GroupsState>(createInitialGroups);
  const [rowErrors, setRowErrors] = useState<Readonly<Record<string, string>>>(
    {},
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    readonly group: TrashGroup;
    readonly index: number;
  } | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [purgeItem, setPurgeItem] = useState<TrashItem | null>(null);
  const [purgePending, setPurgePending] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [emptyPending, setEmptyPending] = useState(false);
  const [emptyError, setEmptyError] = useState<string | null>(null);
  const [emptyResult, setEmptyResult] = useState<TrashEmptyResult | null>(null);

  const requestRefs = useRef<Record<TrashGroup, number>>({
    worlds: 0,
    entities: 0,
    entityTypes: 0,
  });
  const moreRefs = useRef<Record<TrashGroup, HTMLButtonElement | null>>({
    worlds: null,
    entities: null,
    entityTypes: null,
  });

  const groupTitle = (group: TrashGroup): string => {
    switch (group) {
      case 'worlds':
        return messages.trash.groups.worlds.title;
      case 'entities':
        return messages.trash.groups.entities.title;
      case 'entityTypes':
        return messages.trash.groups.entityTypes.title;
    }
  };

  const groupEmpty = (group: TrashGroup): string => {
    switch (group) {
      case 'worlds':
        return messages.trash.groups.worlds.empty;
      case 'entities':
        return messages.trash.groups.entities.empty;
      case 'entityTypes':
        return messages.trash.groups.entityTypes.empty;
    }
  };

  const groupLoadError = (group: TrashGroup): string => {
    switch (group) {
      case 'worlds':
        return messages.trash.groups.worlds.loadError;
      case 'entities':
        return messages.trash.groups.entities.loadError;
      case 'entityTypes':
        return messages.trash.groups.entityTypes.loadError;
    }
  };

  const fetchGroup = useCallback(
    async (
      group: TrashGroup,
      options: {
        readonly cursor?: string | null;
        readonly mode: 'initial' | 'more' | 'refresh';
      },
    ): Promise<void> => {
      requestRefs.current[group] += 1;
      const request = requestRefs.current[group];

      if (options.mode === 'more') {
        setGroups((current) => ({
          ...current,
          [group]: { ...current[group], loadingMore: true, moreError: false },
        }));
      } else {
        setGroups((current) => ({
          ...current,
          [group]: { ...current[group], status: 'loading' },
        }));
      }

      const result = await api.list({
        group,
        ...(options.cursor === undefined || options.cursor === null
          ? {}
          : { cursor: options.cursor }),
      });

      if (request !== requestRefs.current[group]) {
        return;
      }

      if (!result.ok) {
        setGroups((current) => ({
          ...current,
          [group]:
            options.mode === 'more'
              ? { ...current[group], loadingMore: false, moreError: true }
              : { ...current[group], status: 'error' },
        }));
        return;
      }

      setGroups((current) => {
        const base = current[group];
        const page: TrashPage = result.data;

        return {
          ...current,
          [group]: {
            status: 'ready',
            items:
              options.mode === 'more'
                ? [...base.items, ...page.items]
                : page.items,
            nextCursor: page.nextCursor,
            loadingMore: false,
            moreError: false,
          },
        };
      });

      if (options.mode === 'more') {
        const added = result.data.items.length;
        setLiveMessage(formats.plural(added, messages.trash.loadedMore));
        window.requestAnimationFrame(() => {
          moreRefs.current[group]?.focus();
        });
      }
    },
    [api, formats, messages],
  );

  const reloadGroups = useCallback(
    async (groupsToReload: readonly TrashGroup[]): Promise<void> => {
      await Promise.all(
        groupsToReload.map((group) => fetchGroup(group, { mode: 'refresh' })),
      );
    },
    [fetchGroup],
  );

  useEffect(() => {
    void Promise.all(
      TRASH_GROUPS.map((group) => fetchGroup(group, { mode: 'initial' })),
    );
  }, [fetchGroup]);

  useEffect(() => {
    if (focusRequest === null) {
      return;
    }

    const state = groups[focusRequest.group];

    if (state.status !== 'ready') {
      return;
    }

    const section = document.querySelector<HTMLElement>(
      `[data-trash-group="${focusRequest.group}"]`,
    );
    const buttons = section?.querySelectorAll<HTMLElement>(
      '[data-trash-restore]',
    );

    if (buttons !== undefined && buttons.length > 0) {
      const target = buttons[Math.min(focusRequest.index, buttons.length - 1)];
      target?.focus();
    } else {
      const groupEmptyElement = document.getElementById(
        `wc-trash-group-${focusRequest.group}-empty`,
      );

      if (groupEmptyElement !== null) {
        groupEmptyElement.focus();
      } else {
        document.getElementById('wc-trash-empty-global')?.focus();
      }
    }

    window.requestAnimationFrame(() => {
      setFocusRequest(null);
    });
  }, [focusRequest, groups]);

  const allGroups = useMemo(
    () => TRASH_GROUPS.map((group) => groups[group]),
    [groups],
  );
  const allLoading = allGroups.every((group) => group.status === 'loading');
  const allError = allGroups.every((group) => group.status === 'error');
  const allReady = allGroups.every((group) => group.status === 'ready');
  const allEmpty =
    allReady && allGroups.every((group) => group.items.length === 0);

  const removeItem = (group: TrashGroup, item: TrashItem): void => {
    setGroups((current) => ({
      ...current,
      [group]: {
        ...current[group],
        items: current[group].items.filter(
          (entry) => rowKey(entry) !== rowKey(item),
        ),
      },
    }));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[rowKey(item)];
      return next;
    });
  };

  const setRowError = (item: TrashItem, message: string): void => {
    setRowErrors((current) => ({ ...current, [rowKey(item)]: message }));
  };

  const groupForKind = (kind: TrashItem['kind']): TrashGroup =>
    kind === 'world'
      ? 'worlds'
      : kind === 'entity'
        ? 'entities'
        : 'entityTypes';

  const worldNameOf = (item: TrashItem): string =>
    item.kind === 'world' ? '' : item.worldName;

  const handleRestore = async (item: TrashItem): Promise<void> => {
    if (busyId !== null) {
      return;
    }

    const group = groupForKind(item.kind);
    const index = groups[group].items.findIndex(
      (entry) => rowKey(entry) === rowKey(item),
    );

    setBusyId(item.id);
    const result = await api.restore({ kind: item.kind, id: item.id });
    setBusyId(null);

    if (!result.ok) {
      setRowError(item, messages.trash.row.restoreError);
      return;
    }

    if (result.data.restored) {
      removeItem(group, item);
      onNotify('success', messages.trash.row.restored(item.name));
      await reloadGroups(item.kind === 'world' ? TRASH_GROUPS : [group]);
      setFocusRequest({ group, index });

      if (item.kind === 'world') {
        await onLibraryChanged();
      }
      return;
    }

    if (
      result.data.reason === 'world-in-trash' ||
      result.data.reason === 'type-unavailable'
    ) {
      // La fila ya muestra el aviso estático de mundo en papelera; no se
      // duplica el mismo texto como error. El resto de motivos sí se añaden.
      if (
        result.data.reason === 'world-in-trash' &&
        item.kind !== 'world' &&
        item.worldDeletedAt !== null
      ) {
        return;
      }

      setRowError(
        item,
        result.data.reason === 'world-in-trash'
          ? messages.trash.row.worldInTrashNotice(worldNameOf(item))
          : messages.trash.row.restoreTypeUnavailable,
      );
      return;
    }

    // already-restored o not-found: la fila ya no representa el estado real.
    removeItem(group, item);
    onNotify('info', messages.trash.row.listUpdated);
    await reloadGroups(item.kind === 'world' ? TRASH_GROUPS : [group]);
    setFocusRequest({ group, index });
  };

  const handlePurgeConfirm = async (): Promise<void> => {
    if (purgeItem === null || purgePending) {
      return;
    }

    const item = purgeItem;
    const group = groupForKind(item.kind);
    const index = groups[group].items.findIndex(
      (entry) => rowKey(entry) === rowKey(item),
    );

    setPurgePending(true);
    setPurgeError(null);
    const result = await api.purge({
      kind: item.kind,
      id: item.id,
      confirm: 'delete-forever',
    });
    setPurgePending(false);

    if (!result.ok) {
      setPurgeError(messages.trash.purgeDialog.error);
      await reloadGroups([group]);
      return;
    }

    if (result.data.purged) {
      setPurgeItem(null);
      removeItem(group, item);
      onNotify('success', messages.trash.row.purged(item.name));
      const groupsToReload = item.kind === 'world' ? TRASH_GROUPS : [group];
      await reloadGroups(groupsToReload);
      setFocusRequest({ group, index });

      if (item.kind === 'world') {
        await onLibraryChanged();
      }
      return;
    }

    switch (result.data.reason) {
      case 'backup-failed':
        setPurgeError(messages.trash.purgeDialog.backupFailed);
        return;
      case 'type-in-use':
        setPurgeError(messages.trash.purgeDialog.typeInUse);
        return;
      case 'assets-in-use':
        setPurgeError(messages.trash.purgeDialog.assetsInUse);
        return;
      case 'not-found':
      case 'already-purged':
        setPurgeError(messages.trash.purgeDialog.missing);
        await reloadGroups([group]);
        return;
    }
  };

  const handleEmptyConfirm = async (): Promise<void> => {
    if (emptyPending) {
      return;
    }

    setEmptyPending(true);
    setEmptyError(null);
    const result = await api.empty({ confirm: 'empty-trash' });
    setEmptyPending(false);

    if (!result.ok) {
      setEmptyError(messages.trash.emptyDialog.error);
      await reloadGroups(TRASH_GROUPS);
      return;
    }

    if (result.data.backup === 'failed') {
      setEmptyError(messages.trash.emptyDialog.backupFailed);
      return;
    }

    setEmptyResult(result.data);
    const total =
      result.data.purged.worlds +
      result.data.purged.entities +
      result.data.purged.entityTypes;
    const skipped = result.data.skipped;

    onNotify(
      total === 0 ? 'info' : 'success',
      total === 0
        ? skipped > 0
          ? messages.trash.emptyDialog.nonePurged
          : messages.trash.emptyDialog.alreadyEmpty
        : skipped > 0
          ? messages.trash.emptyDialog.summaryLeadPartial
          : messages.trash.emptyDialog.summaryLead,
    );
    await reloadGroups(TRASH_GROUPS);
    await onLibraryChanged();
  };

  const renderSkeletons = (): ReactNode => (
    <ul className="wc-trash-list" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li className="wc-trash-row wc-trash-row--skeleton" key={index}>
          <Skeleton variant="circle" width="1.5rem" height="1.5rem" />
          <div className="wc-trash-row__body">
            <Skeleton width="45%" height="1rem" />
            <Skeleton width="30%" height="0.75rem" />
          </div>
        </li>
      ))}
    </ul>
  );

  if (allError) {
    return (
      <div className="wc-page wc-page--trash">
        <p className="wc-page__lead">{messages.trash.lead}</p>
        <section className="wc-alert wc-alert--inline" role="alert">
          <h2 className="wc-alert__title">{messages.trash.errorTitle}</h2>
          <p>{messages.trash.errorDescription}</p>
          <div className="wc-alert__actions">
            <Button
              variant="secondary"
              onClick={() => {
                void reloadGroups(TRASH_GROUPS);
              }}
            >
              {messages.trash.retry}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="wc-page wc-page--trash">
      <div className="wc-trash__toolbar">
        <p className="wc-page__lead">{messages.trash.lead}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setEmptyResult(null);
            setEmptyError(null);
            setEmptyOpen(true);
          }}
        >
          {messages.trash.emptyAction}
        </Button>
      </div>

      {allLoading ? (
        <p className="wc-visually-hidden" role="status">
          {messages.trash.loading}
        </p>
      ) : null}

      {allEmpty ? (
        <div
          className="wc-trash__empty"
          id="wc-trash-empty-global"
          tabIndex={-1}
        >
          <EmptyState
            title={messages.trash.empty.title}
            description={messages.trash.empty.description}
            headingLevel={2}
          />
        </div>
      ) : (
        TRASH_GROUPS.map((group) => {
          const state = groups[group];
          const title = groupTitle(group);

          return (
            <section
              key={group}
              className="wc-trash-group"
              data-trash-group={group}
              aria-labelledby={`wc-trash-group-${group}-title`}
              aria-busy={state.status === 'loading' ? true : undefined}
            >
              <h2
                className="wc-trash-group__title"
                id={`wc-trash-group-${group}-title`}
                tabIndex={-1}
              >
                {title}
              </h2>

              {state.status === 'loading' ? (
                renderSkeletons()
              ) : state.status === 'error' ? (
                <div className="wc-alert wc-alert--inline" role="alert">
                  <p>{groupLoadError(group)}</p>
                  <div className="wc-alert__actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void fetchGroup(group, { mode: 'initial' });
                      }}
                    >
                      {messages.trash.retry}
                    </Button>
                  </div>
                </div>
              ) : state.items.length === 0 ? (
                <p
                  className="wc-trash-group__empty"
                  id={`wc-trash-group-${group}-empty`}
                  tabIndex={-1}
                >
                  {groupEmpty(group)}
                </p>
              ) : (
                <ul className="wc-trash-list">
                  {state.items.map((item) => (
                    <TrashRow
                      key={rowKey(item)}
                      item={item}
                      pending={busyId === item.id}
                      notice={rowErrors[rowKey(item)]}
                      onRestore={() => {
                        void handleRestore(item);
                      }}
                      onPurge={() => {
                        setPurgeError(null);
                        setPurgeItem(item);
                      }}
                    />
                  ))}
                </ul>
              )}

              {state.nextCursor === null ? null : (
                <div className="wc-trash-group__more">
                  <Button
                    ref={(element) => {
                      moreRefs.current[group] = element;
                    }}
                    variant="ghost"
                    size="sm"
                    loading={state.loadingMore}
                    onClick={() => {
                      void fetchGroup(group, {
                        mode: 'more',
                        cursor: state.nextCursor,
                      });
                    }}
                  >
                    {messages.trash.loadMore}
                  </Button>
                  {state.moreError ? (
                    <p className="wc-field__error" role="alert">
                      {groupLoadError(group)}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          );
        })
      )}

      <p className="wc-visually-hidden" aria-live="polite">
        {liveMessage}
      </p>

      <TrashPurgeDialog
        item={purgeItem}
        open={purgeItem !== null}
        pending={purgePending}
        error={purgeError}
        onClose={() => {
          if (!purgePending) {
            setPurgeItem(null);
            setPurgeError(null);
          }
        }}
        onConfirm={() => {
          void handlePurgeConfirm();
        }}
      />

      <TrashEmptyDialog
        open={emptyOpen}
        pending={emptyPending}
        error={emptyError}
        result={emptyResult}
        onClose={() => {
          if (!emptyPending) {
            setEmptyOpen(false);
            setEmptyResult(null);
            setEmptyError(null);
          }
        }}
        onConfirm={() => {
          void handleEmptyConfirm();
        }}
      />
    </div>
  );
}
