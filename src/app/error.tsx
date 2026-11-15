'use client';

import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { PublicShell } from '@/components/shell/public-shell';
import { Button } from '@/components/ui/button';
import { t } from '@/messages';

type ErrorPageProps = {
  /** Next.js lo pasa, pero no se muestra: puede filtrar detalles internos. */
  error: Error & { digest?: string };
  /** Reintenta el render del segmento que ha fallado. */
  reset: () => void;
};

/**
 * Frontera de error del layout raíz.
 *
 * Sustituye al contenido, así que monta el shell público completo: sin él la
 * pantalla se quedaría sin cabecera, sin pie y sin `main`, y el enlace de
 * salto dejaría de tener destino.
 */
export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <PublicShell>
      <PageShell className="max-w-xl">
        <h1 className="min-w-0 font-display text-display-lg tracking-display text-foreground">
          {t('error.title')}
        </h1>
        <p className="mt-3 min-w-0 text-muted-foreground">
          {t('error.description')}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>{t('error.retry')}</Button>
          <Button asChild variant="outline">
            <Link href="/">{t('error.backHome')}</Link>
          </Button>
        </div>
      </PageShell>
    </PublicShell>
  );
}
