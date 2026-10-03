import React from 'react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { useLab } from '../store/LabContext';
import { FilterType } from '../types';
import { calculateRMSE } from '../utils/math';

const FILTER_TYPES: { id: FilterType; label: string }[] = [
  { id: 'lowpass', label: 'Low-Pass' },
  { id: 'highpass', label: 'High-Pass' },
  { id: 'bandpass', label: 'Band-Pass' },
  { id: 'bandstop', label: 'Band-Stop' },
  { id: 'notch', label: 'Notch (Narrowband)' },
  { id: 'moving-average', label: 'Moving Average' },
  { id: 'fir', label: 'Windowed-Sinc FIR' },
  { id: 'iir', label: 'Butterworth Biquad IIR' },
];

export const FilteringPage: React.FC = () => {
  const { experiment, setExperiment, computed } = useLab();
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
              Digital Filtering Laboratory (FIR, IIR, Biquad & Moving Average)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Design frequency-selective digital filters and inspect 1. Original/Noisy Signal, 2. Filter Response |H(f)|, 3. Filtered Signal, and 4. Residual Error.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums">
            Input SNR: <strong className="text-amber-500">{computed.empiricalSnrDb.toFixed(2)} dB</strong>{' '}
            → Filtered SNR: <strong className="text-emerald-500">{computed.filteredSnrDb.toFixed(2)} dB</strong>{' '}
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
              {f.label}
            </button>
          ))}
        </div>

        {/* Filter Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>
                {flt.type === 'bandpass' || flt.type === 'bandstop'
                  ? 'Lower Cutoff (f_L)'
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
                <span>Upper Cutoff (f_H)</span>
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
                {flt.type === 'moving-average' ? 'Window Length (M)' : 'Filter Order (N)'}
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
              <span>Resonance / Q-Factor</span>
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
          title="1. Original Clean & Noisy Input Signal x[n]"
          subtitle="Time-domain input waveform prior to digital filtering"
          xData={computed.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={250}
          series={[
            {
              id: 'flt-orig',
              label: 'Original Clean Signal',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'flt-noisy',
              label: 'Noisy Input Signal',
              data: computed.noisySignal,
              color: '#f59e0b',
              lineWidth: 1.25,
            },
          ]}
        />

        <InteractivePlot
          title={`2. Filter Magnitude Frequency Response |H(f)| [${flt.type.toUpperCase()}]`}
          subtitle="Transfer function passband, transition roll-off, and stopband attenuation across [0, fs/2]"
          xData={computed.filterFreqAxis}
          xLabel="Frequency (Hz)"
          yLabel="Gain |H(f)|"
          height={250}
          yDomainOverride={[-0.05, 1.15]}
          series={[
            {
              id: 'flt-resp-lin',
              label: 'Linear Gain |H(f)|',
              data: computed.filterMagResponse,
              color: '#8b5cf6',
              lineWidth: 2.4,
            },
          ]}
        />

        <InteractivePlot
          title="3. Filtered Output Signal y[n] vs. Clean Reference"
          subtitle="Compare filter output directly against the ground-truth clean waveform"
          xData={computed.time}
          xLabel="Time (s)"
          yLabel="Amplitude (V)"
          height={250}
          series={[
            {
              id: 'flt-out',
              label: 'Filtered Signal y[n]',
              data: computed.filteredSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
            {
              id: 'flt-ref',
              label: 'Original Clean Reference',
              data: computed.cleanSignal,
              color: '#0ea5e9',
              lineWidth: 1.5,
              dashed: true,
            },
          ]}
        />

        <InteractivePlot
          title="4. Rejected Noise / Residual Difference e[n] = x[n] - y[n]"
          subtitle="Shows the attenuated stopband components and residual estimation error"
          xData={computed.time}
          xLabel="Time (s)"
          yLabel="Difference (V)"
          height={250}
          series={[
            {
              id: 'flt-res',
              label: 'Removed Component (x_noisy - y_filtered)',
              data: computed.residualSignal,
              color: '#f43f5e',
              lineWidth: 1.5,
            },
            {
              id: 'flt-err',
              label: 'Estimation Error (y_filtered - x_clean)',
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
            title: 'Linear Constant-Coefficient Difference Equation (FIR & IIR)',
            formula: 'y[n] = \\sum_{k=0}^{M} b_k x[n-k] - \\sum_{m=1}^{N} a_m y[n-m], \\quad H(z) = \\frac{\\sum_{k=0}^{M} b_k z^{-k}}{1 + \\sum_{m=1}^{N} a_m z^{-m}}',
            explanation:
              'Finite Impulse Response (FIR) filters have feedback coefficients a_m = 0, guaranteeing unconditional stability and exact linear phase. Infinite Impulse Response (IIR) biquad filters achieve sharp transition roll-off with far fewer arithmetic operations.',
          },
          {
            title: 'Butterworth Magnitude Response & Moving Average Sinc Kernel',
            formula: '\\left|H_{\\text{Butt}}(j\\omega)\\right|^2 = \\frac{1}{1 + (\\omega / \\omega_c)^{2N}}, \\quad \\left|H_{\\text{MA}}(e^{j\\omega})\\right| = \\frac{1}{M}\\left|\\frac{\\sin(\\omega M / 2)}{\\sin(\\omega / 2)}\\right|',
            explanation:
              'A Butterworth filter is maximally flat in the passband with a -20N dB/decade roll-off above cutoff fc. The Moving Average filter is an optimal time-domain white-noise smoother whose frequency response follows a Dirichlet sinc envelope.',
          },
        ]}
      />
    </div>
  );
};
