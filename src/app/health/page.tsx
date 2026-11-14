import { CircleCheck } from 'lucide-react';
import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { serverEnv } from '@/lib/env/server';
import { t } from '@/messages';

// La comprobación se renderiza en cada petición: no se cachea un estado viejo.
export const dynamic = 'force-dynamic';

export default function HealthPage() {
  const commitSha = serverEnv.VERCEL_GIT_COMMIT_SHA;
  const commit = commitSha ? commitSha.slice(0, 7) : t('health.commitUnknown');
  const checkedAt = new Date().toISOString();

  return (
    <PageShell className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t('health.title')}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('health.description')}</p>

      <div className="mt-8 flex items-start gap-3 rounded-lg border bg-surface-raised p-6">
        {/* El estado no se comunica solo con color: icono + texto. */}
        <CircleCheck
          aria-hidden
          className="mt-0.5 size-6 shrink-0 text-accent"
        />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">
            {t('health.statusOk')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t('health.statusOkDescription')}
          </p>
        </div>
      </div>

      <dl className="mt-8 space-y-4 text-sm">
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
          <dd className="min-w-0 break-all font-mono">{checkedAt}</dd>
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
