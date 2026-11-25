/**
 * Diálogo presentacional de exportación e importación.
 *
 * Recibe la máquina de estados y las acciones del hook; no conoce el preload.
 * El diálogo permanece montado para que `Dialog` restaure el foco al
 * disparador cuando se cierra.
 */
import type { ReactNode } from 'react';

import { useI18n } from '../../i18n/provider';
import {
  hasTransferWarnings,
  isTransferRetryable,
  type TransferDialogState,
} from '../../transfer/state';
import { Badge, type BadgeTone } from '../badge';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { TransferProgress } from './transfer-progress';
import { TransferSummary } from './transfer-summary';

export interface WorldTransferDialogProps {
  readonly state: TransferDialogState;
  readonly onClose: () => void;
  readonly onCancel: () => void;
  readonly onRetry: () => void;
  readonly onOpenWorld: (worldId: string) => void;
}

interface BadgeInfo {
  readonly tone: BadgeTone;
  readonly label: string;
}

function badgeFor(
  state: TransferDialogState,
  messages: ReturnType<typeof useI18n>['messages'],
): BadgeInfo | null {
  if (state.status === 'running') {
    return {
      tone: 'accent',
      label: messages.transfer.status.running,
    };
  }

  if (state.status === 'cancelling') {
    return {
      tone: 'neutral',
      label: messages.transfer.status.cancelling,
    };
  }

  if (state.status === 'exported' || state.status === 'imported') {
    return {
      tone: hasTransferWarnings(state.result) ? 'warning' : 'success',
      label: hasTransferWarnings(state.result)
        ? messages.transfer.status.successWithWarnings
        : messages.transfer.status.success,
    };
  }

  if (state.status === 'failed') {
    return {
      tone: 'danger',
      label: messages.transfer.status.error,
    };
  }

  return null;
}

/** Diálogo de progreso, éxito o error. */
export function WorldTransferDialog({
  state,
  onClose,
  onCancel,
  onRetry,
  onOpenWorld,
}: WorldTransferDialogProps) {
  const { messages } = useI18n();
  const open = state.status !== 'closed';
  const retrying = state.status === 'failed' && state.retrying;
  const retryable =
    state.status === 'failed' && isTransferRetryable(state.code);
  const dismissible =
    state.status !== 'running' && state.status !== 'cancelling' && !retrying;
  const focusKey =
    state.status === 'running'
      ? `running:${String(state.cancelable)}`
      : state.status === 'failed'
        ? `failed:${String(state.retrying)}`
        : state.status;
  const badge = badgeFor(state, messages);
  const title =
    state.status === 'exported'
      ? messages.transfer.titles.exported
      : state.status === 'imported'
        ? messages.transfer.titles.imported
        : state.status === 'failed'
          ? state.operation === 'export'
            ? messages.transfer.titles.exportFailed
            : messages.transfer.titles.importFailed
          : state.status === 'running' || state.status === 'cancelling'
            ? state.operation === 'export'
              ? messages.transfer.titles.exporting
              : messages.transfer.titles.importing
            : messages.transfer.titles.exporting;

  let body: ReactNode = null;
  let actions: ReactNode = null;

  if (state.status === 'running' || state.status === 'cancelling') {
    body = (
      <TransferProgress
        operation={state.operation}
        phase={state.phase}
        completed={state.completed}
        total={state.total}
        unit={state.unit}
        cancelable={state.status === 'running' && state.cancelable}
        cancelError={state.status === 'running' && state.cancelError}
        cancelling={state.status === 'cancelling'}
      />
    );

    if (state.status === 'running' && state.cancelable) {
      actions = (
        <Button variant="secondary" data-autofocus onClick={onCancel}>
          {messages.transfer.actions.cancel}
        </Button>
      );
    } else if (state.status === 'cancelling') {
      actions = (
        <Button variant="secondary" loading disabled>
          {messages.transfer.actions.cancelling}
        </Button>
      );
    }
  } else if (state.status === 'exported') {
    body = <TransferSummary kind="exported" result={state.result} />;
    actions = (
      <Button variant="secondary" data-autofocus onClick={onClose}>
        {messages.components.dialog.close}
      </Button>
    );
  } else if (state.status === 'imported') {
    body = <TransferSummary kind="imported" result={state.result} />;
    actions = (
      <>
        <Button variant="secondary" onClick={onClose}>
          {messages.components.dialog.close}
        </Button>
        <Button
          variant="primary"
          data-autofocus
          onClick={() => {
            onOpenWorld(state.result.worldId);
          }}
        >
          {messages.transfer.actions.openWorld}
        </Button>
      </>
    );
  } else if (state.status === 'failed') {
    body = (
      <TransferSummary
        kind="failed"
        operation={state.operation}
        code={state.code}
      />
    );
    actions = (
      <>
        <Button
          variant="secondary"
          disabled={state.retrying}
          data-autofocus={retryable ? undefined : true}
          onClick={onClose}
        >
          {messages.components.dialog.close}
        </Button>
        {retryable ? (
          <Button
            variant="primary"
            loading={state.retrying}
            data-autofocus
            onClick={onRetry}
          >
            {messages.transfer.actions.retry}
          </Button>
        ) : null}
      </>
    );
  }

  const context =
    (state.status === 'running' ||
      state.status === 'cancelling' ||
      state.status === 'failed') &&
    state.operation === 'export' &&
    state.worldName !== null ? (
      <span className="wc-transfer__context">{state.worldName}</span>
    ) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="wc-transfer"
      dismissible={dismissible}
      focusKey={focusKey}
      actions={actions ?? undefined}
    >
      <div
        className="wc-transfer__status"
        data-autofocus={retrying ? true : undefined}
        tabIndex={retrying ? -1 : undefined}
      >
        {badge === null ? null : <Badge tone={badge.tone}>{badge.label}</Badge>}
        {context}
      </div>
      {body}
    </Dialog>
  );
}
