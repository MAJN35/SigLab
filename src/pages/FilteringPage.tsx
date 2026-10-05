import React from 'react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { useLab } from '../store/LabContext';
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

export const FilteringPage: React.FC = () => {
  const { experiment, setExperiment, computed, lang } = useLab();
  const flt = experiment.filter;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'fa'
                ? 'آزمایشگاه فیلترینگ دیجیتال (FIR، IIR، Biquad و میانگین متحرک)'
                : 'Digital Filtering Laboratory (FIR, IIR, Biquad & Moving Average)'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'طراحی فیلترهای دیجیتال انتخاب‌گر فرکانسی و بررسی هم‌زمان: ۱. سیگنال اصلی/نویزی، ۲. پاسخ فرکانسی |H(f)|، ۳. سیگنال فیلترشده و ۴. سیگنال خطای باقی‌مانده.'
                : 'Design frequency-selective digital filters and inspect 1. Original/Noisy Signal, 2. Filter Response |H(f)|, 3. Filtered Signal, and 4. Residual Error.'}
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums">
            {lang === 'fa' ? 'SNR ورودی: ' : 'Input SNR: '}
            <strong className="text-amber-500">{computed.empiricalSnrDb.toFixed(2)} dB</strong>{' '}
            → {lang === 'fa' ? 'SNR فیلترشده: ' : 'Filtered SNR: '}
            <strong className="text-emerald-500">{computed.filteredSnrDb.toFixed(2)} dB</strong>{' '}
            · RMSE: {rmseBefore.toFixed(3)} → {rmseAfter.toFixed(3)}
          </div>
        </div>

        {/* Filter Topology Selector */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TYPES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => updateFilter({ type: f.id })}
              className={`neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                flt.type === f.id ? 'neu-btn-active text-sky-500' : ''
              }`}
            >
              {lang === 'fa' ? f.faLabel : f.label}
            </button>
          ))}
        </div>

        {/* Filter Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>
                {flt.type === 'bandpass' || flt.type === 'bandstop'
                  ? lang === 'fa'
                    ? 'فرکانس قطع پایین (f_L)'
                    : 'Lower Cutoff (f_L)'
                  : lang === 'fa'
                  ? 'فرکانس قطع / مرکزی (fc)'
                  : 'Cutoff / Center Freq (fc)'}
              </span>
              <span className="text-sky-500 font-semibold">{flt.cutoffLow} Hz</span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.floor(experiment.signal.samplingRate * 0.45)}
              step={1}
              value={flt.cutoffLow}
              onChange={(e) => updateFilter({ cutoffLow: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          {(flt.type === 'bandpass' || flt.type === 'bandstop') && (
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>{lang === 'fa' ? 'فرکانس قطع بالا (f_H)' : 'Upper Cutoff (f_H)'}</span>
                <span className="text-sky-500 font-semibold">{flt.cutoffHigh} Hz</span>
              </div>
              <input
                type="range"
                min={flt.cutoffLow + 2}
                max={Math.floor(experiment.signal.samplingRate * 0.48)}
                step={1}
                value={flt.cutoffHigh}
                onChange={(e) => updateFilter({ cutoffHigh: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>
                {flt.type === 'moving-average'
                  ? lang === 'fa'
                    ? 'طول پنجره میانگین‌گیری (M)'
                    : 'Window Length (M)'
                  : lang === 'fa'
                  ? 'مرتبه فیلتر (N)'
                  : 'Filter Order (N)'}
              </span>
              <span className="text-sky-500 font-semibold">{flt.order}</span>
            </div>
            <input
              type="range"
              min={2}
              max={flt.type === 'moving-average' ? 32 : 12}
              step={1}
              value={flt.order}
              onChange={(e) => updateFilter({ order: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'ضریب کیفیت / تشدید (Q)' : 'Resonance / Q-Factor'}</span>
              <span className="text-sky-500 font-semibold">{flt.qFactor.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={5.0}
              step={0.05}
              value={flt.qFactor}
              onChange={(e) => updateFilter({ qFactor: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
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
          height={250}
          series={[
            {
              id: 'flt-orig',
              label: lang === 'fa' ? 'سیگنال تمیز اصلی' : 'Original Clean Signal',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'flt-noisy',
              label: lang === 'fa' ? 'سیگنال ورودی نویزی' : 'Noisy Input Signal',
              data: computed.noisySignal,
              color: '#f59e0b',
              lineWidth: 1.25,
            },
          ]}
        />

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
          yLabel={lang === 'fa' ? 'بهره |H(f)|' : 'Gain |H(f)|'}
          height={250}
          yDomainOverride={[-0.05, 1.15]}
          series={[
            {
              id: 'flt-resp-lin',
              label: lang === 'fa' ? 'بهره خطی |H(f)|' : 'Linear Gain |H(f)|',
              data: computed.filterMagResponse,
              color: '#8b5cf6',
              lineWidth: 2.4,
            },
          ]}
        />

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
          height={250}
          series={[
            {
              id: 'flt-out',
              label: lang === 'fa' ? 'سیگنال فیلترشده y[n]' : 'Filtered Signal y[n]',
              data: computed.filteredSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
            {
              id: 'flt-ref',
              label: lang === 'fa' ? 'سیگنال مرجع تمیز' : 'Original Clean Reference',
              data: computed.cleanSignal,
              color: '#0ea5e9',
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
          height={250}
          series={[
            {
              id: 'flt-res',
              label:
                lang === 'fa'
                  ? 'مؤلفه حذف‌شده (x_noisy - y_filtered)'
                  : 'Removed Component (x_noisy - y_filtered)',
              data: computed.residualSignal,
              color: '#f43f5e',
              lineWidth: 1.5,
            },
            {
              id: 'flt-err',
              label:
                lang === 'fa'
                  ? 'خطای تخمین (y_filtered - x_clean)'
                  : 'Estimation Error (y_filtered - x_clean)',
              data: computed.filteredSignal.map((y, i) => y - (computed.cleanSignal[i] ?? 0)),
              color: '#64748b',
              lineWidth: 1.4,
            },
          ]}
        />
      </div>

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
