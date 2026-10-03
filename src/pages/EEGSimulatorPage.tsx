import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { EEG_PRESETS, simulateSyntheticEEG } from '../simulations/eeg';
import { computeFFTSpectrum } from '../simulations/fft';
import { useLab } from '../store/LabContext';
import { EEGBands } from '../types';

export const EEGSimulatorPage: React.FC = () => {
  const { experiment, setExperiment } = useLab();
  const eegCfg = experiment.eeg;

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
    range: string;
    minF: number;
    maxF: number;
    color: string;
  }[] = [
    { key: 'delta', name: 'Delta (δ)', range: '0.5–4 Hz', minF: 0.5, maxF: 4.0, color: '#6366f1' },
    { key: 'theta', name: 'Theta (θ)', range: '4–8 Hz', minF: 4.0, maxF: 8.0, color: '#0ea5e9' },
    { key: 'alpha', name: 'Alpha (α)', range: '8–13 Hz', minF: 8.0, maxF: 13.0, color: '#10b981' },
    { key: 'beta', name: 'Beta (β)', range: '13–30 Hz', minF: 13.0, maxF: 30.0, color: '#f59e0b' },
    { key: 'gamma', name: 'Gamma (γ)', range: '30–80 Hz', minF: 30.0, maxF: 75.0, color: '#ec4899' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Mandatory Non-Clinical Synthetic Banner */}
      <div className="neu-card p-4 border-l-4 border-l-amber-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <div className="text-sm font-bold tracking-tight">
              Synthetic EEG — Not clinical data
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              All waveforms and artifacts are mathematically synthesized for signal-processing education and algorithm testing. Not intended for clinical diagnosis.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EEG_PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                eegCfg.preset === key ? 'neu-btn-active text-sky-500' : ''
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Progression Pipeline: Clean EEG -> Artifact -> Noisy EEG -> Preprocessing -> Recovered EEG */}
      <div className="neu-card p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[640px] text-xs font-mono">
          {[
            { step: '1. Clean Cortical EEG', sub: 'Σ (δ, θ, α, β, γ) Rhythms' },
            { step: '2. Artifact Generator', sub: 'EOG Blink + EMG + 50Hz + Drift' },
            { step: '3. Contaminated EEG', sub: 'Raw Sensor Observation' },
            { step: '4. Preprocessing Chain', sub: `HPF ${eegCfg.preprocessHighpass}Hz + Notch + LPF ${eegCfg.preprocessLowpass}Hz` },
            { step: '5. Recovered EEG', sub: 'Cleaned Cortical Estimate' },
          ].map((item, i, arr) => (
            <React.Fragment key={item.step}>
              <div className="neu-inset px-3.5 py-2 text-center">
                <div className="font-semibold text-sky-500">{item.step}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
              </div>
              {i < arr.length - 1 && <span className="text-slate-400 font-bold">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Controls Grid: Left = 5 Cortical Frequency Bands, Right = Physiological Artifacts & Preprocessing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 neu-card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              Cortical Rhythm Spectral Bands (δ, θ, α, β, γ)
            </h2>
            <p className="text-xs text-slate-500">
              Independently adjust microvolt (μV) amplitude and center frequency for each neural oscillation band.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {BAND_META.map((b) => {
              const val = eegCfg.bands[b.key];
              return (
                <div key={b.key} className="neu-inset p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="text-xs font-bold">{b.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">{b.range}</div>
                  </div>

                  <div className="sm:col-span-4">
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span>Amplitude</span>
                      <span className="font-semibold">{val.amp.toFixed(0)} μV</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={1}
                      value={val.amp}
                      onChange={(e) => updateBand(b.key, 'amp', Number(e.target.value))}
                      className="sci-slider"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span>Center Freq</span>
                      <span className="font-semibold">{val.freq.toFixed(1)} Hz</span>
                    </div>
                    <input
                      type="range"
                      min={b.minF}
                      max={b.maxF}
                      step={0.5}
                      value={val.freq}
                      onChange={(e) => updateBand(b.key, 'freq', Number(e.target.value))}
                      className="sci-slider"
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
              Physiological & Instrumental Artifact Simulator
            </h2>
            <p className="text-xs text-slate-500">
              Toggle and scale non-cortical artifacts and configure the real-time preprocessing recovery filter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Eye Blink */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Ocular Eye Blink (EOG)</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.eyeBlink}
                  onChange={(e) => updateArtifact({ eyeBlink: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Peak Deflection</span>
                <span>{eegCfg.artifacts.eyeBlinkAmp} μV</span>
              </div>
              <input
                type="range"
                min={20}
                max={160}
                value={eegCfg.artifacts.eyeBlinkAmp}
                onChange={(e) => updateArtifact({ eyeBlinkAmp: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            {/* Muscle EMG */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Muscle Artifact (EMG)</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.muscleArtifact}
                  onChange={(e) => updateArtifact({ muscleArtifact: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Burst Amplitude</span>
                <span>{eegCfg.artifacts.muscleAmp} μV</span>
              </div>
              <input
                type="range"
                min={5}
                max={80}
                value={eegCfg.artifacts.muscleAmp}
                onChange={(e) => updateArtifact({ muscleAmp: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            {/* Baseline Drift */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Baseline Drift (0.28 Hz)</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.baselineDrift}
                  onChange={(e) => updateArtifact({ baselineDrift: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Drift Sway</span>
                <span>{eegCfg.artifacts.driftAmp} μV</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={eegCfg.artifacts.driftAmp}
                onChange={(e) => updateArtifact({ driftAmp: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            {/* Power-line Interference */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Power-Line Hum ({eegCfg.artifacts.powerlineFreq} Hz)</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.powerline}
                  onChange={(e) => updateArtifact({ powerline: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Mains Interference</span>
                <span>{eegCfg.artifacts.powerlineAmp} μV</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                value={eegCfg.artifacts.powerlineAmp}
                onChange={(e) => updateArtifact({ powerlineAmp: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            {/* Movement Artifact */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Head Movement Artifact</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.movement}
                  onChange={(e) => updateArtifact({ movement: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Sway Magnitude</span>
                <span>{eegCfg.artifacts.movementAmp} μV</span>
              </div>
              <input
                type="range"
                min={15}
                max={120}
                value={eegCfg.artifacts.movementAmp}
                onChange={(e) => updateArtifact({ movementAmp: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            {/* Electrode Noise */}
            <div className="neu-inset p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                <span>Electrode Pop & Thermal</span>
                <input
                  type="checkbox"
                  checked={eegCfg.artifacts.electrodeNoise}
                  onChange={(e) => updateArtifact({ electrodeNoise: e.target.checked })}
                  className="accent-sky-500"
                />
              </label>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Impedance Noise</span>
                <span>{eegCfg.artifacts.electrodeAmp} μV</span>
              </div>
              <input
                type="range"
                min={5}
                max={65}
                value={eegCfg.artifacts.electrodeAmp}
                onChange={(e) => updateArtifact({ electrodeAmp: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>
          </div>

          {/* Preprocessing Filter Controls */}
          <div className="neu-inset p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span>High-Pass Cutoff</span>
                <span className="text-emerald-500">{eegCfg.preprocessHighpass} Hz</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={4.0}
                step={0.2}
                value={eegCfg.preprocessHighpass}
                onChange={(e) => updateEEG({ preprocessHighpass: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span>Low-Pass Cutoff</span>
                <span className="text-emerald-500">{eegCfg.preprocessLowpass} Hz</span>
              </div>
              <input
                type="range"
                min={15}
                max={75}
                step={1}
                value={eegCfg.preprocessLowpass}
                onChange={(e) => updateEEG({ preprocessLowpass: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            <label className="flex items-center justify-between text-xs font-mono cursor-pointer px-2">
              <span>50Hz Notch Filter</span>
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
        title="Synthetic EEG Signal Progression — Clean → Artifact → Noisy → Recovered (Synthetic EEG — Not clinical data)"
        subtitle="Toggle visibility to compare raw contaminated EEG against preprocessed cortical recovery"
        xData={sim.time}
        xLabel="Time (s)"
        yLabel="Potential (μV)"
        height={300}
        series={[
          {
            id: 'eeg-clean',
            label: 'Clean Cortical EEG',
            data: sim.cleanEEG,
            color: '#0ea5e9',
            lineWidth: 1.9,
          },
          {
            id: 'eeg-art',
            label: 'Artifact Signal Only',
            data: sim.artifactSignal,
            color: '#f43f5e',
            lineWidth: 1.4,
            dashed: true,
            visible: false,
          },
          {
            id: 'eeg-noisy',
            label: 'Contaminated Noisy EEG',
            data: sim.noisyEEG,
            color: '#f59e0b',
            lineWidth: 1.3,
          },
          {
            id: 'eeg-rec',
            label: 'Preprocessed Recovered EEG',
            data: sim.recoveredEEG,
            color: '#10b981',
            lineWidth: 2.2,
          },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title="Individual Synthetic Cortical Band Decomposition (δ, θ, α, β, γ)"
          subtitle="Underlying rhythmic generators prior to summation"
          xData={sim.time}
          xLabel="Time (s)"
          yLabel="Amplitude (μV)"
          height={250}
          series={[
            { id: 'b-delta', label: 'Delta (0.5–4Hz)', data: sim.bandContributions.delta, color: '#6366f1' },
            { id: 'b-theta', label: 'Theta (4–8Hz)', data: sim.bandContributions.theta, color: '#0ea5e9', visible: false },
            { id: 'b-alpha', label: 'Alpha (8–13Hz)', data: sim.bandContributions.alpha, color: '#10b981' },
            { id: 'b-beta', label: 'Beta (13–30Hz)', data: sim.bandContributions.beta, color: '#f59e0b' },
            { id: 'b-gamma', label: 'Gamma (30–80Hz)', data: sim.bandContributions.gamma, color: '#ec4899', visible: false },
          ]}
        />

        <InteractivePlot
          title="Power Spectral Density / FFT of Recovered Synthetic EEG"
          subtitle="Inspect spectral energy peaks across Delta (0.5–4), Theta (4–8), Alpha (8–13), and Beta (13–30) bands"
          xData={eegSpectrum.frequencies.slice(0, 160)}
          xLabel="Frequency (Hz)"
          yLabel="Magnitude (μV)"
          height={250}
          series={[
            {
              id: 'eeg-spec',
              label: 'Recovered EEG Spectrum',
              data: eegSpectrum.magnitude.slice(0, 160),
              color: '#10b981',
              lineWidth: 2,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={[
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
        ]}
      />
    </div>
  );
};
