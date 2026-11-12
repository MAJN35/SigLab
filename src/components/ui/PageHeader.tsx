import React from 'react';

export interface PageHeaderStat {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface PageHeaderProps {
  /** Page title; rendered as the page's only `<h1>`. Pass the already-localized string. */
  title: React.ReactNode;
  /** One-line (or short paragraph) description under the title. */
  subtitle?: React.ReactNode;
  /** Optional leading icon, e.g. `<Waves className="w-5 h-5" />`. Decorative. */
  icon?: React.ReactNode;
  /** Key metrics shown at the inline-end side (mono, accent values). */
  stats?: PageHeaderStat[];
  /** Buttons / toggles shown at the inline-end side, after the stats. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page title row (matches the FFT / ICA / PCA / Wavelet headers).
 * Renders the header row only — place it as the first child of the page's
 * top `neu-card` (which keeps its own `p-5 flex flex-col gap-4`).
 *
 * @example
 * <div className="neu-card p-5 flex flex-col gap-4">
 *   <PageHeader
 *     icon={<Waves className="w-5 h-5" />}
 *     title={isFa ? 'آزمایشگاه FFT' : 'FFT, PSD & STFT Laboratory'}
 *     subtitle={isFa ? '...' : 'Analyze forward FFT magnitude, phase and PSD.'}
 *     stats={[
 *       { label: isFa ? 'تفکیک‌پذیری Δf' : 'Bin Resolution Δf', value: `${df.toFixed(2)} Hz` },
 *       { label: 'IFFT RMSE', value: rmse.toExponential(2) },
 *     ]}
 *     actions={<button className="neu-btn px-3 py-1.5 text-xs">Reset</button>}
 *   />
 *   ...controls
 * </div>
 */
export function PageHeader({ title, subtitle, icon, stats, actions, className = '' }: PageHeaderProps) {
  const hasAside = (stats && stats.length > 0) || actions;
  return (
    <header className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className="neu-inset mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center text-sky-600 dark:text-sky-400"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>

      {hasAside && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {stats && stats.length > 0 && (
            <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-500 dark:text-slate-400">
              {stats.map((s, i) => (
                <div key={i} className="flex items-baseline gap-1">
                  <dt>{s.label}:</dt>
                  <dd className="m-0 font-bold text-sky-600 dark:text-sky-400">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}

export default PageHeader;
