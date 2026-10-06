/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
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
  { id: 'dashboard', label: 'Overview', faLabel: 'نمای کلی' },
  { id: 'audio-lab', label: 'Audio Lab', faLabel: 'آزمایشگاه صوت' },
  { id: 'signal-generator', label: 'Waveforms', faLabel: 'شکل‌موج' },
  { id: 'fft-spectrum', label: 'Spectrum', faLabel: 'طیف فوریه' },
  { id: 'filtering', label: 'Filters', faLabel: 'فیلترها' },
  { id: 'documentation', label: 'Docs', faLabel: 'مرجع علمی' },
];

interface StudyTask {
  id: string;
  title: string;
  faTitle: string;
  pageId: PageId;
  completed: boolean;
}

const INITIAL_STUDY_TASKS: StudyTask[] = [
  {
    id: 'task-1',
    title: 'Generate & play a 20 Hz + 100 Hz mixed signal on the logarithmic spectrogram',
    faTitle: 'تولید و پخش سیگنال ترکیبی ۲۰ هرتز و ۱۰۰ هرتز روی طیف‌نگار لگاریتمی',
    pageId: 'audio-lab',
    completed: true,
  },
  {
    id: 'task-2',
    title: 'Click or drag across the spectrogram (10 Hz – 20 kHz) to sonify frequency components',
    faTitle: 'کلیک و کشیدن موس روی طیف‌نگار (۱۰ هرتز تا ۲۰ کیلوهرتز) برای شنیدن فرکانس‌ها',
    pageId: 'audio-lab',
    completed: false,
  },
  {
    id: 'task-3',
    title: 'Compare Hann vs. Blackman spectral leakage in the FFT Spectrum module',
    faTitle: 'مقایسه نشت طیفی پنجره‌های Hann و Blackman در بخش طیف فوریه',
    pageId: 'fft-spectrum',
    completed: false,
  },
  {
    id: 'task-4',
    title: 'Design an IIR/FIR digital filter and inspect SNR improvement in dB',
    faTitle: 'طراحی فیلتر دیجیتال FIR/IIR و بررسی میزان بهبود نسبت سیگنال به نویز (SNR)',
    pageId: 'filtering',
    completed: false,
  },
  {
    id: 'task-5',
    title: 'Train a 1D-CNN or Denoising Autoencoder in the Deep Learning browser lab',
    faTitle: 'آموزش شبکه عصبی 1D-CNN یا خودرمزگذار حذف نویز در مرورگر',
    pageId: 'deep-learning',
    completed: false,
  },
];

const LabShell: React.FC = () => {
  const {
    activePage,
    setActivePage,
    darkMode,
    setDarkMode,
    lang,
    setLang,
    saveCurrentExperiment,
  } = useLab();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>(INITIAL_STUDY_TASKS);

  const completedCount = studyTasks.filter((t) => t.completed).length;
  const progressPct = Math.round((completedCount / studyTasks.length) * 100);

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

  const handleQuickSave = async () => {
    await saveCurrentExperiment();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const toggleStudyTask = (id: string) => {
    setStudyTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

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

  const activeNavMeta = NAV_ITEMS.find((i) => i.id === activePage) || NAV_ITEMS[0];
  const circleCircumference = 2 * Math.PI * 11;
  const circleOffset = circleCircumference - (progressPct / 100) * circleCircumference;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Subtle Ambient Liquid Refraction Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-36 left-1/4 w-[32rem] h-[32rem] rounded-full bg-sky-400/20 dark:bg-sky-500/12 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] rounded-full bg-cyan-400/15 dark:bg-cyan-500/10 blur-3xl" />
      </div>

      {/* 1. Header with Page-Load Animation & Sliding Active Indicator */}
      <header className="floating-pill-navbar anim-load-header px-3 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Portfolio Link + SigLab Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
            onClick={(e) => {
              const currentTheme = darkMode ? 'dark' : 'light';
              e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
            }}
            className="neu-btn px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
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
            className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <img
              src={LAB_IMAGES.favicon}
              alt="SigLab Icon"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = './favicon.svg';
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-sky-400/40 shadow-sm shrink-0"
            />
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight whitespace-nowrap">
              {lang === 'fa' ? 'سیگ‌لب' : 'SigLab'}
            </span>
          </a>
        </div>

        {/* Center: Clean Core Section Links with Smooth Sliding Active Indicator */}
        <nav className="nav-center-links">
          {TOP_NAV_SHORTCUTS.map((tab) => {
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePage(tab.id)}
                className={`relative h-9 inline-flex items-center px-2.5 text-xs transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 font-bold'
                    : 'text-slate-600 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="relative z-10">{lang === 'fa' ? tab.faLabel : tab.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="top-nav-active-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute bottom-1 left-2 right-2 h-[2px] rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Clean Controls Cluster (Study Progress Modal, All Labs Drawer, Save, Language, Theme) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Interactive Study Session / Lab Tasks Button with Circular Progress */}
          <button
            type="button"
            onClick={() => setChecklistOpen(true)}
            className="btn-circle-glass cursor-pointer"
            title={lang === 'fa' ? 'چک‌لیست تمرین‌های آزمایشگاه' : 'Lab Study Checklist & Progress'}
          >
            <svg className="w-5 h-5 -rotate-90 shrink-0" viewBox="0 0 28 28">
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-slate-300/60 dark:text-slate-700/70"
              />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                stroke={progressPct === 100 ? '#7FD141' : '#38bdf8'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circleCircumference}
                strokeDashoffset={circleOffset}
                className="circular-progress-ring"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="neu-btn px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title={lang === 'fa' ? 'مشاهده همه ۱۵ بخش آزمایشگاه' : 'Browse All 15 Lab Modules'}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">
              {lang === 'fa' ? 'همه بخش‌ها' : 'All Labs'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleQuickSave}
            title={
              savedNotice
                ? lang === 'fa'
                  ? 'آزمایش ذخیره شد'
                  : 'Experiment Saved'
                : lang === 'fa'
                ? 'ذخیره سریع آزمایش در مرورگر'
                : 'Quick Save Experiment'
            }
            aria-label="Quick Save Experiment"
            className={`btn-circle-glass cursor-pointer ${
              savedNotice
                ? 'border-[#7FD141] text-[#7FD141] shadow-[0_0_16px_rgba(127,209,65,0.35)] scale-105'
                : ''
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {savedNotice ? (
                <motion.span
                  key="saved"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Check className="w-4 h-4 text-[#7FD141]" />
                </motion.span>
              ) : (
                <motion.span
                  key="save"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  <Save className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <button
            type="button"
            onClick={() => setLang((l) => (l === 'en' ? 'fa' : 'en'))}
            title={
              lang === 'en'
                ? 'تغییر زبان به فارسی (راست‌به‌چپ)'
                : 'Switch to English (LTR)'
            }
            aria-label="Toggle Language and Direction"
            className="btn-circle-glass text-[11px] font-bold font-mono cursor-pointer"
          >
            {lang === 'en' ? 'FA' : 'EN'}
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle Light and Dark Theme"
            title={
              darkMode
                ? lang === 'fa'
                  ? 'تغییر به حالت روشن'
                  : 'Switch to Light Mode'
                : lang === 'fa'
                ? 'تغییر به حالت تاریک'
                : 'Switch to Dark Mode'
            }
            className="btn-circle-glass cursor-pointer"
          >
            <AnimatePresence mode="wait" initial={false}>
              {darkMode ? (
                <motion.span
                  key="sun"
                  initial={{ rotate: -45, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 45, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Sun className="w-4 h-4 text-sky-400" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ rotate: 45, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -45, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Moon className="w-4 h-4 text-sky-700" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      {/* 4. Sliding Glass Drawer for All 15 Laboratory Modules with Staggered Reveal */}
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
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-50 w-80 max-w-[88vw] h-full pt-24 pb-8 px-5 overflow-y-auto mobile-glass-drawer flex flex-col gap-2"
            >
              <div className="px-2 pb-2 text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between border-b border-slate-300/40 dark:border-slate-800/60">
                <span>
                  {lang === 'fa'
                    ? 'همه ماژول‌های آزمایشگاه (۱۵)'
                    : 'All Laboratory Modules (15)'}
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="btn-circle-glass cursor-pointer"
                  aria-label="Close Drawer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                {NAV_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, x: lang === 'fa' ? 14 : -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.22,
                        delay: index * 0.022,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => {
                        setActivePage(item.id);
                        setDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'btn-tool-pill font-bold'
                          : 'hover:bg-white/40 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {String(index + 1).padStart(2, '0')} ·{' '}
                        {lang === 'fa' ? item.faLabel : item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* 7, 12 & 13. Animated Modal / Dialog for Lab Study Session Checklist & Progress */}
      <AnimatePresence>
        {checklistOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setChecklistOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg neu-card p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ListChecks className="w-5 h-5 text-[#7FD141]" />
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight">
                      {lang === 'fa'
                        ? 'برنامه مطالعه و تمرین‌های تعاملی آزمایشگاه'
                        : 'Interactive Signal Lab Study Session'}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {lang === 'fa'
                        ? `${completedCount} از ${studyTasks.length} تمرین تکمیل شده (${progressPct}٪)`
                        : `${completedCount} of ${studyTasks.length} experiments completed (${progressPct}%)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChecklistOpen(false)}
                  className="btn-circle-glass cursor-pointer"
                  aria-label="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-300/50 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full progress-fill-smooth"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: progressPct === 100 ? '#7FD141' : '#38bdf8',
                  }}
                />
              </div>

              {/* Task Items with Satisfying Completion Transitions */}
              <div className="flex flex-col gap-2.5">
                {studyTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`neu-inset p-3.5 flex items-center justify-between gap-3 task-item-row ${
                      task.completed ? 'task-item-completed' : ''
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleStudyTask(task.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <span
                        className={`text-xs font-medium leading-relaxed ${
                          task.completed ? 'task-text-completed' : ''
                        }`}
                      >
                        {lang === 'fa' ? task.faTitle : task.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePage(task.pageId);
                        setChecklistOpen(false);
                      }}
                      className="neu-btn px-2.5 py-1 rounded-full text-[11px] font-mono shrink-0 cursor-pointer"
                    >
                      {lang === 'fa' ? 'اجرا' : 'Open'}
                    </button>
                  </div>
                ))}
              </div>

              {progressPct === 100 && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="px-4 py-2.5 rounded-xl bg-[#7FD141]/15 border border-[#7FD141]/50 text-xs font-semibold flex items-center gap-2 text-emerald-700 dark:text-[#7FD141]"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {lang === 'fa'
                      ? 'عالی! تمام تمرین‌های این جلسه آزمایشگاهی با موفقیت تکمیل شدند.'
                      : 'Study session complete — all core DSP & spectrogram experiments verified.'}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spacious Centered Main Stage */}
      <div className="flex-1 flex flex-col relative z-10 max-w-[1220px] w-full mx-auto px-4 sm:px-8 pt-28 pb-16 gap-10">
        {/* 2. Hero / Secondary Module Pill Bar with Page-Load Stagger */}
        <div className="anim-load-hero flex items-center justify-between gap-3 overflow-x-auto py-1 no-scrollbar">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
            <span className="text-sky-600 dark:text-sky-400 font-bold">
              {lang === 'fa' ? activeNavMeta.faLabel : activeNavMeta.label}
            </span>
            <span>·</span>
            <span>
              {lang === 'fa' ? 'آزمایشگاه تعاملی سیگنال' : 'Interactive Signal Workspace'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(
              [
                { id: 'wavelet-analysis', label: 'Wavelets', fa: 'موجک' },
                { id: 'pca', label: 'PCA', fa: 'PCA' },
                { id: 'ica', label: 'FastICA', fa: 'ICA' },
                { id: 'telecommunications', label: 'Analog RF', fa: 'آنالوگ' },
                { id: 'custom-samples', label: 'Samples', fa: 'نمونه‌ها' },
                { id: 'experiments', label: 'Presets', fa: 'سناریوها' },
              ] as { id: PageId; label: string; fa: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActivePage(m.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activePage === m.id
                    ? 'btn-tool-pill font-semibold'
                    : 'neu-btn opacity-80 hover:opacity-100'
                }`}
              >
                {lang === 'fa' ? m.fa : m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Active Module Content with Smooth Section Switch Transition */}
        <main className="flex-1 min-w-0 w-full anim-load-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10, scale: 0.994 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.996 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Clean, Spacious Educational Footer */}
        <footer className="neu-card anim-load-footer px-6 py-5 text-center sm:text-start flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {lang === 'fa'
                ? 'آزمایشگاه پردازش سیگنال (SigLab)'
                : 'Signal Processing Laboratory (SigLab)'}
            </span>{' '}
            ·{' '}
            {lang === 'fa'
              ? 'شبیه‌سازی آموزشی و پژوهشی پردازش سیگنال، مخابرات، EEG مصنوعی و یادگیری ماشین.'
              : 'Interactive educational simulation for DSP, telecommunications, synthetic EEG, and machine learning.'}
          </div>
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
            {lang === 'fa' ? 'توسعه توسط ' : 'by '}
            <a
              href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
              onClick={(e) => {
                const currentTheme = darkMode ? 'dark' : 'light';
                e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-sky-700 dark:text-sky-400 hover:underline"
            >
              {lang === 'fa' ? 'محمدعلی جوادی‌نسب' : 'Mohammadali Javadinasab'}
            </a>
          </div>
        </footer>
      </div>
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
