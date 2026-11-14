import { LoaderCircle } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import { t } from '@/messages';

/**
 * Estado de carga de las rutas.
 *
 * El texto es visible (no solo un icono), va en un `role="status"` para que se
 * anuncie y respeta `prefers-reduced-motion`.
 */
export default function Loading() {
  return (
    <PageShell>
      <div
        role="status"
        className="flex items-center gap-3 text-muted-foreground"
      >
        <LoaderCircle
          aria-hidden
          className="size-5 animate-spin motion-reduce:animate-none"
        />
        <p>{t('loading.label')}</p>
      </div>
    </PageShell>
  );
}
