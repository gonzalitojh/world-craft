import Link from 'next/link';

import { t } from '@/messages';

/** Cabecera mínima: marca y navegación principal. */
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label={t('a11y.brandHome')}
          className="min-w-0 rounded-sm font-display text-lg font-semibold tracking-tight"
        >
          {t('meta.applicationName')}
        </Link>
        <nav aria-label={t('a11y.mainNavigation')} className="min-w-0">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-accent">
                {t('nav.home')}
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-accent">
                {t('nav.login')}
              </Link>
            </li>
            <li>
              <Link href="/health" className="hover:text-accent">
                {t('nav.health')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
