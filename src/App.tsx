/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  Cpu,
  Database,
  Filter,
  FlaskConical,
  GitBranch,
  Globe,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Radio,
  Save,
  Signal,
  Sun,
  Waves,
  X,
} from 'lucide-react';
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
  { id: 'dashboard', label: 'Dashboard', faLabel: 'داشبورد', icon: LayoutDashboard },
  { id: 'signal-generator', label: 'Signal Generator', faLabel: 'تولید سیگنال', icon: Waves },
  { id: 'telecommunications', label: 'Telecommunications', faLabel: 'مخابرات', icon: Radio },
  { id: 'eeg-simulator', label: 'EEG Simulator', faLabel: 'شبیه‌ساز EEG', icon: Activity },
  { id: 'fft-spectrum', label: 'FFT & Spectrum', faLabel: 'طیف و FFT', icon: BarChart3 },
  { id: 'wavelet-analysis', label: 'Wavelet Analysis', faLabel: 'تحلیل موجک', icon: Layers },
  { id: 'filtering', label: 'Filtering', faLabel: 'فیلترینگ دیجیتال', icon: Filter },
  { id: 'pca', label: 'PCA', faLabel: 'تحلیل مؤلفه‌های اصلی', icon: GitBranch },
  { id: 'ica', label: 'ICA', faLabel: 'جداسازی منابع (ICA)', icon: Cpu },
  { id: 'modulation-ber', label: 'Modulation & BER', faLabel: 'مدولاسیون و BER', icon: Signal },
  { id: 'deep-learning', label: 'Deep Learning', faLabel: 'یادگیری عمیق', icon: Brain },
  { id: 'custom-samples', label: 'Custom Samples', faLabel: 'نمونه‌های سفارشی', icon: Database },
  { id: 'experiments', label: 'Experiments', faLabel: 'آزمایش‌ها', icon: FlaskConical },
  { id: 'documentation', label: 'Documentation', faLabel: 'مستندات علمی', icon: BookOpen },
];

const TOP_NAV_SHORTCUTS: { id: PageId; label: string; faLabel: string }[] = [
  { id: 'dashboard', label: 'Dashboard', faLabel: 'داشبورد' },
  { id: 'signal-generator', label: 'Signal Gen', faLabel: 'سیگنال' },
  { id: 'telecommunications', label: 'Telecom', faLabel: 'مخابرات' },
  { id: 'eeg-simulator', label: 'EEG Lab', faLabel: 'نوار مغز' },
  { id: 'fft-spectrum', label: 'FFT', faLabel: 'طیف FFT' },
  { id: 'modulation-ber', label: 'BER & SNR', faLabel: 'نرخ خطا' },
  { id: 'deep-learning', label: 'Deep Learning', faLabel: 'یادگیری عمیق' },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient Liquid Refraction Orbs for High-Index Translucency */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-28 left-1/4 w-[28rem] h-[28rem] rounded-full bg-sky-400/25 dark:bg-sky-500/15 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-[26rem] h-[26rem] rounded-full bg-cyan-400/20 dark:bg-cyan-500/12 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 w-[26rem] h-[26rem] rounded-full bg-blue-400/18 dark:bg-indigo-500/12 blur-3xl" />
      </div>

      {/* Floating Pill Navbar: Fixed at top: 16px, left: 50%, translateX(-50%), width: min(96%, 1160px), height: 62px */}
      <header className="floating-pill-navbar px-3.5 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="lg:hidden btn-circle-glass cursor-pointer"
            aria-label="Toggle Navigation Sidebar"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <a
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActivePage('dashboard');
            }}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full"
          >
            <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] text-white flex items-center justify-center shadow-md shrink-0">
              <Waves className="w-4 h-4" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-base sm:text-lg font-extrabold tracking-tight whitespace-nowrap">
                SigLab
              </span>
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 hidden sm:inline">
                siglab.majn35.ir
              </span>
            </div>
          </a>
        </div>

        {/* Center: Section Links with Active 2px Indicator Underline */}
        <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto">
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

        {/* Right: Circular 38px Glass Utility Buttons (Save, Language/RTL, Theme Toggle) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickSave}
            title={savedNotice ? 'Experiment Saved' : 'Quick Save Experiment to IndexedDB'}
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
            title={lang === 'en' ? 'Switch to Persian / RTL (Vazirmatn)' : 'Switch to English / LTR'}
            aria-label="Toggle Language and Direction"
            className="btn-circle-glass text-[11px] font-bold font-mono cursor-pointer"
          >
            {lang === 'en' ? 'FA' : 'EN'}
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle Light and Dark Theme"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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

      {/* Main Layout Container padded below Fixed Floating Pill Navbar */}
      <div className="flex-1 flex relative z-10 max-w-[1600px] w-full mx-auto pt-22">
        {/* Sidebar Navigation (14 Laboratories) */}
        <aside
          className={`${
            mobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-40 w-72 pt-24 px-4 bg-white/75 dark:bg-slate-950/80 backdrop-blur-2xl'
              : 'hidden'
          } lg:block lg:w-64 shrink-0 p-4`}
        >
          <div className="neu-card p-3 sticky top-24 flex flex-col gap-1">
            <div className="px-3 py-2 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>{lang === 'fa' ? 'ماژول‌های آزمایشگاه (۱۴)' : 'Laboratory Modules · 14'}</span>
              <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'btn-tool-pill font-bold'
                      : 'hover:bg-white/40 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
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

        {/* Main Stage Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col justify-between gap-8 w-full">
          <div>{renderPage()}</div>

          {/* Required Educational Simulation Disclaimer Footer */}
          <footer className="neu-card p-5 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold tracking-tight">
                Signal Processing Laboratory · Educational Simulation
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Synthetic data only. Designed for academic education, visualization, and research experimentation. Not intended for clinical diagnosis or real-world telecommunications operation.
              </p>
            </div>
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
              by{' '}
              <a
                href="https://majn35.ir"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-sky-700 dark:text-sky-400 hover:underline"
              >
                Mohammadali Javadinasab
              </a>
            </div>
          </footer>
        </main>
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
