import React, { useId, useMemo } from 'react';
import { AlertTriangle, RotateCcw, Waves } from 'lucide-react';
import { LAB_IMAGES } from '../assets/labImages';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { PageHeader, ParamSlider } from '../components/ui';
import { getSeriesColor, getSeriesDash } from '../theme/palette';
import { EEG_PRESETS, simulateSyntheticEEG } from '../simulations/eeg';
import { computeFFTSpectrum } from '../simulations/fft';
import { useLab } from '../store/LabContext';
import { EEGBands } from '../types';

const PRESET_FA_LABELS: Record<string, string> = {
  relaxed_alpha: 'آرامش با چشمان بسته (غالب آلفا)',
  focused_beta: 'تمرکز ذهنی فعال (غالب بتا)',
  deep_sleep_delta: 'خواب عمیق مرحله ۳ (غالب دلتا)',
  drowsy_theta: 'خواب‌آلودگی / مراقبه (غالب تتا)',
  heavily_contaminated: 'آلوده به آرتیفکت شدید (پلک + عضله + برق)',
};

export const EEGSimulatorPage: React.FC = () => {
  const { experiment, setExperiment, lang, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const eegCfg = experiment.eeg;
  const presetGroupId = useId();

  const updateEEG = (patch: Partial<typeof eegCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      eeg: { ...prev.eeg, ...patch },
    }));
  };

  const updateBand = (band: keyof EEGBands, key: 'amp' | 'freq', val: number) => {
    updateEEG({
      preset: 'custom',
      bands: {
        ...eegCfg.bands,
        [band]: { ...eegCfg.bands[band], [key]: val },
      },
    });
  };

  const updateArtifact = (patch: Partial<typeof eegCfg.artifacts>) => {
    updateEEG({
      artifacts: { ...eegCfg.artifacts, ...patch },
    });
  };

  const applyPreset = (presetKey: string) => {
    const p = EEG_PRESETS[presetKey];
    if (!p) return;
    updateEEG({
      preset: presetKey,
      bands: structuredClone(p.bands),
      artifacts: { ...eegCfg.artifacts, ...p.artifacts },
    });
  };

  const sim = useMemo(
    () => simulateSyntheticEEG(eegCfg, experiment.randomSeed),
    [eegCfg, experiment.randomSeed]
  );

  const eegSpectrum = useMemo(
    () => computeFFTSpectrum(sim.recoveredEEG, eegCfg.samplingRate, 512, 'hann'),
    [sim.recoveredEEG, eegCfg.samplingRate]
  );

  const BAND_META: {
    key: keyof EEGBands;
    name: string;
    faName: string;
    range: string;
    minF: number;
    maxF: number;
    color: string;
  }[] = [
    { key: 'delta', name: 'Delta (δ)', faName: 'باند دلتا (δ)', range: '0.5–4 Hz', minF: 0.5, maxF: 4.0, color: getSeriesColor(0) },
    { key: 'theta', name: 'Theta (θ)', faName: 'باند تتا (θ)', range: '4–8 Hz', minF: 4.0, maxF: 8.0, color: getSeriesColor(1) },
    { key: 'alpha', name: 'Alpha (α)', faName: 'باند آلفا (α)', range: '8–13 Hz', minF: 8.0, maxF: 13.0, color: getSeriesColor(2) },
    { key: 'beta', name: 'Beta (β)', faName: 'باند بتا (β)', range: '13–30 Hz', minF: 13.0, maxF: 30.0, color: getSeriesColor(3) },
    { key: 'gamma', name: 'Gamma (γ)', faName: 'باند گاما (γ)', range: '30–80 Hz', minF: 30.0, maxF: 75.0, color: getSeriesColor(4) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Mandatory Non-Clinical Synthetic Banner + Cortical Map Visual */}
      <div className="neu-card p-5 flex flex-col gap-4 border-s-4 border-s-amber-500">
        <PageHeader
          icon={<Waves className="w-5 h-5" />}
          title={isFa ? 'شبیه‌ساز نوار مغز (EEG)' : 'EEG Simulator'}
          subtitle={
            isFa
              ? 'تولید ریتم‌های مغزی و آرتیفکت‌ها و پاکسازی آن‌ها با فیلترهای پیش‌پردازش.'
              : 'Generate brain rhythms and artifacts, then clean them with preprocessing filters.'
          }
          stats={[
            { label: 'fs', value: `${eegCfg.samplingRate} Hz` },
            {
              label: isFa ? 'باند عبور' : 'Passband',
              value: `${eegCfg.preprocessHighpass}–${eegCfg.preprocessLowpass} Hz`,
            },
          ]}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold tracking-tight">
                {isFa
                  ? 'سیگنال EEG مصنوعی — غیربالینی (Synthetic EEG — Not clinical data)'
                  : 'Synthetic EEG — Not clinical data'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {isFa
                  ? 'تمامی امواج مغزی و آرتیفکت‌ها به صورت ریاضی برای آموزش پردازش سیگنال و ارزیابی الگوریتم‌ها سنتز شده‌اند و هیچ کاربرد تشخیصی یا پزشکی ندارند.'
                  : 'All waveforms and artifacts are mathematically synthesized for signal-processing education and algorithm testing. Not intended for clinical diagnosis.'}
              </p>
            </div>
          </div>

          <span id={presetGroupId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isFa ? 'پیش‌تنظیم حالت مغزی' : 'Brain-state preset'}
          </span>
          <div role="group" aria-labelledby={presetGroupId} className="flex flex-wrap gap-1.5">
            {Object.entries(EEG_PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                aria-pressed={eegCfg.preset === key}
                onClick={() => applyPreset(key)}
                className={`neu-btn px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                  eegCfg.preset === key ? 'btn-tool-pill' : ''
                }`}
              >
                {isFa ? PRESET_FA_LABELS[key] || p.label : p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="oscilloscope-frame overflow-hidden">
            <img
              src={LAB_IMAGES.eegCortical}
              alt={isFa ? 'نقشه قشر مغز و الکترودهای EEG' : 'Cortical EEG Electrode Montage'}
              referrerPolicy="no-referrer"
              className="w-full h-32 object-cover opacity-90"
            />
            <div className="p-2 bg-slate-950/85 border-t border-sky-400/20 text-2xs font-mono text-slate-300 flex justify-between gap-2">
              <span>
                {isFa
                  ? 'مدل نوسانگرهای ریتمیک قشر مغز (۱۰-۲۰)'
                  : '10-20 Cortical Rhythm Oscillator Model'}
              </span>
              <span className="text-emerald-400">fs={eegCfg.samplingRate}Hz</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Visual Progression Pipeline: Clean EEG -> Artifact -> Noisy EEG -> Preprocessing -> Recovered EEG */}
      <div className="neu-card p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[640px] text-xs font-mono">
          {[
            {
              step: lang === 'fa' ? '۱. EEG قشری تمیز' : '1. Clean Cortical EEG',
              sub: 'Σ (δ, θ, α, β, γ) Rhythms',
            },
            {
              step: lang === 'fa' ? '۲. مولد آرتیفکت‌ها' : '2. Artifact Generator',
              sub: 'EOG Blink + EMG + 50Hz + Drift',
            },
            {
              step: lang === 'fa' ? '۳. EEG آلوده به آرتیفکت' : '3. Contaminated EEG',
              sub: lang === 'fa' ? 'سیگنال خام سنسور' : 'Raw Sensor Observation',
            },
            {
              step: lang === 'fa' ? '۴. زنجیره پیش‌پردازش' : '4. Preprocessing Chain',
              sub: `HPF ${eegCfg.preprocessHighpass}Hz + Notch + LPF ${eegCfg.preprocessLowpass}Hz`,
            },
            {
              step: lang === 'fa' ? '۵. EEG بازیابی‌شده' : '5. Recovered EEG',
              sub: lang === 'fa' ? 'تخمین سیگنال مغزی پاکسازی‌شده' : 'Cleaned Cortical Estimate',
            },
          ].map((item, i, arr) => (
            <React.Fragment key={item.step}>
              <div className="neu-inset px-3.5 py-2 text-center">
                <div className="font-semibold text-sky-500">{item.step}</div>
                <div className="text-2xs text-slate-500 mt-0.5">{item.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <span aria-hidden="true" className="text-slate-400 font-bold rtl:rotate-180">
                  →
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Controls Grid: Left = 5 Cortical Frequency Bands, Right = Physiological Artifacts & Preprocessing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 neu-card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              {lang === 'fa'
                ? 'باندهای فرکانسی ریتم‌های قشر مغز (δ, θ, α, β, γ)'
                : 'Cortical Rhythm Spectral Bands (δ, θ, α, β, γ)'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'fa'
                ? 'دامنه (برحسب میکروولت μV) و فرکانس مرکزی هر باند نوسانی مغز را به صورت مستقل تنظیم کنید.'
                : 'Independently adjust microvolt (μV) amplitude and center frequency for each neural oscillation band.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {BAND_META.map((b) => {
              const val = eegCfg.bands[b.key];
              return (
                <div key={b.key} className="neu-inset p-3 flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-full shrink-0 self-center"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="text-xs font-bold">{isFa ? b.faName : b.name}</span>
                    <span className="text-caption font-mono text-slate-500">{b.range}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ParamSlider
                      label={`${b.name} amplitude`}
                      faLabel={`دامنه ${b.faName}`}
                      value={val.amp}
                      min={0}
                      max={80}
                      step={1}
                      unit="μV"
                      lang={lang}
                      onChange={(v) => updateBand(b.key, 'amp', v)}
                    />
                    <ParamSlider
                      label={`${b.name} center freq`}
                      faLabel={`فرکانس مرکزی ${b.faName}`}
                      value={val.freq}
                      min={b.minF}
                      max={b.maxF}
                      step={0.5}
                      unit="Hz"
                      format={(v) => v.toFixed(1)}
                      lang={lang}
                      onChange={(v) => updateBand(b.key, 'freq', v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* EEG Artifact Simulation & Preprocessing Controls */}
        <div className="lg:col-span-6 neu-card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              {lang === 'fa'
                ? 'شبیه‌ساز آرتیفکت‌های فیزیولوژیک و محیطی'
                : 'Physiological & Instrumental Artifact Simulator'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'fa'
                ? 'آرتیفکت‌های غیرمغزی را فعال یا تنظیم کنید و فیلترهای پیش‌پردازش را برای بازیابی سیگنال پیکربندی نمایید.'
                : 'Toggle and scale non-cortical artifacts and configure the real-time preprocessing recovery filter.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Eye Blink */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>{lang === 'fa' ? 'پلک‌زدن چشم (EOG)' : 'Ocular Eye Blink (EOG)'}</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.eyeBlink}
                  onChange={(e) => updateArtifact({ eyeBlink: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <ParamSlider
                label="Peak Deflection"
                faLabel="دامنه جهش"
                value={eegCfg.artifacts.eyeBlinkAmp}
                min={20}
                max={160}
                step={1}
                unit="μV"
                lang={lang}
                disabled={!eegCfg.artifacts.eyeBlink}
                onChange={(v) => updateArtifact({ eyeBlinkAmp: v })}
              />
            </div>

            {/* Muscle EMG */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>{lang === 'fa' ? 'انقباض عضلانی (EMG)' : 'Muscle Artifact (EMG)'}</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.muscleArtifact}
                  onChange={(e) => updateArtifact({ muscleArtifact: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <ParamSlider
                label="Burst Amplitude"
                faLabel="دامنه نویز عضله"
                value={eegCfg.artifacts.muscleAmp}
                min={5}
                max={80}
                step={1}
                unit="μV"
                lang={lang}
                disabled={!eegCfg.artifacts.muscleArtifact}
                onChange={(v) => updateArtifact({ muscleAmp: v })}
              />
            </div>

            {/* Baseline Drift */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>{lang === 'fa' ? 'انحراف خط پایه (0.28Hz)' : 'Baseline Drift (0.28 Hz)'}</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.baselineDrift}
                  onChange={(e) => updateArtifact({ baselineDrift: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <ParamSlider
                label="Drift Sway"
                faLabel="دامنه نوسان پایه"
                value={eegCfg.artifacts.driftAmp}
                min={10}
                max={100}
                step={1}
                unit="μV"
                lang={lang}
                disabled={!eegCfg.artifacts.baselineDrift}
                onChange={(v) => updateArtifact({ driftAmp: v })}
              />
            </div>

            {/* Power-line Interference */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>
                  {lang === 'fa'
                    ? `نویز برق شهر (${eegCfg.artifacts.powerlineFreq} Hz)`
                    : `Power-Line Hum (${eegCfg.artifacts.powerlineFreq} Hz)`}
                </span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.powerline}
                  onChange={(e) => updateArtifact({ powerline: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <ParamSlider
                label="Mains Interference"
                faLabel="دامنه تداخل برق"
                value={eegCfg.artifacts.powerlineAmp}
                min={5}
                max={60}
                step={1}
                unit="μV"
                lang={lang}
                disabled={!eegCfg.artifacts.powerline}
                onChange={(v) => updateArtifact({ powerlineAmp: v })}
              />
            </div>

            {/* Movement Artifact */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>{lang === 'fa' ? 'آرتیفکت حرکت سر' : 'Head Movement Artifact'}</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.movement}
                  onChange={(e) => updateArtifact({ movement: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <ParamSlider
                label="Sway Magnitude"
                faLabel="دامنه حرکت"
                value={eegCfg.artifacts.movementAmp}
                min={15}
                max={120}
                step={1}
                unit="μV"
                lang={lang}
                disabled={!eegCfg.artifacts.movement}
                onChange={(v) => updateArtifact({ movementAmp: v })}
              />
            </div>

            {/* Electrode Noise */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>{lang === 'fa' ? 'نویز امپدانس الکترود' : 'Electrode Pop & Thermal'}</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.electrodeNoise}
                  onChange={(e) => updateArtifact({ electrodeNoise: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <ParamSlider
                label="Impedance Noise"
                faLabel="نویز تماس الکترود"
                value={eegCfg.artifacts.electrodeAmp}
                min={5}
                max={65}
                step={1}
                unit="μV"
                lang={lang}
                disabled={!eegCfg.artifacts.electrodeNoise}
                onChange={(v) => updateArtifact({ electrodeAmp: v })}
              />
            </div>
          </div>

          {/* Preprocessing Filter Controls */}
          <div className="neu-inset p-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-center">
            <ParamSlider
              label="High-Pass Cutoff"
              faLabel="فرکانس قطع بالاگذر"
              value={eegCfg.preprocessHighpass}
              min={0.2}
              max={4.0}
              step={0.2}
              unit="Hz"
              lang={lang}
              onChange={(v) => updateEEG({ preprocessHighpass: v })}
            />
            <ParamSlider
              label="Low-Pass Cutoff"
              faLabel="فرکانس قطع پایین‌گذر"
              value={eegCfg.preprocessLowpass}
              min={15}
              max={75}
              step={1}
              unit="Hz"
              lang={lang}
              onChange={(v) => updateEEG({ preprocessLowpass: v })}
            />

            <label className="flex items-center justify-between text-xs font-mono cursor-pointer px-2">
              <span>{lang === 'fa' ? 'فیلتر Notch برق شهر' : '50Hz Notch Filter'}</span>
              <input
                type="checkbox"
                checked={eegCfg.preprocessNotch}
                onChange={(e) => updateEEG({ preprocessNotch: e.target.checked })}
                className="accent-emerald-500"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main EEG Progression Visualizations */}
      <InteractivePlot
        title={
          lang === 'fa'
            ? 'روند پردازش سیگنال EEG مصنوعی — تمیز ← آرتیفکت ← آلوده ← بازیابی‌شده (غیربالینی)'
            : 'Synthetic EEG Signal Progression — Clean → Artifact → Noisy → Recovered (Synthetic EEG — Not clinical data)'
        }
        subtitle={
          lang === 'fa'
            ? 'قابلیت روشن/خاموش کردن هر منحنی برای مقایسه سیگنال آلوده و سیگنال قشری بازیابی‌شده'
            : 'Toggle visibility to compare raw contaminated EEG against preprocessed cortical recovery'
        }
        xData={sim.time}
        xLabel={isFa ? 'زمان (s)' : 'Time (s)'}
        xUnit="s"
        yLabel={isFa ? 'پتانسیل (μV)' : 'Potential (μV)'}
        yUnit="μV"
        height={300}
        series={[
          {
            id: 'eeg-clean',
            label: lang === 'fa' ? 'EEG قشری تمیز' : 'Clean Cortical EEG',
            data: sim.cleanEEG,
            color: getSeriesColor(0),
            dash: getSeriesDash(0),
            lineWidth: 1.9,
          },
          {
            id: 'eeg-art',
            label: lang === 'fa' ? 'فقط سیگنال آرتیفکت' : 'Artifact Signal Only',
            data: sim.artifactSignal,
            color: getSeriesColor(4),
            lineWidth: 1.4,
            dash: getSeriesDash(2),
            visible: false,
          },
          {
            id: 'eeg-noisy',
            label: lang === 'fa' ? 'EEG آلوده به آرتیفکت' : 'Contaminated Noisy EEG',
            data: sim.noisyEEG,
            color: getSeriesColor(1),
            dash: getSeriesDash(1),
            lineWidth: 1.3,
          },
          {
            id: 'eeg-rec',
            label: lang === 'fa' ? 'EEG بازیابی‌شده پس از پیش‌پردازش' : 'Preprocessed Recovered EEG',
            data: sim.recoveredEEG,
            color: getSeriesColor(2),
            dash: getSeriesDash(3),
            lineWidth: 2.2,
          },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? 'تجزیه باندهای فرکانسی قشر مغز (δ, θ, α, β, γ)'
              : 'Individual Synthetic Cortical Band Decomposition (δ, θ, α, β, γ)'
          }
          subtitle={
            lang === 'fa'
              ? 'نوسانگرهای ریتمیک پایه پیش از ترکیب خطی'
              : 'Underlying rhythmic generators prior to summation'
          }
          xData={sim.time}
          xLabel={isFa ? 'زمان (s)' : 'Time (s)'}
          xUnit="s"
          yLabel={isFa ? 'دامنه (μV)' : 'Amplitude (μV)'}
          yUnit="μV"
          height={250}
          autoDash
          series={[
            { id: 'b-delta', label: 'Delta (0.5–4Hz)', data: sim.bandContributions.delta, color: BAND_META[0].color },
            { id: 'b-theta', label: 'Theta (4–8Hz)', data: sim.bandContributions.theta, color: BAND_META[1].color, visible: false },
            { id: 'b-alpha', label: 'Alpha (8–13Hz)', data: sim.bandContributions.alpha, color: BAND_META[2].color },
            { id: 'b-beta', label: 'Beta (13–30Hz)', data: sim.bandContributions.beta, color: BAND_META[3].color },
            { id: 'b-gamma', label: 'Gamma (30–80Hz)', data: sim.bandContributions.gamma, color: BAND_META[4].color, visible: false },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'طیف فرکانسی فوریه (FFT) سیگنال EEG بازیابی‌شده'
              : 'Power Spectral Density / FFT of Recovered Synthetic EEG'
          }
          subtitle={
            lang === 'fa'
              ? 'بررسی قله‌های انرژی در باندهای دلتا، تتا، آلفا و بتا'
              : 'Inspect spectral energy peaks across Delta (0.5–4), Theta (4–8), Alpha (8–13), and Beta (13–30) bands'
          }
          xData={eegSpectrum.frequencies.slice(0, 160)}
          xLabel={isFa ? 'فرکانس (Hz)' : 'Frequency (Hz)'}
          xUnit="Hz"
          yLabel={isFa ? 'اندازه (μV)' : 'Magnitude (μV)'}
          yUnit="μV"
          height={250}
          series={[
            {
              id: 'eeg-spec',
              label: lang === 'fa' ? 'طیف EEG بازیابی‌شده' : 'Recovered EEG Spectrum',
              data: eegSpectrum.magnitude.slice(0, 160),
              color: getSeriesColor(2),
              lineWidth: 2,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={
          lang === 'fa'
            ? [
                {
                  title: 'برهم‌نهی ریتم‌های چندبانده قشر مغز (مدل آموزشی)',
                  formula: 'v_{\\text{EEG}}(t) = \\sum_{b \\in \\{\\delta,\\theta,\\alpha,\\beta,\\gamma\\}} A_b(t)\\sin(2\\pi f_b t + \\phi_b) + \\eta_{1/f}(t)',
                  explanation:
                    'در مدل‌های آموزشی EEG، پتانسیل‌های سطحی پوست سر به صورت برهم‌نهی نوسانگرهای باند-محدود (دلتا، تتا، آلفا، بتا و گاما) به همراه نویز پس‌زمینه 1/f مدل‌سازی می‌شوند.',
                },
                {
                  title: 'آلودگی آرتیفکت و آبشار فیلترهای پیش‌پردازش خطی',
                  formula: 'y(t) = \\left(h_{\\text{LPF}} * h_{\\text{Notch}} * h_{\\text{HPF}} * (v_{\\text{EEG}} + v_{\\text{EOG}} + v_{\\text{EMG}} + v_{\\text{mains}})\\right)(t)',
                  explanation:
                    'فیلتر بالاگذر (>0.5 Hz) انحراف خط پایه ناشی از تنفس و تعریق را حذف می‌کند، فیلتر شکاف (Notch) در ۵۰/۶۰ هرتز تداخل برق شهر را سرکوب می‌نماید و فیلتر پایین‌گذر (<40 Hz) نویز عضلانی فرکانس بالا (EMG) را تضعیف می‌کند.',
                },
              ]
            : [
                {
                  title: 'Synthetic Multi-Band Cortical Rhythm Superposition',
                  formula: 'v_{\\text{EEG}}(t) = \\sum_{b \\in \\{\\delta,\\theta,\\alpha,\\beta,\\gamma\\}} A_b(t)\\sin(2\\pi f_b t + \\phi_b) + \\eta_{1/f}(t)',
                  explanation:
                    'Educational EEG models represent surface scalp potentials as the superposition of band-limited rhythmic oscillators modulated by slow spindle envelopes plus 1/f background activity.',
                },
                {
                  title: 'Artifact Contamination & Linear Preprocessing Cascade',
                  formula: 'y(t) = \\left(h_{\\text{LPF}} * h_{\\text{Notch}} * h_{\\text{HPF}} * (v_{\\text{EEG}} + v_{\\text{EOG}} + v_{\\text{EMG}} + v_{\\text{mains}})\\right)(t)',
                  explanation:
                    'High-pass filtering (>0.5 Hz) eliminates baseline sweat/respiration drift, a narrowband 50/60 Hz notch removes power-line hum, and low-pass filtering (<40 Hz) suppresses cranial muscle EMG.',
                },
              ]
        }
      />
    </div>
  );
};
