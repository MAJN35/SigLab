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

const NAV_ITEMS: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'signal-generator', label: 'Signal Generator', icon: Waves },
    { id: 'telecommunications', label: 'Telecommunications', icon: Radio },
    { id: 'eeg-simulator', label: 'EEG Simulator', icon: Activity },
    { id: 'fft-spectrum', label: 'FFT & Spectrum', icon: BarChart3 },
    { id: 'wavelet-analysis', label: 'Wavelet Analysis', icon: Layers },
    { id: 'filtering', label: 'Filtering', icon: Filter },
    { id: 'pca', label: 'PCA', icon: GitBranch },
    { id: 'ica', label: 'ICA', icon: Cpu },
    { id: 'modulation-ber', label: 'Modulation & BER', icon: Signal },
    { id: 'deep-learning', label: 'Deep Learning', icon: Brain },
    { id: 'custom-samples', label: 'Custom Samples', icon: Database },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'documentation', label: 'Documentation', icon: BookOpen },
  ];

const TOP_NAV_SHORTCUTS: { id: PageId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'signal-generator', label: 'Signal Gen' },
  { id: 'telecommunications', label: 'Telecom' },
  { id: 'eeg-simulator', label: 'EEG Lab' },
  { id: 'fft-spectrum', label: 'FFT' },
  { id: 'modulation-ber', label: 'BER & SNR' },
  { id: 'deep-learning', label: 'Deep Learning' },
];

const LabShell: React.FC = () => {
  const { activePage, setActivePage, darkMode, setDarkMode, saveCurrentExperiment } =
    useLab();
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
      {/* Ambient Background Glow Orbs for Genuine Glassmorphism Refraction */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-sky-400/25 dark:bg-sky-500/15 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-indigo-400/20 dark:bg-indigo-500/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-teal-400/20 dark:bg-emerald-500/12 blur-3xl" />
      </div>

      {/* Floating Curved Island Header */}
      <div className="sticky top-3 z-30 px-4 sm:px-6 pt-1">
        <header className="max-w-[1560px] mx-auto glass-island-header px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          {/* Zone 1: Brand Lockup */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="lg:hidden neu-btn p-2 rounded-full cursor-pointer"
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
              className="flex items-center gap-2.5 pl-1 pr-2 py-0.5 rounded-full"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                <Waves className="w-4 h-4" />
              </span>
              <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                SignalLab
              </span>
            </a>
          </div>

          {/* Zone 2: Curved Island Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 px-1.5 py-1 rounded-full bg-white/50 dark:bg-slate-900/50 border border-white/70 dark:border-white/10">
            {TOP_NAV_SHORTCUTS.map((tab) => {
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePage(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white/60 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Curved Pill Actions & Theme Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickSave}
              className="neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {savedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save State</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Toggle Light and Dark Theme"
              className="neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </header>
      </div>

      {/* Main Layout Container */}
      <div className="flex-1 flex relative z-10 max-w-[1600px] w-full mx-auto pt-2">
        {/* Sidebar Navigation (14 Laboratories) */}
        <aside
          className={`${
            mobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-40 w-68 pt-20 bg-white/85 dark:bg-slate-950/85 backdrop-blur-2xl'
              : 'hidden'
          } lg:block lg:w-64 shrink-0 p-4`}
        >
          <div className="neu-card p-3 sticky top-22 flex flex-col gap-1">
            <div className="px-3 py-2 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
              Laboratory Modules (14)
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500/15 to-indigo-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30 shadow-xs'
                      : 'hover:bg-white/60 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {String(index + 1).padStart(2, '0')}. {item.label}
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
                Signal Processing Laboratory — Educational Simulation
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
