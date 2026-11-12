import React, { useId } from 'react';
import { Plus, RotateCcw, Trash2, Activity } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { MathFormula, TheoryAccordion } from '../components/MathBlock';
import { PageHeader, ParamSlider } from '../components/ui';
import { getSeriesColor, getSeriesDash } from '../theme/palette';
import { getSignalLatexExpression } from '../simulations/signals';
import { useLab } from '../store/LabContext';
import { SignalComponent, SignalWaveType } from '../types';

const WAVE_TYPES: { id: SignalWaveType; label: string; faLabel: string }[] = [
  { id: 'sine', label: 'Sine', faLabel: 'سینوسی (Sine)' },
  { id: 'cosine', label: 'Cosine', faLabel: 'کسینوسی (Cosine)' },
  { id: 'square', label: 'Square', faLabel: 'مربعی (Square)' },
  { id: 'triangle', label: 'Triangle', faLabel: 'مثلثی (Triangle)' },
  { id: 'sawtooth', label: 'Sawtooth', faLabel: 'دندان‌اره‌ای (Sawtooth)' },
  { id: 'pulse', label: 'Pulse Train', faLabel: 'قطار پالس (Pulse)' },
  { id: 'chirp', label: 'Linear Chirp', faLabel: 'چرپ خطی (Chirp)' },
  { id: 'multitone', label: 'Multi-Tone', faLabel: 'چندفرکانسه (Multi-Tone)' },
  { id: 'composite', label: 'Custom Composite', faLabel: 'ترکیبی سفارشی (Composite)' },
];

export const SignalGeneratorPage: React.FC = () => {
  const { experiment, setExperiment, computed, lang, nyquist, isAliasing, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const sig = experiment.signal;
  const waveGroupId = useId();
  const aliasShade = isFa ? 'بالای نایکوئیست' : 'above Nyquist';
  const aliasWarning = (
    <>
      {isFa
        ? `بالاتر از نایکوئیست (fs/2 = ${nyquist.toFixed(1)} Hz): الیاسینگ رخ می‌دهد؛ بخش تئوری پایین را ببینید.`
        : `Above Nyquist (fs/2 = ${nyquist.toFixed(1)} Hz): aliasing will occur, see theory below.`}
    </>
  );
  const latexExpr = getSignalLatexExpression(sig);

  const updateSignal = (patch: Partial<typeof sig>) => {
    setExperiment((prev) => ({
      ...prev,
      signal: { ...prev.signal, ...patch },
    }));
  };

  const addComponent = () => {
    const newComp: SignalComponent = {
      id: `comp-${Date.now()}`,
      type: 'sine',
      amplitude: 0.8,
      frequency: 12,
      phase: 0,
      enabled: true,
    };
    updateSignal({
      type: 'composite',
      components: [...sig.components, newComp],
    });
  };

  const updateComponent = (id: string, patch: Partial<SignalComponent>) => {
    updateSignal({
      components: sig.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const removeComponent = (id: string) => {
    if (sig.components.length <= 1) return;
    updateSignal({
      components: sig.components.filter((c) => c.id !== id),
    });
  };

  const numSamples = Math.round(sig.samplingRate * sig.duration);

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Waveform Type Selector */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <PageHeader
          icon={<Activity className="w-5 h-5" />}
          title={
            isFa
              ? 'تولیدکننده دقیق سیگنال و توابع پایه (Signal & Function Generator)'
              : 'Precision Signal & Function Generator'
          }
          subtitle={
            isFa
              ? 'تولید شکل‌موج‌های استاندارد متناوب، سیگنال‌های چرپ (Chirp) با جاروب فرکانسی و سیگنال‌های ترکیبی چندهارمونیکی همراه با نمایش زنده رابطه ریاضی.'
              : 'Synthesize canonical waveforms, frequency-swept chirps, and multi-harmonic composite signals with live mathematical notation.'
          }
          stats={[
            { label: isFa ? 'تعداد کل نمونه‌ها' : 'Total Samples', value: numSamples },
            { label: 'Δt', value: `${(1000 / sig.samplingRate).toFixed(2)} ms` },
            { label: isFa ? 'نایکوئیست' : 'Nyquist', value: `${nyquist.toFixed(1)} Hz` },
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

        {/* Waveform Mode Buttons */}
        <span id={waveGroupId} className="sr-only">
          {isFa ? 'نوع شکل‌موج' : 'Waveform type'}
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={waveGroupId}>
          {WAVE_TYPES.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => updateSignal({ type: w.id })}
              aria-pressed={sig.type === w.id}
              className={`neu-btn px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                sig.type === w.id ? 'btn-tool-pill' : ''
              }`}
            >
              {lang === 'fa' ? w.faLabel : w.label}
            </button>
          ))}
        </div>

        {/* Live Mathematical Expression Display */}
        <div className="neu-inset p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-500 shrink-0">
            {lang === 'fa' ? 'معادله تحلیلی سیگنال:' : 'Analytical Governing Equation:'}
          </div>
          <div className="overflow-x-auto py-1">
            <MathFormula tex={latexExpr} block={false} className="text-sm" />
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Left Controls + Right Live Plots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Parameter Controls */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="neu-card p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'پارامترهای سراسری نمونه‌برداری و پایه زمانی'
                : 'Global Sampling & Timebase Parameters'}
            </h2>

            <ParamSlider
              label="Sampling Rate (fs)"
              faLabel="نرخ نمونه‌برداری (fs)"
              value={sig.samplingRate}
              min={32}
              max={1024}
              step={16}
              unit="Hz"
              onChange={(v) => updateSignal({ samplingRate: v })}
            />
            <ParamSlider
              label="Duration (T)"
              faLabel="مدت زمان سیگنال (T)"
              value={sig.duration}
              min={0.25}
              max={5.0}
              step={0.25}
              unit="s"
              onChange={(v) => updateSignal({ duration: v })}
            />
            <ParamSlider
              label="DC Offset (V_DC)"
              faLabel="مؤلفه مستقیم (DC Offset)"
              value={sig.dcOffset}
              min={-3}
              max={3}
              step={0.1}
              unit="V"
              onChange={(v) => updateSignal({ dcOffset: v })}
            />

            {sig.type !== 'composite' && (
              <>
                <hr className="border-slate-200/60 dark:border-slate-800" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                  {isFa ? 'پارامترهای شکل‌موج اصلی' : 'Primary Waveform Parameters'}
                </h3>

                <ParamSlider
                  label="Amplitude (A)"
                  faLabel="دامنه (A)"
                  value={sig.amplitude}
                  min={0.1}
                  max={5.0}
                  step={0.05}
                  unit="V"
                  onChange={(v) => updateSignal({ amplitude: v })}
                />
                <ParamSlider
                  label="Frequency (f0)"
                  faLabel="فرکانس پایه (f0)"
                  value={sig.frequency}
                  min={0.5}
                  max={120}
                  step={0.5}
                  unit="Hz"
                  onChange={(v) => updateSignal({ frequency: v })}
                  warning={isAliasing ? aliasWarning : undefined}
                />
                <ParamSlider
                  label="Phase Shift (φ)"
                  faLabel="اختلاف فاز اولیه (φ)"
                  value={sig.phase}
                  min={-180}
                  max={180}
                  step={5}
                  unit="°"
                  onChange={(v) => updateSignal({ phase: v })}
                />

                {sig.type === 'chirp' && (
                  <ParamSlider
                    label="Target End Frequency (f1)"
                    faLabel="فرکانس پایانی جاروب (f1)"
                    value={sig.frequencyEnd}
                    min={2}
                    max={150}
                    step={1}
                    unit="Hz"
                    onChange={(v) => updateSignal({ frequencyEnd: v })}
                    warning={isAliasing && sig.frequencyEnd > nyquist ? aliasWarning : undefined}
                  />
                )}

                {sig.type === 'pulse' && (
                  <ParamSlider
                    label="Pulse Duty Cycle"
                    faLabel="چرخه کار پالس (Duty Cycle)"
                    value={sig.dutyCycle}
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    format={(v) => (v * 100).toFixed(0)}
                    unit="%"
                    onChange={(v) => updateSignal({ dutyCycle: v })}
                  />
                )}
              </>
            )}
          </div>

          {/* Composite Multi-Component Builder */}
          <div className="neu-card p-5 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  {lang === 'fa'
                    ? 'ترکیب‌کننده هارمونیک‌های سیگنال مرکب'
                    : 'Composite Signal Harmonic Mixer'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'fa'
                    ? 'جمع خطی چند شکل‌موج مستقل x(t) = Σ x_k(t)'
                    : 'Combine multiple waveforms x(t) = Σ x_k(t)'}
                </p>
              </div>
              <button
                type="button"
                onClick={addComponent}
                className="btn-primary-pill px-3.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{lang === 'fa' ? 'افزودن مؤلفه' : 'Add Component'}</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {sig.components.map((comp, idx) => (
                <div key={comp.id} className="neu-inset p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id={`${comp.id}-enabled`}
                        type="checkbox"
                        checked={comp.enabled}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, { enabled: e.target.checked });
                        }}
                        className="rounded accent-sky-500 cursor-pointer"
                      />
                      <label htmlFor={`${comp.id}-enabled`} className="text-xs font-semibold font-mono cursor-pointer">
                        {lang === 'fa' ? `مؤلفه #${idx + 1}` : `Component #${idx + 1}`}
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label={isFa ? `نوع موج مؤلفه ${idx + 1}` : `Component ${idx + 1} waveform`}
                        value={comp.type}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, {
                            type: e.target.value as Exclude<SignalWaveType, 'composite'>,
                          });
                        }}
                        className="neu-btn px-2.5 py-1 rounded-full text-xs font-mono"
                      >
                        <option value="sine">{lang === 'fa' ? 'سینوسی' : 'Sine'}</option>
                        <option value="cosine">{lang === 'fa' ? 'کسینوسی' : 'Cosine'}</option>
                        <option value="square">{lang === 'fa' ? 'مربعی' : 'Square'}</option>
                        <option value="triangle">{lang === 'fa' ? 'مثلثی' : 'Triangle'}</option>
                        <option value="sawtooth">{lang === 'fa' ? 'دندان‌اره‌ای' : 'Sawtooth'}</option>
                        <option value="chirp">{lang === 'fa' ? 'چرپ' : 'Chirp'}</option>
                      </select>

                      {sig.components.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeComponent(comp.id)}
                          aria-label={isFa ? `حذف مؤلفه ${idx + 1}` : `Remove component ${idx + 1}`}
                          title={isFa ? `حذف مؤلفه ${idx + 1}` : `Remove component ${idx + 1}`}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2 text-caption font-mono">
                    <label className="flex flex-col gap-1">
                      <span className="text-slate-500">
                        {lang === 'fa' ? 'دامنه:' : 'Amp:'} {comp.amplitude.toFixed(2)}V
                      </span>
                      <input
                        type="range"
                        min={0.1}
                        max={4}
                        step={0.1}
                        value={comp.amplitude}
                        aria-valuetext={`${comp.amplitude.toFixed(2)} V`}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, { amplitude: Number(e.target.value) });
                        }}
                        className="sci-slider"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-slate-500">
                        {lang === 'fa' ? 'فرکانس:' : 'Freq:'} {comp.frequency.toFixed(1)}Hz
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        step={0.5}
                        value={comp.frequency}
                        aria-valuetext={`${comp.frequency.toFixed(1)} Hz`}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, { frequency: Number(e.target.value) });
                        }}
                        className="sci-slider"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-slate-500">
                        {lang === 'fa' ? 'فاز:' : 'Phase:'} {comp.phase}°
                      </span>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={15}
                        value={comp.phase}
                        aria-valuetext={`${comp.phase}°`}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, { phase: Number(e.target.value) });
                        }}
                        className="sci-slider"
                      />
                    </label>
                  </div>
                  {comp.enabled && comp.frequency > nyquist && (
                    <p
                      className="rounded-chip border px-2 py-1 text-caption leading-snug"
                      style={{
                        color: 'var(--warning-text)',
                        background: 'var(--warning-soft)',
                        borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)',
                      }}
                    >
                      {aliasWarning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Plots Column */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <InteractivePlot
            title={lang === 'fa' ? 'شکل‌موج سنتزشده در حوزه زمان x(t)' : 'Synthesized Waveform x(t)'}
            subtitle={
              lang === 'fa'
                ? `نرخ نمونه‌برداری fs = ${sig.samplingRate} Hz · حد فرکانسی نایکوئیست = ${(sig.samplingRate / 2).toFixed(1)} Hz`
                : `Sampling Rate fs = ${sig.samplingRate} Hz · Nyquist Limit = ${(sig.samplingRate / 2).toFixed(1)} Hz`
            }
            xData={computed.time}
            xLabel={isFa ? 'زمان (s)' : 'Time (s)'}
            yLabel={isFa ? 'دامنه (V)' : 'Amplitude (V)'}
            xUnit="s"
            yUnit="V"
            height={300}
            series={[
              {
                id: 'clean-gen',
                label: lang === 'fa' ? 'سیگنال تمیز سنتزشده' : 'Synthesized Clean Signal',
                data: computed.cleanSignal,
                color: getSeriesColor(0),
                dash: getSeriesDash(0),
                lineWidth: 2.2,
              },
              {
                id: 'noisy-gen',
                label: lang === 'fa' ? 'همراه با نویز کانال' : 'With Channel Noise',
                data: computed.noisySignal,
                color: getSeriesColor(1),
                dash: getSeriesDash(1),
                lineWidth: 1.2,
                visible: false,
              },
            ]}
          />

          <InteractivePlot
            title={
              lang === 'fa'
                ? 'طیف اندازه فرکانسی |X(f)| سیگنال سنتزشده'
                : 'Magnitude Spectrum |X(f)| of Synthesized Signal'
            }
            subtitle={
              lang === 'fa'
                ? 'مشاهده ساختار هارمونیک‌ها (مانند هارمونیک‌های فرد 1/k در موج مربعی و مثلثی یا طیف پهن‌باند در چرپ)'
                : 'Observe harmonic structure (e.g., odd harmonics 1/k in Square & Triangle waves, wideband sweep in Chirp)'
            }
            xData={computed.spectrum.frequencies}
            xLabel={isFa ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
            yLabel={isFa ? 'اندازه' : 'Magnitude'}
            xUnit="Hz"
            height={260}
            markers={[{ x: nyquist, label: `fs/2 = ${nyquist.toFixed(1)} Hz` }]}
            shadeRegions={[{ x0: nyquist, x1: Infinity, label: aliasShade }]}
            peaks={computed.peaks.map((p) => ({
              x: p.frequency,
              y: p.magnitude,
              label: `${p.frequency.toFixed(1)}Hz`,
            }))}
            series={[
              {
                id: 'gen-fft',
                label: lang === 'fa' ? 'اندازه طیف |X(f)|' : 'Spectral Magnitude',
                data: computed.spectrum.magnitude,
                color: getSeriesColor(0),
                lineWidth: 2,
              },
            ]}
          />
        </div>
      </div>

      <TheoryAccordion
        items={
          lang === 'fa'
            ? [
                {
                  title: 'بسط سری فوریه و هارمونیک‌های شکل‌موج‌های متناوب',
                  formula: 'x_{\\text{square}}(t) = \\frac{4A}{\\pi}\\sum_{k=1}^{\\infty} \\frac{\\sin\\!\\left(2\\pi(2k-1)f_0 t\\right)}{2k-1}',
                  explanation:
                    'موج‌های متناوب غیرسینوسی مانند موج مربعی، مثلثی و دندان‌اره‌ای از یک سینوسی پایه در فرکانس f0 به همراه بی‌نهایت هارمونیک مضرب صحیح تشکیل شده‌اند که دامنه آن‌ها با نرخ 1/k (در موج مربعی و دندان‌اره‌ای) یا 1/k² (در موج مثلثی) کاهش می‌یابد.',
                },
                {
                  title: 'قضیه نمونه‌برداری نایکوئیست-شانون و پدیده Aliasing',
                  formula: 'f_s \\ge 2 f_{\\max}, \\quad f_{\\text{alias}} = \\left| f_0 - k f_s \\right|',
                  explanation:
                    'برای بازسازی دقیق یک سیگنال باند-محدود بدون تاخوردگی طیفی (Aliasing)، نرخ نمونه‌برداری fs باید حداقل دو برابر بزرگ‌ترین فرکانس موجود در سیگنال باشد.',
                },
              ]
            : [
                {
                  title: 'Fourier Series Synthesis & Harmonic Waveforms',
                  formula: 'x_{\\text{square}}(t) = \\frac{4A}{\\pi}\\sum_{k=1}^{\\infty} \\frac{\\sin\\!\\left(2\\pi(2k-1)f_0 t\\right)}{2k-1}',
                  explanation:
                    'Non-sinusoidal periodic waveforms such as square, triangle, and sawtooth waves are composed of a fundamental sinusoid at f0 plus infinite integer harmonics whose amplitudes decay at 1/k (square/sawtooth) or 1/k² (triangle).',
                },
                {
                  title: 'Nyquist-Shannon Sampling Theorem & Aliasing',
                  formula: 'f_s \\ge 2 f_{\\max}, \\quad f_{\\text{alias}} = \\left| f_0 - k f_s \\right|',
                  explanation:
                    'To reconstruct a bandlimited signal without spectral folding (aliasing), the sampling rate fs must be at least twice the highest frequency component fmax.',
                },
              ]
        }
      />
    </div>
  );
};
