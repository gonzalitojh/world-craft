'use client';

import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { t } from '@/messages';

type ErrorPageProps = {
  /** Next.js lo pasa, pero no se muestra: puede filtrar detalles internos. */
  error: Error & { digest?: string };
  /** Reintenta el render del segmento que ha fallado. */
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <PageShell className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t('error.title')}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('error.description')}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>{t('error.retry')}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t('error.backHome')}</Link>
        </Button>
      </div>
    </PageShell>
  );
}
