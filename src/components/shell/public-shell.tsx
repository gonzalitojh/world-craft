import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { Topbar } from '@/components/shell/topbar';

/**
 * Shell de la web pública.
 *
 * Conserva los landmarks que ya probaban los E2E —`banner`, `main` y
 * `contentinfo`— y el `id="contenido"` que usa el enlace de salto. La cabecera
 * y el pie viven aquí y no en el layout raíz para que el espacio de trabajo
 * pueda tener su propio chrome sin duplicar el documento.
 */
type PublicShellProps = {
  children: ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar variant="public" />
      <main id="contenido" tabIndex={-1} className="min-w-0 flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
