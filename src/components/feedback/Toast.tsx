import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  message: React.ReactNode;
  kind?: ToastKind;
  action?: ToastAction;
  /** Auto-dismiss delay in ms (default 6000). Use 0 to keep until dismissed. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'kind' | 'duration'>> {
  id: string;
  message: React.ReactNode;
  action?: ToastAction;
}

export interface ToastApi {
  showToast: (opts: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ToastListContext = createContext<ToastItem[]>([]);

const MAX_TOASTS = 4;
let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    toastCounter += 1;
    const id = `toast-${Date.now()}-${toastCounter}`;
    const item: ToastItem = {
      id,
      message: opts.message,
      kind: opts.kind ?? 'info',
      action: opts.action,
      duration: opts.duration ?? 6000,
    };
    setToasts((list) => [...list, item].slice(-MAX_TOASTS));
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={api}>
      <ToastListContext.Provider value={toasts}>{children}</ToastListContext.Provider>
    </ToastContext.Provider>
  );
};

/** Global toast API. Must be used inside `LabProvider` (which mounts `ToastProvider`). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  error: 'border-rose-500/50 bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  warning: 'border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  info: 'border-sky-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
};

const ToastCard: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
  dismissLabel: string;
}> = ({ toast, onDismiss, dismissLabel }) => {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration);
  const startRef = useRef(0);

  useEffect(() => {
    if (toast.duration <= 0 || paused) return;
    startRef.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(800, remainingRef.current - (Date.now() - startRef.current));
    };
  }, [paused, toast.duration, toast.id, onDismiss]);

  return (
    <li
      className={`siglab-toast pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg ${KIND_STYLES[toast.kind]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss(toast.id);
      }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold"
      >
        {KIND_ICON[toast.kind]}
      </span>
      <div className="min-w-0 flex-1 leading-snug">{toast.message}</div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction();
            onDismiss(toast.id);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-sm font-bold underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={dismissLabel}
        className="shrink-0 rounded-md px-1.5 text-base leading-none opacity-70 hover:opacity-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
};

/**
 * Renders active toasts. Live regions are always mounted so screen readers
 * announce additions reliably: non-errors via role="status" (polite), errors
 * via role="alert".
 */
export const ToastViewport: React.FC<{ lang?: 'en' | 'fa' }> = ({ lang = 'en' }) => {
  const toasts = useContext(ToastListContext);
  const api = useContext(ToastContext);
  if (!api) return null;
  const dismissLabel = lang === 'fa' ? 'بستن اعلان' : 'Dismiss notification';
  const polite = toasts.filter((t) => t.kind !== 'error');
  const assertive = toasts.filter((t) => t.kind === 'error');

  return (
    <div
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className="pointer-events-none fixed bottom-4 start-4 end-4 z-[1000] flex flex-col items-stretch gap-2 sm:start-auto sm:w-96"
    >
      <style>{`
        @keyframes siglab-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: no-preference) { .siglab-toast { animation: siglab-toast-in 160ms ease-out; } }
      `}</style>
      <ol role="alert" aria-live="assertive" className="m-0 flex list-none flex-col gap-2 p-0">
        {assertive.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={api.dismissToast} dismissLabel={dismissLabel} />
        ))}
      </ol>
      <ol role="status" aria-live="polite" className="m-0 flex list-none flex-col gap-2 p-0">
        {polite.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={api.dismissToast} dismissLabel={dismissLabel} />
        ))}
      </ol>
    </div>
  );
};
