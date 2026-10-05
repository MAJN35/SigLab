import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { MathFormula, TheoryAccordion } from '../components/MathBlock';
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
  const { experiment, setExperiment, computed, lang } = useLab();
  const sig = experiment.signal;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'fa'
                ? 'تولیدکننده دقیق سیگنال و توابع پایه (Signal & Function Generator)'
                : 'Precision Signal & Function Generator'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'تولید شکل‌موج‌های استاندارد متناوب، سیگنال‌های چرپ (Chirp) با جاروب فرکانسی و سیگنال‌های ترکیبی چندهارمونیکی همراه با نمایش زنده رابطه ریاضی.'
                : 'Synthesize canonical waveforms, frequency-swept chirps, and multi-harmonic composite signals with live mathematical notation.'}
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500">
            {lang === 'fa' ? 'تعداد کل نمونه‌ها:' : 'Total Samples:'}{' '}
            <strong className="text-sky-500">{numSamples}</strong> · Δt ={' '}
            {(1000 / sig.samplingRate).toFixed(2)} ms
          </div>
        </div>

        {/* Waveform Mode Buttons */}
        <div className="flex flex-wrap gap-2">
          {WAVE_TYPES.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => updateSignal({ type: w.id })}
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

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>{lang === 'fa' ? 'نرخ نمونه‌برداری (fs)' : 'Sampling Rate (fs)'}</span>
                <span className="text-sky-500 font-semibold">{sig.samplingRate} Hz</span>
              </div>
              <input
                type="range"
                min={32}
                max={1024}
                step={16}
                value={sig.samplingRate}
                onChange={(e) => updateSignal({ samplingRate: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>{lang === 'fa' ? 'مدت زمان سیگنال (T)' : 'Duration (T)'}</span>
                <span className="text-sky-500 font-semibold">{sig.duration.toFixed(2)} s</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={5.0}
                step={0.25}
                value={sig.duration}
                onChange={(e) => updateSignal({ duration: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>{lang === 'fa' ? 'مؤلفه مستقیم (DC Offset)' : 'DC Offset (V_DC)'}</span>
                <span className="text-sky-500 font-semibold">{sig.dcOffset.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min={-3}
                max={3}
                step={0.1}
                value={sig.dcOffset}
                onChange={(e) => updateSignal({ dcOffset: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            {sig.type !== 'composite' && (
              <>
                <hr className="border-slate-200/60 dark:border-slate-800" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                  {lang === 'fa' ? 'پارامترهای شکل‌موج اصلی' : 'Primary Waveform Parameters'}
                </h3>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span>{lang === 'fa' ? 'دامنه (A)' : 'Amplitude (A)'}</span>
                    <span className="text-sky-500 font-semibold">{sig.amplitude.toFixed(2)} V</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={5.0}
                    step={0.05}
                    value={sig.amplitude}
                    onChange={(e) => updateSignal({ amplitude: Number(e.target.value) })}
                    className="sci-slider"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span>{lang === 'fa' ? 'فرکانس پایه (f0)' : 'Frequency (f0)'}</span>
                    <span className="text-sky-500 font-semibold">{sig.frequency.toFixed(1)} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={120}
                    step={0.5}
                    value={sig.frequency}
                    onChange={(e) => updateSignal({ frequency: Number(e.target.value) })}
                    className="sci-slider"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span>{lang === 'fa' ? 'اختلاف فاز اولیه (φ)' : 'Phase Shift (φ)'}</span>
                    <span className="text-sky-500 font-semibold">{sig.phase.toFixed(0)}°</span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={5}
                    value={sig.phase}
                    onChange={(e) => updateSignal({ phase: Number(e.target.value) })}
                    className="sci-slider"
                  />
                </div>

                {sig.type === 'chirp' && (
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span>
                        {lang === 'fa' ? 'فرکانس پایانی جاروب (f1)' : 'Target End Frequency (f1)'}
                      </span>
                      <span className="text-sky-500 font-semibold">
                        {sig.frequencyEnd.toFixed(1)} Hz
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={150}
                      step={1}
                      value={sig.frequencyEnd}
                      onChange={(e) => updateSignal({ frequencyEnd: Number(e.target.value) })}
                      className="sci-slider"
                    />
                  </div>
                )}

                {sig.type === 'pulse' && (
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span>{lang === 'fa' ? 'چرخه کار پالس (Duty Cycle)' : 'Pulse Duty Cycle'}</span>
                      <span className="text-sky-500 font-semibold">
                        {(sig.dutyCycle * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      value={sig.dutyCycle}
                      onChange={(e) => updateSignal({ dutyCycle: Number(e.target.value) })}
                      className="sci-slider"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Composite Multi-Component Builder */}
          <div className="neu-card p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
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
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'fa' ? 'افزودن مؤلفه' : 'Add Component'}</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {sig.components.map((comp, idx) => (
                <div key={comp.id} className="neu-inset p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={comp.enabled}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, { enabled: e.target.checked });
                        }}
                        className="rounded accent-sky-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold font-mono">
                        {lang === 'fa' ? `مؤلفه #${idx + 1}` : `Component #${idx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={comp.type}
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, {
                            type: e.target.value as Exclude<SignalWaveType, 'composite'>,
                          });
                        }}
                        className="neu-btn px-2.5 py-1 rounded-full text-xs font-mono bg-transparent"
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
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
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
                        onChange={(e) => {
                          updateSignal({ type: 'composite' });
                          updateComponent(comp.id, { phase: Number(e.target.value) });
                        }}
                        className="sci-slider"
                      />
                    </label>
                  </div>
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
            xLabel="Time (s)"
            yLabel="Amplitude (V)"
            height={300}
            series={[
              {
                id: 'clean-gen',
                label: lang === 'fa' ? 'سیگنال تمیز سنتزشده' : 'Synthesized Clean Signal',
                data: computed.cleanSignal,
                color: '#0ea5e9',
                lineWidth: 2.2,
              },
              {
                id: 'noisy-gen',
                label: lang === 'fa' ? 'همراه با نویز کانال' : 'With Channel Noise',
                data: computed.noisySignal,
                color: '#f59e0b',
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
            xLabel="Frequency (Hz)"
            yLabel="Magnitude"
            height={260}
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
                color: '#10b981',
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
