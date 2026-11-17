import Link from 'next/link';

import { PageShell } from '@/components/page-shell';
import { PublicShell } from '@/components/shell/public-shell';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/lib/i18n/server';

/**
 * Página 404.
 *
 * Se envuelve con el shell público porque el layout raíz ya no pinta cabecera
 * ni pie: una ruta inexistente también debe tener navegación y salida.
 */
export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <PublicShell>
      <PageShell className="max-w-xl">
        <h1 className="min-w-0 font-display text-display-lg tracking-display text-foreground">
          {t('notFound.title')}
        </h1>
        <p className="mt-3 min-w-0 text-muted-foreground">
          {t('notFound.description')}
        </p>
        <Button asChild className="mt-8">
          <Link href="/">{t('notFound.backHome')}</Link>
        </Button>
      </PageShell>
    </PublicShell>
  );
}
