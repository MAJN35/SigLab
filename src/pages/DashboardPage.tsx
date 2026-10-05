import React from 'react';
import { LAB_IMAGES } from '../assets/labImages';
import { InteractiveHeatmap, InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { EDUCATIONAL_PRESETS, useLab } from '../store/LabContext';
import { AudioSpectrogramPage } from './AudioSpectrogramPage';

export const DashboardPage: React.FC = () => {
  const {
    experiment,
    setExperiment,
    computed,
    setActivePage,
    applyEducationalPreset,
    lang,
  } = useLab();

  return (
    <div className="flex flex-col gap-8">
      {/* Spacious Hero & Live Parameter Strip */}
      <div className="neu-card p-6 sm:p-8 flex flex-col gap-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
              {lang === 'fa'
                ? `آزمایش فعال · نرخ نمونه ${experiment.signal.samplingRate} Hz · بذر #${experiment.randomSeed}`
                : `Active Workspace · fs = ${experiment.signal.samplingRate} Hz · Seed #${experiment.randomSeed}`}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {lang === 'fa' && experiment.id === 'exp-default-lab'
                ? 'آزمایشگاه تعاملی پردازش سیگنال و تحلیل طیفی'
                : experiment.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'fa'
                ? 'محیط شبیه‌سازی زنده برای بررسی شکل‌موج در حوزه زمان، طیف فرکانسی فوریه (FFT)، طیف‌نگار زمان-فرکانس (STFT)، مخابرات، EEG و یادگیری عمیق.'
                : experiment.description ||
                  'Interactive time-domain, spectral, and time-frequency laboratory workspace.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              aria-label="Load Educational Preset"
              onChange={(e) => {
                const found = EDUCATIONAL_PRESETS.find((p) => p.id === e.target.value);
                if (found) applyEducationalPreset(found);
              }}
              defaultValue=""
              className="neu-inset px-4 py-2.5 text-xs font-medium rounded-full bg-transparent outline-none cursor-pointer"
            >
              <option value="" disabled>
                {lang === 'fa'
                  ? 'انتخاب سناریوی آموزشی آماده...'
                  : 'Load Educational Preset...'}
              </option>
              {EDUCATIONAL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.category}] {p.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setActivePage('audio-lab')}
              className="btn-primary-pill px-5 py-2.5 text-xs whitespace-nowrap cursor-pointer"
            >
              {lang === 'fa' ? 'پخش زنده صوت و طیف‌نگار' : 'Live Audio & Spectrogram'}
            </button>

            <button
              type="button"
              onClick={() => setActivePage('signal-generator')}
              className="neu-btn px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              {lang === 'fa' ? 'تنظیم سیگنال' : 'Configure Signal'}
            </button>
          </div>
        </div>

        {/* Clean 4-Slider Live Control Bar with Integrated Readouts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5 border-t border-slate-300/40 dark:border-slate-800/70">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'fa' ? 'فرکانس اصلی (f0)' : 'Primary Frequency (f0)'}
              </span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {experiment.signal.frequency.toFixed(1)} Hz
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={0.5}
              value={experiment.signal.frequency}
              onChange={(e) => {
                const val = Number(e.target.value);
                setExperiment((prev) => ({
                  ...prev,
                  signal: {
                    ...prev.signal,
                    frequency: val,
                    components: prev.signal.components.map((c, idx) =>
                      idx === 0 ? { ...c, frequency: val } : c
                    ),
                  },
                }));
              }}
              className="sci-slider"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'fa' ? 'دامنه سیگنال (A)' : 'Signal Amplitude (A)'}
              </span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {experiment.signal.amplitude.toFixed(2)} V
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={5}
              step={0.1}
              value={experiment.signal.amplitude}
              onChange={(e) => {
                const val = Number(e.target.value);
                setExperiment((prev) => ({
                  ...prev,
                  signal: {
                    ...prev.signal,
                    amplitude: val,
                    components: prev.signal.components.map((c, idx) =>
                      idx === 0 ? { ...c, amplitude: val } : c
                    ),
                  },
                }));
              }}
              className="sci-slider"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'fa' ? 'نسبت سیگنال به نویز (SNR)' : 'Channel SNR (AWGN)'}
              </span>
              <span className="font-bold text-amber-500">
                {computed.empiricalSnrDb.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={-5}
              max={35}
              step={1}
              value={experiment.noise.snrDb}
              onChange={(e) =>
                setExperiment((prev) => ({
                  ...prev,
                  noise: { ...prev.noise, enabled: true, snrDb: Number(e.target.value) },
                }))
              }
              className="sci-slider"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'fa' ? 'فرکانس قطع فیلتر (fH)' : 'Filter Cutoff (fH)'}
              </span>
              <span className="font-bold text-emerald-500">
                {experiment.filter.cutoffHigh.toFixed(0)} Hz · SNR {computed.filteredSnrDb.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={1}
              value={experiment.filter.cutoffHigh}
              onChange={(e) =>
                setExperiment((prev) => ({
                  ...prev,
                  filter: {
                    ...prev.filter,
                    enabled: true,
                    cutoffHigh: Number(e.target.value),
                  },
                }))
              }
              className="sci-slider"
            />
          </div>
        </div>
      </div>

      {/* Live Audio Signal Player & Interactive Click-to-Hear Spectrogram System */}
      <AudioSpectrogramPage embedded />

      {/* Primary Time-Domain & Frequency Spectrum Plots with Generous Spacing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <InteractivePlot
          title={
            lang === 'fa'
              ? 'اسیلوسکوپ حوزه زمان (سیگنال تمیز، نویزی و فیلترشده)'
              : 'Time-Domain Oscilloscope (Clean, Noisy & Filtered)'
          }
          subtitle={
            lang === 'fa'
              ? 'برای بزرگ‌نمایی روی نمودار کادر بکشید'
              : 'Drag on the canvas to zoom · Hover to inspect sample values'
          }
          xData={computed.time}
          xLabel={lang === 'fa' ? 'زمان (s)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
          height={290}
          series={[
            {
              id: 'clean',
              label: lang === 'fa' ? 'تمیز x(t)' : 'Clean x(t)',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'noisy',
              label: lang === 'fa' ? 'نویزی' : 'Noisy',
              data: computed.noisySignal,
              color: '#f59e0b',
              lineWidth: 1.2,
            },
            {
              id: 'filtered',
              label: lang === 'fa' ? 'فیلترشده y(t)' : 'Filtered y(t)',
              data: computed.filteredSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? `طیف دامنه تبدیل فوریه سریع (N=${experiment.analysis.fft.fftSize})`
              : `FFT Magnitude Spectrum (N=${experiment.analysis.fft.fftSize})`
          }
          subtitle={
            lang === 'fa'
              ? 'قله‌های هارمونیکی غالب و پاسخ فرکانسی فیلتر'
              : 'Automatic harmonic peak detection & filter response |H(f)|'
          }
          xData={computed.spectrum.frequencies}
          xLabel={lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
          yLabel={lang === 'fa' ? 'دامنه |X(f)|' : 'Magnitude |X(f)|'}
          height={290}
          peaks={computed.peaks.map((pk) => ({
            x: pk.frequency,
            y: pk.magnitude,
            label: `${pk.frequency.toFixed(1)}Hz`,
          }))}
          series={[
            {
              id: 'fft-noisy',
              label: lang === 'fa' ? 'طیف سیگنال' : 'Spectrum |X(f)|',
              data: computed.spectrum.magnitude,
              color: '#f59e0b',
              lineWidth: 1.5,
            },
            {
              id: 'fft-filt',
              label: lang === 'fa' ? 'پاسخ فیلتر |H(f)|' : 'Filter |H(f)|',
              data: computed.filterMagResponse.slice(
                0,
                computed.spectrum.frequencies.length
              ),
              color: '#10b981',
              lineWidth: 1.8,
              dashed: true,
            },
          ]}
        />
      </div>

      {/* STFT Spectrogram + Concept Visual Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-8">
          <InteractiveHeatmap
            title={
              lang === 'fa'
                ? 'طیف‌نگار زمان-فرکانس (STFT Spectrogram)'
                : 'Time-Frequency Spectrogram (STFT)'
            }
            subtitle={
              lang === 'fa'
                ? 'توزیع انرژی فرکانسی سیگنال در طول زمان با پنجره Hann'
                : 'Localized spectral energy across sliding Hann time windows'
            }
            xValues={computed.spectrogram.times}
            yValues={computed.spectrogram.frequencies}
            matrix={computed.spectrogram.matrix}
            xLabel={lang === 'fa' ? 'زمان (s)' : 'Time (s)'}
            yLabel={lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
            height={260}
          />
        </div>

        <div className="lg:col-span-4 neu-card p-6 flex flex-col justify-between gap-4">
          <div className="oscilloscope-frame overflow-hidden">
            <img
              src={LAB_IMAGES.dspFourier}
              alt={
                lang === 'fa'
                  ? 'تجزیه طیفی فوریه و هارمونیک‌های سیگنال'
                  : 'Fourier Harmonic Decomposition Diagram'
              }
              referrerPolicy="no-referrer"
              className="w-full h-44 object-cover opacity-90"
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-tight">
              {lang === 'fa'
                ? 'کاوش در ۱۴ ماژول تخصصی آزمایشگاه'
                : 'Explore Specialized Lab Modules'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'fa'
                ? 'از نوار بالا می‌توانید وارد بخش‌های تخصصی موجک، فیلترینگ، مخابرات دیجیتال، شبیه‌ساز نوار مغز (EEG)، جداسازی کور منابع (ICA) و شبکه عصبی شوید.'
                : 'Jump directly into Wavelet Scalograms, Digital Filter Design, QPSK/QAM Constellations, Synthetic EEG, FastICA, or In-Browser Neural Networks.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActivePage('eeg-simulator')}
              className="neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
            >
              {lang === 'fa' ? 'شبیه‌ساز EEG' : 'EEG Lab'}
            </button>
            <button
              type="button"
              onClick={() => setActivePage('modulation-ber')}
              className="neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
            >
              {lang === 'fa' ? 'صورت فلکی و BER' : 'Modulation & BER'}
            </button>
            <button
              type="button"
              onClick={() => setActivePage('deep-learning')}
              className="neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
            >
              {lang === 'fa' ? 'یادگیری عمیق' : 'Deep Learning'}
            </button>
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
                  title: 'نسبت سیگنال به نویز (SNR) و تبدیل فوریه گسسته (DFT)',
                  formula:
                    '\\text{SNR}_{\\text{dB}} = 10 \\log_{10}\\!\\left(\\frac{\\sum_{n=0}^{N-1} |x[n]|^2}{\\sum_{n=0}^{N-1} |w[n]|^2}\\right), \\quad X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j\\frac{2\\pi}{N}kn}',
                  explanation:
                    'نسبت سیگنال به نویز (SNR) توان سیگنال مطلوب را به توان نویز مقایسه می‌کند. تبدیل فوریه گسسته (DFT) سیگنال را به مؤلفه‌های فرکانسی f_k = k · fs / N تجزیه می‌نماید.',
                  variables: 'X[k]: ضریب طیفی فوریه · w[n]: دنباله نویز افزایشی',
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
                  title: 'Empirical Signal-to-Noise Ratio (SNR) & Spectral Decomposition',
                  formula:
                    '\\text{SNR}_{\\text{dB}} = 10 \\log_{10}\\!\\left(\\frac{\\sum_{n=0}^{N-1} |x[n]|^2}{\\sum_{n=0}^{N-1} |w[n]|^2}\\right), \\quad X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j\\frac{2\\pi}{N}kn}',
                  explanation:
                    'SNR measures the logarithmic ratio of clean signal power to additive noise power. The Discrete Fourier Transform (DFT) projects the time-domain signal onto orthogonal complex exponential basis functions.',
                  variables: 'X[k]: Complex Fourier bin at f_k = k·fs/N · w[n]: Noise sequence',
                },
              ]
        }
      />
    </div>
  );
};
