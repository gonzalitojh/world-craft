import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { getMessages, t } from '@/messages';

export default function HomePage() {
  const messages = getMessages();

  return (
    <PageShell>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {t('home.eyebrow')}
      </p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
        {t('home.title')}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        {t('home.description')}
      </p>
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap">
        <Button asChild>
          <Link href="/login">{t('home.primaryAction')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/health">{t('home.secondaryAction')}</Link>
        </Button>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        {t('home.privateNote')}
      </p>

      <section aria-labelledby="pilares" className="mt-12 border-t pt-8">
        <h2
          id="pilares"
          className="font-display text-2xl font-semibold tracking-tight"
        >
          {t('home.pillarsTitle')}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {messages.home.pillars.map((pillar) => (
            <li key={pillar.title} className="min-w-0">
              <h3 className="break-words font-display text-lg font-semibold">
                {pillar.title}
              </h3>
              <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
                {pillar.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
