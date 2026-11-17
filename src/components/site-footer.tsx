'use client';

import Link from 'next/link';

import { useI18n } from '@/components/i18n/locale-provider';

/** Pie de la web pública: privacidad, licencia y acceso al estado técnico. */
export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-(--content-max) min-w-0 flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <p className="max-w-(--prose-max) min-w-0">{t('footer.note')}</p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
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
