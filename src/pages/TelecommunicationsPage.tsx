import React, { useMemo } from 'react';
import { LAB_IMAGES } from '../assets/labImages';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { computeFFTSpectrum } from '../simulations/fft';
import { simulateAnalogModulation } from '../simulations/modulation';
import { useLab } from '../store/LabContext';
import { AnalogModType, NoiseType } from '../types';

const ANALOG_MODS: { id: AnalogModType; label: string; faLabel: string }[] = [
  { id: 'AM', label: 'AM (DSB-LC)', faLabel: 'مدولاسیون دامنه (AM)' },
  { id: 'DSB-SC', label: 'DSB-SC', faLabel: 'دو باند جانبی بدون حامل (DSB-SC)' },
  { id: 'SSB', label: 'SSB-USB', faLabel: 'تک باند جانبی (SSB)' },
  { id: 'FM', label: 'FM', faLabel: 'مدولاسیون فرکانس (FM)' },
  { id: 'PM', label: 'PM', faLabel: 'مدولاسیون فاز (PM)' },
];

const NOISE_TYPES: { id: NoiseType; label: string; faLabel: string }[] = [
  { id: 'awgn', label: 'AWGN', faLabel: 'نویز سفید گوسی (AWGN)' },
  { id: 'gaussian', label: 'Gaussian', faLabel: 'گوسی (Gaussian)' },
  { id: 'uniform', label: 'Uniform', faLabel: 'یکنواخت (Uniform)' },
  { id: 'impulse', label: 'Impulse (Salt & Pepper)', faLabel: 'ضربه‌ای (Impulse)' },
  { id: 'burst', label: 'Burst Noise', faLabel: 'نویز رگباری (Burst)' },
  { id: 'powerline', label: 'Power-Line (50/60 Hz)', faLabel: 'برق شهر (50/60 Hz)' },
  { id: 'sinusoidal', label: 'Sinusoidal Jammer', faLabel: 'تداخل سینوسی' },
  { id: 'custom', label: 'Custom Hybrid', faLabel: 'نویز ترکیبی' },
];

export const TelecommunicationsPage: React.FC = () => {
  const { experiment, setExperiment, computed, lang } = useLab();
  const analogCfg = experiment.modulation.analog;
  const noiseCfg = experiment.noise;

  const updateAnalog = (patch: Partial<typeof analogCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      modulation: {
        ...prev.modulation,
        analog: { ...prev.modulation.analog, ...patch },
      },
    }));
  };

  const updateNoise = (patch: Partial<typeof noiseCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      noise: { ...prev.noise, enabled: true, ...patch },
    }));
  };

  const sim = useMemo(
    () => simulateAnalogModulation(analogCfg, experiment.randomSeed),
    [analogCfg, experiment.randomSeed]
  );

  const modSpectrum = useMemo(
    () => computeFFTSpectrum(sim.modulated, sim.samplingRate, 1024, 'hann'),
    [sim]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Analog Modulation Section Header + Transceiver Block Diagram */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {lang === 'fa'
                  ? 'آزمایشگاه مخابرات آنالوگ و مدل‌سازی نویز کانال'
                  : 'Telecommunications & Noise Laboratory'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'fa'
                  ? 'شبیه‌سازی کامل زنجیره فرستنده-گیرنده مخابرات آنالوگ (AM, DSB-SC, SSB, FM, PM) و آزمایشگاه تزریق نویز و تداخل کانال.'
                  : 'End-to-end Analog Transceiver chain (AM, DSB-SC, SSB, FM, PM) and multi-distribution Channel Noise Laboratory.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ANALOG_MODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateAnalog({ type: m.id })}
                  className={`neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    analogCfg.type === m.id ? 'btn-tool-pill' : ''
                  }`}
                >
                  {lang === 'fa' ? m.faLabel : m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="oscilloscope-frame overflow-hidden">
              <img
                src={LAB_IMAGES.telecomModulation}
                alt={lang === 'fa' ? 'دیاگرام مدولاسیون مخابراتی' : 'Telecommunications Modulation Diagram'}
                referrerPolicy="no-referrer"
                className="w-full h-32 object-cover opacity-90"
              />
              <div className="p-2 bg-slate-950/85 border-t border-sky-400/20 text-[10px] font-mono text-slate-300 flex justify-between">
                <span>
                  {lang === 'fa'
                    ? 'طیف باند عبوری و حامل فرکانس رادیویی (RF)'
                    : 'RF Passband Carrier & Sideband Architecture'}
                </span>
                <span className="text-sky-400">{analogCfg.type}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Flow Chain */}
        <div className="neu-inset p-3.5 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[680px] text-xs font-mono">
            {[
              {
                step: lang === 'fa' ? '۱. پیام m(t)' : '1. Message m(t)',
                detail: `${analogCfg.messageFreq} Hz Baseband`,
              },
              {
                step: lang === 'fa' ? '۲. حامل c(t)' : '2. Carrier c(t)',
                detail: `${analogCfg.carrierFreq} Hz RF LO`,
              },
              {
                step: lang === 'fa' ? '۳. مدولاتور' : '3. Modulator',
                detail: `${analogCfg.type} (m=${analogCfg.modulationIndex})`,
              },
              {
                step: lang === 'fa' ? '۴. سیگنال مدوله‌شده s(t)' : '4. Modulated s(t)',
                detail: lang === 'fa' ? 'سیگنال باند عبوری' : 'Passband Signal',
              },
              {
                step: lang === 'fa' ? '۵. کانال AWGN' : '5. AWGN Channel',
                detail: `SNR = ${analogCfg.snrDb} dB`,
              },
              {
                step: lang === 'fa' ? '۶. دمدولاتور' : '6. Demodulator',
                detail: analogCfg.type === 'AM' ? 'Envelope Det' : 'Coherent / Discrim',
              },
              {
                step: lang === 'fa' ? '۷. پیام بازیابی‌شده m̂(t)' : '7. Recovered m̂(t)',
                detail: lang === 'fa' ? 'خروجی فیلتر پایین‌گذر' : 'Low-Pass Reconstructed',
              },
            ].map((node, idx, arr) => (
              <React.Fragment key={node.step}>
                <div className="neu-card-sm px-3 py-2 text-center">
                  <div className="font-semibold text-sky-600 dark:text-sky-400">{node.step}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{node.detail}</div>
                </div>
                {idx < arr.length - 1 && (
                  <span className="text-slate-400 font-bold px-1">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Analog Modulation Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'فرکانس پیام (fm)' : 'Message Freq (fm)'}</span>
              <span className="text-sky-500 font-semibold">{analogCfg.messageFreq} Hz</span>
            </div>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={analogCfg.messageFreq}
              onChange={(e) => updateAnalog({ messageFreq: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'فرکانس حامل (fc)' : 'Carrier Freq (fc)'}</span>
              <span className="text-sky-500 font-semibold">{analogCfg.carrierFreq} Hz</span>
            </div>
            <input
              type="range"
              min={30}
              max={150}
              step={5}
              value={analogCfg.carrierFreq}
              onChange={(e) => updateAnalog({ carrierFreq: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'شاخص مدولاسیون (m / β)' : 'Modulation Index (m / β)'}</span>
              <span className="text-sky-500 font-semibold">
                {analogCfg.modulationIndex.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={3.5}
              step={0.05}
              value={analogCfg.modulationIndex}
              onChange={(e) => updateAnalog({ modulationIndex: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'دامنه حامل (Ac)' : 'Carrier Amp (Ac)'}</span>
              <span className="text-sky-500 font-semibold">{analogCfg.carrierAmp.toFixed(1)} V</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={analogCfg.carrierAmp}
              onChange={(e) => updateAnalog({ carrierAmp: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'نسبت سیگنال به نویز کانال' : 'Channel SNR'}</span>
              <span className="text-amber-500 font-semibold">{analogCfg.snrDb} dB</span>
            </div>
            <input
              type="range"
              min={-2}
              max={35}
              step={1}
              value={analogCfg.snrDb}
              onChange={(e) => updateAnalog({ snrDb: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
        </div>
      </div>

      {/* Time-Domain Transceiver Plots & Passband Spectrum */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? `شکل‌موج مدوله‌شده s(t) و سیگنال دریافتی نویزی r(t) [${analogCfg.type}]`
              : `Modulated Passband Waveform s(t) & Noisy Received r(t) [${analogCfg.type}]`
          }
          subtitle={
            lang === 'fa'
              ? 'بررسی پوش حامل، تغییرات فاز/فرکانس و اثر نویز افزایشی کانال'
              : 'Inspect carrier envelope / phase modulation and additive channel noise'
          }
          xData={sim.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={260}
          series={[
            {
              id: 'mod-clean',
              label: lang === 'fa' ? `سیگنال مدوله‌شده ${analogCfg.type}` : `Modulated ${analogCfg.type}`,
              data: sim.modulated,
              color: '#0ea5e9',
              lineWidth: 1.8,
            },
            {
              id: 'mod-noisy',
              label: lang === 'fa' ? 'دریافتی نویزی r(t)' : 'Noisy Channel r(t)',
              data: sim.noisy,
              color: '#f59e0b',
              lineWidth: 1.1,
              visible: false,
            },
            {
              id: 'carrier-ref',
              label: lang === 'fa' ? 'موج حامل خام c(t)' : 'Unmodulated Carrier',
              data: sim.carrier,
              color: '#94a3b8',
              lineWidth: 1,
              dashed: true,
              visible: false,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'مقایسه سیگنال پیام پایه m(t) و پیام دمدوله‌شده در گیرنده m̂(t)'
              : 'Baseband Message m(t) vs. Demodulated Recovered Signal m̂(t)'
          }
          subtitle={
            lang === 'fa'
              ? 'مقایسه مستقیم شکل‌موج ارسالی با خروجی آشکارساز و فیلتر پایین‌گذر گیرنده'
              : 'Compare transmitted baseband waveform against receiver low-pass output'
          }
          xData={sim.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={260}
          series={[
            {
              id: 'msg-orig',
              label: lang === 'fa' ? 'پیام ارسالی m(t)' : 'Transmitted Message m(t)',
              data: sim.message,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'msg-rec',
              label: lang === 'fa' ? 'پیام بازیابی‌شده m̂(t)' : 'Demodulated Recovered m̂(t)',
              data: sim.recovered,
              color: '#10b981',
              lineWidth: 2,
            },
          ]}
        />
      </div>

      <InteractivePlot
        title={
          lang === 'fa'
            ? `طیف فرکانسی باند عبوری |S(f)| برای مدولاسیون ${analogCfg.type}`
            : `Passband Frequency Spectrum |S(f)| of ${analogCfg.type} Signal`
        }
        subtitle={
          lang === 'fa'
            ? `متمرکز حول فرکانس حامل fc = ${analogCfg.carrierFreq} Hz به همراه باندهای جانبی در fc ± k·fm`
            : `Centered around Carrier Frequency fc = ${analogCfg.carrierFreq} Hz with sidebands at fc ± k·fm`
        }
        xData={modSpectrum.frequencies.slice(0, 260)}
        xLabel="Frequency (Hz)"
        yLabel="Magnitude |S(f)|"
        height={230}
        series={[
          {
            id: 'mod-spec',
            label: lang === 'fa' ? `طیف فرکانسی ${analogCfg.type}` : `${analogCfg.type} Passband Spectrum`,
            data: modSpectrum.magnitude.slice(0, 260),
            color: '#8b5cf6',
            lineWidth: 2,
          },
        ]}
      />

      {/* Dedicated Noise Laboratory Section */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {lang === 'fa'
                ? 'آزمایشگاه نویز و تداخل (سیگنال تمیز ← نویزی ← فیلترشده)'
                : 'Noise & Interference Laboratory (Clean → Noisy → Filtered)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'تزریق انواع مدل‌های نویز تصادفی و تداخل متناوب و بررسی افت SNR و بازیابی سیگنال با فیلتر.'
                : 'Inject stochastic and deterministic interference models and evaluate real-time SNR degradation and filter recovery.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NOISE_TYPES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => updateNoise({ type: n.id })}
                className={`neu-btn px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
                  noiseCfg.type === n.id ? 'btn-tool-pill font-semibold' : ''
                }`}
              >
                {lang === 'fa' ? n.faLabel : n.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'نسبت SNR هدف' : 'Target SNR'}</span>
              <span className="text-amber-500 font-semibold">{noiseCfg.snrDb} dB</span>
            </div>
            <input
              type="range"
              min={-5}
              max={35}
              step={1}
              value={noiseCfg.snrDb}
              onChange={(e) => updateNoise({ snrDb: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'دامنه نویز' : 'Noise Amplitude'}</span>
              <span className="text-amber-500 font-semibold">
                {noiseCfg.amplitude.toFixed(2)} V
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={2.5}
              step={0.05}
              value={noiseCfg.amplitude}
              onChange={(e) => updateNoise({ amplitude: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'واریانس (σ²)' : 'Variance (σ²)'}</span>
              <span className="text-amber-500 font-semibold">
                {noiseCfg.variance.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={2.0}
              step={0.05}
              value={noiseCfg.variance}
              onChange={(e) => updateNoise({ variance: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'فرکانس تداخل' : 'Interference Freq'}</span>
              <span className="text-amber-500 font-semibold">
                {noiseCfg.interferenceFreq} Hz
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={noiseCfg.interferenceFreq}
              onChange={(e) => updateNoise({ interferenceFreq: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'احتمال نویز ضربه‌ای' : 'Impulse Probability'}</span>
              <span className="text-amber-500 font-semibold">
                {(noiseCfg.impulseProbability * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={0.005}
              max={0.2}
              step={0.005}
              value={noiseCfg.impulseProbability}
              onChange={(e) => updateNoise({ impulseProbability: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
        </div>

        <InteractivePlot
          title={
            lang === 'fa'
              ? `روند اثر نویز: تمیز ← نویزی (${noiseCfg.type.toUpperCase()}) ← بازیابی فیلترشده`
              : `Noise Progression: Clean → Noisy (${noiseCfg.type.toUpperCase()}) → Filtered Recovery`
          }
          subtitle={
            lang === 'fa'
              ? `SNR ورودی = ${computed.empiricalSnrDb.toFixed(2)} dB ← SNR خروجی فیلتر = ${computed.filteredSnrDb.toFixed(2)} dB`
              : `Input SNR = ${computed.empiricalSnrDb.toFixed(2)} dB → Output Filtered SNR = ${computed.filteredSnrDb.toFixed(2)} dB`
          }
          xData={computed.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={250}
          series={[
            {
              id: 'nl-clean',
              label: lang === 'fa' ? 'سیگنال تمیز' : 'Clean Signal',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'nl-noisy',
              label: lang === 'fa' ? `نویزی (${noiseCfg.type.toUpperCase()})` : `Noisy (${noiseCfg.type.toUpperCase()})`,
              data: computed.noisySignal,
              color: '#f59e0b',
              lineWidth: 1.2,
            },
            {
              id: 'nl-filt',
              label: lang === 'fa' ? 'خروجی فیلترشده' : 'Filtered Output',
              data: computed.filteredSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={
          lang === 'fa'
            ? [
                {
                  title: 'مدولاسیون دامنه (AM, DSB-SC, SSB)',
                  formula: 's_{\\text{AM}}(t) = A_c\\left[1 + m\\cdot x(t)\\right]\\cos(2\\pi f_c t), \\quad s_{\\text{SSB}}(t) = \\frac{A_c}{2}\\left[x(t)\\cos(\\omega_c t) \\mp \\hat{x}(t)\\sin(\\omega_c t)\\right]',
                  explanation:
                    'در مدولاسیون استاندارد AM یک مؤلفه حامل قوی ارسال می‌شود که آشکارسازی پوش غیرهمدوس را ممکن می‌سازد، در حالی که DSB-SC حامل را حذف کرده و SSB با استفاده از تبدیل هیلبرت x̂(t) پهنای باند ارسالی را نصف می‌کند.',
                },
                {
                  title: 'مدولاسیون زاویه (FM و PM) و قانون پهنای باند کارسون',
                  formula: 's_{\\text{FM}}(t) = A_c\\cos\\!\\left(2\\pi f_c t + 2\\pi k_f \\int_0^t m(\\tau)\\,d\\tau\\right), \\quad B_T \\approx 2(\\Delta f + f_m) = 2f_m(\\beta + 1)',
                  explanation:
                    'مدولاسیون فرکانس و فاز اطلاعات پیام را در زاویه فاز لحظه‌ای حامل کدگذاری می‌کنند و با مصرف پهنای باند بیشتر، مقاومت بسیار بالایی در برابر نویز دامنه ایجاد می‌نمایند.',
                },
              ]
            : [
                {
                  title: 'Amplitude Modulation (AM, DSB-SC, SSB)',
                  formula: 's_{\\text{AM}}(t) = A_c\\left[1 + m\\cdot x(t)\\right]\\cos(2\\pi f_c t), \\quad s_{\\text{SSB}}(t) = \\frac{A_c}{2}\\left[x(t)\\cos(\\omega_c t) \\mp \\hat{x}(t)\\sin(\\omega_c t)\\right]',
                  explanation:
                    'Standard AM embeds a large carrier component enabling simple non-coherent envelope detection, whereas DSB-SC suppresses the carrier and SSB uses the Hilbert transform x̂(t) to halve transmission bandwidth.',
                },
                {
                  title: 'Angle Modulation (FM & PM) & Carson Bandwidth Rule',
                  formula: 's_{\\text{FM}}(t) = A_c\\cos\\!\\left(2\\pi f_c t + 2\\pi k_f \\int_0^t m(\\tau)\\,d\\tau\\right), \\quad B_T \\approx 2(\\Delta f + f_m) = 2f_m(\\beta + 1)',
                  explanation:
                    'Frequency and Phase Modulation encode information in the instantaneous phase angle of the carrier, trading wider RF bandwidth BT for strong resilience against amplitude noise.',
                },
              ]
        }
      />
    </div>
  );
};
