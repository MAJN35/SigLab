import React, { useId, useMemo, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { InteractivePlot, type PlotMarker, type PlotShadeRegion } from '../components/InteractivePlot';
import { LiveEquation, TheoryAccordion } from '../components/MathBlock';
import { PageHeader, ParamSlider } from '../components/ui';
import { computeFFTSpectrum } from '../simulations/fft';
import { useLab } from '../store/LabContext';
import { getSeriesColor, getSeriesDash, MARKER_COLOR } from '../theme/palette';
import { FilterType } from '../types';
import { calculateRMSE } from '../utils/math';

const FILTER_TYPES: { id: FilterType; label: string; faLabel: string }[] = [
  { id: 'lowpass', label: 'Low-Pass', faLabel: 'پایین‌گذر (Low-Pass)' },
  { id: 'highpass', label: 'High-Pass', faLabel: 'بالاگذر (High-Pass)' },
  { id: 'bandpass', label: 'Band-Pass', faLabel: 'میان‌گذر (Band-Pass)' },
  { id: 'bandstop', label: 'Band-Stop', faLabel: 'میان‌نگذر (Band-Stop)' },
  { id: 'notch', label: 'Notch (Narrowband)', faLabel: 'ناچ / حذف باند باریک (Notch)' },
  { id: 'moving-average', label: 'Moving Average', faLabel: 'میانگین متحرک (Moving Average)' },
  { id: 'fir', label: 'Windowed-Sinc FIR', faLabel: 'فیلتر FIR سینک پنجره‌دار' },
  { id: 'iir', label: 'Butterworth Biquad IIR', faLabel: 'فیلتر IIR باترورث دوقطبی' },
];

/** Filter types whose implementation actually uses the Q / resonance parameter. */
const Q_FILTER_TYPES: ReadonlySet<FilterType> = new Set<FilterType>([
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'iir',
]);

const STOPBAND_COLOR = 'rgba(244, 63, 94, 0.10)';
const CUTOFF_COLOR = '#f59e0b';

export const FilteringPage: React.FC = () => {
  const { experiment, setExperiment, computed, lang, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const flt = experiment.filter;
  const fs = experiment.signal.samplingRate;
  const typeGroupId = useId();
  const scaleGroupId = useId();
  const [respScale, setRespScale] = useState<'linear' | 'db'>('linear');
  const isDb = respScale === 'db';

  const isBand = flt.type === 'bandpass' || flt.type === 'bandstop';
  const usesQ = Q_FILTER_TYPES.has(flt.type);
  const usesCutoff = flt.type !== 'moving-average';

  // Cutoffs exactly as the |H(f)| model in simulations/filters uses them.
  const fc1 = Math.max(0.5, flt.cutoffLow);
  const fc2 = Math.max(fc1 + 2, flt.cutoffHigh);
  const notchBw = fc1 / Math.max(1, flt.qFactor * 3);

  const stopbandLabel = isFa ? 'باند توقف' : 'stopband';
  const { cutoffMarkers, stopbands } = useMemo(() => {
    const m: PlotMarker[] = [];
    const r: PlotShadeRegion[] = [];
    switch (flt.type) {
      case 'lowpass':
      case 'iir':
      case 'fir':
        m.push({ x: fc1, label: `fc = ${fc1.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        r.push({ x0: fc1, x1: Infinity, color: STOPBAND_COLOR, label: stopbandLabel });
        break;
      case 'highpass':
        m.push({ x: fc1, label: `fc = ${fc1.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        r.push({ x0: 0, x1: fc1, color: STOPBAND_COLOR, label: stopbandLabel });
        break;
      case 'bandpass':
        m.push({ x: fc1, label: `f_L = ${fc1.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        m.push({ x: fc2, label: `f_H = ${fc2.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        r.push({ x0: 0, x1: fc1, color: STOPBAND_COLOR, label: stopbandLabel });
        r.push({ x0: fc2, x1: Infinity, color: STOPBAND_COLOR });
        break;
      case 'bandstop':
        m.push({ x: fc1, label: `f_L = ${fc1.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        m.push({ x: fc2, label: `f_H = ${fc2.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        r.push({ x0: fc1, x1: fc2, color: STOPBAND_COLOR, label: stopbandLabel });
        break;
      case 'notch':
        m.push({ x: fc1, label: `f₀ = ${fc1.toFixed(0)} Hz`, color: CUTOFF_COLOR });
        r.push({ x0: Math.max(0, fc1 - notchBw), x1: fc1 + notchBw, color: STOPBAND_COLOR, label: stopbandLabel });
        break;
      default:
        break;
    }
    return { cutoffMarkers: m, stopbands: r };
  }, [flt.type, fc1, fc2, notchBw, stopbandLabel]);

  const respData = isDb ? computed.filterMagResponseDb : computed.filterMagResponse;
  const respMarkers: PlotMarker[] = [
    ...cutoffMarkers,
    { y: isDb ? -3 : Math.SQRT1_2, label: '−3 dB', color: MARKER_COLOR },
  ];

  // Input vs output spectra (display only; same FFT settings as the FFT page).
  const fftSize = experiment.analysis.fft.fftSize;
  const windowType = experiment.analysis.fft.windowType;
  const outputSpectrum = useMemo(
    () => computeFFTSpectrum(computed.filteredSignal, fs, fftSize, windowType),
    [computed.filteredSignal, fs, fftSize, windowType]
  );

  const liveEq = useMemo((): { tex: string; values: Record<string, number | string> } => {
    const N = Math.max(1, flt.order);
    switch (flt.type) {
      case 'highpass':
        return {
          tex: '|H(f)| = \\frac{1}{\\sqrt{1 + ({{fc}}/f)^{2\\cdot {{N}}}}},\\quad Q = {{Q}}',
          values: { fc: fc1, N, Q: flt.qFactor },
        };
      case 'bandpass':
        return {
          tex: '|H(f)| = \\frac{1}{\\sqrt{1 + (f/{{fH}})^{2\\cdot {{N}}}}}\\cdot\\frac{1}{\\sqrt{1 + ({{fL}}/f)^{2\\cdot {{N}}}}},\\quad Q = {{Q}}',
          values: { fL: fc1, fH: fc2, N, Q: flt.qFactor },
        };
      case 'bandstop':
        return {
          tex: '|H(f)| = 1 - \\frac{1}{\\sqrt{1 + (f/{{fH}})^{2\\cdot {{N}}}}}\\cdot\\frac{1}{\\sqrt{1 + ({{fL}}/f)^{2\\cdot {{N}}}}}',
          values: { fL: fc1, fH: fc2, N },
        };
      case 'notch':
        return {
          tex: '|H(f)| = \\frac{|f - {{f0}}|}{\\sqrt{(f - {{f0}})^2 + {{bw}}^2}},\\quad \\Delta f = \\frac{f_0}{3Q},\\; Q = {{Q}}',
          values: { f0: fc1, bw: notchBw, Q: flt.qFactor },
        };
      case 'moving-average':
        return {
          tex: '|H(f)| = \\frac{1}{{{M}}}\\left|\\frac{\\sin(\\pi f\\,{{M}}/{{fs}})}{\\sin(\\pi f/{{fs}})}\\right|',
          values: { M: Math.max(2, Math.round(flt.order)), fs },
        };
      default:
        return {
          tex: '|H(f)| = \\frac{1}{\\sqrt{1 + (f/{{fc}})^{2\\cdot {{N}}}}}',
          values: { fc: fc1, N },
        };
    }
  }, [flt.type, flt.order, flt.qFactor, fc1, fc2, notchBw, fs]);

  const updateFilter = (patch: Partial<typeof flt>) => {
    setExperiment((prev) => ({
      ...prev,
      filter: { ...prev.filter, enabled: true, ...patch },
    }));
  };

  const rmseBefore = calculateRMSE(computed.cleanSignal, computed.noisySignal);
  const rmseAfter = calculateRMSE(computed.cleanSignal, computed.filteredSignal);

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <PageHeader
          icon={<SlidersHorizontal className="w-5 h-5" />}
          title={
            isFa
              ? 'آزمایشگاه فیلترینگ دیجیتال (FIR، IIR، Biquad و میانگین متحرک)'
              : 'Digital Filtering Laboratory (FIR, IIR, Biquad & Moving Average)'
          }
          subtitle={
            isFa
              ? 'طراحی فیلترهای دیجیتال انتخاب‌گر فرکانسی و بررسی هم‌زمان: ۱. سیگنال اصلی/نویزی، ۲. پاسخ فرکانسی |H(f)|، ۳. سیگنال فیلترشده و ۴. سیگنال خطای باقی‌مانده.'
              : 'Design frequency-selective digital filters and inspect 1. Original/Noisy Signal, 2. Filter Response |H(f)|, 3. Filtered Signal, and 4. Residual Error.'
          }
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
        <div className="text-xs font-mono tabular-nums" role="status" aria-live="polite">
          {isFa ? 'SNR ورودی: ' : 'Input SNR: '}
          <strong className="text-amber-600 dark:text-amber-400">{computed.empiricalSnrDb.toFixed(2)} dB</strong>{' '}
          → {isFa ? 'SNR فیلترشده: ' : 'Filtered SNR: '}
          <strong className="text-emerald-600 dark:text-emerald-400">{computed.filteredSnrDb.toFixed(2)} dB</strong>{' '}
          · RMSE: {rmseBefore.toFixed(3)} → {rmseAfter.toFixed(3)}
        </div>

        {/* Filter Topology Selector */}
        <span id={typeGroupId} className="sr-only">
          {isFa ? 'نوع فیلتر' : 'Filter type'}
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={typeGroupId}>
          {FILTER_TYPES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={flt.type === f.id}
              onClick={() => updateFilter({ type: f.id })}
              className={`neu-btn px-3 py-1.5 rounded-control text-xs font-semibold cursor-pointer ${
                flt.type === f.id ? 'neu-btn-active text-sky-500' : ''
              }`}
            >
              {lang === 'fa' ? f.faLabel : f.label}
            </button>
          ))}
        </div>

        {/* Filter Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {usesCutoff && (
            <ParamSlider
              label={isBand ? 'Lower Cutoff (f_L)' : flt.type === 'notch' ? 'Notch Frequency (f₀)' : 'Cutoff Freq (fc)'}
              faLabel={isBand ? 'فرکانس قطع پایین (f_L)' : flt.type === 'notch' ? 'فرکانس ناچ (f₀)' : 'فرکانس قطع (fc)'}
              value={flt.cutoffLow}
              min={1}
              max={Math.floor(fs * 0.45)}
              step={1}
              unit="Hz"
              onChange={(v) => updateFilter({ cutoffLow: v })}
            />
          )}

          {isBand && (
            <ParamSlider
              label="Upper Cutoff (f_H)"
              faLabel="فرکانس قطع بالا (f_H)"
              value={flt.cutoffHigh}
              min={flt.cutoffLow + 2}
              max={Math.floor(fs * 0.48)}
              step={1}
              unit="Hz"
              onChange={(v) => updateFilter({ cutoffHigh: v })}
            />
          )}

          <ParamSlider
            label={flt.type === 'moving-average' ? 'Window Length (M)' : 'Filter Order (N)'}
            faLabel={flt.type === 'moving-average' ? 'طول پنجره میانگین‌گیری (M)' : 'مرتبه فیلتر (N)'}
            value={flt.order}
            min={2}
            max={flt.type === 'moving-average' ? 32 : 12}
            step={1}
            unit={flt.type === 'moving-average' ? (isFa ? 'نمونه' : 'samples') : undefined}
            onChange={(v) => updateFilter({ order: v })}
          />

          {usesQ && (
            <ParamSlider
              label="Resonance / Q-Factor"
              faLabel="ضریب کیفیت / تشدید (Q)"
              value={flt.qFactor}
              min={0.3}
              max={5.0}
              step={0.05}
              onChange={(v) => updateFilter({ qFactor: v })}
            />
          )}
        </div>
      </div>

      {/* 4 Required Visualizations: 1. Original/Noisy, 2. Filter Response, 3. Filtered Signal, 4. Error/Difference */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? '۱. سیگنال ورودی تمیز و نویزی x[n]'
              : '1. Original Clean & Noisy Input Signal x[n]'
          }
          subtitle={
            lang === 'fa'
              ? 'شکل‌موج ورودی در حوزه زمان پیش از اعمال فیلتر دیجیتال'
              : 'Time-domain input waveform prior to digital filtering'
          }
          xData={computed.time}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
          xUnit="s"
          yUnit="V"
          height={250}
          series={[
            {
              id: 'flt-orig',
              label: lang === 'fa' ? 'سیگنال تمیز اصلی' : 'Original Clean Signal',
              data: computed.cleanSignal,
              color: getSeriesColor(0),
              lineWidth: 2,
            },
            {
              id: 'flt-noisy',
              label: lang === 'fa' ? 'سیگنال ورودی نویزی' : 'Noisy Input Signal',
              data: computed.noisySignal,
              color: getSeriesColor(1),
              dash: getSeriesDash(1),
              lineWidth: 1.25,
            },
          ]}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span id={scaleGroupId} className="text-caption font-mono text-slate-500 dark:text-slate-400">
              {isFa ? 'مقیاس |H(f)|:' : '|H(f)| scale:'}
            </span>
            <div className="flex gap-1" role="group" aria-labelledby={scaleGroupId}>
              {(['linear', 'db'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={respScale === m}
                  onClick={() => setRespScale(m)}
                  className={`neu-btn px-2.5 py-1 rounded-chip text-xs font-mono cursor-pointer ${
                    respScale === m ? 'neu-btn-active text-sky-600 dark:text-sky-400 font-bold' : ''
                  }`}
                >
                  {m === 'linear' ? (isFa ? 'خطی' : 'Linear') : isFa ? 'دسی‌بل (dB)' : 'dB'}
                </button>
              ))}
            </div>
          </div>
          <InteractivePlot
            title={
              lang === 'fa'
                ? `۲. پاسخ فرکانسی دامنه فیلتر |H(f)| [${flt.type.toUpperCase()}]`
                : `2. Filter Magnitude Frequency Response |H(f)| [${flt.type.toUpperCase()}]`
            }
            subtitle={
              lang === 'fa'
                ? 'باند عبور، شیب باند گذار و تضعیف باند توقف تابع تبدیل در بازه [0, fs/2]'
                : 'Transfer function passband, transition roll-off, and stopband attenuation across [0, fs/2]'
            }
            xData={computed.filterFreqAxis}
            xLabel={lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
            yLabel={
              isDb
                ? isFa
                  ? 'بهره 20·log₁₀|H(f)| (dB)'
                  : 'Gain 20·log₁₀|H(f)| (dB)'
                : isFa
                ? 'بهره |H(f)|'
                : 'Gain |H(f)|'
            }
            xUnit="Hz"
            yUnit={isDb ? 'dB' : undefined}
            height={250}
            yDomainOverride={isDb ? [-85, 5] : [-0.05, 1.15]}
            markers={respMarkers}
            shadeRegions={stopbands}
            series={[
              {
                id: isDb ? 'flt-resp-db' : 'flt-resp-lin',
                label: isDb
                  ? isFa
                    ? 'بهره (dB، حداقل -80)'
                    : 'Gain (dB, floor -80)'
                  : isFa
                  ? 'بهره خطی |H(f)|'
                  : 'Linear Gain |H(f)|',
                data: respData,
                color: getSeriesColor(7),
                lineWidth: 2.4,
              },
            ]}
          />
          <div className="neu-inset px-3 py-2 overflow-x-auto">
            <LiveEquation
              tex={liveEq.tex}
              values={liveEq.values}
              precision={2}
              caption={isFa ? 'مدل پاسخ اندازه با پارامترهای فعلی' : 'Magnitude-response model with current parameters'}
            />
          </div>
        </div>

        <InteractivePlot
          title={
            lang === 'fa'
              ? '۳. سیگنال خروجی فیلترشده y[n] در مقایسه با سیگنال مرجع تمیز'
              : '3. Filtered Output Signal y[n] vs. Clean Reference'
          }
          subtitle={
            lang === 'fa'
              ? 'مقایسه مستقیم خروجی فیلتر با شکل‌موج تمیز اولیه'
              : 'Compare filter output directly against the ground-truth clean waveform'
          }
          xData={computed.time}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
          xUnit="s"
          yUnit="V"
          height={250}
          series={[
            {
              id: 'flt-out',
              label: lang === 'fa' ? 'سیگنال فیلترشده y[n]' : 'Filtered Signal y[n]',
              data: computed.filteredSignal,
              color: getSeriesColor(2),
              lineWidth: 2.2,
            },
            {
              id: 'flt-ref',
              label: lang === 'fa' ? 'سیگنال مرجع تمیز' : 'Original Clean Reference',
              data: computed.cleanSignal,
              color: getSeriesColor(0),
              lineWidth: 1.5,
              dashed: true,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? '۴. نویز حذف‌شده و سیگنال خطای باقی‌مانده e[n] = x[n] - y[n]'
              : '4. Rejected Noise / Residual Difference e[n] = x[n] - y[n]'
          }
          subtitle={
            lang === 'fa'
              ? 'نمایش مؤلفه‌های حذف‌شده باند توقف و خطای تخمین باقی‌مانده'
              : 'Shows the attenuated stopband components and residual estimation error'
          }
          xData={computed.time}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'اختلاف (V)' : 'Difference (V)'}
          xUnit="s"
          yUnit="V"
          height={250}
          series={[
            {
              id: 'flt-res',
              label:
                lang === 'fa'
                  ? 'مؤلفه حذف‌شده (x_noisy - y_filtered)'
                  : 'Removed Component (x_noisy - y_filtered)',
              data: computed.residualSignal,
              color: getSeriesColor(4),
              lineWidth: 1.5,
            },
            {
              id: 'flt-err',
              label:
                lang === 'fa'
                  ? 'خطای تخمین (y_filtered - x_clean)'
                  : 'Estimation Error (y_filtered - x_clean)',
              data: computed.filteredSignal.map((y, i) => y - (computed.cleanSignal[i] ?? 0)),
              color: getSeriesColor(5),
              dash: getSeriesDash(1),
              lineWidth: 1.4,
            },
          ]}
        />
      </div>

      {/* Input vs output spectrum */}
      <InteractivePlot
        title={
          isFa
            ? '۵. طیف ورودی |X(f)| در برابر طیف خروجی |Y(f)|'
            : '5. Input Spectrum |X(f)| vs Output Spectrum |Y(f)|'
        }
        subtitle={
          isFa
            ? `اثر فیلتر در حوزه فرکانس (FFT با N=${fftSize}، پنجره ${windowType}) · ناحیه سایه‌دار: باند توقف`
            : `Filter effect in the frequency domain (FFT N=${fftSize}, ${windowType} window) · shaded: stopband`
        }
        xData={computed.spectrum.frequencies}
        xLabel={isFa ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
        yLabel={isFa ? 'دامنه' : 'Magnitude'}
        xUnit="Hz"
        height={260}
        markers={cutoffMarkers}
        shadeRegions={stopbands}
        series={[
          {
            id: 'flt-spec-in',
            label: isFa ? 'طیف ورودی نویزی |X(f)|' : 'Noisy Input |X(f)|',
            data: computed.spectrum.magnitude,
            color: getSeriesColor(1),
            lineWidth: 1.4,
          },
          {
            id: 'flt-spec-out',
            label: isFa ? 'طیف خروجی فیلترشده |Y(f)|' : 'Filtered Output |Y(f)|',
            data: outputSpectrum.magnitude.slice(0, computed.spectrum.frequencies.length),
            color: getSeriesColor(2),
            dash: getSeriesDash(1),
            lineWidth: 2,
          },
        ]}
      />

      <TheoryAccordion
        items={[
          {
            title:
              lang === 'fa'
                ? 'معادله تفاضلی خطی با ضرایب ثابت (فیلترهای FIR و IIR)'
                : 'Linear Constant-Coefficient Difference Equation (FIR & IIR)',
            formula:
              'y[n] = \\sum_{k=0}^{M} b_k x[n-k] - \\sum_{m=1}^{N} a_m y[n-m], \\quad H(z) = \\frac{\\sum_{k=0}^{M} b_k z^{-k}}{1 + \\sum_{m=1}^{N} a_m z^{-m}}',
            explanation:
              lang === 'fa'
                ? 'فیلترهای پاسخ ضربه متناهی (FIR) فاقد ضرایب بازخورد (a_m = 0) هستند و پایداری مطلق و فاز خطی دقیق را تضمین می‌کنند. فیلترهای پاسخ ضربه نامتناهی (IIR) با تعداد عملیات حسابی بسیار کمتر، شیب قطع تندتری ایجاد می‌کنند.'
                : 'Finite Impulse Response (FIR) filters have feedback coefficients a_m = 0, guaranteeing unconditional stability and exact linear phase. Infinite Impulse Response (IIR) biquad filters achieve sharp transition roll-off with far fewer arithmetic operations.',
          },
          {
            title:
              lang === 'fa'
                ? 'پاسخ فرکانسی باترورث (Butterworth) و هسته سینک میانگین متحرک'
                : 'Butterworth Magnitude Response & Moving Average Sinc Kernel',
            formula:
              '\\left|H_{\\text{Butt}}(j\\omega)\\right|^2 = \\frac{1}{1 + (\\omega / \\omega_c)^{2N}}, \\quad \\left|H_{\\text{MA}}(e^{j\\omega})\\right| = \\frac{1}{M}\\left|\\frac{\\sin(\\omega M / 2)}{\\sin(\\omega / 2)}\\right|',
            explanation:
              lang === 'fa'
                ? 'فیلتر باترورث دارای بیشترین همواری ممکن در باند عبور و افت -20N dB بر دهه بالاتر از فرکانس قطع fc است. فیلتر میانگین متحرک نیز بهینه‌ترین هموارساز نویز سفید در حوزه زمان است که پاسخ فرکانسی آن از پوش تابع سینک دیریکله پیروی می‌کند.'
                : 'A Butterworth filter is maximally flat in the passband with a -20N dB/decade roll-off above cutoff fc. The Moving Average filter is an optimal time-domain white-noise smoother whose frequency response follows a Dirichlet sinc envelope.',
          },
        ]}
      />
    </div>
  );
};
