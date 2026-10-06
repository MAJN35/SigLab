import React from 'react';
import { Activity, BarChart3, Brain, Cpu, Filter, Layers, Radio, Signal } from 'lucide-react';
import { LAB_IMAGES } from '../assets/labImages';
import { TheoryAccordion } from '../components/MathBlock';
import { EDUCATIONAL_PRESETS, useLab } from '../store/LabContext';
import { PageId } from '../types';
import { AudioSpectrogramPage } from './AudioSpectrogramPage';

export const DashboardPage: React.FC = () => {
  const { setActivePage, applyEducationalPreset, lang } = useLab();

  const quickModules: {
    id: PageId;
    title: string;
    faTitle: string;
    desc: string;
    faDesc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'signal-generator',
      title: 'Multi-Channel Signal & Noise Lab',
      faTitle: 'تولیدکننده سیگنال و نویز کانال',
      desc: 'Compose waveforms, AWGN, impulse noise, and 50/60 Hz interference.',
      faDesc: 'ساخت سیگنال‌های ترکیبی، نویز گوسی (AWGN) و تداخل برق شهر.',
      icon: Activity,
    },
    {
      id: 'filtering',
      title: 'Digital Filtering (FIR / IIR)',
      faTitle: 'فیلترینگ دیجیتال (FIR / IIR)',
      desc: 'Low-pass, high-pass, band-pass, and notch filtering with SNR metrics.',
      faDesc: 'فیلترهای پایین‌گذر، بالاگذر، میان‌گذر و ناچ به همراه بهبود SNR.',
      icon: Filter,
    },
    {
      id: 'fft-spectrum',
      title: 'FFT & Windowing Analysis',
      faTitle: 'تحلیل فوریه (FFT) و پنجره‌ها',
      desc: 'Compare Hann, Hamming, Blackman, and Flat-Top spectral leakage.',
      faDesc: 'بررسی نشت طیفی و تفکیک‌پذیری فرکانسی با پنجره‌های مختلف.',
      icon: BarChart3,
    },
    {
      id: 'wavelet-analysis',
      title: 'Wavelet Multi-Resolution',
      faTitle: 'تحلیل موجک (Wavelet)',
      desc: 'Continuous wavelet scalogram and multi-level wavelet denoising.',
      faDesc: 'اسکالوگرام زمان-مقیاس و حذف نویز مبتنی بر آستانه‌گذاری موجک.',
      icon: Layers,
    },
    {
      id: 'eeg-simulator',
      title: 'Synthetic EEG Brainwave Lab',
      faTitle: 'شبیه‌ساز نوار مغز (EEG)',
      desc: 'Delta, Theta, Alpha, Beta, Gamma bands with artifact removal.',
      faDesc: 'شبیه‌سازی ریتم‌های مغزی و حذف آرتیفکت پلک‌زدن و عضله.',
      icon: Activity,
    },
    {
      id: 'modulation-ber',
      title: 'Digital Modulation & BER',
      faTitle: 'مدولاسیون دیجیتال و BER',
      desc: 'BPSK, QPSK, 16-QAM constellations and Monte-Carlo bit error curves.',
      faDesc: 'نمودار صورت فلکی BPSK/QPSK/QAM و منحنی نرخ خطای بیت.',
      icon: Signal,
    },
    {
      id: 'telecommunications',
      title: 'Analog RF Modulation',
      faTitle: 'مخابرات آنالوگ (AM / FM)',
      desc: 'AM, DSB-SC, SSB, FM, and PM carrier modulation and demodulation.',
      faDesc: 'مدولاسیون و دمدولاسیون دامنه، فرکانس و فاز در حضور نویز.',
      icon: Radio,
    },
    {
      id: 'ica',
      title: 'FastICA Blind Source Separation',
      faTitle: 'جداسازی کور منابع (FastICA)',
      desc: 'Unmix overlapping signals (cocktail party problem) via kurtosis.',
      faDesc: 'جداسازی سیگنال‌های مخلوط‌شده مستقل با الگوریتم FastICA.',
      icon: Cpu,
    },
    {
      id: 'deep-learning',
      title: '1D Neural DSP (TensorFlow.js)',
      faTitle: 'یادگیری عمیق سیگنال (TF.js)',
      desc: 'Train 1D CNNs and Autoencoders directly in the browser.',
      faDesc: 'آموزش زنده شبکه عصبی کانولوشنی و خودرمزگذار در مرورگر.',
      icon: Brain,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Primary Interactive Audio Signal Player & Logarithmic Spectrogram Workspace */}
      <AudioSpectrogramPage embedded />

      {/* Clean Specialized Lab Modules Grid + Preset Loader */}
      <div className="neu-card p-6 sm:p-7 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              {lang === 'fa'
                ? 'ماژول‌های تخصصی آزمایشگاه پردازش سیگنال'
                : 'Specialized Signal Processing Modules'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'fa'
                ? 'انتخاب مستقیم ابزارهای تخصصی فیلترینگ، مخابرات، موجک، EEG و یادگیری ماشین'
                : 'Jump directly into specialized DSP, telecommunications, EEG, and machine learning workspaces'}
            </p>
          </div>

          <select
            aria-label="Load Educational Preset"
            onChange={(e) => {
              const found = EDUCATIONAL_PRESETS.find((p) => p.id === e.target.value);
              if (found) applyEducationalPreset(found);
            }}
            defaultValue=""
            className="neu-inset px-4 py-2 text-xs font-medium rounded-full bg-transparent outline-none cursor-pointer"
          >
            <option value="" disabled>
              {lang === 'fa'
                ? 'بارگذاری سناریوی آموزشی آماده...'
                : 'Load Educational Scenario...'}
            </option>
            {EDUCATIONAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickModules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActivePage(m.id)}
                className="neu-card-sm p-4 text-start flex items-start gap-3.5 hover:border-sky-400/50 transition-all cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {lang === 'fa' ? m.faTitle : m.title}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {lang === 'fa' ? m.faDesc : m.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Visual Concept Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pt-2 border-t border-slate-300/40 dark:border-slate-800/70">
          <div className="lg:col-span-4 oscilloscope-frame overflow-hidden">
            <img
              src={LAB_IMAGES.dspFourier}
              alt={
                lang === 'fa'
                  ? 'تجزیه طیفی فوریه و زمان-فرکانس'
                  : 'Fourier & Time-Frequency Decomposition'
              }
              referrerPolicy="no-referrer"
              className="w-full h-36 object-cover opacity-90"
            />
          </div>
          <div className="lg:col-span-8 flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-tight">
              {lang === 'fa'
                ? 'طیف‌نگار (Spectrogram) چگونه کار می‌کند؟'
                : 'How the Interactive Logarithmic Spectrogram Works'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'fa'
                ? 'طیف‌نگار نشان می‌دهد که محتوای فرکانسی سیگنال چگونه در طول زمان تغییر می‌کند. محور عمودی به‌صورت لگاریتمی از ۱۰ هرتز تا ۲۰ کیلوهرتز درجه‌بندی شده است تا هم فرکانس‌های پایین (مانند ۲۰ هرتز و ۱۰۰ هرتز) و هم فرکانس‌های بالا به وضوح قابل مشاهده و شنیدن باشند. روی هر نقطه از طیف‌نگار کلیک کنید تا صدای آن فرکانس را بشنوید.'
                : 'A spectrogram shows how the frequency content of a signal changes over time. The vertical frequency axis is scaled logarithmically from 10 Hz to 20 kHz so low frequencies (like 20 Hz and 100 Hz) and high-frequency harmonics are equally clear. Click or drag anywhere on the spectrogram to hear the selected frequency.'}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Theory Accordion */}
      <TheoryAccordion
        items={
          lang === 'fa'
            ? [
                {
                  title: 'نمونه‌برداری زمان‌گسسته و قضیه نایکوئیست-شانون',
                  formula:
                    'x[n] = x(n T_s) = x\\!\\left(\\frac{n}{f_s}\\right), \\quad f_{\\text{Nyquist}} = \\frac{f_s}{2}',
                  explanation:
                    'یک سیگنال پیوسته در زمان x(t) با نرخ fs هرتز نمونه‌برداری می‌شود. برای جلوگیری از پدیده تداخل طیفی (Aliasing)، نرخ نمونه‌برداری fs باید حداقل دو برابر بیشترین مؤلفه فرکانسی سیگنال باشد.',
                  variables: 'fs: نرخ نمونه‌برداری (Hz) · Ts: دوره تناوب نمونه‌برداری (s)',
                },
                {
                  title: 'تبدیل فوریه زمان‌کوتاه (STFT) و طیف‌نگار لگاریتمی',
                  formula:
                    'X(m, \\omega) = \\sum_{n=-\\infty}^{\\infty} x[n]\\,w[n - mH]\\,e^{-j\\omega n}, \\quad S_{\\text{dB}}(m, f) = 20\\log_{10}|X(m, f)|',
                  explanation:
                    'طیف‌نگار با اعمال پنجره لغزان Hann روی سیگنال و محاسبه تبدیل فوریه در هر قطعه زمانی، توزیع انرژی سیگنال را در صفحه زمان-فرکانس نمایش می‌دهد.',
                  variables: 'w[n]: پنجره Hann · H: گام پرش زمانی (Hop Size)',
                },
              ]
            : [
                {
                  title: 'Discrete-Time Signal Representation & Nyquist Sampling',
                  formula:
                    'x[n] = x(n T_s) = x\\!\\left(\\frac{n}{f_s}\\right), \\quad f_{\\text{Nyquist}} = \\frac{f_s}{2}',
                  explanation:
                    'A continuous-time waveform x(t) sampled at rate fs (Hz) yields discrete sequence x[n]. To prevent spectral aliasing, the sampling rate fs must strictly exceed twice the highest frequency component.',
                  variables: 'fs: Sampling Rate (Hz) · Ts = 1/fs: Sample Period (s) · N: Number of Samples',
                },
                {
                  title: 'Short-Time Fourier Transform (STFT) & Logarithmic Spectrogram',
                  formula:
                    'X(m, \\omega) = \\sum_{n=-\\infty}^{\\infty} x[n]\\,w[n - mH]\\,e^{-j\\omega n}, \\quad S_{\\text{dB}}(m, f) = 20\\log_{10}|X(m, f)|',
                  explanation:
                    'The spectrogram applies a sliding Hann window w[n] across time frames m and evaluates the magnitude spectrum in dB across a logarithmic frequency axis (10 Hz to 20 kHz).',
                  variables: 'w[n]: Window function · H: Hop size in samples · f: Logarithmic frequency (Hz)',
                },
              ]
        }
      />
    </div>
  );
};
