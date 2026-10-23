import React from 'react';
import {
  BookOpen,
  HelpCircle,
  Lightbulb,
  MousePointerClick,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLab } from '../store/LabContext';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (presetKey: string) => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, onSelectPreset }) => {
  const { lang, setActivePage } = useLab();

  if (!isOpen) return null;

  const STEPS =
    lang === 'fa'
      ? [
          {
            number: '۱',
            title: 'یک سیگنال انتخاب کنید یا دکمه پخش را بزنید',
            desc: 'از منوی شکل‌موج‌ها یا پیش‌تنظیم‌های سریع (مانند ۲۰ هرتز، ۱ کیلوهرتز یا نویز)، یک صدا را انتخاب کنید و روی دکمه پخش (Play) بزنید تا صدا و نمایش زنده شروع شود.',
          },
          {
            number: '۲',
            title: 'روی طیف‌نگار کلیک کنید تا فرکانس را بشنوید',
            desc: 'طیف‌نگار نشان می‌دهد چه فرکانس‌هایی در چه زمانی وجود دارند. روی هر نقطه کلیک یا لمس کنید تا بلافاصله همان فرکانس سنتز و پخش شود.',
          },
          {
            number: '۳',
            title: 'از حالت چندسیگنال یا بازه فرکانسی لذت ببرید',
            desc: 'با حالت «چندسیگنال» می‌توانید چند فرکانس دلخواه را علامت بزنید و همه را با هم (آکورد) یا پشت‌سرهم بنوازید. همچنین با «میکروفون» صدای محیط را زنده ببینید.',
          },
        ]
      : [
          {
            number: '1',
            title: 'Pick a Sound or Hit Play',
            desc: 'Select a waveform (like Sine or Musical) or a quick preset (20 Hz, 1 kHz, Chirp), then press the Play button to hear real audio and watch the live visualizations.',
          },
          {
            number: '2',
            title: 'Click Anywhere on the Spectrogram to Hear It',
            desc: 'The spectrogram displays sound frequencies over time (from deep bass at bottom to high treble at top). Click or drag on the canvas to instantly play that exact frequency.',
          },
          {
            number: '3',
            title: 'Try Multi-Signals, Ranges, or Live Mic',
            desc: 'Switch to Multi-Click to pin notes and play them as chords, test frequency ranges, or toggle the Live Mic to see and analyze your own voice in real time.',
          },
        ];

  const FREQ_GUIDES =
    lang === 'fa'
      ? [
          { name: 'بیس عمیق (Sub-Bass)', range: '۱۰ تا ۶۰ هرتز', note: 'لرزش‌های بم؛ بیشتر احساس می‌شود تا شنیده شود.', preset: '20hz' },
          { name: 'بیس معمولی (Bass)', range: '۶۰ تا ۲۵۰ هرتز', note: 'فرکانس‌های صدای بم و گیتار باس.', preset: '100hz' },
          { name: 'محدوده میانی (Mids)', range: '۲۵۰ تا ۲ کیلوهرتز', note: 'صدای گفتار انسان و سازهای ملودیک.', preset: '1khz' },
          { name: 'تریبل و وضوح (Highs)', range: '۲ تا ۲۰ کیلوهرتز', note: 'جزییات تیز، هیلی‌هت و سوت‌های فرکانس بالا.', preset: 'chirp' },
        ]
      : [
          { name: 'Sub-Bass (Deep Rumble)', range: '10 – 60 Hz', note: 'Vibrations you feel as much as hear.', preset: '20hz' },
          { name: 'Bass & Low-End', range: '60 – 250 Hz', note: 'Kick drums, basslines, deep chest tones.', preset: '100hz' },
          { name: 'Midrange & Human Voice', range: '250 Hz – 2 kHz', note: 'Vocal fundamentals and melodic instruments.', preset: '1khz' },
          { name: 'Treble & Clarity', range: '2 kHz – 20 kHz', note: 'Crispness, cymbal sheen, and high harmonics.', preset: 'chirp' },
        ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto neu-card p-6 shadow-2xl flex flex-col gap-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-300/30 dark:border-slate-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  {lang === 'fa' ? 'راهنمای سریع و ساده آزمایشگاه' : 'Quick & Friendly Guide'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'fa'
                    ? 'همه چیز درباره صدا، فرکانس و نحوه کار با این ابزار در ۱ دقیقه'
                    : 'Everything you need to know about sound and frequencies in 1 minute'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-circle-glass cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Step Interactive Tour */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-mono font-semibold text-sky-500 uppercase tracking-wider">
              {lang === 'fa' ? '۳ قدم ساده برای شروع' : '3 Simple Steps to Start'}
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              {STEPS.map((s) => (
                <div key={s.number} className="neu-inset p-3.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {s.number}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {s.title}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sound Frequency Map (Human-Friendly) */}
          <div className="flex flex-col gap-2.5 pt-2">
            <span className="text-xs font-mono font-semibold text-emerald-500 uppercase tracking-wider">
              {lang === 'fa' ? 'نقشه فرکانس‌های شنوایی انسان' : 'What Are Frequencies? (Hearing Map)'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FREQ_GUIDES.map((f) => (
                <div
                  key={f.name}
                  className="neu-card-sm p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{f.name}</span>
                      <span className="font-mono text-sky-500 text-[11px] font-semibold">{f.range}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {f.note}
                    </p>
                  </div>
                  {onSelectPreset && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPreset(f.preset);
                        onClose();
                      }}
                      className="neu-btn px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 self-start cursor-pointer text-sky-600 dark:text-sky-400 hover:text-sky-500"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>{lang === 'fa' ? 'تست این صدا' : 'Try this sound'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-300/30 dark:border-slate-800/60 text-xs">
            <button
              type="button"
              onClick={() => {
                setActivePage('documentation');
                onClose();
              }}
              className="text-slate-500 hover:text-sky-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'مطالعه ریاضیات و مستندات' : 'Detailed Math & Formulas'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary-pill px-5 py-2 text-xs font-semibold cursor-pointer"
            >
              {lang === 'fa' ? 'متوجه شدم، بزن بریم!' : 'Got it, let’s explore!'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
