import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { simulateDigitalModulation } from '../simulations/modulation';
import { useLab } from '../store/LabContext';
import { DigitalModType } from '../types';
import { BERSimulationCurve, BERSimulationRequest, runMonteCarloBER } from '../workers/berWorker';

const DIGITAL_SCHEMES: { id: DigitalModType; label: string; order: number }[] = [
  { id: 'ASK', label: '2-ASK (OOK)', order: 2 },
  { id: 'FSK', label: '2-FSK', order: 2 },
  { id: 'BPSK', label: 'BPSK (M=2)', order: 2 },
  { id: 'QPSK', label: 'QPSK (M=4)', order: 4 },
  { id: '8-PSK', label: '8-PSK (M=8)', order: 8 },
  { id: '16-QAM', label: '16-QAM (M=16)', order: 16 },
  { id: '64-QAM', label: '64-QAM (M=64)', order: 64 },
];

const SCHEME_COLORS: Record<DigitalModType, string> = {
  ASK: '#94a3b8',
  FSK: '#ec4899',
  BPSK: '#0ea5e9',
  QPSK: '#10b981',
  '8-PSK': '#a855f7',
  '16-QAM': '#f59e0b',
  '64-QAM': '#f43f5e',
};

export const ModulationBERPage: React.FC = () => {
  const { experiment, setExperiment, darkMode } = useLab();
  const digCfg = experiment.modulation.digital;
  const constellationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const berCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [selectedBerSchemes, setSelectedBerSchemes] = useState<DigitalModType[]>([
    'BPSK',
    'QPSK',
    '16-QAM',
    '64-QAM',
  ]);
  const [simBitsPerPoint, setSimBitsPerPoint] = useState<number>(4000);
  const [isRunningBer, setIsRunningBer] = useState<boolean>(false);
  const [berCurves, setBerCurves] = useState<BERSimulationCurve[]>([]);

  const updateDigital = (patch: Partial<typeof digCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      modulation: {
        ...prev.modulation,
        digital: { ...prev.modulation.digital, ...patch },
      },
    }));
  };

  const digResult = useMemo(
    () => simulateDigitalModulation(digCfg, experiment.randomSeed),
    [digCfg, experiment.randomSeed]
  );

  const triggerBerSweep = () => {
    setIsRunningBer(true);
    const req: BERSimulationRequest = {
      schemes: selectedBerSchemes.length > 0 ? selectedBerSchemes : ['BPSK'],
      snrMin: -2,
      snrMax: 20,
      snrStep: 2,
      bitsPerPoint: simBitsPerPoint,
      seed: experiment.randomSeed,
    };

    try {
      const worker = new Worker(new URL('../workers/berWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        if (e.data?.curves) {
          setBerCurves(e.data.curves);
        }
        setIsRunningBer(false);
        worker.terminate();
      };
      worker.onerror = () => {
        const fallback = runMonteCarloBER(req);
        setBerCurves(fallback);
        setIsRunningBer(false);
        worker.terminate();
      };
      worker.postMessage(req);
    } catch {
      const fallback = runMonteCarloBER(req);
      setBerCurves(fallback);
      setIsRunningBer(false);
    }
  };

  useEffect(() => {
    triggerBerSweep();
  }, [selectedBerSchemes, simBitsPerPoint, experiment.randomSeed]);

  // Draw IQ Constellation Diagram Canvas
  useEffect(() => {
    const canvas = constellationCanvasRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth || 440;
    const height = 310;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050912';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.36;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, cy);
    ctx.lineTo(width - 16, cy);
    ctx.moveTo(cx, 16);
    ctx.lineTo(cx, height - 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();

    for (const rx of digResult.rxSymbols) {
      const px = cx + rx.I * radius;
      const py = cy - rx.Q * radius;
      ctx.fillStyle = rx.isError ? 'rgba(244, 63, 94, 0.9)' : 'rgba(34, 211, 238, 0.78)';
      ctx.beginPath();
      ctx.arc(px, py, rx.isError ? 3.2 : 2.3, 0, 2 * Math.PI);
      ctx.fill();
    }

    for (const pt of digResult.idealConstellation) {
      const px = cx + pt.I * radius;
      const py = cy - pt.Q * radius;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.stroke();

      if (digResult.idealConstellation.length <= 16) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pt.label, px, py - 9);
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('In-Phase (I)', width - 16, cy - 8);
    ctx.textAlign = 'left';
    ctx.fillText('Quadrature (Q)', cx + 8, 24);
  }, [darkMode, digResult]);

  // Draw Logarithmic BER vs Eb/N0 Waterfall Plot
  useEffect(() => {
    const canvas = berCanvasRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth || 560;
    const height = 310;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#050912';
    ctx.fillRect(0, 0, width, height);

    const padL = 62;
    const padR = 20;
    const padT = 20;
    const padB = 36;
    const plotW = Math.max(50, width - padL - padR);
    const plotH = Math.max(50, height - padT - padB);

    const logMin = -6;
    const logMax = 0;
    const snrMin = -2;
    const snrMax = 20;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "IBM Plex Mono", monospace';

    for (let exp = logMin; exp <= logMax; exp++) {
      const ratio = (logMax - exp) / (logMax - logMin);
      const py = padT + ratio * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`10^${exp}`, padL - 6, py);
    }

    for (let s = snrMin; s <= snrMax; s += 2) {
      const ratio = (s - snrMin) / (snrMax - snrMin);
      const px = padL + ratio * plotW;
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${s}`, px, padT + plotH + 6);
    }

    ctx.textAlign = 'right';
    ctx.fillText('Eb/N0 (dB)', padL + plotW, height - 10);

    for (const c of berCurves) {
      const color = SCHEME_COLORS[c.scheme] || '#0284c7';

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      c.snrDb.forEach((snr, idx) => {
        const px = padL + ((snr - snrMin) / (snrMax - snrMin)) * plotW;
        const lv = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-7, c.theoreticalBer[idx]))));
        const py = padT + ((logMax - lv) / (logMax - logMin)) * plotH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      c.snrDb.forEach((snr, idx) => {
        const px = padL + ((snr - snrMin) / (snrMax - snrMin)) * plotW;
        const lv = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-7, c.simulatedBer[idx]))));
        const py = padT + ((logMax - lv) / (logMax - logMin)) * plotH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      c.snrDb.forEach((snr, idx) => {
        const px = padL + ((snr - snrMin) / (snrMax - snrMin)) * plotW;
        const lv = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-7, c.simulatedBer[idx]))));
        const py = padT + ((logMax - lv) / (logMax - logMin)) * plotH;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [darkMode, berCurves]);

  const toggleSchemeComparison = (scheme: DigitalModType) => {
    setSelectedBerSchemes((prev) =>
      prev.includes(scheme) ? prev.filter((s) => s !== scheme) : [...prev, scheme]
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Digital Modulation, IQ Constellation & Monte Carlo BER Laboratory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Simulate ASK, FSK, BPSK, QPSK, 8-PSK, 16-QAM, and 64-QAM symbol mapping, decision errors, and Web-Worker BER vs. SNR curves.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums">
            Bits/Symbol (k): <strong className="text-sky-500">{digResult.bitsPerSymbol}</strong> ·
            Bit Errors: <strong className="text-rose-500">{digResult.numErrors} / {digResult.txBits.length}</strong> ·
            Empirical BER: <strong className="text-amber-500">{digResult.ber.toFixed(4)}</strong>
          </div>
        </div>

        {/* Digital Scheme Selector */}
        <div className="flex flex-wrap gap-1.5">
          {DIGITAL_SCHEMES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => updateDigital({ type: s.id })}
              className={`neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                digCfg.type === s.id ? 'neu-btn-active text-sky-500' : ''
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Channel Eb/N0 (SNR)</span>
              <span className="text-amber-500 font-semibold">{digCfg.snrDb} dB</span>
            </div>
            <input
              type="range"
              min={-2}
              max={25}
              step={1}
              value={digCfg.snrDb}
              onChange={(e) => updateDigital({ snrDb: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Transmitted Bit Block</span>
              <span className="text-sky-500 font-semibold">{digCfg.numBits} bits</span>
            </div>
            <input
              type="range"
              min={64}
              max={1024}
              step={64}
              value={digCfg.numBits}
              onChange={(e) => updateDigital({ numBits: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Symbol Rate (Rs)</span>
              <span className="text-sky-500 font-semibold">{digCfg.symbolRate} Bd</span>
            </div>
            <input
              type="range"
              min={8}
              max={128}
              step={8}
              value={digCfg.symbolRate}
              onChange={(e) => updateDigital({ symbolRate: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Passband Carrier (fc)</span>
              <span className="text-sky-500 font-semibold">{digCfg.carrierFreq} Hz</span>
            </div>
            <input
              type="range"
              min={16}
              max={160}
              step={8}
              value={digCfg.carrierFreq}
              onChange={(e) => updateDigital({ carrierFreq: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
        </div>
      </div>

      {/* Constellation Diagram & BER vs SNR Waterfall Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 neu-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                IQ Constellation Diagram [{digCfg.type}]
              </h3>
              <p className="text-xs text-slate-500">
                Blue = Correct Symbol · Rose = Decision Error · Rings = Ideal Reference
              </p>
            </div>
          </div>
          <div className="oscilloscope-frame p-1 overflow-hidden">
            <canvas ref={constellationCanvasRef} className="block w-full rounded-xl" />
          </div>
        </div>

        <div className="xl:col-span-7 neu-card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                BER vs. Eb/N0 (SNR) Multi-Scheme Waterfall Comparison
              </h3>
              <p className="text-xs text-slate-500">
                Solid lines = Web Worker Monte Carlo Simulation · Dashed = Analytical Erfc Theory
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={simBitsPerPoint}
                onChange={(e) => setSimBitsPerPoint(Number(e.target.value))}
                className="neu-inset px-3 py-1.5 rounded-full text-xs font-mono bg-transparent"
              >
                <option value={1500}>1,500 bits/pt (Fast)</option>
                <option value={4000}>4,000 bits/pt (Balanced)</option>
                <option value={12000}>12,000 bits/pt (High Precision)</option>
              </select>
              <button
                type="button"
                onClick={triggerBerSweep}
                disabled={isRunningBer}
                className="btn-primary-pill px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              >
                {isRunningBer ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Re-Run Worker</span>
              </button>
            </div>
          </div>

          {/* Toggle which modulation schemes to compare on the BER curve */}
          <div className="flex flex-wrap items-center gap-1.5">
            {DIGITAL_SCHEMES.map((s) => {
              const active = selectedBerSchemes.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSchemeComparison(s.id)}
                  className={`neu-btn px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer ${
                    active ? 'neu-btn-active font-semibold' : 'opacity-45'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: SCHEME_COLORS[s.id] }}
                  />
                  <span>{s.id}</span>
                </button>
              );
            })}
          </div>

          <div className="oscilloscope-frame p-1 overflow-hidden">
            <canvas ref={berCanvasRef} className="block w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Passband Modulated Waveform + Bit Stream Error Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7">
          <InteractivePlot
            title={`Passband Modulated Carrier Waveform s(t) [${digCfg.type}]`}
            subtitle="First 16 transmitted symbols modulated onto the RF carrier with phase/amplitude/frequency transitions"
            xData={digResult.waveformTime}
            xLabel="Time (s)"
            yLabel="Amplitude (V)"
            height={235}
            series={[
              {
                id: 'dig-clean',
                label: 'Ideal Modulated Carrier',
                data: digResult.waveformClean,
                color: '#0ea5e9',
                lineWidth: 2,
              },
              {
                id: 'dig-noisy',
                label: 'Noisy Received Carrier',
                data: digResult.waveformNoisy,
                color: '#f59e0b',
                lineWidth: 1.2,
              },
            ]}
          />
        </div>

        {/* Bit Error Stream Comparison Table */}
        <div className="xl:col-span-5 neu-card p-4 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Transmitted vs. Demodulated Bit Stream Inspector (First 64 Bits)
            </h3>
            <p className="text-xs text-slate-500">
              Bit decision errors are highlighted in rose red
            </p>
          </div>

          <div className="neu-inset p-3 font-mono text-xs flex flex-col gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 w-14 shrink-0">TX Bits:</span>
              <div className="flex flex-wrap gap-1">
                {digResult.txBits.slice(0, 48).map((b, idx) => (
                  <span
                    key={idx}
                    className="w-4 h-5 flex items-center justify-center rounded bg-slate-200/70 dark:bg-slate-800/80"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 w-14 shrink-0">RX Bits:</span>
              <div className="flex flex-wrap gap-1">
                {digResult.rxBits.slice(0, 48).map((b, idx) => {
                  const isErr = b !== digResult.txBits[idx];
                  return (
                    <span
                      key={idx}
                      className={`w-4 h-5 flex items-center justify-center rounded font-bold ${
                        isErr
                          ? 'bg-rose-500 text-white'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {b}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="neu-inset p-2.5">
              <div className="text-slate-400 text-[10px]">Total Bits</div>
              <div className="font-bold text-sm">{digResult.txBits.length}</div>
            </div>
            <div className="neu-inset p-2.5">
              <div className="text-slate-400 text-[10px]">Bit Errors</div>
              <div className="font-bold text-sm text-rose-500">{digResult.numErrors}</div>
            </div>
            <div className="neu-inset p-2.5">
              <div className="text-slate-400 text-[10px]">Measured BER</div>
              <div className="font-bold text-sm text-amber-500">
                {digResult.ber.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TheoryAccordion
        items={[
          {
            title: 'Coherent M-PSK & M-QAM Bit Error Probability in AWGN',
            formula: 'P_{b,\\text{BPSK/QPSK}} = Q\\!\\left(\\sqrt{\\frac{2E_b}{N_0}}\\right) = \\frac{1}{2}\\text{erfc}\\!\\left(\\sqrt{\\frac{E_b}{N_0}}\\right), \\quad P_{b,M\\text{-QAM}} \\approx \\frac{4}{\\log_2 M}\\left(1 - \\frac{1}{\\sqrt{M}}\\right)Q\\!\\left(\\sqrt{\\frac{3\\log_2 M}{M-1}\\frac{E_b}{N_0}}\\right)',
            explanation:
              'Higher-order constellations such as 16-QAM (4 bits/sym) and 64-QAM (6 bits/sym) pack more bits per Hertz of bandwidth, but pack constellation points closer together for a fixed average transmit power, requiring higher Eb/N0 to achieve the same BER.',
          },
          {
            title: 'In-Phase & Quadrature (IQ) Passband Representation',
            formula: 's(t) = I(t)\\cos(2\\pi f_c t) - Q(t)\\sin(2\\pi f_c t) = \\text{Re}\\!\\left\\{[I(t) + jQ(t)]e^{j2\\pi f_c t}\\right\\}',
            explanation:
              'Any digital passband modulation scheme can be synthesized and demodulated using orthogonal cosine (In-Phase I) and sine (Quadrature Q) basis carriers.',
          },
        ]}
      />
    </div>
  );
};
