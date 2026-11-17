import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { serverEnv } from '@/lib/env/server';
import {
  buildHealthPayload,
  probeDatabase,
  type DatabaseStatus,
} from '@/lib/health';
import { t, type MessageKey } from '@/messages';

// La comprobación se renderiza en cada petición: no se cachea un estado viejo.
export const dynamic = 'force-dynamic';

/** Presentación de cada estado de la base de datos. */
const databasePresentation: Record<
  DatabaseStatus,
  {
    description: MessageKey;
    label: MessageKey;
    icon: typeof CircleCheck;
    iconClass: string;
  }
> = {
  available: {
    label: 'health.databaseAvailable',
    description: 'health.databaseAvailableDescription',
    icon: CircleCheck,
    iconClass: 'text-success',
  },
  paused: {
    label: 'health.databasePaused',
    description: 'health.databasePausedDescription',
    icon: CircleAlert,
    iconClass: 'text-warning',
  },
  error: {
    label: 'health.databaseError',
    description: 'health.databaseErrorDescription',
    icon: TriangleAlert,
    iconClass: 'text-danger',
  },
};

export default async function HealthPage() {
  const database = await probeDatabase();
  const payload = buildHealthPayload(database);
  const available = database === 'available';
  const commitSha = serverEnv.VERCEL_GIT_COMMIT_SHA;
  const commit = commitSha ? commitSha.slice(0, 7) : t('health.commitUnknown');
  const databaseInfo = databasePresentation[database];
  const DatabaseIcon = databaseInfo.icon;

  return (
    <PageShell className="max-w-3xl">
      <h1 className="min-w-0 font-display text-display-lg tracking-display text-foreground">
        {t('health.title')}
      </h1>
      <p className="mt-3 min-w-0 text-muted-foreground">
        {t('health.description')}
      </p>

      <div className="mt-8 flex min-w-0 items-start gap-3 rounded-lg border bg-surface-raised p-6">
        {/* El estado no se comunica solo con color: icono + texto. La tarjeta
            reutiliza el mismo icono y severidad que el detalle de la base. */}
        <DatabaseIcon
          aria-hidden
          className={`mt-0.5 size-6 shrink-0 ${databaseInfo.iconClass}`}
        />
        <div className="min-w-0">
          <p className="min-w-0 font-display text-display-sm tracking-display text-foreground">
            {available ? t('health.statusOk') : t('health.statusDegraded')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {available
              ? t('health.statusOkDescription')
              : t('health.statusDegradedDescription')}
          </p>
        </div>
      </div>

      <dl className="mt-8 space-y-4 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <dt className="font-medium sm:w-32 sm:shrink-0">
            {t('health.databaseLabel')}
          </dt>
          <dd className="flex min-w-0 items-start gap-2">
            <DatabaseIcon
              aria-hidden
              className={`mt-0.5 size-4 shrink-0 ${databaseInfo.iconClass}`}
            />
            <span className="min-w-0">
              <span className="font-medium">{t(databaseInfo.label)}</span>
              <span className="mt-1 block leading-relaxed text-muted-foreground">
                {t(databaseInfo.description)}
              </span>
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <dt className="font-medium sm:w-32 sm:shrink-0">
            {t('health.commitLabel')}
          </dt>
          <dd className="min-w-0 break-all font-mono">{commit}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <dt className="font-medium sm:w-32 sm:shrink-0">
            {t('health.checkedAtLabel')}
          </dt>
          <dd className="min-w-0 break-all font-mono">{payload.timestamp}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <dt className="font-medium sm:w-32 sm:shrink-0">
            {t('health.apiLabel')}
          </dt>
          <dd className="min-w-0 break-all font-mono">
            <Link
              href="/api/health"
              className="underline underline-offset-4 hover:text-accent"
            >
              {t('health.apiLink')}
            </Link>
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-sm">
        <Link
          href="/"
          className="underline underline-offset-4 hover:text-accent"
        >
          {t('health.backHome')}
        </Link>
      </p>
    </PageShell>
  );
}
