import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une clases de Tailwind resolviendo conflictos: la última gana.
 *
 * Es el helper estándar de shadcn/ui (`cn`) y el único punto donde se combinan
 * clases condicionales con las de un componente.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
