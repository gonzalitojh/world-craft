import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { getMessages, t } from '@/messages';

export default function HomePage() {
  const messages = getMessages();

  return (
    <PageShell>
      <p className="font-mono text-eyebrow uppercase tracking-eyebrow text-muted-foreground">
        {t('home.eyebrow')}
      </p>
      <h1 className="mt-4 max-w-3xl min-w-0 font-display text-display-xl tracking-display text-foreground">
        {t('home.title')}
      </h1>
      <p className="mt-6 max-w-2xl min-w-0 text-lg leading-relaxed text-muted-foreground">
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
      <p className="mt-6 min-w-0 text-sm text-muted-foreground">
        {t('home.privateNote')}
      </p>

      <section aria-labelledby="pilares" className="mt-12 border-t pt-8">
        <h2
          id="pilares"
          className="min-w-0 font-display text-display-md tracking-display text-foreground"
        >
          {t('home.pillarsTitle')}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {messages.home.pillars.map((pillar) => (
            <li key={pillar.title} className="min-w-0">
              <h3 className="min-w-0 break-words font-display text-display-sm tracking-display text-foreground">
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
