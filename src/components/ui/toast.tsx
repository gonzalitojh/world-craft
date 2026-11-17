'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  X,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useI18n } from '@/components/i18n/locale-provider';
import { cn } from '@/lib/utils';

/**
 * Avisos efímeros propios (sin sonner ni Radix Toast).
 *
 * Por qué a mano: la aplicación necesita dos cosas que las librerías resuelven
 * de forma sorprendente —dos regiones `aria-live` persistentes en el documento
 * y avisos que se pausan al pasar el ratón o al enfocar— y ninguna de las dos
 * justifica una dependencia más.
 *
 * Reglas de accesibilidad que implementa:
 *
 * 1. Las dos regiones (`polite` y `assertive`) se pintan siempre, vacías al
 *    principio: un lector de pantalla solo anuncia cambios en regiones que ya
 *    existían cuando el cambio ocurrió.
 * 2. Los avisos individuales **no llevan `role`**: el anuncio lo hace la
 *    región. Poner `role="status"` o `role="alert"` dentro de una región viva
 *    provoca doble anuncio.
 * 3. Cada aviso combina icono y texto; el color nunca es la única información.
 * 4. La entrada se anima en `motion.css` dentro de `prefers-reduced-motion:
 *    no-preference`, así que con movimiento reducido aparece sin animación.
 *
 * Comportamiento de tiempo: `info` y `success` duran 6 s, `warning` 10 s y
 * `error` no se cierra solo. Al pausar se cancela el temporizador y al reanudar
 * se vuelve a contar el tiempo completo, que es predecible y evita que un aviso
 * desaparezca a los pocos milisegundos de reanudar.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milisegundos antes de cerrarse; `null` lo deja fijo hasta cerrarlo. */
  duration?: number | null;
};

type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number | null;
};

type ToastContextValue = {
  /** Encola un aviso y devuelve su identificador para poder cerrarlo. */
  toast: (options: ToastOptions) => string;
  /** Cierra un aviso concreto. */
  dismiss: (id: string) => void;
};

/** Avisos simultáneos. Más de tres tapan la pantalla y saturan el anuncio. */
const MAX_VISIBLE = 3;

const DEFAULT_DURATIONS: Record<ToastVariant, number | null> = {
  info: 6_000,
  success: 6_000,
  warning: 10_000,
  error: null,
};

/** Borde izquierdo de cada variante: el refuerzo visual, nunca el único. */
const TONE_EDGE: Record<ToastVariant, string> = {
  info: 'border-l-info',
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-danger',
};

const TONE_ICON: Record<ToastVariant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const className = cn('mt-0.5 size-5 shrink-0', TONE_ICON[variant]);

  switch (variant) {
    case 'success':
      return <CheckCircle2 aria-hidden="true" className={className} />;
    case 'warning':
      return <AlertTriangle aria-hidden="true" className={className} />;
    case 'error':
      return <OctagonAlert aria-hidden="true" className={className} />;
    case 'info':
      return <Info aria-hidden="true" className={className} />;
  }
}

type ToastItemProps = {
  record: ToastRecord;
  onDismiss: (id: string) => void;
};

function ToastItem({ record, onDismiss }: ToastItemProps) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const { id, title, description, variant, duration } = record;

  useEffect(() => {
    if (duration === null || paused) {
      return;
    }

    const timer = window.setTimeout(() => onDismiss(id), duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, paused, id, onDismiss]);

  return (
    <div
      data-slot="toast"
      data-state="open"
      className={cn(
        'pointer-events-auto flex w-full min-w-0 items-start gap-3 rounded-lg border border-l-4 border-border bg-surface-raised p-3 shadow-card',
        TONE_EDGE[variant],
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <ToastIcon variant={variant} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="min-w-0 text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="min-w-0 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label={t('a11y.dismissToast')}
        className="-m-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color,border-color] hover:bg-foreground/5 hover:text-foreground"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((record) => record.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const variant = options.variant ?? 'info';
    const record: ToastRecord = {
      id: `toast-${counter.current}`,
      title: options.title,
      variant,
      duration:
        options.duration === undefined
          ? DEFAULT_DURATIONS[variant]
          : options.duration,
    };

    if (options.description !== undefined) {
      record.description = options.description;
    }

    setToasts((current) => [...current, record].slice(-MAX_VISIBLE));

    return record.id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss],
  );

  const polite = toasts.filter((record) => record.variant !== 'error');
  const assertive = toasts.filter((record) => record.variant === 'error');

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        data-slot="toast-region"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-toast) flex flex-col gap-2 p-4 sm:left-auto sm:w-96 sm:max-w-[calc(100%-2rem)]"
      >
        <div
          role="region"
          aria-label={t('toast.regionPolite')}
          aria-live="polite"
          aria-atomic="false"
          className="flex flex-col gap-2"
        >
          {polite.map((record) => (
            <ToastItem key={record.id} record={record} onDismiss={dismiss} />
          ))}
        </div>
        <div
          role="region"
          aria-label={t('toast.regionAssertive')}
          aria-live="assertive"
          aria-atomic="false"
          className="flex flex-col gap-2"
        >
          {assertive.map((record) => (
            <ToastItem key={record.id} record={record} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/** Acceso a los avisos. Falla si se usa fuera de `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  }

  return value;
}
