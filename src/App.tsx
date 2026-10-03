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
    <div className="min-h-screen flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 neu-card rounded-none border-x-0 border-t-0 px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="lg:hidden neu-btn p-2 rounded-lg cursor-pointer"
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
            className="font-display text-lg font-bold tracking-tight whitespace-nowrap"
          >
            SignalLab
          </a>
        </div>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setActivePage('dashboard')}
            className={`hover:text-sky-500 transition-colors whitespace-nowrap cursor-pointer ${
              activePage === 'dashboard' ? 'text-sky-500 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActivePage('telecommunications')}
            className={`hover:text-sky-500 transition-colors whitespace-nowrap cursor-pointer ${
              activePage === 'telecommunications' ? 'text-sky-500 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Telecom
          </button>
          <button
            type="button"
            onClick={() => setActivePage('eeg-simulator')}
            className={`hover:text-sky-500 transition-colors whitespace-nowrap cursor-pointer ${
              activePage === 'eeg-simulator' ? 'text-sky-500 font-semibold underline underline-offset-4' : ''
            }`}
          >
            EEG Lab
          </button>
          <button
            type="button"
            onClick={() => setActivePage('modulation-ber')}
            className={`hover:text-sky-500 transition-colors whitespace-nowrap cursor-pointer ${
              activePage === 'modulation-ber' ? 'text-sky-500 font-semibold underline underline-offset-4' : ''
            }`}
          >
            BER & SNR
          </button>
          <button
            type="button"
            onClick={() => setActivePage('deep-learning')}
            className={`hover:text-sky-500 transition-colors whitespace-nowrap cursor-pointer ${
              activePage === 'deep-learning' ? 'text-sky-500 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Deep Learning
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleQuickSave}
            className="neu-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap cursor-pointer"
          >
            {savedNotice ? 'Saved to IndexedDB' : 'Save Experiment'}
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle Light and Dark Theme"
            className="neu-btn p-2 rounded-lg cursor-pointer"
            title={darkMode ? 'Switch to Calibrated Light Lab' : 'Switch to Dark Lab Theme'}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex relative">
        {/* Sidebar Navigation (14 Laboratories) */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 w-64 pt-16' : 'hidden'
          } lg:block lg:w-64 shrink-0 p-4`}
        >
          <div className="neu-card p-3 sticky top-20 flex flex-col gap-1">
            <div className="px-3 py-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'neu-inset text-sky-600 dark:text-sky-400 font-semibold'
                      : 'hover:bg-slate-200/40 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300'
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
        <main className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col justify-between gap-8 max-w-[1600px] mx-auto w-full">
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
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
              by{' '}
              <a
                href="https://majn35.ir"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Mohammadali Javadinasab
              </a>{' '}
              <span className="text-slate-400 mx-1">·</span>
              <span className="font-mono text-[11px] text-slate-500">SigLab.majn35.ir</span>
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
