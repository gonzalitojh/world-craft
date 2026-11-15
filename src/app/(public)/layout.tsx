import type { ReactNode } from 'react';

import { PublicShell } from '@/components/shell/public-shell';

/**
 * Rutas públicas: portada, acceso y estado.
 *
 * Las URLs no cambian al vivir en un route group: `(public)` no aparece en la
 * dirección, solo organiza layouts.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
