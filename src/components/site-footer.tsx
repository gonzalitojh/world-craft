import Link from 'next/link';

import { t } from '@/messages';

/** Pie mínimo: privacidad, licencia y acceso al estado técnico. */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <p className="max-w-prose">{t('footer.note')}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{t('footer.license')}</span>
          <Link
            href="/health"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t('footer.statusLink')}
          </Link>
        </p>
      </div>
    </footer>
  );
}
