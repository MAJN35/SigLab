import React from 'react';
import {
  Activity,
  Cpu,
  Radio,
  Sliders,
  Sparkles,
  Waves,
} from 'lucide-react';
import { InteractiveHeatmap, InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { PipelineEditor } from '../components/PipelineEditor';
import { EDUCATIONAL_PRESETS, useLab } from '../store/LabContext';

export const DashboardPage: React.FC = () => {
  const {
    experiment,
    setExperiment,
    computed,
    setActivePage,
    applyEducationalPreset,
  } = useLab();

  const activeBlocksCount = experiment.processing.filter((b) => b.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Quick Preset Bar */}
      <div className="neu-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-sky-600 dark:text-sky-400 mb-1">
            Active Experiment · Seed #{experiment.randomSeed} · Client-Side DSP Engine
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {experiment.name}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
            {experiment.description ||
              'Interactive time-domain, spectral, and time-frequency laboratory workspace.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Load Educational Preset"
            onChange={(e) => {
              const found = EDUCATIONAL_PRESETS.find((p) => p.id === e.target.value);
              if (found) applyEducationalPreset(found);
            }}
            defaultValue=""
            className="neu-inset px-3.5 py-2 text-xs font-medium rounded-full bg-transparent outline-none cursor-pointer"
          >
            <option value="" disabled>
              Load Educational Preset...
            </option>
            {EDUCATIONAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setActivePage('signal-generator')}
            className="btn-primary-pill px-4 py-2 text-xs whitespace-nowrap cursor-pointer"
          >
            Configure Signal
          </button>
          <button
            type="button"
            onClick={() => setActivePage('experiments')}
            className="neu-btn px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer"
          >
            Save / Export JSON
          </button>
        </div>
      </div>

      {/* 10 Key Scientific Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Current Signal / Type
          </div>
          <div className="text-base font-bold font-mono mt-1 capitalize truncate">
            {experiment.signal.type}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {experiment.signal.type === 'composite'
              ? `${experiment.signal.components.filter((c) => c.enabled).length} Active Harmonics`
              : 'Single Waveform'}
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Sampling Rate (fs)
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {experiment.signal.samplingRate}
            <span className="text-xs font-normal text-slate-400 ml-1">Hz</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            Nyquist: {(experiment.signal.samplingRate / 2).toFixed(0)} Hz
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Fundamental Freq & Amp
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {experiment.signal.frequency.toFixed(1)}
            <span className="text-xs font-normal text-slate-400 ml-1">Hz</span>
            <span className="mx-1.5 text-slate-400">·</span>
            {experiment.signal.amplitude.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">V</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            Dominant Peak: {computed.peaks[0]?.frequency.toFixed(1) ?? '—'} Hz
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Channel Noise & SNR
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1 text-amber-500">
            {computed.empiricalSnrDb.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">dB</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            Filtered SNR: {computed.filteredSnrDb.toFixed(2)} dB
          </div>
        </div>

        <div className="neu-card-sm p-3.5">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Modulation BER & Samples
          </div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1 text-sky-500">
            {computed.currentBer.toExponential(2)}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            N = {computed.time.length} samples · {activeBlocksCount} DSP stages
          </div>
        </div>
      </div>

      {/* Live Quick Scrubbers on Dashboard so every parameter can be tested immediately */}
      <div className="neu-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>Primary Frequency</span>
            <span className="font-semibold text-sky-500">
              {experiment.signal.frequency.toFixed(1)} Hz
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={80}
            step={0.5}
            value={experiment.signal.frequency}
            onChange={(e) => {
              const f = Number(e.target.value);
              setExperiment((prev) => ({
                ...prev,
                signal: {
                  ...prev.signal,
                  frequency: f,
                  components: prev.signal.components.map((c, idx) =>
                    idx === 0 ? { ...c, frequency: f } : c
                  ),
                },
              }));
            }}
            className="sci-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>Channel SNR (AWGN)</span>
            <span className="font-semibold text-amber-500">
              {experiment.noise.snrDb.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min={-5}
            max={35}
            step={0.5}
            value={experiment.noise.snrDb}
            onChange={(e) =>
              setExperiment((prev) => ({
                ...prev,
                noise: { ...prev.noise, enabled: true, snrDb: Number(e.target.value) },
              }))
            }
            className="sci-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span>Filter Cutoff (fc)</span>
            <span className="font-semibold text-emerald-500">
              {experiment.filter.cutoffLow.toFixed(1)} Hz
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={100}
            step={1}
            value={experiment.filter.cutoffLow}
            onChange={(e) =>
              setExperiment((prev) => ({
                ...prev,
                filter: { ...prev.filter, enabled: true, cutoffLow: Number(e.target.value) },
              }))
            }
            className="sci-slider"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-xs font-mono">
            <div className="text-slate-500">Freq Scale</div>
            <div className="font-semibold">
              {experiment.analysis.fft.logScale ? 'Logarithmic (dB)' : 'Linear Mag'}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setExperiment((prev) => ({
                ...prev,
                analysis: {
                  ...prev.analysis,
                  fft: {
                    ...prev.analysis.fft,
                    logScale: !prev.analysis.fft.logScale,
                  },
                },
              }))
            }
            className="neu-btn px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer"
          >
            Toggle dB / Linear
          </button>
        </div>
      </div>

      {/* Main Time-Domain Plot (Original, Noisy, Filtered with independent visibility controls) */}
      <InteractivePlot
        title="Time-Domain Waveform Analysis — Original vs. Noisy vs. Filtered"
        subtitle="Toggle visibility of individual signal layers, drag to box-zoom, pan, hover for exact sample values, or export as PNG"
        xData={computed.time}
        xLabel="Time (s)"
        yLabel="Amplitude (V)"
        height={290}
        series={[
          {
            id: 'clean',
            label: 'Original Clean',
            data: computed.cleanSignal,
            color: '#0ea5e9',
            lineWidth: 2,
          },
          {
            id: 'noisy',
            label: 'Noisy Channel',
            data: computed.noisySignal,
            color: '#f59e0b',
            lineWidth: 1.25,
          },
          {
            id: 'filtered',
            label: `Filtered (${experiment.filter.type.toUpperCase()})`,
            data: computed.filteredSignal,
            color: '#10b981',
            lineWidth: 2.2,
          },
        ]}
      />

      {/* Frequency Domain + Spectrogram Side-by-Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={`Frequency-Domain FFT Spectrum (${experiment.analysis.fft.fftSize}-pt ${experiment.analysis.fft.windowType.toUpperCase()})`}
          subtitle="Dominant frequency peaks are automatically detected and annotated"
          xData={computed.spectrum.frequencies}
          xLabel="Frequency (Hz)"
          yLabel={experiment.analysis.fft.logScale ? 'Magnitude (dB)' : 'Magnitude |X(f)|'}
          height={265}
          peaks={computed.peaks.map((pk) => ({
            x: pk.frequency,
            y: experiment.analysis.fft.logScale ? pk.magnitudeDb : pk.magnitude,
            label: `${pk.frequency.toFixed(1)}Hz`,
          }))}
          series={[
            {
              id: 'fft-mag',
              label: experiment.analysis.fft.logScale ? 'FFT Magnitude (dB)' : 'FFT Magnitude',
              data: experiment.analysis.fft.logScale
                ? computed.spectrum.magnitudeDb
                : computed.spectrum.magnitude,
              color: '#38bdf8',
              lineWidth: 2,
            },
          ]}
        />

        <InteractiveHeatmap
          title="Short-Time Fourier Transform (STFT) Spectrogram"
          subtitle="Time-frequency energy evolution across sliding Hann windows"
          xValues={computed.spectrogram.times}
          yValues={computed.spectrogram.frequencies}
          matrix={computed.spectrogram.matrix}
          xLabel="Time (s)"
          yLabel="Frequency (Hz)"
          height={265}
        />
      </div>

      {/* Interactive Processing Pipeline */}
      <PipelineEditor />

      {/* Scientific Explanations */}
      <TheoryAccordion
        items={[
          {
            title: 'Discrete Fourier Transform (DFT) & Radix-2 FFT',
            formula: 'X[k] = \\sum_{n=0}^{N-1} x[n]\\,e^{-j\\frac{2\\pi}{N}kn}, \\quad k = 0, 1, \\dots, N-1',
            explanation:
              'Decomposes a finite-length discrete-time sequence x[n] into orthogonal complex exponential frequency bins. The Cooley-Tukey Radix-2 algorithm reduces computational complexity from O(N²) to O(N log₂ N).',
            variables: 'fs: Sampling frequency (Hz) · Δf = fs / N: Spectral resolution',
          },
          {
            title: 'Signal-to-Noise Ratio (SNR) & Bit Error Rate (BER)',
            formula: '\\text{SNR}_{\\text{dB}} = 10\\log_{10}\\!\\left(\\frac{P_{\\text{signal}}}{P_{\\text{noise}}}\\right), \\quad \\text{BER} = \\frac{N_{\\text{errors}}}{N_{\\text{bits}}}',
            explanation:
              'Quantifies the ratio of desired signal power to corrupting noise power in decibels, and the empirical probability of bit decision errors across a digital communication link.',
            variables: 'P = (1/N) Σ |x[n]|² · Eb/N0: Energy per bit to noise power spectral density ratio',
          },
        ]}
      />
    </div>
  );
};
