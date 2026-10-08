/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  Filter,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListChecks,
  Moon,
  Radio,
  Save,
  Signal,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LAB_IMAGES } from './assets/labImages';
import { AudioSpectrogramPage } from './pages/AudioSpectrogramPage';
import { CustomSamplesPage } from './pages/CustomSamplesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeepLearningPage } from './pages/DeepLearningPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { EEGSimulatorPage } from './pages/EEGSimulatorPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { FFTSpectrumPage } from './pages/FFTSpectrumPage';
import { FilteringPage } from './pages/FilteringPage';
import { ICAPage } from './pages/ICAPage';
import { ModulationBERPage } from './pages/ModulationBERPage';
import { PCAPage } from './pages/PCAPage';
import { SignalGeneratorPage } from './pages/SignalGeneratorPage';
import { TelecommunicationsPage } from './pages/TelecommunicationsPage';
import { WaveletPage } from './pages/WaveletPage';
import { LabProvider, useLab } from './store/LabContext';
import { PageId } from './types';

const NAV_ITEMS: {
  id: PageId;
  label: string;
  faLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Overview', faLabel: 'نمای کلی آزمایشگاه', icon: LayoutDashboard },
  { id: 'audio-lab', label: 'Audio & Spectrogram', faLabel: 'پخش زنده صوت و طیف‌نگار', icon: Volume2 },
  { id: 'signal-generator', label: 'Signal Generator', faLabel: 'تولیدکننده سیگنال', icon: Activity },
  { id: 'fft-spectrum', label: 'FFT & Spectrum', faLabel: 'طیف فوریه و FFT', icon: BarChart3 },
  { id: 'filtering', label: 'Digital Filtering', faLabel: 'فیلترینگ دیجیتال', icon: Filter },
  { id: 'wavelet-analysis', label: 'Wavelet Analysis', faLabel: 'تحلیل موجک (Wavelet)', icon: Layers },
  { id: 'telecommunications', label: 'Analog Telecom', faLabel: 'مخابرات آنالوگ و نویز', icon: Radio },
  { id: 'modulation-ber', label: 'Digital Mod & BER', faLabel: 'مدولاسیون دیجیتال و BER', icon: Signal },
  { id: 'eeg-simulator', label: 'EEG Simulator', faLabel: 'شبیه‌ساز نوار مغز (EEG)', icon: Activity },
  { id: 'pca', label: 'PCA Subspace', faLabel: 'تحلیل مؤلفه‌های اصلی (PCA)', icon: GitBranch },
  { id: 'ica', label: 'FastICA Separation', faLabel: 'جداسازی منابع مستقل (ICA)', icon: Cpu },
  { id: 'deep-learning', label: 'Deep Learning', faLabel: 'یادگیری عمیق (TF.js)', icon: Brain },
  { id: 'custom-samples', label: 'Custom Samples', faLabel: 'نمونه‌های سفارشی', icon: Database },
  { id: 'experiments', label: 'Saved Experiments', faLabel: 'مدیریت آزمایش‌ها', icon: FlaskConical },
  { id: 'documentation', label: 'Reference & Math', faLabel: 'مستندات و مرجع علمی', icon: BookOpen },
];

const TOP_NAV_SHORTCUTS: { id: PageId; label: string; faLabel: string }[] = [
  { id: 'dashboard', label: 'Audio Lab', faLabel: 'آزمایشگاه صوت' },
  { id: 'signal-generator', label: 'Waveforms', faLabel: 'شکل‌موج' },
  { id: 'fft-spectrum', label: 'Spectrum', faLabel: 'طیف فوریه' },
  { id: 'filtering', label: 'Filters', faLabel: 'فیلترها' },
  { id: 'documentation', label: 'Docs', faLabel: 'مرجع علمی' },
];

const LabShell: React.FC = () => {
  const {
    activePage,
    setActivePage,
    darkMode,
    setDarkMode,
    lang,
    setLang,
  } = useLab();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Passive scroll progress indicator & floating Scroll-to-Top visibility
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 20 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
      setScrollPct(pct);
      setShowScrollTop(scrollTop > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [activePage]);

  // Performant IntersectionObserver for subtle scroll-reveal and staggered card animations
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const timer = window.setTimeout(() => {
      const elements = document.querySelectorAll('.neu-card, .neu-card-sm');
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
      );

      elements.forEach((el, idx) => {
        if (!el.classList.contains('is-revealed')) {
          el.classList.add('scroll-reveal');
          const staggerMs = (idx % 4) * 70;
          (el as HTMLElement).style.setProperty('--stagger-delay', `${staggerMs}ms`);
          observer.observe(el);
        }
      });

      return () => observer.disconnect();
    }, 30);

    return () => window.clearTimeout(timer);
  }, [activePage]);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'audio-lab':
        return <AudioSpectrogramPage />;
      case 'signal-generator':
        return <SignalGeneratorPage />;
      case 'telecommunications':
        return <TelecommunicationsPage />;
      case 'eeg-simulator':
        return <EEGSimulatorPage />;
      case 'fft-spectrum':
        return <FFTSpectrumPage />;
      case 'wavelet-analysis':
        return <WaveletPage />;
      case 'filtering':
        return <FilteringPage />;
      case 'pca':
        return <PCAPage />;
      case 'ica':
        return <ICAPage />;
      case 'modulation-ber':
        return <ModulationBERPage />;
      case 'deep-learning':
        return <DeepLearningPage />;
      case 'custom-samples':
        return <CustomSamplesPage />;
      case 'experiments':
        return <ExperimentsPage />;
      case 'documentation':
        return <DocumentationPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Top Viewport Scroll Progress Bar */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2px] z-[60] pointer-events-none bg-transparent"
      >
        <div
          className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-[#7FD141] transition-[width] duration-100 ease-out"
          style={{ width: `${scrollPct}%` }}
        />
      </div>

      {/* Minimal Floating Header */}
      <header className="floating-pill-navbar anim-load-header px-4 sm:px-5 flex items-center justify-between gap-3">
        {/* Left: Portfolio Link + SigLab Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
            onClick={(e) => {
              const currentTheme = darkMode ? 'dark' : 'light';
              e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
            }}
            className="neu-btn px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 whitespace-nowrap"
            title={lang === 'fa' ? 'بازگشت به پورتفولیو majn35.ir' : 'Return to majn35.ir Portfolio'}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden md:inline">{lang === 'fa' ? 'پورتفولیو' : 'Portfolio'}</span>
          </a>

          <a
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActivePage('dashboard');
            }}
            className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full"
          >
            <img
              src={LAB_IMAGES.favicon}
              alt="SigLab Icon"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = './favicon.svg';
              }}
              className="w-7 h-7 rounded-full object-cover border border-sky-400/40 shrink-0"
            />
            <span className="font-display text-sm font-bold tracking-tight whitespace-nowrap">
              {lang === 'fa' ? 'سیگ‌لب' : 'SigLab'}
            </span>
          </a>
        </div>

        {/* Center: Core Links */}
        <nav className="nav-center-links">
          {TOP_NAV_SHORTCUTS.map((tab) => {
            const isActive =
              activePage === tab.id || (tab.id === 'dashboard' && activePage === 'audio-lab');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePage(tab.id)}
                className={`relative h-9 inline-flex items-center px-3 text-xs transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 font-bold'
                    : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="relative z-10">{lang === 'fa' ? tab.faLabel : tab.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="top-nav-active-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute bottom-1.5 left-2.5 right-2.5 h-[2px] rounded-full bg-sky-500 dark:bg-sky-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Minimal Controls (Modules Drawer, Language, Theme) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="neu-btn px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title={lang === 'fa' ? 'همه ماژول‌ها' : 'All Modules'}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">
              {lang === 'fa' ? 'ماژول‌ها' : 'Modules'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLang((l) => (l === 'en' ? 'fa' : 'en'))}
            aria-label="Toggle Language"
            className="btn-circle-glass text-[11px] font-bold font-mono cursor-pointer"
          >
            {lang === 'en' ? 'FA' : 'EN'}
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle Theme"
            className="btn-circle-glass cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-sky-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-700" />
            )}
          </button>
        </div>
      </header>

      {/* Sliding Glass Drawer for All Modules */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: lang === 'fa' ? 320 : -320, opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: lang === 'fa' ? 320 : -320, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-50 w-72 max-w-[85vw] h-full pt-20 pb-8 px-4 overflow-y-auto mobile-glass-drawer flex flex-col gap-2"
            >
              <div className="px-2 pb-2 text-xs font-mono font-semibold text-slate-500 flex items-center justify-between border-b border-slate-300/30 dark:border-slate-800/60">
                <span>{lang === 'fa' ? 'همه بخش‌ها' : 'All Modules'}</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="btn-circle-glass cursor-pointer"
                  aria-label="Close Drawer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActivePage(item.id);
                        setDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'btn-tool-pill font-bold'
                          : 'hover:bg-white/40 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{lang === 'fa' ? item.faLabel : item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Spacious, Minimal Centered Main Stage */}
      <div className="flex-1 flex flex-col relative z-10 max-w-[1120px] w-full mx-auto px-4 sm:px-6 pt-24 pb-12 gap-8">
        <main className="flex-1 min-w-0 w-full anim-load-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Minimal Single-Line Footer */}
        <footer className="pt-4 border-t border-slate-300/30 dark:border-slate-800/50 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {lang === 'fa'
              ? 'آزمایشگاه پردازش سیگنال (SigLab)'
              : 'SigLab — Audio & Signal Processing Lab'}
          </span>
          <a
            href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
            onClick={(e) => {
              const currentTheme = darkMode ? 'dark' : 'light';
              e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
            }}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-600 dark:text-sky-400 hover:underline"
          >
            {lang === 'fa' ? 'محمدعلی جوادی‌نسب' : 'Mohammadali Javadinasab'}
          </a>
        </footer>
      </div>

      {/* Minimal Scroll-to-Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-5 right-5 z-40 neu-btn p-2.5 rounded-full text-xs shadow-lg cursor-pointer"
            title={lang === 'fa' ? 'بازگشت به بالای صفحه' : 'Scroll to Top'}
          >
            <ArrowUp className="w-4 h-4 text-sky-500" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <LabProvider>
      <LabShell />
    </LabProvider>
  );
}
