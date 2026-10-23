import React from 'react';
import { Activity, BarChart3, Brain, Cpu, Filter, Layers, Radio, Signal } from 'lucide-react';
import { useLab } from '../store/LabContext';
import { PageId } from '../types';
import { AudioSpectrogramPage } from './AudioSpectrogramPage';

export const DashboardPage: React.FC = () => {
  const { setActivePage, lang } = useLab();

  const quickModules: {
    id: PageId;
    title: string;
    faTitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'signal-generator', title: 'Signal Generator', faTitle: 'تولید سیگنال', icon: Activity },
    { id: 'filtering', title: 'FIR / IIR Filters', faTitle: 'فیلتر دیجیتال', icon: Filter },
    { id: 'fft-spectrum', title: 'FFT & Windows', faTitle: 'تحلیل فوریه', icon: BarChart3 },
    { id: 'wavelet-analysis', title: 'Wavelets', faTitle: 'موجک', icon: Layers },
    { id: 'eeg-simulator', title: 'EEG Simulator', faTitle: 'نوار مغز EEG', icon: Activity },
    { id: 'modulation-ber', title: 'Digital Modulation', faTitle: 'مدولاسیون دیجیتال', icon: Signal },
    { id: 'telecommunications', title: 'Analog RF', faTitle: 'مخابرات آنالوگ', icon: Radio },
    { id: 'ica', title: 'FastICA', faTitle: 'جداسازی FastICA', icon: Cpu },
    { id: 'deep-learning', title: 'Neural DSP', faTitle: 'یادگیری عمیق', icon: Brain },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Primary Interactive Audio Signal Player & Logarithmic Spectrogram Workspace */}
      <AudioSpectrogramPage embedded />

      {/* Intuitive Module Launcher with Clear Human Descriptions */}
      <div className="neu-card p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {lang === 'fa' ? 'سایر آزمایشگاه‌های پردازش سیگنال و صوت' : 'Explore Other Signal Labs'}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {lang === 'fa' ? 'برای تغییر ابزار کلیک کنید' : 'Click any lab to open'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {quickModules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActivePage(m.id)}
                className="neu-btn px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 text-start cursor-pointer transition-transform hover:-translate-y-0.5"
              >
                <Icon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="truncate">{lang === 'fa' ? m.faTitle : m.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

