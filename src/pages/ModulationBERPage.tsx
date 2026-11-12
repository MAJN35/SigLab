import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Play, RadioTower, RefreshCw, RotateCcw } from 'lucide-react';
import { InteractivePlot, PlotSeries } from '../components/InteractivePlot';
import { LiveEquation, TheoryAccordion } from '../components/MathBlock';
import { PageHeader, ParamSlider } from '../components/ui';
import { useElementSize } from '../hooks/useElementSize';
import { simulateDigitalModulation } from '../simulations/modulation';
import { useLab } from '../store/LabContext';
import { getSeriesColor, PLOT_SURFACE_BG } from '../theme/palette';
import { DigitalModType } from '../types';
import { BERSimulationCurve, BERSimulationRequest, runMonteCarloBER } from '../workers/berWorker';

const DIGITAL_SCHEMES: { id: DigitalModType; label: string; faLabel: string; order: number }[] = [
  { id: 'ASK', label: '2-ASK (OOK)', faLabel: 'کلیدزنی دامنه (2-ASK)', order: 2 },
  { id: 'FSK', label: '2-FSK', faLabel: 'کلیدزنی فرکانس (2-FSK)', order: 2 },
  { id: 'BPSK', label: 'BPSK (M=2)', faLabel: 'کلیدزنی فاز دودویی (BPSK)', order: 2 },
  { id: 'QPSK', label: 'QPSK (M=4)', faLabel: 'کلیدزنی فاز چهارگانه (QPSK)', order: 4 },
  { id: '8-PSK', label: '8-PSK (M=8)', faLabel: 'کلیدزنی فاز هشت‌تایی (8-PSK)', order: 8 },
  { id: '16-QAM', label: '16-QAM (M=16)', faLabel: 'مدولاسیون دامنه متعامد (16-QAM)', order: 16 },
  { id: '64-QAM', label: '64-QAM (M=64)', faLabel: 'مدولاسیون دامنه متعامد (64-QAM)', order: 64 },
];

/** Stable palette color per scheme (index in DIGITAL_SCHEMES). */
const SCHEME_COLORS = Object.fromEntries(
  DIGITAL_SCHEMES.map((s, i) => [s.id, getSeriesColor(i)])
) as Record<DigitalModType, string>;

const BER_SNR_MIN = -2;
const BER_SNR_MAX = 20;
const BER_SNR_STEP = 2;

export const ModulationBERPage: React.FC = () => {
  const { experiment, setExperiment, lang, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const digCfg = experiment.modulation.digital;
  const constellationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const constellationBoxRef = useRef<HTMLDivElement | null>(null);
  const constellationSize = useElementSize(constellationBoxRef);
  const schemeGroupId = useId();
  const compareGroupId = useId();
  const bitsSelectId = useId();

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

  // ---- Single long-lived BER worker -------------------------------------
  // The worker answers requests strictly in FIFO order but does not echo an
  // id, so we keep a queue of in-flight request ids and pop one per reply.
  // Only the reply matching the latest request id is applied.
  const workerRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);
  const latestReqIdRef = useRef(0);
  const inFlightRef = useRef<number[]>([]);
  const lastReqRef = useRef<BERSimulationRequest | null>(null);

  const applyFallback = useCallback((req: BERSimulationRequest, id: number) => {
    const fallback = runMonteCarloBER(req);
    if (id === latestReqIdRef.current) {
      setBerCurves(fallback);
      setIsRunningBer(false);
    }
  }, []);

  const getWorker = useCallback((): Worker | null => {
    if (workerBrokenRef.current) return null;
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker(new URL('../workers/berWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e: MessageEvent<{ curves?: BERSimulationCurve[] }>) => {
        const id = inFlightRef.current.shift();
        if (id !== latestReqIdRef.current) return; // stale reply
        if (e.data?.curves) setBerCurves(e.data.curves);
        setIsRunningBer(false);
      };
      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        workerBrokenRef.current = true;
        inFlightRef.current = [];
        if (lastReqRef.current) applyFallback(lastReqRef.current, latestReqIdRef.current);
      };
      workerRef.current = worker;
      return worker;
    } catch {
      workerBrokenRef.current = true;
      return null;
    }
  }, [applyFallback]);

  const triggerBerSweep = useCallback(() => {
    const id = ++latestReqIdRef.current;
    setIsRunningBer(true);
    const req: BERSimulationRequest = {
      schemes: selectedBerSchemes.length > 0 ? selectedBerSchemes : ['BPSK'],
      snrMin: BER_SNR_MIN,
      snrMax: BER_SNR_MAX,
      snrStep: BER_SNR_STEP,
      bitsPerPoint: simBitsPerPoint,
      seed: experiment.randomSeed,
    };
    lastReqRef.current = req;

    const worker = getWorker();
    if (!worker) {
      applyFallback(req, id);
      return;
    }
    inFlightRef.current.push(id);
    worker.postMessage(req);
  }, [selectedBerSchemes, simBitsPerPoint, experiment.randomSeed, getWorker, applyFallback]);

  useEffect(() => {
    triggerBerSweep();
  }, [triggerBerSweep]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      inFlightRef.current = [];
    },
    []
  );

  // ---- IQ constellation canvas (DPR-aware, resizes with its container) ----
  const constellationWidth = constellationSize.width || 440;
  const constellationHeight = Math.round(Math.min(340, Math.max(240, constellationWidth * 0.72)));
  const symbolErrorCount = useMemo(
    () => digResult.rxSymbols.reduce((n, rx) => n + (rx.isError ? 1 : 0), 0),
    [digResult]
  );

  useEffect(() => {
    const canvas = constellationCanvasRef.current;
    if (!canvas) return;
    const width = constellationWidth;
    const height = constellationHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = PLOT_SURFACE_BG;
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
      if (rx.isError) {
        // Errors: larger rose "x" so they differ by shape, not only colour.
        const r = 3.4;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.95)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px - r, py - r);
        ctx.lineTo(px + r, py + r);
        ctx.moveTo(px + r, py - r);
        ctx.lineTo(px - r, py + r);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.78)';
        ctx.beginPath();
        ctx.arc(px, py, 2.3, 0, 2 * Math.PI);
        ctx.fill();
      }
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
  }, [digResult, constellationWidth, constellationHeight]);

  const constellationAria = isFa
    ? `نمودار صورت فلکی IQ برای ${digCfg.type}: ${digResult.idealConstellation.length} نقطه مرجع، ${digResult.rxSymbols.length} سمبل دریافتی، ${symbolErrorCount} خطای تصمیم‌گیری در Eb/N0 = ${digCfg.snrDb} dB`
    : `IQ constellation for ${digCfg.type}: ${digResult.idealConstellation.length} reference points, ${digResult.rxSymbols.length} received symbols, ${symbolErrorCount} decision errors at Eb/N0 = ${digCfg.snrDb} dB`;

  // ---- BER waterfall (InteractivePlot, true log y axis) -------------------
  const berXData = berCurves[0]?.snrDb ?? [];
  const berSeries = useMemo<PlotSeries[]>(
    () =>
      berCurves.flatMap((c) => {
        const color = SCHEME_COLORS[c.scheme] ?? getSeriesColor(0);
        return [
          {
            id: `${c.scheme}-sim`,
            label: isFa ? `${c.scheme} شبیه‌سازی` : `${c.scheme} simulated`,
            data: c.simulatedBer,
            color,
            lineWidth: 2.1,
          },
          {
            id: `${c.scheme}-theory`,
            label: isFa ? `${c.scheme} تئوری` : `${c.scheme} theory`,
            data: c.theoreticalBer,
            color,
            lineWidth: 1.4,
            dash: [4, 4],
          },
        ];
      }),
    [berCurves, isFa]
  );
  const snrInBerRange = digCfg.snrDb >= BER_SNR_MIN && digCfg.snrDb <= BER_SNR_MAX;
  const berMarkers = useMemo(
    () => [
      {
        x: digCfg.snrDb,
        label: `Eb/N0 = ${digCfg.snrDb} dB`,
        color: '#f59e0b',
      },
    ],
    [digCfg.snrDb]
  );
  const berPeaks = useMemo(
    () =>
      digResult.ber > 0
        ? [{ x: digCfg.snrDb, y: digResult.ber, label: `${isFa ? 'اندازه‌گیری' : 'measured'} ${digResult.ber.toExponential(1)}` }]
        : [],
    [digCfg.snrDb, digResult.ber, isFa]
  );
  const berDomain = useMemo<[number, number]>(() => [1e-6, 1], []);

  const toggleSchemeComparison = (scheme: DigitalModType) => {
    setSelectedBerSchemes((prev) =>
      prev.includes(scheme) ? prev.filter((s) => s !== scheme) : [...prev, scheme]
    );
  };

  const ebNoLinear = Math.pow(10, digCfg.snrDb / 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <PageHeader
          icon={<RadioTower className="w-5 h-5" />}
          title={
            isFa
              ? 'آزمایشگاه مدولاسیون دیجیتال، صورت فلکی IQ و نرخ خطای بیت مونت‌کارلو (BER)'
              : 'Digital Modulation, IQ Constellation & Monte Carlo BER Laboratory'
          }
          subtitle={
            isFa
              ? 'شبیه‌سازی نگاشت سمبل‌های ASK، FSK، BPSK، QPSK، 8-PSK، 16-QAM و 64-QAM، خطاهای تصمیم‌گیری و منحنی‌های BER بر حسب SNR.'
              : 'Simulate ASK, FSK, BPSK, QPSK, 8-PSK, 16-QAM, and 64-QAM symbol mapping, decision errors, and Web-Worker BER vs. SNR curves.'
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
        <div role="status" aria-live="polite" className="text-xs font-mono tabular-nums">
          {isFa ? 'بیت بر سمبل (k): ' : 'Bits/Symbol (k): '}
          <strong className="text-sky-500">{digResult.bitsPerSymbol}</strong> ·{' '}
          {isFa ? 'خطاهای بیتی: ' : 'Bit Errors: '}
          <strong className="text-rose-500">
            {digResult.numErrors} / {digResult.txBits.length}
          </strong>{' '}
          · {isFa ? 'نرخ خطای بیت تجربی: ' : 'Empirical BER: '}
          <strong className="text-amber-500">{digResult.ber.toFixed(4)}</strong>
        </div>

        {/* Digital Scheme Selector */}
        <div className="flex flex-col gap-1.5">
          <span id={schemeGroupId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isFa ? 'طرح مدولاسیون' : 'Modulation scheme'}
          </span>
          <div role="group" aria-labelledby={schemeGroupId} className="flex flex-wrap gap-1.5">
            {DIGITAL_SCHEMES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={digCfg.type === s.id}
                onClick={() => updateDigital({ type: s.id })}
                className={`neu-btn px-3 py-1.5 rounded-chip text-xs font-semibold cursor-pointer ${
                  digCfg.type === s.id ? 'neu-btn-active text-sky-500' : ''
                }`}
              >
                {isFa ? s.faLabel : s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ParamSlider
            label="Channel Eb/N0 (SNR)"
            faLabel="نسبت Eb/N0 کانال (SNR)"
            value={digCfg.snrDb}
            min={-2}
            max={25}
            step={1}
            unit="dB"
            lang={lang}
            onChange={(v) => updateDigital({ snrDb: v })}
          />
          <ParamSlider
            label="Transmitted Bit Block"
            faLabel="تعداد بیت‌های ارسالی"
            value={digCfg.numBits}
            min={64}
            max={1024}
            step={64}
            unit="bits"
            lang={lang}
            onChange={(v) => updateDigital({ numBits: v })}
          />
          <ParamSlider
            label="Symbol Rate (Rs)"
            faLabel="نرخ سمبل (Rs)"
            value={digCfg.symbolRate}
            min={8}
            max={128}
            step={8}
            unit="Bd"
            lang={lang}
            onChange={(v) => updateDigital({ symbolRate: v })}
          />
          <ParamSlider
            label="Passband Carrier (fc)"
            faLabel="فرکانس حامل باند عبوری (fc)"
            value={digCfg.carrierFreq}
            min={16}
            max={160}
            step={8}
            unit="Hz"
            lang={lang}
            onChange={(v) => updateDigital({ carrierFreq: v })}
          />
        </div>
      </div>

      {/* Constellation Diagram & BER vs SNR Waterfall Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 neu-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {isFa
                  ? `نمودار صورت فلکی هم‌فاز و متعامد (IQ Constellation) [${digCfg.type}]`
                  : `IQ Constellation Diagram [${digCfg.type}]`}
              </h2>
              <p className="text-xs text-slate-500">
                {isFa
                  ? 'نقطه آبی = سمبل صحیح · ضربدر قرمز = خطای تصمیم‌گیری · دایره‌های سفید = نقاط مرجع ایده‌آل'
                  : 'Blue dot = Correct Symbol · Rose × = Decision Error · Rings = Ideal Reference'}
              </p>
            </div>
          </div>
          <div className="oscilloscope-frame p-1 overflow-hidden">
            <div ref={constellationBoxRef} className="w-full" dir="ltr">
              <canvas
                ref={constellationCanvasRef}
                role="img"
                aria-label={constellationAria}
                className="block w-full rounded-xl"
                style={{ height: constellationHeight }}
              />
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 neu-card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {isFa
                  ? 'مقایسه آبشاری نرخ خطای بیت (BER) بر حسب Eb/N0'
                  : 'BER vs. Eb/N0 (SNR) Multi-Scheme Waterfall Comparison'}
              </h2>
              <p className="text-xs text-slate-500">
                {isFa
                  ? 'خطوط ممتد = شبیه‌سازی مونت‌کارلو · خطوط نقطه‌چین = رابطه تحلیلی تابع تئوری Erfc · خط کهربایی = Eb/N0 فعلی'
                  : 'Solid lines = Web Worker Monte Carlo Simulation · Dashed = Analytical Erfc Theory · Amber line = current Eb/N0'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={bitsSelectId} className="sr-only">
                {isFa ? 'تعداد بیت در هر نقطه SNR' : 'Bits per SNR point'}
              </label>
              <select
                id={bitsSelectId}
                value={simBitsPerPoint}
                onChange={(e) => setSimBitsPerPoint(Number(e.target.value))}
                className="neu-inset px-3 py-1.5 rounded-full text-xs font-mono"
              >
                <option value={1500}>
                  {isFa ? '۱,۵۰۰ بیت بر نقطه (سریع)' : '1,500 bits/pt (Fast)'}
                </option>
                <option value={4000}>
                  {isFa ? '۴,۰۰۰ بیت بر نقطه (متعادل)' : '4,000 bits/pt (Balanced)'}
                </option>
                <option value={12000}>
                  {isFa ? '۱۲,۰۰۰ بیت بر نقطه (دقت بالا)' : '12,000 bits/pt (High Precision)'}
                </option>
              </select>
              <button
                type="button"
                onClick={triggerBerSweep}
                disabled={isRunningBer}
                aria-busy={isRunningBer}
                className="btn-primary-pill px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              >
                {isRunningBer ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{isFa ? 'اجرای مجدد شبیه‌ساز' : 'Re-Run Worker'}</span>
              </button>
            </div>
          </div>

          {/* Toggle which modulation schemes to compare on the BER curve */}
          <span id={compareGroupId} className="sr-only">
            {isFa ? 'طرح‌های مقایسه‌شده در نمودار BER' : 'Schemes compared on the BER chart'}
          </span>
          <div role="group" aria-labelledby={compareGroupId} className="flex flex-wrap items-center gap-1.5">
            {DIGITAL_SCHEMES.map((s) => {
              const active = selectedBerSchemes.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSchemeComparison(s.id)}
                  className={`neu-btn px-2.5 py-1 rounded-chip text-xs font-mono flex items-center gap-1.5 cursor-pointer ${
                    active ? 'neu-btn-active font-semibold' : 'opacity-60'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: SCHEME_COLORS[s.id] }}
                  />
                  <span>{s.id}</span>
                </button>
              );
            })}
          </div>

          <span role="status" aria-live="polite" className="sr-only">
            {isRunningBer
              ? isFa
                ? 'در حال اجرای شبیه‌سازی BER…'
                : 'Running BER simulation…'
              : isFa
                ? `منحنی‌های BER برای ${berCurves.length} طرح به‌روز شد`
                : `BER curves updated for ${berCurves.length} schemes`}
          </span>

          <div aria-busy={isRunningBer} className={isRunningBer ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <InteractivePlot
              title={isFa ? 'BER بر حسب Eb/N0' : 'BER vs. Eb/N0'}
              xData={berXData}
              xLabel="Eb/N0 (dB)"
              xUnit="dB"
              yLabel={isFa ? 'نرخ خطای بیت (BER)' : 'Bit Error Rate (BER)'}
              yLogScale
              yDomainOverride={berDomain}
              height={310}
              series={berSeries}
              markers={snrInBerRange ? berMarkers : []}
              peaks={snrInBerRange ? berPeaks : []}
              peakColor="#f59e0b"
              ariaLabel={
                isFa
                  ? `نمودار لگاریتمی BER بر حسب Eb/N0 از ${BER_SNR_MIN} تا ${BER_SNR_MAX} dB برای ${berCurves.map((c) => c.scheme).join('، ')}؛ BER اندازه‌گیری‌شده در ${digCfg.snrDb} dB برابر ${digResult.ber.toExponential(2)}`
                  : `Log-scale BER vs Eb/N0 from ${BER_SNR_MIN} to ${BER_SNR_MAX} dB for ${berCurves.map((c) => c.scheme).join(', ')}; measured BER at ${digCfg.snrDb} dB is ${digResult.ber.toExponential(2)}`
              }
            />
          </div>
          {!snrInBerRange && (
            <p className="text-caption text-slate-500">
              {isFa
                ? `Eb/N0 فعلی (${digCfg.snrDb} dB) خارج از بازه منحنی‌ها (${BER_SNR_MIN} تا ${BER_SNR_MAX} dB) است.`
                : `Current Eb/N0 (${digCfg.snrDb} dB) is outside the swept range (${BER_SNR_MIN}–${BER_SNR_MAX} dB).`}
            </p>
          )}
          <LiveEquation
            values={{
              snr: digCfg.snrDb,
              lin: ebNoLinear,
              errs: digResult.numErrors,
              bits: digResult.txBits.length,
              ber: digResult.ber,
            }}
            precision={3}
            tex={'\\frac{E_b}{N_0} = 10^{{{snr}}/10} = {{lin}}, \\quad \\hat{P}_b = \\frac{{{errs}}}{{{bits}}} = {{ber}}'}
            caption={
              isFa
                ? 'BER اندازه‌گیری‌شده برای بلوک بیت فعلی (نقطه کهربایی روی نمودار)'
                : 'Measured BER for the current bit block (amber point on the chart)'
            }
          />
        </div>
      </div>

      {/* Passband Modulated Waveform + Bit Stream Error Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7">
          <InteractivePlot
            title={
              lang === 'fa'
                ? `شکل‌موج حامل مدوله‌شده باند عبوری s(t) [${digCfg.type}]`
                : `Passband Modulated Carrier Waveform s(t) [${digCfg.type}]`
            }
            subtitle={
              lang === 'fa'
                ? '۱۶ سمبل اول ارسالی مدوله‌شده روی حامل فرکانس رادیویی همراه با گذارهای فاز، دامنه و فرکانس'
                : 'First 16 transmitted symbols modulated onto the RF carrier with phase/amplitude/frequency transitions'
            }
            xData={digResult.waveformTime}
            xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
            yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
            height={235}
            xUnit="s"
            yUnit="V"
            series={[
              {
                id: 'dig-clean',
                label: lang === 'fa' ? 'حامل مدوله‌شده ایده‌آل' : 'Ideal Modulated Carrier',
                data: digResult.waveformClean,
                color: getSeriesColor(0),
                lineWidth: 2,
              },
              {
                id: 'dig-noisy',
                label: lang === 'fa' ? 'حامل دریافتی نویزی' : 'Noisy Received Carrier',
                data: digResult.waveformNoisy,
                color: getSeriesColor(1),
                lineWidth: 1.2,
                dash: [5, 3],
              },
            ]}
          />
        </div>

        {/* Bit Error Stream Comparison Table */}
        <div className="xl:col-span-5 neu-card p-4 flex flex-col justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'مقایسه رشته بیت‌های ارسالی و دمدوله‌شده (۴۸ بیت اول)'
                : 'Transmitted vs. Demodulated Bit Stream Inspector (First 48 Bits)'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'fa'
                ? 'خطاهای تصمیم‌گیری بیتی با رنگ قرمز مشخص شده‌اند'
                : 'Bit decision errors are highlighted in rose red'}
            </p>
          </div>

          <div className="neu-inset p-3 font-mono text-xs flex flex-col gap-2 overflow-x-auto" dir="ltr">
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

          <div role="status" aria-live="polite" className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div className="neu-inset p-2.5">
              <div className="text-slate-400 text-caption">
                {lang === 'fa' ? 'کل بیت‌ها' : 'Total Bits'}
              </div>
              <div className="font-bold text-sm">{digResult.txBits.length}</div>
            </div>
            <div className="neu-inset p-2.5">
              <div className="text-slate-400 text-caption">
                {lang === 'fa' ? 'خطاهای بیتی' : 'Bit Errors'}
              </div>
              <div className="font-bold text-sm text-rose-500">{digResult.numErrors}</div>
            </div>
            <div className="neu-inset p-2.5">
              <div className="text-slate-400 text-caption">
                {lang === 'fa' ? 'نرخ BER اندازه‌گیری‌شده' : 'Measured BER'}
              </div>
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
            title:
              lang === 'fa'
                ? 'احتمال خطای بیت مدولاسیون‌های همدوس M-PSK و M-QAM در کانال AWGN'
                : 'Coherent M-PSK & M-QAM Bit Error Probability in AWGN',
            formula:
              'P_{b,\\text{BPSK/QPSK}} = Q\\!\\left(\\sqrt{\\frac{2E_b}{N_0}}\\right) = \\frac{1}{2}\\text{erfc}\\!\\left(\\sqrt{\\frac{E_b}{N_0}}\\right), \\quad P_{b,M\\text{-QAM}} \\approx \\frac{4}{\\log_2 M}\\left(1 - \\frac{1}{\\sqrt{M}}\\right)Q\\!\\left(\\sqrt{\\frac{3\\log_2 M}{M-1}\\frac{E_b}{N_0}}\\right)',
            explanation:
              lang === 'fa'
                ? 'صورت‌های فلکی مرتبه بالاتر مانند 16-QAM (۴ بیت بر سمبل) و 64-QAM (۶ بیت بر سمبل) بازده طیفی بالاتری دارند، اما نقاط صورت فلکی را به یکدیگر نزدیک‌تر می‌کنند و برای رسیدن به همان نرخ خطای بیت نیازمند نسبت Eb/N0 بیشتری هستند.'
                : 'Higher-order constellations such as 16-QAM (4 bits/sym) and 64-QAM (6 bits/sym) pack more bits per Hertz of bandwidth, but pack constellation points closer together for a fixed average transmit power, requiring higher Eb/N0 to achieve the same BER.',
          },
          {
            title:
              lang === 'fa'
                ? 'نمایش باند عبوری مؤلفه‌های هم‌فاز و متعامد (IQ Representation)'
                : 'In-Phase & Quadrature (IQ) Passband Representation',
            formula:
              's(t) = I(t)\\cos(2\\pi f_c t) - Q(t)\\sin(2\\pi f_c t) = \\text{Re}\\!\\left\\{[I(t) + jQ(t)]e^{j2\\pi f_c t}\\right\\}',
            explanation:
              lang === 'fa'
                ? 'هر طرح مدولاسیون باند عبوری دیجیتال را می‌توان با استفاده از دو حامل متعامد کسینوسی (مؤلفه هم‌فاز I) و سینوسی (مؤلفه متعامد Q) سنتز و دمدوله کرد.'
                : 'Any digital passband modulation scheme can be synthesized and demodulated using orthogonal cosine (In-Phase I) and sine (Quadrature Q) basis carriers.',
          },
        ]}
      />
    </div>
  );
};
