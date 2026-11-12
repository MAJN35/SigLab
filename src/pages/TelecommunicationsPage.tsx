import React, { useId, useMemo } from 'react';
import { Radio, RotateCcw } from 'lucide-react';
import { LAB_IMAGES } from '../assets/labImages';
import { InteractivePlot } from '../components/InteractivePlot';
import { LiveEquation, TheoryAccordion } from '../components/MathBlock';
import { PageHeader, ParamSlider } from '../components/ui';
import { getSeriesColor, getSeriesDash, MARKER_COLOR } from '../theme/palette';
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
  const { experiment, setExperiment, computed, lang, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const analogCfg = experiment.modulation.analog;
  const noiseCfg = experiment.noise;
  const modGroupId = useId();
  const noiseGroupId = useId();

  // Which noise parameters the selected noise model actually uses
  // (mirrors the switch in simulations/signals addNoise).
  const nt = noiseCfg.type;
  const usesSnr = nt !== 'gaussian';
  const usesAmplitude = nt !== 'awgn';
  const usesVariance = nt === 'gaussian';
  const usesInterference = nt === 'powerline' || nt === 'sinusoidal' || nt === 'custom';
  const usesImpulse = nt === 'impulse' || nt === 'custom';

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

  // Approximate transmission bandwidth for the selected scheme (display only).
  const isAngle = analogCfg.type === 'FM' || analogCfg.type === 'PM';
  const bandwidthHz = isAngle
    ? 2 * analogCfg.messageFreq * (analogCfg.modulationIndex + 1)
    : analogCfg.type === 'SSB'
      ? analogCfg.messageFreq
      : 2 * analogCfg.messageFreq;
  const bandwidthTex = isAngle
    ? 'B_T \\approx 2f_m(\\beta + 1) = 2 \\cdot {{fm}}\\,\\text{Hz} \\cdot ({{beta}} + 1) = {{bw}}\\,\\text{Hz}'
    : analogCfg.type === 'SSB'
      ? 'B_T = f_m = {{bw}}\\,\\text{Hz}'
      : 'B_T = 2f_m = 2 \\cdot {{fm}}\\,\\text{Hz} = {{bw}}\\,\\text{Hz}';
  const spectrumMarkers = useMemo(
    () => [{ x: analogCfg.carrierFreq, label: `fc = ${analogCfg.carrierFreq} Hz`, color: MARKER_COLOR }],
    [analogCfg.carrierFreq]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Analog Modulation Section Header + Transceiver Block Diagram */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 flex flex-col gap-3">
            <PageHeader
              icon={<Radio className="w-5 h-5" />}
              title={isFa ? 'مخابرات آنالوگ' : 'Analog Telecom'}
              subtitle={
                isFa
                  ? 'شبیه‌سازی کامل زنجیره فرستنده-گیرنده مخابرات آنالوگ (AM, DSB-SC, SSB, FM, PM) و آزمایشگاه تزریق نویز و تداخل کانال.'
                  : 'End-to-end Analog Transceiver chain (AM, DSB-SC, SSB, FM, PM) and multi-distribution Channel Noise Laboratory.'
              }
              actions={
                <button
                  type="button"
                  onClick={resetExperiment}
                  className="neu-btn rounded-control px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  {isFa ? 'بازنشانی پیش‌فرض‌ها' : 'Reset to defaults'}
                </button>
              }
            />
            <span id={modGroupId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {isFa ? 'نوع مدولاسیون' : 'Modulation type'}
            </span>
            <div role="group" aria-labelledby={modGroupId} className="flex flex-wrap gap-1.5">
              {ANALOG_MODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={analogCfg.type === m.id}
                  onClick={() => updateAnalog({ type: m.id })}
                  className={`neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    analogCfg.type === m.id ? 'btn-tool-pill' : ''
                  }`}
                >
                  {isFa ? m.faLabel : m.label}
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
              <div className="p-2 bg-slate-950/85 border-t border-sky-400/20 text-2xs font-mono text-slate-300 flex justify-between gap-2">
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
                  <div className="text-2xs text-slate-500 mt-0.5">{node.detail}</div>
                </div>
                {idx < arr.length - 1 && (
                  <span aria-hidden="true" className="text-slate-400 font-bold px-1 rtl:rotate-180">
                    →
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Analog Modulation Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pt-1">
          <ParamSlider
            label="Message Freq (fm)"
            faLabel="فرکانس پیام (fm)"
            value={analogCfg.messageFreq}
            min={2}
            max={20}
            step={1}
            unit="Hz"
            lang={lang}
            onChange={(v) => updateAnalog({ messageFreq: v })}
          />
          <ParamSlider
            label="Carrier Freq (fc)"
            faLabel="فرکانس حامل (fc)"
            value={analogCfg.carrierFreq}
            min={30}
            max={150}
            step={5}
            unit="Hz"
            lang={lang}
            onChange={(v) => updateAnalog({ carrierFreq: v })}
          />
          <ParamSlider
            label={isAngle ? 'Modulation Index (β)' : 'Modulation Index (m)'}
            faLabel={isAngle ? 'شاخص مدولاسیون (β)' : 'شاخص مدولاسیون (m)'}
            value={analogCfg.modulationIndex}
            min={0.1}
            max={3.5}
            step={0.05}
            lang={lang}
            onChange={(v) => updateAnalog({ modulationIndex: v })}
            warning={
              analogCfg.type === 'AM' && analogCfg.modulationIndex > 1
                ? isFa
                  ? 'm > 1: فرامدولاسیون — آشکارساز پوش اعوجاج ایجاد می‌کند'
                  : 'm > 1: over-modulation — envelope detection distorts'
                : undefined
            }
          />
          <ParamSlider
            label="Carrier Amp (Ac)"
            faLabel="دامنه حامل (Ac)"
            value={analogCfg.carrierAmp}
            min={0.5}
            max={3.0}
            step={0.1}
            unit="V"
            lang={lang}
            onChange={(v) => updateAnalog({ carrierAmp: v })}
          />
          <ParamSlider
            label="Channel SNR"
            faLabel="نسبت سیگنال به نویز کانال"
            value={analogCfg.snrDb}
            min={-2}
            max={35}
            step={1}
            unit="dB"
            lang={lang}
            onChange={(v) => updateAnalog({ snrDb: v })}
          />
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
          xLabel={isFa ? 'زمان (s)' : 'Time (s)'}
          xUnit="s"
          yLabel={isFa ? 'دامنه (V)' : 'Amplitude (V)'}
          yUnit="V"
          height={260}
          series={[
            {
              id: 'mod-clean',
              label: lang === 'fa' ? `سیگنال مدوله‌شده ${analogCfg.type}` : `Modulated ${analogCfg.type}`,
              data: sim.modulated,
              color: getSeriesColor(0),
              lineWidth: 1.8,
            },
            {
              id: 'mod-noisy',
              label: lang === 'fa' ? 'دریافتی نویزی r(t)' : 'Noisy Channel r(t)',
              data: sim.noisy,
              color: getSeriesColor(1),
              dash: getSeriesDash(1),
              lineWidth: 1.1,
              visible: false,
            },
            {
              id: 'carrier-ref',
              label: lang === 'fa' ? 'موج حامل خام c(t)' : 'Unmodulated Carrier',
              data: sim.carrier,
              color: MARKER_COLOR,
              lineWidth: 1,
              dash: getSeriesDash(2),
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
          xLabel={isFa ? 'زمان (s)' : 'Time (s)'}
          xUnit="s"
          yLabel={isFa ? 'دامنه (V)' : 'Amplitude (V)'}
          yUnit="V"
          height={260}
          series={[
            {
              id: 'msg-orig',
              label: lang === 'fa' ? 'پیام ارسالی m(t)' : 'Transmitted Message m(t)',
              data: sim.message,
              color: getSeriesColor(0),
              lineWidth: 2,
            },
            {
              id: 'msg-rec',
              label: lang === 'fa' ? 'پیام بازیابی‌شده m̂(t)' : 'Demodulated Recovered m̂(t)',
              data: sim.recovered,
              color: getSeriesColor(2),
              dash: getSeriesDash(1),
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
        xLabel={isFa ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
        xUnit="Hz"
        yLabel={isFa ? 'اندازه |S(f)|' : 'Magnitude |S(f)|'}
        height={230}
        markers={spectrumMarkers}
        series={[
          {
            id: 'mod-spec',
            label: lang === 'fa' ? `طیف فرکانسی ${analogCfg.type}` : `${analogCfg.type} Passband Spectrum`,
            data: modSpectrum.magnitude.slice(0, 260),
            color: getSeriesColor(7),
            lineWidth: 2,
          },
        ]}
      />
      <div className="neu-card px-4 py-3 overflow-x-auto -mt-3">
        <LiveEquation
          tex={bandwidthTex}
          values={{ fm: analogCfg.messageFreq, beta: analogCfg.modulationIndex, bw: bandwidthHz }}
          caption={
            isFa
              ? `پهنای باند تقریبی ${analogCfg.type} حول fc = ${analogCfg.carrierFreq} Hz`
              : `Approximate ${analogCfg.type} transmission bandwidth around fc = ${analogCfg.carrierFreq} Hz`
          }
        />
      </div>

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
          <span id={noiseGroupId} className="sr-only">
            {isFa ? 'مدل نویز' : 'Noise model'}
          </span>
          <div role="group" aria-labelledby={noiseGroupId} className="flex flex-wrap gap-1.5">
            {NOISE_TYPES.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-pressed={noiseCfg.type === n.id}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {usesSnr && (
            <ParamSlider
              label="Target SNR"
              faLabel="نسبت SNR هدف"
              value={noiseCfg.snrDb}
              min={-5}
              max={35}
              step={1}
              unit="dB"
              lang={lang}
              onChange={(v) => updateNoise({ snrDb: v })}
            />
          )}
          {usesAmplitude && (
            <ParamSlider
              label="Noise Amplitude"
              faLabel="دامنه نویز"
              value={noiseCfg.amplitude}
              min={0.05}
              max={2.5}
              step={0.05}
              unit="V"
              lang={lang}
              onChange={(v) => updateNoise({ amplitude: v })}
            />
          )}
          {usesVariance && (
            <ParamSlider
              label="Variance (σ²)"
              faLabel="واریانس (σ²)"
              value={noiseCfg.variance}
              min={0.05}
              max={2.0}
              step={0.05}
              lang={lang}
              onChange={(v) => updateNoise({ variance: v })}
            />
          )}
          {usesInterference && (
            <ParamSlider
              label="Interference Freq"
              faLabel="فرکانس تداخل"
              value={noiseCfg.interferenceFreq}
              min={10}
              max={100}
              step={5}
              unit="Hz"
              lang={lang}
              onChange={(v) => updateNoise({ interferenceFreq: v })}
            />
          )}
          {usesImpulse && (
            <ParamSlider
              label="Impulse Probability"
              faLabel="احتمال نویز ضربه‌ای"
              value={noiseCfg.impulseProbability}
              min={0.005}
              max={0.2}
              step={0.005}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              lang={lang}
              onChange={(v) => updateNoise({ impulseProbability: v })}
            />
          )}
        </div>

        <p role="status" aria-live="polite" className="text-xs font-mono tabular-nums">
          {isFa ? 'SNR ورودی: ' : 'Input SNR: '}
          <strong className="text-amber-600 dark:text-amber-400">{computed.empiricalSnrDb.toFixed(2)} dB</strong>
          {' → '}
          {isFa ? 'SNR خروجی فیلتر: ' : 'Filtered SNR: '}
          <strong className="text-emerald-600 dark:text-emerald-400">{computed.filteredSnrDb.toFixed(2)} dB</strong>
        </p>

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
          xLabel={isFa ? 'زمان (s)' : 'Time (s)'}
          xUnit="s"
          yLabel={isFa ? 'دامنه (V)' : 'Amplitude (V)'}
          yUnit="V"
          height={250}
          series={[
            {
              id: 'nl-clean',
              label: lang === 'fa' ? 'سیگنال تمیز' : 'Clean Signal',
              data: computed.cleanSignal,
              color: getSeriesColor(0),
              lineWidth: 2,
            },
            {
              id: 'nl-noisy',
              label: lang === 'fa' ? `نویزی (${noiseCfg.type.toUpperCase()})` : `Noisy (${noiseCfg.type.toUpperCase()})`,
              data: computed.noisySignal,
              color: getSeriesColor(1),
              dash: getSeriesDash(1),
              lineWidth: 1.2,
            },
            {
              id: 'nl-filt',
              label: lang === 'fa' ? 'خروجی فیلترشده' : 'Filtered Output',
              data: computed.filteredSignal,
              color: getSeriesColor(2),
              dash: getSeriesDash(3),
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
