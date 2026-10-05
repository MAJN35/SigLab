import React from 'react';
import { InteractiveHeatmap, InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { PipelineEditor } from '../components/PipelineEditor';
import { EDUCATIONAL_PRESETS, useLab } from '../store/LabContext';

export const DashboardPage: React.FC = () => {
  const {
    experiment,
    setExperiment,
    computed,
    setActivePage,
    applyEducationalPreset,
    lang,
  } = useLab();

  const activeBlocksCount = experiment.processing.filter((b) => b.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Quick Preset Bar */}
      <div className="neu-card p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div>
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400 mb-1">
              {lang === 'fa'
                ? `آزمایش فعال · بذر تصادفی #${experiment.randomSeed} · موتور پردازش سیگنال تحت مرورگر`
                : `Active Experiment · Seed #${experiment.randomSeed} · Client-Side DSP Engine`}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {lang === 'fa' && experiment.id === 'exp-default-lab'
                ? 'تحلیل طیفی و فیلترینگ سیگنال ترکیبی (آزمایش پیش‌فرض)'
                : experiment.name}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {lang === 'fa'
                ? 'محیط آزمایشگاهی تعاملی برای بررسی هم‌زمان سیگنال در حوزه زمان، طیف فرکانسی فوریه (FFT)، طیف‌نگار زمان-فرکانس (STFT)، مخابرات، سیگنال‌های مغزی (EEG) و یادگیری عمیق.'
                : experiment.description ||
                  'Interactive time-domain, spectral, and time-frequency laboratory workspace.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Load Educational Preset"
              onChange={(e) => {
                const found = EDUCATIONAL_PRESETS.find((p) => p.id === e.target.value);
                if (found) applyEducationalPreset(found);
              }}
              defaultValue=""
              className="neu-inset px-3.5 py-2 text-xs font-medium rounded-full bg-transparent outline-none cursor-pointer"
            >
              <option value="" disabled>
                {lang === 'fa'
                  ? 'بارگذاری سناریوی آموزشی آماده...'
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
              onClick={() => setActivePage('signal-generator')}
              className="btn-primary-pill px-4 py-2 text-xs whitespace-nowrap cursor-pointer"
            >
              {lang === 'fa' ? 'تنظیم سیگنال پایه' : 'Configure Signal'}
            </button>
            <button
              type="button"
              onClick={() => setActivePage('experiments')}
              className="neu-btn px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              {lang === 'fa' ? 'ذخیره / خروجی JSON' : 'Save / Export JSON'}
            </button>
          </div>
        </div>

        {/* Visual Educational Illustration */}
        <div className="lg:col-span-4">
          <div className="oscilloscope-frame overflow-hidden relative group">
            <img
              src="/src/assets/images/dsp_fourier_diagram_1791208364636.jpg"
              alt={
                lang === 'fa'
                  ? 'تجزیه طیفی فوریه و هارمونیک‌های سیگنال'
                  : 'Fourier Harmonic Decomposition Diagram'
              }
              referrerPolicy="no-referrer"
              className="w-full h-36 sm:h-40 object-cover opacity-90 group-hover:scale-103 transition-transform duration-300"
            />
            <div className="p-2.5 bg-slate-950/85 border-t border-sky-400/20 text-[11px] font-mono text-slate-300 flex items-center justify-between">
              <span>
                {lang === 'fa'
                  ? 'تجزیه حوزه زمان به فرکانس · تبدیل فوریه و موجک'
                  : 'Time-Frequency Decomposition · FFT & Wavelets'}
              </span>
              <span className="text-sky-400">DSP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Scientific Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {lang === 'fa' ? 'نوع سیگنال فعلی' : 'Current Signal / Type'}
          </div>
          <div className="text-base font-bold font-mono mt-1 capitalize truncate">
            {experiment.signal.type}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {experiment.signal.type === 'composite'
              ? lang === 'fa'
                ? `${experiment.signal.components.filter((c) => c.enabled).length} هارمونیک فعال`
                : `${experiment.signal.components.filter((c) => c.enabled).length} Active Harmonics`
              : lang === 'fa'
              ? 'شکل‌موج پایه'
              : 'Single Waveform'}
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {lang === 'fa' ? 'نرخ نمونه‌برداری (fs)' : 'Sampling Rate (fs)'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {experiment.signal.samplingRate}
            <span className="text-xs font-normal text-slate-400 ml-1">Hz</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {lang === 'fa' ? 'فرکانس نایکوئیست:' : 'Nyquist:'}{' '}
            {(experiment.signal.samplingRate / 2).toFixed(0)} Hz
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {lang === 'fa' ? 'فرکانس و دامنه پایه' : 'Fundamental Freq & Amp'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {experiment.signal.frequency.toFixed(1)}
            <span className="text-xs font-normal text-slate-400 ml-1">Hz</span>
            <span className="mx-1.5 text-slate-400">·</span>
            {experiment.signal.amplitude.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">V</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {lang === 'fa' ? 'قله غالب:' : 'Dominant Peak:'}{' '}
            {computed.peaks[0]?.frequency.toFixed(1) ?? '—'} Hz
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {lang === 'fa' ? 'نویز کانال و نسبت SNR' : 'Channel Noise & SNR'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1 text-amber-500">
            {computed.empiricalSnrDb.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">dB</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {lang === 'fa' ? 'SNR پس از فیلتر:' : 'Filtered SNR:'}{' '}
            {computed.filteredSnrDb.toFixed(2)} dB
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {lang === 'fa' ? 'نرخ خطای بیت (BER) و نمونه‌ها' : 'Modulation BER & Samples'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1 text-sky-500">
            {computed.currentBer.toExponential(2)}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {lang === 'fa'
              ? `N = ${computed.time.length} نمونه · ${activeBlocksCount} مرحله پردازش`
              : `N = ${computed.time.length} samples · ${activeBlocksCount} DSP stages`}
          </div>
        </div>
      </div>

      {/* Live Quick Scrubbers */}
      <div className="neu-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>{lang === 'fa' ? 'فرکانس اصلی (f0)' : 'Primary Frequency'}</span>
            <span className="font-semibold text-sky-500">
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

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>{lang === 'fa' ? 'دامنه سیگنال (A)' : 'Signal Amplitude'}</span>
            <span className="font-semibold text-sky-500">
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

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>{lang === 'fa' ? 'نسبت سیگنال به نویز (SNR)' : 'Channel SNR (AWGN)'}</span>
            <span className="font-semibold text-amber-500">
              {experiment.noise.snrDb.toFixed(0)} dB
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

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>{lang === 'fa' ? 'فرکانس قطع بالا فیلتر (fH)' : 'Filter High Cutoff'}</span>
            <span className="font-semibold text-emerald-500">
              {experiment.filter.cutoffHigh.toFixed(0)} Hz
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

      {/* Primary Time-Domain & Frequency Spectrum Plots */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? 'اسیلوسکوپ حوزه زمان (سیگنال تمیز، نویزی و فیلترشده)'
              : 'Time-Domain Oscilloscope (Clean, Noisy & Filtered)'
          }
          subtitle={
            lang === 'fa'
              ? 'کادر بکشید تا بزرگ‌نمایی شود · نشانگر موس را حرکت دهید تا مقادیر لحظه‌ای خوانده شوند'
              : 'Drag a box to zoom · Hover to inspect exact sample values · Toggle trace visibility'
          }
          xData={computed.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={275}
          series={[
            {
              id: 'clean',
              label: lang === 'fa' ? 'سیگنال تمیز x(t)' : 'Clean Signal x(t)',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'noisy',
              label: lang === 'fa' ? 'سیگنال نویزی x(t)+n(t)' : 'Noisy Signal x(t)+n(t)',
              data: computed.noisySignal,
              color: '#f59e0b',
              lineWidth: 1.25,
            },
            {
              id: 'filtered',
              label: lang === 'fa' ? 'خروجی فیلترشده y(t)' : 'Filtered Output y(t)',
              data: computed.filteredSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? `طیف اندازه تبدیل فوریه سریع (N=${experiment.analysis.fft.fftSize}، پنجره ${experiment.analysis.fft.windowType})`
              : `FFT Magnitude Spectrum (N=${experiment.analysis.fft.fftSize}, ${experiment.analysis.fft.windowType} window)`
          }
          subtitle={
            lang === 'fa'
              ? 'تشخیص خودکار قله‌های فرکانسی غالب و مقایسه طیف نویزی و فیلترشده'
              : 'Automatic harmonic peak detection annotated on spectrum'
          }
          xData={computed.spectrum.frequencies}
          xLabel="Frequency (Hz)"
          yLabel="Magnitude |X(f)|"
          height={275}
          peaks={computed.peaks.map((pk) => ({
            x: pk.frequency,
            y: pk.magnitude,
            label: `${pk.frequency.toFixed(1)}Hz (${pk.magnitude.toFixed(2)})`,
          }))}
          series={[
            {
              id: 'fft-noisy',
              label: lang === 'fa' ? 'طیف سیگنال نویزی' : 'Noisy Spectrum',
              data: computed.spectrum.magnitude,
              color: '#f59e0b',
              lineWidth: 1.4,
            },
            {
              id: 'fft-filt',
              label: lang === 'fa' ? 'پاسخ فرکانسی فیلتر |H(f)|' : 'Filter Response |H(f)|',
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

      {/* STFT Spectrogram + Visual Processing Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5">
          <InteractiveHeatmap
            title={
              lang === 'fa'
                ? 'طیف‌نگار زمان-فرکانس تبدیل فوریه زمان‌کوتاه (STFT)'
                : 'Short-Time Fourier Transform (STFT) Spectrogram'
            }
            subtitle={
              lang === 'fa'
                ? 'توزیع انرژی زمان-فرکانس سیگنال با پنجره لغزان Hann'
                : 'Time-frequency energy localization across sliding Hann windows'
            }
            xValues={computed.spectrogram.times}
            yValues={computed.spectrogram.frequencies}
            matrix={computed.spectrogram.matrix}
            xLabel="Time (s)"
            yLabel="Frequency (Hz)"
            height={255}
          />
        </div>

        <div className="xl:col-span-7">
          <PipelineEditor compact={true} />
        </div>
      </div>

      {/* Expandable Theory Accordion */}
      <TheoryAccordion
        items={
          lang === 'fa'
            ? [
                {
                  title: 'نمونه‌برداری زمان‌گسسته و قضیه نایکوئیست-شانون',
                  formula: 'x[n] = x(n T_s) = x\\!\\left(\\frac{n}{f_s}\\right), \\quad f_{\\text{Nyquist}} = \\frac{f_s}{2}',
                  explanation:
                    'یک سیگنال پیوسته در زمان x(t) با نرخ fs هرتز نمونه‌برداری می‌شود. برای جلوگیری از پدیده تداخل طیفی (Aliasing)، نرخ نمونه‌برداری fs باید حداقل دو برابر بیشترین مؤلفه فرکانسی سیگنال باشد.',
                  variables: 'fs: نرخ نمونه‌برداری (Hz) · Ts: دوره تناوب نمونه‌برداری (s)',
                },
                {
                  title: 'نسبت سیگنال به نویز (SNR) و تبدیل فوریه گسسته (DFT)',
                  formula: '\\text{SNR}_{\\text{dB}} = 10 \\log_{10}\\!\\left(\\frac{\\sum_{n=0}^{N-1} |x[n]|^2}{\\sum_{n=0}^{N-1} |w[n]|^2}\\right), \\quad X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j\\frac{2\\pi}{N}kn}',
                  explanation:
                    'نسبت سیگنال به نویز (SNR) توان سیگنال مطلوب را به توان نویز مقایسه می‌کند. تبدیل فوریه گسسته (DFT) سیگنال را به مؤلفه‌های فرکانسی f_k = k · fs / N تجزیه می‌نماید.',
                  variables: 'X[k]: ضریب طیفی فوریه · w[n]: دنباله نویز افزایشی',
                },
              ]
            : [
                {
                  title: 'Discrete-Time Signal Representation & Nyquist Sampling',
                  formula: 'x[n] = x(n T_s) = x\\!\\left(\\frac{n}{f_s}\\right), \\quad f_{\\text{Nyquist}} = \\frac{f_s}{2}',
                  explanation:
                    'A continuous-time waveform x(t) sampled at rate fs (Hz) yields discrete sequence x[n]. To prevent spectral aliasing, the sampling rate fs must strictly exceed twice the highest frequency component.',
                  variables: 'fs: Sampling Rate (Hz) · Ts = 1/fs: Sample Period (s) · N: Number of Samples',
                },
                {
                  title: 'Empirical Signal-to-Noise Ratio (SNR) & Spectral Decomposition',
                  formula: '\\text{SNR}_{\\text{dB}} = 10 \\log_{10}\\!\\left(\\frac{\\sum_{n=0}^{N-1} |x[n]|^2}{\\sum_{n=0}^{N-1} |w[n]|^2}\\right), \\quad X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j\\frac{2\\pi}{N}kn}',
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
