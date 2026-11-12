import React, { useEffect, useId, useRef } from 'react';
import { BookOpen, Lightbulb, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLab } from '../store/LabContext';

/* ------------------------------------------------------------------ */
/* Public, reusable content model                                      */
/* ------------------------------------------------------------------ */

export type GuideTone = 'sky' | 'emerald' | 'amber' | 'violet';

export interface GuideStep {
  title: string;
  desc: string;
}

export interface GuideCard {
  title: string;
  /** Short highlighted value shown next to the title (e.g. a frequency range). */
  badge?: string;
  desc: string;
  /** When set and `onSelectPreset` is provided, a "Try this" button is rendered. */
  preset?: string;
}

interface GuideSectionBase {
  heading: string;
  tone?: GuideTone;
}

export type GuideSection =
  | (GuideSectionBase & { kind: 'steps'; steps: GuideStep[] })
  | (GuideSectionBase & { kind: 'cards'; cards: GuideCard[] })
  | (GuideSectionBase & { kind: 'custom'; content: React.ReactNode });

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with a card's `preset` key when the user presses its "Try this" button. */
  onSelectPreset?: (presetKey: string) => void;
  /** Dialog title. Defaults to the audio-lab guide title (localized). */
  title?: string;
  /** Short line under the title. */
  subtitle?: string;
  /** Guide body. Defaults to the audio-spectrogram guide content (localized). */
  sections?: GuideSection[];
  /** Show the "Detailed Math & Formulas" link to the documentation page. Default true. */
  showDocsLink?: boolean;
  /** Label of the primary dismiss button. */
  confirmLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Default (audio spectrogram) content                                 */
/* ------------------------------------------------------------------ */

const getDefaultAudioSections = (lang: string): GuideSection[] =>
  lang === 'fa'
    ? [
        {
          kind: 'steps',
          tone: 'sky',
          heading: '۳ قدم ساده برای شروع',
          steps: [
            {
              title: 'یک سیگنال انتخاب کنید یا دکمه پخش را بزنید',
              desc: 'از منوی شکل‌موج‌ها یا پیش‌تنظیم‌های سریع (مانند ۲۰ هرتز، ۱ کیلوهرتز یا نویز)، یک صدا را انتخاب کنید و روی دکمه پخش (Play) بزنید تا صدا و نمایش زنده شروع شود.',
            },
            {
              title: 'روی طیف‌نگار کلیک کنید تا فرکانس را بشنوید',
              desc: 'طیف‌نگار نشان می‌دهد چه فرکانس‌هایی در چه زمانی وجود دارند. روی هر نقطه کلیک یا لمس کنید تا بلافاصله همان فرکانس سنتز و پخش شود.',
            },
            {
              title: 'از حالت چندسیگنال یا بازه فرکانسی لذت ببرید',
              desc: 'با حالت «چندسیگنال» می‌توانید چند فرکانس دلخواه را علامت بزنید و همه را با هم (آکورد) یا پشت‌سرهم بنوازید. همچنین با «میکروفون» صدای محیط را زنده ببینید.',
            },
          ],
        },
        {
          kind: 'cards',
          tone: 'emerald',
          heading: 'نقشه فرکانس‌های شنوایی انسان',
          cards: [
            { title: 'بیس عمیق (Sub-Bass)', badge: '۱۰ تا ۶۰ هرتز', desc: 'لرزش‌های بم؛ بیشتر احساس می‌شود تا شنیده شود.', preset: '20hz' },
            { title: 'بیس معمولی (Bass)', badge: '۶۰ تا ۲۵۰ هرتز', desc: 'فرکانس‌های صدای بم و گیتار باس.', preset: '100hz' },
            { title: 'محدوده میانی (Mids)', badge: '۲۵۰ تا ۲ کیلوهرتز', desc: 'صدای گفتار انسان و سازهای ملودیک.', preset: '1khz' },
            { title: 'تریبل و وضوح (Highs)', badge: '۲ تا ۲۰ کیلوهرتز', desc: 'جزییات تیز، هیلی‌هت و سوت‌های فرکانس بالا.', preset: 'chirp' },
          ],
        },
      ]
    : [
        {
          kind: 'steps',
          tone: 'sky',
          heading: '3 Simple Steps to Start',
          steps: [
            {
              title: 'Pick a Sound or Hit Play',
              desc: 'Select a waveform (like Sine or Musical) or a quick preset (20 Hz, 1 kHz, Chirp), then press the Play button to hear real audio and watch the live visualizations.',
            },
            {
              title: 'Click Anywhere on the Spectrogram to Hear It',
              desc: 'The spectrogram displays sound frequencies over time (from deep bass at bottom to high treble at top). Click or drag on the canvas to instantly play that exact frequency.',
            },
            {
              title: 'Try Multi-Signals, Ranges, or Live Mic',
              desc: 'Switch to Multi-Click to pin notes and play them as chords, test frequency ranges, or toggle the Live Mic to see and analyze your own voice in real time.',
            },
          ],
        },
        {
          kind: 'cards',
          tone: 'emerald',
          heading: 'What Are Frequencies? (Hearing Map)',
          cards: [
            { title: 'Sub-Bass (Deep Rumble)', badge: '10 – 60 Hz', desc: 'Vibrations you feel as much as hear.', preset: '20hz' },
            { title: 'Bass & Low-End', badge: '60 – 250 Hz', desc: 'Kick drums, basslines, deep chest tones.', preset: '100hz' },
            { title: 'Midrange & Human Voice', badge: '250 Hz – 2 kHz', desc: 'Vocal fundamentals and melodic instruments.', preset: '1khz' },
            { title: 'Treble & Clarity', badge: '2 kHz – 20 kHz', desc: 'Crispness, cymbal sheen, and high harmonics.', preset: 'chirp' },
          ],
        },
      ];

/* Contrast-safe heading colors (AA on light + dark surfaces). */
const TONE_TEXT: Record<GuideTone, string> = {
  sky: 'text-sky-700 dark:text-sky-400',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  amber: 'text-amber-700 dark:text-amber-400',
  violet: 'text-violet-700 dark:text-violet-400',
};
const TONE_BADGE_BG: Record<GuideTone, string> = {
  sky: 'bg-sky-600 dark:bg-sky-400',
  emerald: 'bg-emerald-700 dark:bg-emerald-400',
  amber: 'bg-amber-700 dark:bg-amber-400',
  violet: 'bg-violet-700 dark:bg-violet-400',
};

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  title,
  subtitle,
  sections,
  showDocsLink = true,
  confirmLabel,
}) => {
  const { lang, setActivePage } = useLab();
  const isFa = lang === 'fa';
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus management, focus trap, Escape, scroll lock — active only while open.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = requestAnimationFrame(() => {
      const target =
        closeBtnRef.current ??
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        dialogRef.current;
      target?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? dialogRef.current.contains(active) : false;
      if (e.shiftKey) {
        if (!inside || active === first || active === dialogRef.current) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  const effectiveTitle =
    title ?? (isFa ? 'راهنمای سریع و ساده آزمایشگاه' : 'Quick & Friendly Guide');
  const effectiveSubtitle =
    subtitle ??
    (title
      ? undefined
      : isFa
      ? 'همه چیز درباره صدا، فرکانس و نحوه کار با این ابزار در ۱ دقیقه'
      : 'Everything you need to know about sound and frequencies in 1 minute');
  const effectiveSections = sections ?? getDefaultAudioSections(lang);
  const fmtNum = (n: number) => (isFa ? n.toLocaleString('fa-IR') : String(n));

  const renderSection = (section: GuideSection, sIdx: number) => {
    const tone = section.tone ?? (sIdx % 2 === 0 ? 'sky' : 'emerald');
    const heading = (
      <h3
        className={`text-xs font-mono font-semibold uppercase tracking-wider ${TONE_TEXT[tone]}`}
      >
        {section.heading}
      </h3>
    );

    if (section.kind === 'steps') {
      return (
        <section key={sIdx} className="flex flex-col gap-3">
          {heading}
          <ol className="grid grid-cols-1 gap-2.5">
            {section.steps.map((s, i) => (
              <li key={i} className="neu-inset p-3.5 flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-full text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${TONE_BADGE_BG[tone]}`}
                >
                  {fmtNum(i + 1)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {s.title}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    }

    if (section.kind === 'cards') {
      return (
        <section key={sIdx} className="flex flex-col gap-2.5 pt-2">
          {heading}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {section.cards.map((c, i) => (
              <li key={i} className="neu-card-sm p-3 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{c.title}</span>
                    {c.badge && (
                      <span className="font-mono text-sky-700 dark:text-sky-400 text-[11px] font-semibold whitespace-nowrap">
                        {c.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {c.desc}
                  </p>
                </div>
                {onSelectPreset && c.preset && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPreset(c.preset as string);
                      onClose();
                    }}
                    className="neu-btn px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 self-start cursor-pointer text-sky-700 dark:text-sky-400 hover:text-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  >
                    <Volume2 className="w-3 h-3" aria-hidden="true" />
                    <span>{isFa ? 'تست این صدا' : 'Try this sound'}</span>
                    <span className="sr-only">: {c.title}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      );
    }

    return (
      <section key={sIdx} className="flex flex-col gap-2.5 pt-2">
        {heading}
        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {section.content}
        </div>
      </section>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — click closes (pointer convenience; keyboard users have Escape + buttons) */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={effectiveSubtitle ? descId : undefined}
            tabIndex={-1}
            dir={isFa ? 'rtl' : 'ltr'}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto overscroll-contain neu-card p-6 shadow-2xl flex flex-col gap-5 outline-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-300/30 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  aria-hidden="true"
                  className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0"
                >
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h2 id={titleId} className="text-base font-bold tracking-tight">
                    {effectiveTitle}
                  </h2>
                  {effectiveSubtitle && (
                    <p id={descId} className="text-xs text-slate-600 dark:text-slate-400">
                      {effectiveSubtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                className="btn-circle-glass cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                aria-label={isFa ? 'بستن راهنما' : 'Close guide'}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {effectiveSections.map(renderSection)}

            {/* Footer */}
            <div
              className={`flex items-center gap-3 pt-3 border-t border-slate-300/30 dark:border-slate-800/60 text-xs ${
                showDocsLink ? 'justify-between' : 'justify-end'
              }`}
            >
              {showDocsLink && (
                <button
                  type="button"
                  onClick={() => {
                    setActivePage('documentation');
                    onClose();
                  }}
                  className="text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isFa ? 'مطالعه ریاضیات و مستندات' : 'Detailed Math & Formulas'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="btn-primary-pill px-5 py-2 text-xs font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                {confirmLabel ?? (isFa ? 'متوجه شدم، بزن بریم!' : 'Got it, let’s explore!')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
