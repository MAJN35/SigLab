import React, { useMemo } from 'react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { computeFFTSpectrum } from '../simulations/fft';
import { simulateAnalogModulation } from '../simulations/modulation';
import { useLab } from '../store/LabContext';
import { AnalogModType, NoiseType } from '../types';

const ANALOG_MODS: { id: AnalogModType; label: string; desc: string }[] = [
  { id: 'AM', label: 'AM (DSB-LC)', desc: 'Full Carrier Double-Sideband Amplitude Modulation' },
  { id: 'DSB-SC', label: 'DSB-SC', desc: 'Double-Sideband Suppressed Carrier Modulation' },
  { id: 'SSB', label: 'SSB-USB', desc: 'Single-Sideband Upper Sideband Hilbert Transform' },
  { id: 'FM', label: 'FM', desc: 'Frequency Modulation (Carson Bandwidth Rule)' },
  { id: 'PM', label: 'PM', desc: 'Phase Modulation (Instantaneous Phase Deviation)' },
];

const NOISE_TYPES: { id: NoiseType; label: string }[] = [
  { id: 'awgn', label: 'AWGN' },
  { id: 'gaussian', label: 'Gaussian' },
  { id: 'uniform', label: 'Uniform' },
  { id: 'impulse', label: 'Impulse (Salt & Pepper)' },
  { id: 'burst', label: 'Burst Noise' },
  { id: 'powerline', label: 'Power-Line (50/60 Hz)' },
  { id: 'sinusoidal', label: 'Sinusoidal Jammer' },
  { id: 'custom', label: 'Custom Hybrid' },
];

export const TelecommunicationsPage: React.FC = () => {
  const { experiment, setExperiment, computed } = useLab();
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Telecommunications & Noise Laboratory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              End-to-end Analog Transceiver chain (AM, DSB-SC, SSB, FM, PM) and multi-distribution Channel Noise Laboratory.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ANALOG_MODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => updateAnalog({ type: m.id })}
                className={`neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  analogCfg.type === m.id ? 'neu-btn-active text-sky-500' : ''
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Flow Chain requested in prompt: Message -> Carrier -> Modulator -> Modulated Signal -> Noise -> Demodulator -> Recovered Signal */}
        <div className="neu-inset p-3.5 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[680px] text-xs font-mono">
            {[
              { step: '1. Message m(t)', detail: `${analogCfg.messageFreq} Hz Baseband` },
              { step: '2. Carrier c(t)', detail: `${analogCfg.carrierFreq} Hz RF LO` },
              { step: '3. Modulator', detail: `${analogCfg.type} (m=${analogCfg.modulationIndex})` },
              { step: '4. Modulated s(t)', detail: 'Passband Signal' },
              { step: '5. AWGN Channel', detail: `SNR = ${analogCfg.snrDb} dB` },
              { step: '6. Demodulator', detail: analogCfg.type === 'AM' ? 'Envelope Det' : 'Coherent / Discrim' },
              { step: '7. Recovered m̂(t)', detail: 'Low-Pass Reconstructed' },
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
              <span>Message Freq (fm)</span>
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
              <span>Carrier Freq (fc)</span>
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
              <span>Modulation Index (m / β)</span>
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
              <span>Carrier Amp (Ac)</span>
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
              <span>Channel SNR</span>
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
          title={`Modulated Passband Waveform s(t) & Noisy Received r(t) [${analogCfg.type}]`}
          subtitle="Inspect carrier envelope / phase modulation and additive channel noise"
          xData={sim.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={260}
          series={[
            {
              id: 'mod-clean',
              label: `Modulated ${analogCfg.type}`,
              data: sim.modulated,
              color: '#0ea5e9',
              lineWidth: 1.8,
            },
            {
              id: 'mod-noisy',
              label: 'Noisy Channel r(t)',
              data: sim.noisy,
              color: '#f59e0b',
              lineWidth: 1.1,
              visible: false,
            },
            {
              id: 'carrier-ref',
              label: 'Unmodulated Carrier',
              data: sim.carrier,
              color: '#94a3b8',
              lineWidth: 1,
              dashed: true,
              visible: false,
            },
          ]}
        />

        <InteractivePlot
          title="Baseband Message m(t) vs. Demodulated Recovered Signal m̂(t)"
          subtitle="Compare transmitted baseband waveform against receiver low-pass output"
          xData={sim.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={260}
          series={[
            {
              id: 'msg-orig',
              label: 'Transmitted Message m(t)',
              data: sim.message,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'msg-rec',
              label: 'Demodulated Recovered m̂(t)',
              data: sim.recovered,
              color: '#10b981',
              lineWidth: 2,
            },
          ]}
        />
      </div>

      <InteractivePlot
        title={`Passband Frequency Spectrum |S(f)| of ${analogCfg.type} Signal`}
        subtitle={`Centered around Carrier Frequency fc = ${analogCfg.carrierFreq} Hz with sidebands at fc ± k·fm`}
        xData={modSpectrum.frequencies.slice(0, 260)}
        xLabel="Frequency (Hz)"
        yLabel="Magnitude |S(f)|"
        height={230}
        series={[
          {
            id: 'mod-spec',
            label: `${analogCfg.type} Passband Spectrum`,
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
              Noise & Interference Laboratory (Clean → Noisy → Filtered)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inject stochastic and deterministic interference models and evaluate real-time SNR degradation and filter recovery.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NOISE_TYPES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => updateNoise({ type: n.id })}
                className={`neu-btn px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  noiseCfg.type === n.id ? 'neu-btn-active text-amber-500 font-semibold' : ''
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Target SNR</span>
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
              <span>Noise Amplitude</span>
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
              <span>Variance (σ²)</span>
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
              <span>Interference Freq</span>
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
              <span>Impulse Probability</span>
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
          title={`Noise Progression: Clean → Noisy (${noiseCfg.type.toUpperCase()}) → Filtered Recovery`}
          subtitle={`Input SNR = ${computed.empiricalSnrDb.toFixed(2)} dB → Output Filtered SNR = ${computed.filteredSnrDb.toFixed(2)} dB`}
          xData={computed.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={250}
          series={[
            {
              id: 'nl-clean',
              label: 'Clean Signal',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'nl-noisy',
              label: `Noisy (${noiseCfg.type.toUpperCase()})`,
              data: computed.noisySignal,
              color: '#f59e0b',
              lineWidth: 1.2,
            },
            {
              id: 'nl-filt',
              label: 'Filtered Output',
              data: computed.filteredSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={[
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
        ]}
      />
    </div>
  );
};
