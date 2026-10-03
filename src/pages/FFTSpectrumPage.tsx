import React from 'react';
import { InteractiveHeatmap, InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { useLab } from '../store/LabContext';
import { WindowFunctionType } from '../types';
import { calculateRMSE } from '../utils/math';

const WINDOWS: { id: WindowFunctionType; label: string; sidelobe: string }[] = [
  { id: 'rectangular', label: 'Rectangular (Dirichlet)', sidelobe: '-13 dB' },
  { id: 'hann', label: 'Hann (Raised Cosine)', sidelobe: '-31.5 dB' },
  { id: 'hamming', label: 'Hamming', sidelobe: '-42.7 dB' },
  { id: 'blackman', label: 'Blackman (3-Term)', sidelobe: '-58 dB' },
  { id: 'flattop', label: 'Flat-Top (Amplitude Calibrated)', sidelobe: '-93 dB' },
];

export const FFTSpectrumPage: React.FC = () => {
  const { experiment, setExperiment, computed } = useLab();
  const fftCfg = experiment.analysis.fft;

  const updateFFT = (patch: Partial<typeof fftCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        fft: { ...prev.analysis.fft, ...patch },
      },
    }));
  };

  // Slice spectrum up to maxFreqLimit
  const maxFreq = Math.min(experiment.signal.samplingRate / 2, fftCfg.maxFreqLimit);
  let limitIdx = computed.spectrum.frequencies.findIndex((f) => f > maxFreq);
  if (limitIdx === -1) limitIdx = computed.spectrum.frequencies.length;

  const freqs = computed.spectrum.frequencies.slice(0, limitIdx);
  const mag = (fftCfg.logScale
    ? computed.spectrum.magnitudeDb
    : computed.spectrum.magnitude
  ).slice(0, limitIdx);
  const phase = computed.spectrum.phaseDeg.slice(0, limitIdx);
  const psd = computed.spectrum.psdDb.slice(0, limitIdx);

  const ifftLen = computed.spectrum.ifftReconstructed.length;
  const ifftRmse = calculateRMSE(
    computed.noisySignal.slice(0, ifftLen),
    computed.spectrum.ifftReconstructed
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls Card */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Fast Fourier Transform (FFT), PSD & STFT Laboratory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analyze forward FFT magnitude, phase, Power Spectral Density (PSD), Short-Time Fourier Transform (STFT), and exact Inverse FFT reconstruction.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500">
            Bin Resolution Δf ={' '}
            <strong className="text-sky-500">
              {(experiment.signal.samplingRate / fftCfg.fftSize).toFixed(2)} Hz
            </strong>{' '}
            · IFFT RMSE = <strong className="text-emerald-500">{ifftRmse.toExponential(2)}</strong>
          </div>
        </div>

        {/* FFT Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1.5">
              FFT Radix-2 Size (N)
            </label>
            <div className="flex flex-wrap gap-1">
              {([128, 256, 512, 1024, 2048] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => updateFFT({ fftSize: sz })}
                  className={`neu-btn px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                    fftCfg.fftSize === sz ? 'neu-btn-active text-sky-500 font-bold' : ''
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1.5">
              Apodization Window w[n]
            </label>
            <select
              value={fftCfg.windowType}
              onChange={(e) => updateFFT({ windowType: e.target.value as WindowFunctionType })}
              className="neu-inset w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-transparent"
            >
              {WINDOWS.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                  {w.label} ({w.sidelobe})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Sampling Rate (fs)</span>
              <span className="text-sky-500 font-semibold">
                {experiment.signal.samplingRate} Hz
              </span>
            </div>
            <input
              type="range"
              min={64}
              max={1024}
              step={32}
              value={experiment.signal.samplingRate}
              onChange={(e) =>
                setExperiment((prev) => ({
                  ...prev,
                  signal: { ...prev.signal, samplingRate: Number(e.target.value) },
                }))
              }
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Frequency Display Limit</span>
              <span className="text-sky-500 font-semibold">{fftCfg.maxFreqLimit} Hz</span>
            </div>
            <input
              type="range"
              min={20}
              max={512}
              step={10}
              value={fftCfg.maxFreqLimit}
              onChange={(e) => updateFFT({ maxFreqLimit: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div className="flex flex-col justify-between">
            <span className="text-xs font-mono text-slate-500">Amplitude Axis Scale</span>
            <button
              type="button"
              onClick={() => updateFFT({ logScale: !fftCfg.logScale })}
              className="neu-btn py-1.5 px-3 rounded-lg text-xs font-mono font-semibold text-sky-500 cursor-pointer"
            >
              {fftCfg.logScale ? 'Logarithmic (20 log₁₀ dB)' : 'Linear Magnitude |X[k]|'}
            </button>
          </div>
        </div>

        {/* Dominant Frequency Peaks Table */}
        <div className="neu-inset p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono font-semibold text-slate-500">
            Detected Dominant Spectral Peaks:
          </span>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
            {computed.peaks.length === 0 ? (
              <span className="text-slate-400">No prominent tonal peaks above threshold</span>
            ) : (
              computed.peaks.map((pk, idx) => (
                <span key={idx}>
                  <strong className="text-amber-500">Peak #{idx + 1}:</strong>{' '}
                  {pk.frequency.toFixed(2)} Hz ({pk.magnitude.toFixed(2)} V /{' '}
                  {pk.magnitudeDb.toFixed(1)} dB)
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Magnitude Spectrum & Power Spectral Density */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={`One-Sided FFT Magnitude Spectrum (${fftCfg.windowType.toUpperCase()} Window)`}
          subtitle="Dominant harmonic peaks highlighted with amber markers"
          xData={freqs}
          xLabel="Frequency (Hz)"
          yLabel={fftCfg.logScale ? 'Magnitude (dB)' : 'Amplitude |X(f)|'}
          height={265}
          peaks={computed.peaks.map((pk) => ({
            x: pk.frequency,
            y: fftCfg.logScale ? pk.magnitudeDb : pk.magnitude,
            label: `${pk.frequency.toFixed(1)}Hz`,
          }))}
          series={[
            {
              id: 'fft-main',
              label: fftCfg.logScale ? 'Magnitude (dB)' : 'Magnitude |X(f)|',
              data: mag,
              color: '#0ea5e9',
              lineWidth: 2,
            },
          ]}
        />

        <InteractivePlot
          title="Power Spectral Density (PSD) & Phase Spectrum ∠X(f)"
          subtitle="Toggle visibility between Periodogram PSD (dB/Hz) and Phase Angle (degrees)"
          xData={freqs}
          xLabel="Frequency (Hz)"
          yLabel="PSD (dB/Hz) / Phase (°)"
          height={265}
          series={[
            {
              id: 'psd-curve',
              label: 'Power Spectral Density (dB/Hz)',
              data: psd,
              color: '#10b981',
              lineWidth: 1.9,
            },
            {
              id: 'phase-curve',
              label: 'Phase Spectrum (deg)',
              data: phase,
              color: '#f59e0b',
              lineWidth: 1.3,
              visible: false,
            },
          ]}
        />
      </div>

      {/* STFT Spectrogram & Inverse FFT Verification */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractiveHeatmap
          title={`STFT Time-Frequency Spectrogram (Win=${fftCfg.stftWindowSize}, Hop=${fftCfg.stftHopSize})`}
          subtitle="Hover across the time-frequency plane to inspect localized spectral energy"
          xValues={computed.spectrogram.times}
          yValues={computed.spectrogram.frequencies}
          matrix={computed.spectrogram.matrix}
          xLabel="Time (s)"
          yLabel="Frequency (Hz)"
          height={260}
        />

        <InteractivePlot
          title="Inverse FFT (IFFT) Time-Domain Reconstruction Verification"
          subtitle={`Verifies x[n] = IFFT(FFT(x[n])) · Reconstruction RMSE = ${ifftRmse.toExponential(2)}`}
          xData={computed.time.slice(0, ifftLen)}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={260}
          series={[
            {
              id: 'orig-ifft',
              label: 'Original Input Signal x[n]',
              data: computed.noisySignal.slice(0, ifftLen),
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'rec-ifft',
              label: 'IFFT Reconstructed x̂[n]',
              data: computed.spectrum.ifftReconstructed,
              color: '#10b981',
              lineWidth: 1.8,
              dashed: true,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={[
          {
            title: 'Forward & Inverse Discrete Fourier Transform (DFT / IDFT)',
            formula: 'X[k] = \\sum_{n=0}^{N-1} x[n]e^{-j\\frac{2\\pi}{N}kn}, \\quad x[n] = \\frac{1}{N}\\sum_{k=0}^{N-1} X[k]e^{+j\\frac{2\\pi}{N}kn}',
            explanation:
              'The forward DFT projects a time-domain block onto N harmonically related complex sinusoids, while the IDFT reconstructs the exact time-domain samples by summing those weightedphasors.',
          },
          {
            title: 'Spectral Leakage, Windowing & Short-Time Fourier Transform (STFT)',
            formula: '\\text{STFT}\\{x[n]\\}(m, k) = \\sum_{n=-\\infty}^{\\infty} x[n]\\,w[n - mH]\\,e^{-j\\frac{2\\pi}{N}kn}',
            explanation:
              'Tapering the signal with a Hann, Hamming, or Blackman window w[n] suppresses spectral leakage sidelobes caused by non-integer period truncation at the expense of a slightly wider mainlobe.',
          },
        ]}
      />
    </div>
  );
};
