/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  Cpu,
  Database,
  Filter,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Moon,
  Radio,
  Save,
  Signal,
  Sun,
  X,
} from 'lucide-react';
import { LAB_IMAGES } from './assets/labImages';
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
  { id: 'signal-generator', label: 'Waveforms', faLabel: 'شکل‌موج‌ها' },
  { id: 'fft-spectrum', label: 'Spectrum', faLabel: 'طیف فوریه' },
  { id: 'filtering', label: 'Filters', faLabel: 'فیلترها' },
  { id: 'eeg-simulator', label: 'EEG Lab', faLabel: 'آزمایشگاه EEG' },
  { id: 'modulation-ber', label: 'Telecom', faLabel: 'مخابرات' },
  { id: 'deep-learning', label: 'AI Lab', faLabel: 'یادگیری عمیق' },
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
    saveCurrentExperiment,
  } = useLab();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleQuickSave = async () => {
    await saveCurrentExperiment();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
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

      {/* Floating Pill Navbar */}
      <header className="floating-pill-navbar px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Portfolio Link + SigLab Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
            onClick={(e) => {
              const currentTheme = darkMode ? 'dark' : 'light';
              e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
            }}
            className="neu-btn px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            title={lang === 'fa' ? 'بازگشت به پورتفولیو majn35.ir' : 'Return to majn35.ir Portfolio'}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">{lang === 'fa' ? 'پورتفولیو' : 'Portfolio'}</span>
          </a>

          <a
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActivePage('dashboard');
            }}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full"
          >
            <img
              src={LAB_IMAGES.favicon}
              alt="SigLab Icon"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = './favicon.svg';
              }}
              className="w-8 h-8 rounded-full object-cover border border-sky-400/40 shadow-sm shrink-0"
            />
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight whitespace-nowrap">
              {lang === 'fa' ? 'سیگ‌لب' : 'SigLab'}
            </span>
          </a>
        </div>

        {/* Center: Clean Core Section Links */}
        <nav className="nav-center-links">
          {TOP_NAV_SHORTCUTS.map((tab) => {
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePage(tab.id)}
                className={`nav-section-link cursor-pointer ${
                  isActive ? 'nav-section-link-active' : ''
                }`}
              >
                {lang === 'fa' ? tab.faLabel : tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Clean Controls Cluster (All Modules Drawer Button, Save, Language, Theme) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title={lang === 'fa' ? 'مشاهده همه ۱۴ بخش آزمایشگاه' : 'Browse All 14 Lab Modules'}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden md:inline">
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
              savedNotice ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : ''
            }`}
          >
            {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
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
            {darkMode ? (
              <Sun className="w-4 h-4 text-sky-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-700" />
            )}
          </button>
        </div>
      </header>

      {/* Sliding Glass Drawer for All 14 Laboratory Modules */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-950/35 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-50 w-80 max-w-[88vw] h-full pt-24 pb-8 px-5 overflow-y-auto mobile-glass-drawer flex flex-col gap-2">
            <div className="px-2 pb-2 text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between border-b border-slate-300/40 dark:border-slate-800/60">
              <span>{lang === 'fa' ? 'همه ماژول‌های آزمایشگاه (۱۴)' : 'All Laboratory Modules (14)'}</span>
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
                  <button
                    key={item.id}
                    type="button"
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
                      {String(index + 1).padStart(2, '0')} · {lang === 'fa' ? item.faLabel : item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* Spacious Centered Main Stage (No Permanent Sidebar Clutter) */}
      <div className="flex-1 flex flex-col relative z-10 max-w-[1220px] w-full mx-auto px-4 sm:px-8 pt-28 pb-16 gap-10">
        {/* Subtle Secondary Module Pill Bar for Quick Switching */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto py-1 no-scrollbar">
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

        {/* Active Module Content */}
        <main className="flex-1 min-w-0 w-full">{renderPage()}</main>

        {/* Clean, Spacious Educational Footer */}
        <footer className="neu-card px-6 py-5 text-center sm:text-start flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
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
