import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MANUAL_VERSION_MAX,
  VERSION_LABEL_MAX_LENGTH,
  type EntityVersionSummary,
  type VersionOrigin,
} from '../../../shared/contracts/versions';
import { Badge, type BadgeTone } from '../badge';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { DisclosureSection } from '../disclosure-section';
import { Skeleton, SkeletonText } from '../skeleton';
import { TextField } from '../text-field';
import { useI18n } from '../../i18n/provider';

export interface EntityHistorySectionProps {
  readonly worldId: string;
  readonly entityId: string;
  /** La descripción está vacía: no se ofrece guardar una versión. */
  readonly descriptionEmpty: boolean;
  /** Cambia cuando la ficha se recarga desde la página. */
  readonly refreshToken: number;
  /** Fuerza el autoguardado pendiente antes de abrir un diálogo. */
  readonly onBeforeAction: () => Promise<boolean>;
  /** La ficha cambió en el servidor (restauración) y debe recargarse. */
  readonly onEntityChanged: () => void;
  readonly onNotify: (tone: 'success' | 'error', message: string) => void;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const ORIGIN_TONES: Readonly<Record<VersionOrigin, BadgeTone>> = {
  auto: 'neutral',
  manual: 'accent',
  restore: 'warning',
};

/** Historial de versiones de la descripción dentro de la ficha. */
export function EntityHistorySection({
  worldId,
  entityId,
  descriptionEmpty,
  refreshToken,
  onBeforeAction,
  onEntityChanged,
  onNotify,
}: EntityHistorySectionProps) {
  const { messages, formats } = useI18n();
  const api = window.worldCraft.versions;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [versions, setVersions] = useState<readonly EntityVersionSummary[]>([]);
  const [loadToken, setLoadToken] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openingSave, setOpeningSave] = useState(false);
  const [restoreTarget, setRestoreTarget] =
    useState<EntityVersionSummary | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const manualCount = versions.filter(
    (version) => version.origin === 'manual',
  ).length;
  const canSave = !descriptionEmpty && manualCount < MANUAL_VERSION_MAX;

  const load = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;
    setStatus('loading');
    const result = await api.list({ worldId, entityId, limit: 200 });

    if (request !== requestRef.current) {
      return;
    }

    if (!result.ok) {
      setStatus('error');
      return;
    }

    setVersions(result.data);
    setStatus('ready');
  }, [api, entityId, worldId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load, loadToken, open, refreshToken]);

  const requestOpen = async (action: () => void): Promise<void> => {
    if (openingSave) {
      return;
    }

    setOpeningSave(true);
    const saved = await onBeforeAction();
    setOpeningSave(false);

    if (saved) {
      action();
    }
  };

  const submitSave = async (): Promise<void> => {
    if (saving) {
      return;
    }

    const label = saveLabel.trim();

    if (label.length === 0) {
      setSaveError(messages.entities.history.saveDialog.required);
      return;
    }

    setSaving(true);
    setSaveError(null);
    const result = await api.create({ worldId, entityId, label });
    setSaving(false);

    if (!result.ok) {
      setSaveError(messages.entities.history.saveDialog.error);
      return;
    }

    if (!result.data.created) {
      setSaveError(
        result.data.reason === 'manual-limit'
          ? messages.entities.history.saveDialog.limit
          : messages.entities.history.saveDialog.error,
      );
      return;
    }

    const createdVersion = result.data.version;
    setVersions((current) => [createdVersion, ...current]);
    setSaveOpen(false);
    setSaveLabel('');
    onNotify('success', messages.entities.history.saveDialog.success);
    setLoadToken((current) => current + 1);
  };

  const submitRestore = async (): Promise<void> => {
    if (restoreTarget === null || restorePending) {
      return;
    }

    setRestorePending(true);
    setRestoreError(null);
    const result = await api.restore({
      worldId,
      entityId,
      versionId: restoreTarget.id,
    });
    setRestorePending(false);

    if (!result.ok) {
      setRestoreError(messages.entities.history.restoreDialog.error);
      return;
    }

    if (!result.data.restored) {
      setRestoreError(
        result.data.reason === 'unchanged'
          ? messages.entities.history.restoreDialog.unchanged
          : messages.entities.history.restoreDialog.missing,
      );
      return;
    }

    setRestoreTarget(null);
    onNotify('success', messages.entities.history.restoreDialog.success);
    onEntityChanged();
    setLoadToken((current) => current + 1);
  };

  const title = messages.entities.history.title;
  const meta =
    status === 'ready'
      ? formats.plural(versions.length, messages.entities.history.count)
      : undefined;

  return (
    <DisclosureSection
      id="wc-entity-section-history"
      title={title}
      open={open}
      onToggle={(next) => {
        setOpen(next);
      }}
      meta={meta}
      actions={
        canSave ? (
          <Button
            variant="secondary"
            size="sm"
            loading={openingSave}
            onClick={() => {
              void requestOpen(() => {
                setSaveLabel('');
                setSaveError(null);
                setSaveOpen(true);
              });
            }}
          >
            {messages.entities.history.save}
          </Button>
        ) : undefined
      }
    >
      {descriptionEmpty ? (
        <p className="wc-history__note">
          {messages.entities.history.emptyDescription}
        </p>
      ) : !canSave ? (
        <p className="wc-history__note">
          {messages.entities.history.manualLimit}
        </p>
      ) : null}

      {status === 'loading' || status === 'idle' ? (
        <div className="wc-history__loading" aria-busy="true">
          <SkeletonText lines={3} />
          <Skeleton width="40%" height="1rem" />
        </div>
      ) : status === 'error' ? (
        <div className="wc-alert wc-alert--inline" role="alert">
          <p>{messages.entities.history.loadError}</p>
          <div className="wc-alert__actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void load();
              }}
            >
              {messages.entities.history.retry}
            </Button>
          </div>
        </div>
      ) : versions.length === 0 ? (
        <p className="wc-history__empty">{messages.entities.history.empty}</p>
      ) : (
        <ul className="wc-history-list">
          {versions.map((version) => {
            const date = formats.formatDateTime(version.createdAt);
            const preview = version.descriptionTextPreview.trim();

            return (
              <li className="wc-history-item" key={version.id}>
                <div className="wc-history-item__head">
                  <Badge tone={ORIGIN_TONES[version.origin]}>
                    {messages.entities.history.origins[version.origin]}
                  </Badge>
                  {version.label === null ? null : (
                    <span className="wc-history-item__label">
                      {version.label}
                    </span>
                  )}
                  <time
                    className="wc-history-item__date"
                    dateTime={new Date(version.createdAt).toISOString()}
                  >
                    {date}
                  </time>
                </div>
                <p className="wc-history-item__preview">
                  {preview.length === 0
                    ? messages.entities.history.previewEmpty
                    : preview}
                </p>
                <div className="wc-history-item__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={messages.entities.history.restoreNamed(
                      version.label,
                      date,
                    )}
                    onClick={() => {
                      void requestOpen(() => {
                        setRestoreError(null);
                        setRestoreTarget(version);
                      });
                    }}
                  >
                    {messages.entities.history.restore}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="wc-history__retention">
        {messages.entities.history.retention}
      </p>

      {saveOpen ? (
        <Dialog
          open
          onClose={() => {
            if (!saving) {
              setSaveOpen(false);
              setSaveError(null);
            }
          }}
          title={messages.entities.history.saveDialog.title}
          dismissible={!saving}
          actions={
            <>
              <Button
                variant="ghost"
                data-autofocus
                disabled={saving}
                onClick={() => {
                  setSaveOpen(false);
                  setSaveError(null);
                }}
              >
                {messages.entities.history.saveDialog.cancel}
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={saveLabel.trim().length === 0}
                onClick={() => {
                  void submitSave();
                }}
              >
                {messages.entities.history.saveDialog.submit}
              </Button>
            </>
          }
        >
          <p className="wc-dialog__lead">
            {messages.entities.history.saveDialog.lead}
          </p>
          <TextField
            label={messages.entities.history.saveDialog.label}
            hint={messages.entities.history.saveDialog.hint}
            error={saveError ?? undefined}
            required
            autoFocusOnOpen
            maxLength={VERSION_LABEL_MAX_LENGTH}
            value={saveLabel}
            onChange={(event) => {
              setSaveLabel(event.currentTarget.value);
              setSaveError(null);
            }}
          />
        </Dialog>
      ) : null}

      {restoreTarget !== null ? (
        <Dialog
          open
          onClose={() => {
            if (!restorePending) {
              setRestoreTarget(null);
              setRestoreError(null);
            }
          }}
          title={messages.entities.history.restoreDialog.title(
            formats.formatDateTime(restoreTarget.createdAt),
          )}
          dismissible={!restorePending}
          actions={
            <>
              <Button
                variant="ghost"
                data-autofocus
                disabled={restorePending}
                onClick={() => {
                  setRestoreTarget(null);
                  setRestoreError(null);
                }}
              >
                {messages.entities.history.restoreDialog.cancel}
              </Button>
              <Button
                variant="primary"
                loading={restorePending}
                onClick={() => {
                  void submitRestore();
                }}
              >
                {messages.entities.history.restoreDialog.submit}
              </Button>
            </>
          }
        >
          <p className="wc-dialog__lead">
            {messages.entities.history.restoreDialog.lead}
          </p>
          <div
            className="wc-history-preview"
            role="region"
            tabIndex={0}
            aria-label={messages.entities.history.restoreDialog.previewLabel}
          >
            {restoreTarget.descriptionTextPreview.trim().length === 0
              ? messages.entities.history.previewEmpty
              : restoreTarget.descriptionTextPreview}
          </div>
          {restoreError === null ? null : (
            <p className="wc-field__error" role="alert">
              {restoreError}
            </p>
          )}
        </Dialog>
      ) : null}
    </DisclosureSection>
  );
}
