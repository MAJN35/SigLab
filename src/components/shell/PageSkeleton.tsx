import React from 'react';

/**
 * Suspense fallback shown while a page chunk downloads.
 * Uses `motion-safe:` so the shimmer is disabled for reduced-motion users.
 */
export const PageSkeleton: React.FC<{ lang: 'en' | 'fa' }> = ({ lang }) => {
  const bar = 'rounded-full bg-slate-300/50 dark:bg-slate-700/50 motion-safe:animate-pulse';
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{lang === 'fa' ? 'در حال بارگذاری آزمایشگاه…' : 'Loading lab…'}</span>
      <div aria-hidden="true" className="rounded-[22px] border border-slate-300/40 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30 p-5 sm:p-6 flex flex-col gap-3">
        <div className={`${bar} h-3 w-24`} />
        <div className={`${bar} h-6 w-2/3 sm:w-1/2`} />
        <div className={`${bar} h-3 w-full sm:w-3/4`} />
      </div>
      <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-[22px] border border-slate-300/40 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30 p-5 flex flex-col gap-3">
          <div className={`${bar} h-3 w-32`} />
          <div className="h-56 rounded-xl bg-slate-300/40 dark:bg-slate-700/40 motion-safe:animate-pulse" />
        </div>
        <div className="rounded-[22px] border border-slate-300/40 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30 p-5 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`${bar} h-3`} style={{ width: `${90 - i * 12}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
};
