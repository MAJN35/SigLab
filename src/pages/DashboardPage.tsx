import React from 'react';
import { ArrowRight, GraduationCap, Play, Sparkles } from 'lucide-react';
import {
  LEARNING_PATH,
  NavItem,
  getGroupedNav,
  getNavItem,
  navDescription,
  navLabel,
} from '../config/navigation';
import { useLab } from '../store/LabContext';
import { EDUCATIONAL_PRESETS, EducationalPreset } from '../store/presets';
import { PageId } from '../types';

/** Overview groups exclude the Overview page itself. */
const MODULE_GROUPS = getGroupedNav()
  .map(({ group, items }) => ({ group, items: items.filter((i) => i.id !== 'dashboard') }))
  .filter((g) => g.items.length > 0);

const CATEGORY_LABELS: Record<EducationalPreset['category'], { en: string; fa: string }> = {
  Telecommunications: { en: 'Communications', fa: 'مخابرات' },
  'Signal Processing': { en: 'Signal processing', fa: 'پردازش سیگنال' },
  EEG: { en: 'EEG', fa: 'EEG' },
  'Machine Learning': { en: 'Machine learning', fa: 'یادگیری ماشین' },
};

/** Works whether or not the optional FA fields exist on the preset type. */
type LocalizablePreset = EducationalPreset & { faTitle?: string; faDescription?: string };
const presetTitle = (p: EducationalPreset, lang: 'en' | 'fa') =>
  lang === 'fa' ? ((p as LocalizablePreset).faTitle ?? p.title) : p.title;
const presetDescription = (p: EducationalPreset, lang: 'en' | 'fa') =>
  lang === 'fa' ? ((p as LocalizablePreset).faDescription ?? p.description) : p.description;

const isModifiedClick = (e: React.MouseEvent) =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export const DashboardPage: React.FC = () => {
  const { setActivePage, applyEducationalPreset, lang } = useLab();
  const isFa = lang === 'fa';

  /** In-app navigation that keeps real `#/page` hrefs (open-in-new-tab still works). */
  const linkProps = (id: PageId) => ({
    href: `#/${id}`,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(e)) return;
      e.preventDefault();
      setActivePage(id);
    },
  });

  const audio = getNavItem('audio-lab');
  const AudioIcon = audio.icon;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section aria-labelledby="overview-title" className="neu-card p-5 sm:p-7 flex flex-col gap-5">
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {isFa ? 'آزمایشگاه آموزشی پردازش سیگنال' : 'Interactive signal-processing lab'}
          </span>
          <h1 id="overview-title" className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isFa
              ? 'سیگنال‌ها را بسازید، ببینید و بشنوید'
              : 'Build, see and hear signals'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isFa
              ? 'از یک موج سینوسی ساده شروع کنید و قدم‌به‌قدم تا طیف فوریه، فیلترها، مخابرات، سیگنال‌های مغزی و یادگیری ماشین پیش بروید. همه‌چیز در مرورگر شما اجرا می‌شود.'
              : 'Start with a simple sine wave and work your way up to spectra, filters, communications, brain signals and machine learning. Everything runs in your browser.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            {...linkProps(LEARNING_PATH[0].id)}
            className="btn-tool-pill px-4 py-2 rounded-full text-xs font-bold inline-flex items-center gap-2"
          >
            <GraduationCap aria-hidden="true" className="w-4 h-4" />
            {isFa ? 'شروع مسیر یادگیری' : 'Start the learning path'}
            <ArrowRight aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />
          </a>
          <a
            {...linkProps('audio-lab')}
            className="neu-btn px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-2"
          >
            <AudioIcon aria-hidden="true" className="w-4 h-4 text-sky-500" />
            {isFa ? 'باز کردن صوت و طیف‌نگار' : 'Open Audio & Spectrogram'}
          </a>
        </div>
      </section>

      {/* Start here: Fundamentals learning path */}
      <section aria-labelledby="learning-path-title" className="neu-card p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="learning-path-title" className="text-base font-bold tracking-tight">
            {isFa ? 'از اینجا شروع کنید' : 'Start here'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isFa
              ? 'چهار گام مبانی به ترتیب پیشنهادی؛ هر گام بر پایه گام قبلی است.'
              : 'Four fundamentals in the recommended order — each step builds on the one before.'}
          </p>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LEARNING_PATH.map((item, idx) => (
            <li key={item.id} className="flex">
              <a
                {...linkProps(item.id)}
                className="neu-tile w-full p-3.5 rounded-xl flex flex-col gap-2 text-start"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="w-6 h-6 rounded-full border border-sky-500/60 text-sky-600 dark:text-sky-400 text-[11px] font-mono font-bold inline-flex items-center justify-center shrink-0"
                  >
                    {(idx + 1).toLocaleString(isFa ? 'fa-IR' : 'en-US')}
                  </span>
                  <span className="text-xs font-bold leading-snug">
                    <span className="sr-only">
                      {isFa ? `گام ${idx + 1}: ` : `Step ${idx + 1}: `}
                    </span>
                    {navLabel(item, lang)}
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {navDescription(item, lang)}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* All modules, grouped like the drawer */}
      <section aria-labelledby="all-modules-title" className="neu-card p-5 sm:p-6 flex flex-col gap-5">
        <h2 id="all-modules-title" className="text-base font-bold tracking-tight">
          {isFa ? 'همه آزمایشگاه‌ها' : 'All labs'}
        </h2>
        {MODULE_GROUPS.map(({ group, items }) => (
          <div key={group.id} className="flex flex-col gap-2.5">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              {navLabel(group, lang)}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item: NavItem) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} className="flex">
                    <a
                      {...linkProps(item.id)}
                      className="neu-tile w-full p-3.5 rounded-xl flex items-start gap-3 text-start"
                    >
                      <Icon aria-hidden="true" className="w-4 h-4 mt-0.5 text-sky-500 shrink-0" />
                      <span className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-bold leading-snug">{navLabel(item, lang)}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {navDescription(item, lang)}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* Guided labs: ready-made educational presets */}
      <section aria-labelledby="guided-labs-title" className="neu-card p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 id="guided-labs-title" className="text-base font-bold tracking-tight flex items-center gap-2">
              <Sparkles aria-hidden="true" className="w-4 h-4 text-sky-500" />
              {isFa ? 'آزمایش‌های راهنما' : 'Guided labs'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFa
                ? 'یک سناریوی آماده را اجرا کنید؛ تنظیمات بارگذاری می‌شود و آزمایشگاه مربوط باز می‌شود.'
                : 'Launch a ready-made scenario — settings are loaded and the right lab opens.'}
            </p>
          </div>
          <a
            {...linkProps('experiments')}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
          >
            {isFa ? 'مدیریت آزمایش‌ها' : 'Manage experiments'}
            <ArrowRight aria-hidden="true" className="w-3.5 h-3.5 rtl:-scale-x-100" />
          </a>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EDUCATIONAL_PRESETS.map((preset) => {
            const target = getNavItem(preset.targetPage);
            const title = presetTitle(preset, lang);
            return (
              <li key={preset.id} className="neu-inset p-3.5 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {isFa ? CATEGORY_LABELS[preset.category]?.fa : CATEGORY_LABELS[preset.category]?.en}
                    {' · '}
                    {navLabel(target, lang)}
                  </span>
                  <span className="text-xs font-bold">{title}</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {presetDescription(preset, lang)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyEducationalPreset(preset)}
                  aria-label={isFa ? `اجرای «${title}»` : `Launch “${title}”`}
                  className="neu-btn py-1.5 px-3 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 self-start inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play aria-hidden="true" className="w-3 h-3 rtl:-scale-x-100" />
                  {isFa ? 'اجرا' : 'Launch'}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
