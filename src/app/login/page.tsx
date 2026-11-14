import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { t } from '@/messages';

/**
 * Placeholder de acceso: no hay formulario falso.
 *
 * La autenticación real llega con M1-01 (issue #11). Se muestra un botón
 * deshabilitado junto a la explicación visible de por qué no está activo.
 */
export default function LoginPage() {
  return (
    <PageShell className="max-w-md">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t('login.title')}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('login.description')}</p>

      <div className="mt-8 rounded-lg border bg-surface-raised p-6">
        <h2 className="font-display text-xl font-semibold">
          {t('login.cardTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('login.cardBody')}
        </p>
        <Button disabled className="mt-6 w-full">
          {t('login.disabledAction')}
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('login.disabledReason')}
        </p>
      </div>

      <p className="mt-6 text-sm">
        <Link
          href="/"
          className="underline underline-offset-4 hover:text-accent"
        >
          {t('login.backHome')}
        </Link>
      </p>
    </PageShell>
  );
}
