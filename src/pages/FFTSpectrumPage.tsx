import React, { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { BarChart3, RotateCcw } from 'lucide-react';
import { InteractiveHeatmap, InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import type { Signal3DStageProps } from '../components/Signal3DStage';
import { PageHeader, ParamSlider } from '../components/ui';
import { getSeriesColor, getSeriesDash } from '../theme/palette';
import { useLab } from '../store/LabContext';
import { WindowFunctionType } from '../types';
import { calculateRMSE } from '../utils/math';

const WINDOWS: { id: WindowFunctionType; label: string; faLabel: string; sidelobe: string }[] = [
  { id: 'rectangular', label: 'Rectangular (Dirichlet)', faLabel: 'مستطیلی (Dirichlet)', sidelobe: '-13 dB' },
  { id: 'hann', label: 'Hann (Raised Cosine)', faLabel: 'هان (Hann)', sidelobe: '-31.5 dB' },
  { id: 'hamming', label: 'Hamming', faLabel: 'همینگ (Hamming)', sidelobe: '-42.7 dB' },
  { id: 'blackman', label: 'Blackman (3-Term)', faLabel: 'بلک‌من (Blackman)', sidelobe: '-58 dB' },
  { id: 'flattop', label: 'Flat-Top (Amplitude Calibrated)', faLabel: 'فلت‌تاپ (کالیبره دامنه)', sidelobe: '-93 dB' },
];

// Babylon.js is heavy: load the 3D stage only when it is about to be seen.
const Signal3DStage = lazy(() =>
  import('../components/Signal3DStage').then((m) => ({ default: m.Signal3DStage }))
);

const STAGE_HEIGHT_CLASS = 'h-[460px] sm:h-[520px]';

const StagePlaceholder: React.FC<{ isFa: boolean }> = ({ isFa }) => (
  <div
    className={`neu-card ${STAGE_HEIGHT_CLASS} flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400`}
    role="status"
    aria-live="polite"
  >
    {isFa ? 'در حال بارگذاری صحنه سه‌بعدی…' : 'Loading 3D stage…'}
  </div>
);

/** Mounts the lazy Signal3DStage once its container scrolls near the viewport. */
const LazySignal3DStage: React.FC<Signal3DStageProps & { isFa: boolean }> = ({ isFa, ...props }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <Suspense fallback={<StagePlaceholder isFa={isFa} />}>
          <Signal3DStage {...props} />
        </Suspense>
      ) : (
        <StagePlaceholder isFa={isFa} />
      )}
    </div>
  );
};

export const FFTSpectrumPage: React.FC = () => {
  const { experiment, setExperiment, computed, lang, darkMode, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const fftSizeLabelId = useId();
  const windowSelectId = useId();
  const scaleLabelId = useId();
  const fftCfg = experiment.analysis.fft;

  const updateFFT = (patch: Partial<typeof fftCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        fft: { ...prev.analysis.fft, ...patch },
      },
    }));
  };

  // Slice spectrum up to maxFreqLimit
  const maxFreq = Math.min(experiment.signal.samplingRate / 2, fftCfg.maxFreqLimit);
  let limitIdx = computed.spectrum.frequencies.findIndex((f) => f > maxFreq);
  if (limitIdx === -1) limitIdx = computed.spectrum.frequencies.length;

  const freqs = computed.spectrum.frequencies.slice(0, limitIdx);
  const mag = (fftCfg.logScale
    ? computed.spectrum.magnitudeDb
    : computed.spectrum.magnitude
  ).slice(0, limitIdx);
  const phase = computed.spectrum.phaseDeg.slice(0, limitIdx);
  const psd = computed.spectrum.psdDb.slice(0, limitIdx);

  const ifftLen = computed.spectrum.ifftReconstructed.length;
  const ifftRmse = calculateRMSE(
    computed.noisySignal.slice(0, ifftLen),
    computed.spectrum.ifftReconstructed
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls Card */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <PageHeader
          icon={<BarChart3 className="w-5 h-5" />}
          title={
            isFa
              ? 'آزمایشگاه تبدیل فوریه سریع (FFT)، چگالی طیف توان (PSD) و STFT'
              : 'Fast Fourier Transform (FFT), PSD & STFT Laboratory'
          }
          subtitle={
            isFa
              ? 'تحلیل طیف دامنه و فاز تبدیل فوریه سریع، چگالی طیف توان (PSD)، طیف‌نگار زمان-فرکانس (STFT) و بازسازی دقیق سیگنال با تبدیل فوریه معکوس (IFFT).'
              : 'Analyze forward FFT magnitude, phase, Power Spectral Density (PSD), Short-Time Fourier Transform (STFT), and exact Inverse FFT reconstruction.'
          }
          stats={[
            {
              label: isFa ? 'تفکیک‌پذیری فرکانسی Δf' : 'Bin Resolution Δf',
              value: `${(experiment.signal.samplingRate / fftCfg.fftSize).toFixed(2)} Hz`,
            },
            { label: isFa ? 'خطای بازسازی IFFT' : 'IFFT RMSE', value: ifftRmse.toExponential(2) },
          ]}
          actions={
            <button
              type="button"
              onClick={resetExperiment}
              className="neu-btn rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {isFa ? 'بازنشانی به پیش‌فرض' : 'Reset to defaults'}
            </button>
          }
        />

        {/* FFT Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <span id={fftSizeLabelId} className="block text-xs font-mono text-slate-500 mb-1.5">
              {lang === 'fa' ? 'اندازه پنجره FFT (N)' : 'FFT Radix-2 Size (N)'}
            </span>
            <div className="flex flex-wrap gap-1" role="group" aria-labelledby={fftSizeLabelId}>
              {([128, 256, 512, 1024, 2048] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => updateFFT({ fftSize: sz })}
                  aria-pressed={fftCfg.fftSize === sz}
                  className={`neu-btn px-2.5 py-1 rounded-chip text-xs font-mono cursor-pointer ${
                    fftCfg.fftSize === sz ? 'neu-btn-active text-sky-500 font-bold' : ''
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={windowSelectId} className="block text-xs font-mono text-slate-500 mb-1.5">
              {lang === 'fa' ? 'پنجره هموارسازی طیفی w[n]' : 'Apodization Window w[n]'}
            </label>
            <select
              id={windowSelectId}
              value={fftCfg.windowType}
              onChange={(e) => updateFFT({ windowType: e.target.value as WindowFunctionType })}
              className="neu-inset w-full px-3 py-1.5 rounded-control text-xs font-mono"
            >
              {WINDOWS.map((w) => (
                <option key={w.id} value={w.id}>
                  {lang === 'fa' ? w.faLabel : w.label} ({w.sidelobe})
                </option>
              ))}
            </select>
          </div>

          <ParamSlider
            label="Sampling Rate (fs)"
            faLabel="نرخ نمونه‌برداری (fs)"
            value={experiment.signal.samplingRate}
            min={64}
            max={1024}
            step={32}
            unit="Hz"
            onChange={(v) =>
              setExperiment((prev) => ({
                ...prev,
                signal: { ...prev.signal, samplingRate: v },
              }))
            }
          />

          <ParamSlider
            label="Frequency Display Limit"
            faLabel="حداکثر فرکانس نمایش"
            value={fftCfg.maxFreqLimit}
            min={20}
            max={512}
            step={10}
            unit="Hz"
            onChange={(v) => updateFFT({ maxFreqLimit: v })}
          />

          <div className="flex flex-col justify-between">
            <span id={scaleLabelId} className="text-xs font-mono text-slate-500">
              {lang === 'fa' ? 'مقیاس محور دامنه' : 'Amplitude Axis Scale'}
            </span>
            <button
              type="button"
              aria-describedby={scaleLabelId}
              aria-pressed={fftCfg.logScale}
              onClick={() => updateFFT({ logScale: !fftCfg.logScale })}
              className="neu-btn py-1.5 px-3 rounded-control text-xs font-mono font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
            >
              {fftCfg.logScale
                ? lang === 'fa'
                  ? 'لگاریتمی دسی‌بل (20 log₁₀ dB)'
                  : 'Logarithmic (20 log₁₀ dB)'
                : lang === 'fa'
                ? 'دامنه خطی |X[k]|'
                : 'Linear Magnitude |X[k]|'}
            </button>
          </div>
        </div>

        {/* Dominant Frequency Peaks Table */}
        <div className="neu-inset p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono font-semibold text-slate-500">
            {lang === 'fa' ? 'قله‌های فرکانسی غالب شناسایی‌شده:' : 'Detected Dominant Spectral Peaks:'}
          </span>
          <div
            className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums"
            role="status"
            aria-live="polite"
          >
            {computed.peaks.length === 0 ? (
              <span className="text-slate-400">
                {lang === 'fa'
                  ? 'هیچ قله فرکانسی بارزی بالاتر از آستانه یافت نشد'
                  : 'No prominent tonal peaks above threshold'}
              </span>
            ) : (
              computed.peaks.map((pk, idx) => (
                <span key={idx}>
                  <strong className="text-amber-500">
                    {lang === 'fa' ? `قله #${idx + 1}:` : `Peak #${idx + 1}:`}
                  </strong>{' '}
                  {pk.frequency.toFixed(2)} Hz ({pk.magnitude.toFixed(2)} V /{' '}
                  {pk.magnitudeDb.toFixed(1)} dB)
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3D Interactive FFT, Signal Helix & Time-Frequency Stage */}
      <LazySignal3DStage
        isFa={isFa}
        fallbackWave={computed.noisySignal}
        fallbackFilteredWave={computed.filteredSignal}
        fallbackSpectrumMag={computed.spectrum.magnitude}
        fallbackSpectrumFreqs={computed.spectrum.frequencies}
        frequency={experiment.signal.frequency}
        waveType={experiment.signal.type}
        lang={lang}
        darkMode={darkMode}
        heightClass={STAGE_HEIGHT_CLASS}
      />

      {/* Magnitude Spectrum & Power Spectral Density */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? `طیف دامنه یک‌طرفه تبدیل فوریه سریع (پنجره ${fftCfg.windowType.toUpperCase()})`
              : `One-Sided FFT Magnitude Spectrum (${fftCfg.windowType.toUpperCase()} Window)`
          }
          subtitle={
            lang === 'fa'
              ? 'قله‌های هارمونیکی غالب با نشانگر کهربایی مشخص شده‌اند'
              : 'Dominant harmonic peaks highlighted with amber markers'
          }
          xData={freqs}
          xLabel={lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
          yLabel={
            fftCfg.logScale
              ? lang === 'fa'
                ? 'دامنه (dB)'
                : 'Magnitude (dB)'
              : lang === 'fa'
              ? 'دامنه |X(f)|'
              : 'Amplitude |X(f)|'
          }
          xUnit="Hz"
          yUnit={fftCfg.logScale ? 'dB' : undefined}
          height={265}
          peaks={computed.peaks.map((pk) => ({
            x: pk.frequency,
            y: fftCfg.logScale ? pk.magnitudeDb : pk.magnitude,
            label: `${pk.frequency.toFixed(1)}Hz`,
          }))}
          series={[
            {
              id: 'fft-main',
              label: fftCfg.logScale
                ? lang === 'fa'
                  ? 'دامنه (dB)'
                  : 'Magnitude (dB)'
                : lang === 'fa'
                ? 'دامنه |X(f)|'
                : 'Magnitude |X(f)|',
              data: mag,
              color: getSeriesColor(0),
              lineWidth: 2,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'چگالی طیف توان (PSD) و طیف فاز ∠X(f)'
              : 'Power Spectral Density (PSD) & Phase Spectrum ∠X(f)'
          }
          subtitle={
            lang === 'fa'
              ? 'چگالی طیف توان (dB/Hz، محور چپ) و زاویه فاز (درجه، محور راست)'
              : 'Periodogram PSD (dB/Hz, left axis) and Phase Angle (degrees, right axis)'
          }
          xData={freqs}
          xLabel={lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
          yLabel={lang === 'fa' ? 'چگالی توان (dB/Hz)' : 'PSD (dB/Hz)'}
          yLabelRight={lang === 'fa' ? 'فاز (°)' : 'Phase (°)'}
          yDomainRightOverride={[-180, 180]}
          xUnit="Hz"
          yUnit="dB/Hz"
          yUnitRight="°"
          height={265}
          series={[
            {
              id: 'psd-curve',
              label: lang === 'fa' ? 'چگالی طیف توان (dB/Hz)' : 'Power Spectral Density (dB/Hz)',
              data: psd,
              color: getSeriesColor(0),
              dash: getSeriesDash(0),
              unit: 'dB/Hz',
              lineWidth: 1.9,
            },
            {
              id: 'phase-curve',
              label: lang === 'fa' ? 'طیف فاز (درجه)' : 'Phase Spectrum (deg)',
              data: phase,
              color: getSeriesColor(1),
              dash: getSeriesDash(1),
              yAxis: 'right',
              unit: '°',
              lineWidth: 1.3,
              visible: false,
            },
          ]}
        />
      </div>

      {/* STFT Spectrogram & Inverse FFT Verification */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractiveHeatmap
          title={
            lang === 'fa'
              ? `طیف‌نگار زمان-فرکانس STFT (پنجره=${fftCfg.stftWindowSize}، گام=${fftCfg.stftHopSize})`
              : `STFT Time-Frequency Spectrogram (Win=${fftCfg.stftWindowSize}, Hop=${fftCfg.stftHopSize})`
          }
          subtitle={
            lang === 'fa'
              ? 'نشانگر ماوس را روی صفحه زمان-فرکانس حرکت دهید تا انرژی طیفی محلی را بررسی کنید'
              : 'Hover across the time-frequency plane to inspect localized spectral energy'
          }
          xValues={computed.spectrogram.times}
          yValues={computed.spectrogram.frequencies}
          matrix={computed.spectrogram.matrix}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
          xProbeLabel={lang === 'fa' ? 'زمان' : 'Time'}
          xProbeUnit=" s"
          yProbeLabel={lang === 'fa' ? 'فرکانس' : 'Frequency'}
          yProbeUnit=" Hz"
          valueProbeLabel={lang === 'fa' ? 'انرژی' : 'Energy'}
          height={260}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'تأیید بازسازی حوزه زمان با تبدیل فوریه معکوس (IFFT)'
              : 'Inverse FFT (IFFT) Time-Domain Reconstruction Verification'
          }
          subtitle={
            lang === 'fa'
              ? `بررسی صحت رابطه x[n] = IFFT(FFT(x[n])) · خطای بازسازی RMSE = ${ifftRmse.toExponential(2)}`
              : `Verifies x[n] = IFFT(FFT(x[n])) · Reconstruction RMSE = ${ifftRmse.toExponential(2)}`
          }
          xData={computed.time.slice(0, ifftLen)}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
          xUnit="s"
          yUnit="V"
          height={260}
          series={[
            {
              id: 'orig-ifft',
              label: lang === 'fa' ? 'سیگنال ورودی اصلی x[n]' : 'Original Input Signal x[n]',
              data: computed.noisySignal.slice(0, ifftLen),
              color: getSeriesColor(0),
              lineWidth: 2,
            },
            {
              id: 'rec-ifft',
              label: lang === 'fa' ? 'سیگنال بازسازی‌شده با IFFT' : 'IFFT Reconstructed x̂[n]',
              data: computed.spectrum.ifftReconstructed,
              color: getSeriesColor(1),
              lineWidth: 1.8,
              dashed: true,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={[
          {
            title:
              lang === 'fa'
                ? 'تبدیل فوریه گسسته مستقیم و معکوس (DFT / IDFT)'
                : 'Forward & Inverse Discrete Fourier Transform (DFT / IDFT)',
            formula:
              'X[k] = \\sum_{n=0}^{N-1} x[n]e^{-j\\frac{2\\pi}{N}kn}, \\quad x[n] = \\frac{1}{N}\\sum_{k=0}^{N-1} X[k]e^{+j\\frac{2\\pi}{N}kn}',
            explanation:
              lang === 'fa'
                ? 'تبدیل فوریه گسسته (DFT) یک بلوک زمانی از سیگنال را روی N سینوسی مختلط متعامد تصویر می‌کند و تبدیل معکوس (IDFT) با جمع وزن‌دار همان فازورهای مختلط، نمونه‌های دقیق حوزه زمان را بازسازی می‌نماید.'
                : 'The forward DFT projects a time-domain block onto N harmonically related complex sinusoids, while the IDFT reconstructs the exact time-domain samples by summing those weighted phasors.',
          },
          {
            title:
              lang === 'fa'
                ? 'نشت طیفی، پنجره‌گذاری و تبدیل فوریه زمان‌کوتاه (STFT)'
                : 'Spectral Leakage, Windowing & Short-Time Fourier Transform (STFT)',
            formula:
              '\\text{STFT}\\{x[n]\\}(m, k) = \\sum_{n=-\\infty}^{\\infty} x[n]\\,w[n - mH]\\,e^{-j\\frac{2\\pi}{N}kn}',
            explanation:
              lang === 'fa'
                ? 'ضرب کردن سیگنال در یک پنجره نرم (مانند Hann، Hamming یا Blackman) گلبرگ‌های فرعی ناشی از نشت طیفی در لبه‌های برش متناهی را به شدت تضعیف می‌کند.'
                : 'Tapering the signal with a Hann, Hamming, or Blackman window w[n] suppresses spectral leakage sidelobes caused by non-integer period truncation at the expense of a slightly wider mainlobe.',
          },
        ]}
      />
    </div>
  );
};
