import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { t } from '@/messages';

export default function NotFound() {
  return (
    <PageShell className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t('notFound.title')}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('notFound.description')}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t('notFound.backHome')}</Link>
      </Button>
    </PageShell>
  );
}
