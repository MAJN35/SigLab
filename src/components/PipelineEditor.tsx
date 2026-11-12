import React, { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Sliders, Trash2 } from 'lucide-react';
import { PipelineBlock, PipelineBlockType } from '../types';
import { useLab } from '../store/LabContext';
import { InteractivePlot } from './InteractivePlot';

const AVAILABLE_BLOCKS: {
  type: PipelineBlockType;
  name: string;
  faName: string;
  defaultParams: Record<string, number | string | boolean>;
}[] = [
  {
    type: 'noise',
    name: 'AWGN Noise Injector',
    faName: 'تزریق‌کننده نویز سفید گوسی (AWGN)',
    defaultParams: { snrDb: 10 },
  },
  {
    type: 'bandpass',
    name: 'Band-Pass Filter',
    faName: 'فیلتر میان‌گذر (Band-Pass)',
    defaultParams: { cutoffLow: 4, cutoffHigh: 28, order: 4 },
  },
  {
    type: 'notch',
    name: '50 Hz Notch Filter',
    faName: 'فیلتر حذف فرکانس برق ۵۰ هرتز (Notch)',
    defaultParams: { freq: 50 },
  },
  {
    type: 'wavelet-denoise',
    name: 'Wavelet Soft Denoiser',
    faName: 'حذف نویز با آستانه‌گذاری نرم موجک',
    defaultParams: { threshold: 0.25 },
  },
  {
    type: 'ica',
    name: 'FastICA Artifact Projection',
    faName: 'حذف آرتیفکت با تصویرسازی FastICA',
    defaultParams: { components: 4 },
  },
  {
    type: 'pca',
    name: 'PCA Subspace Filter',
    faName: 'فیلتر زیرفضای مؤلفه‌های اصلی (PCA)',
    defaultParams: { components: 2 },
  },
  {
    type: 'fft',
    name: 'FFT Spectral Transform',
    faName: 'تبدیل طیفی فوریه سریع (FFT)',
    defaultParams: { fftSize: 512 },
  },
];

/* ------------------------------------------------------------------ */
/* Parameter schema — one entry per tunable param of each block type   */
/* ------------------------------------------------------------------ */

interface ParamContext {
  /** Nyquist frequency (fs / 2) of the current experiment. */
  nyquist: number;
  params: Record<string, number | string | boolean>;
}

type Bound = number | ((ctx: ParamContext) => number);

interface ParamSpec {
  key: string;
  label: { en: string; fa: string };
  unit?: { en: string; fa: string };
  hint?: { en: string; fa: string };
  min: Bound;
  max: Bound;
  step: number;
  defaultValue: number;
  integer?: boolean;
  /** Discrete choices (rendered as a select instead of number + slider). */
  options?: number[];
}

const HZ = { en: 'Hz', fa: 'هرتز' };
const FREQ_STEP = 0.5;

const resolveBound = (b: Bound, ctx: ParamContext) => (typeof b === 'function' ? b(ctx) : b);

const numParam = (ctx: ParamContext, key: string, fallback: number) => {
  const v = Number(ctx.params[key]);
  return Number.isFinite(v) ? v : fallback;
};

const PARAM_SCHEMA: Partial<Record<PipelineBlockType, ParamSpec[]>> = {
  noise: [
    {
      key: 'snrDb',
      label: { en: 'Signal-to-noise ratio (SNR)', fa: 'نسبت سیگنال به نویز (SNR)' },
      unit: { en: 'dB', fa: 'دسی‌بل' },
      hint: { en: 'Lower = noisier', fa: 'کمتر = نویز بیشتر' },
      min: -20,
      max: 60,
      step: 1,
      defaultValue: 10,
    },
  ],
  bandpass: [
    {
      key: 'cutoffLow',
      label: { en: 'Low cutoff (f_L)', fa: 'فرکانس قطع پایین (f_L)' },
      unit: HZ,
      min: 0.1,
      max: (ctx) => Math.max(0.1, numParam(ctx, 'cutoffHigh', 28) - FREQ_STEP),
      step: FREQ_STEP,
      defaultValue: 4,
    },
    {
      key: 'cutoffHigh',
      label: { en: 'High cutoff (f_H)', fa: 'فرکانس قطع بالا (f_H)' },
      unit: HZ,
      min: (ctx) => numParam(ctx, 'cutoffLow', 4) + FREQ_STEP,
      max: (ctx) => Math.max(1, ctx.nyquist - FREQ_STEP),
      step: FREQ_STEP,
      defaultValue: 28,
    },
    {
      key: 'order',
      label: { en: 'Filter order (N)', fa: 'مرتبه فیلتر (N)' },
      min: 1,
      max: 10,
      step: 1,
      integer: true,
      defaultValue: 4,
    },
  ],
  notch: [
    {
      key: 'freq',
      label: { en: 'Notch frequency (f₀)', fa: 'فرکانس ناچ (f₀)' },
      unit: HZ,
      hint: { en: 'Mains hum: 50 or 60 Hz', fa: 'برق شهر: ۵۰ یا ۶۰ هرتز' },
      min: 1,
      max: (ctx) => Math.max(2, ctx.nyquist - 2),
      step: FREQ_STEP,
      defaultValue: 50,
    },
  ],
  'wavelet-denoise': [
    {
      key: 'threshold',
      label: { en: 'Soft threshold (λ)', fa: 'آستانه نرم (λ)' },
      hint: { en: 'Fraction of max coefficient', fa: 'کسری از بزرگ‌ترین ضریب' },
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.25,
    },
  ],
  ica: [
    {
      key: 'components',
      label: { en: 'Independent components', fa: 'تعداد مؤلفه‌های مستقل' },
      min: 1,
      max: 16,
      step: 1,
      integer: true,
      defaultValue: 4,
    },
  ],
  pca: [
    {
      key: 'components',
      label: { en: 'Principal components kept', fa: 'تعداد مؤلفه‌های اصلی حفظ‌شده' },
      min: 1,
      max: 16,
      step: 1,
      integer: true,
      defaultValue: 2,
    },
  ],
  fft: [
    {
      key: 'fftSize',
      label: { en: 'FFT size (N)', fa: 'اندازه FFT (N)' },
      unit: { en: 'points', fa: 'نقطه' },
      min: 64,
      max: 4096,
      step: 1,
      integer: true,
      defaultValue: 512,
      options: [64, 128, 256, 512, 1024, 2048, 4096],
    },
  ],
};

const clampToSpec = (raw: number, spec: ParamSpec, ctx: ParamContext): number => {
  const min = resolveBound(spec.min, ctx);
  const max = Math.max(min, resolveBound(spec.max, ctx));
  let v = Math.min(max, Math.max(min, raw));
  if (spec.integer) v = Math.round(v);
  else {
    // Snap to the step grid relative to min, avoiding float noise.
    const decimals = (String(spec.step).split('.')[1] || '').length;
    v = Number((Math.round((v - min) / spec.step) * spec.step + min).toFixed(decimals + 2));
    v = Math.min(max, Math.max(min, v));
  }
  return v;
};

/* ------------------------------------------------------------------ */
/* Single parameter field: number input + slider (or select)           */
/* ------------------------------------------------------------------ */

const ParamField: React.FC<{
  spec: ParamSpec;
  ctx: ParamContext;
  value: number;
  isFa: boolean;
  onCommit: (v: number) => void;
}> = ({ spec, ctx, value, isFa, onCommit }) => {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const min = resolveBound(spec.min, ctx);
  const max = Math.max(min, resolveBound(spec.max, ctx));
  const label = isFa ? spec.label.fa : spec.label.en;
  const unit = spec.unit ? (isFa ? spec.unit.fa : spec.unit.en) : '';
  const hint = spec.hint ? (isFa ? spec.hint.fa : spec.hint.en) : '';

  const parsed = draft.trim() === '' ? NaN : Number(draft);
  const invalid = !Number.isFinite(parsed) || parsed < min || parsed > max;
  const fmt = (n: number) => String(Number(n.toFixed(2)));
  const rangeMsg = isFa
    ? `بازه مجاز: ${fmt(min)} تا ${fmt(max)}${unit ? ` ${unit}` : ''}`
    : `Allowed: ${fmt(min)} – ${fmt(max)}${unit ? ` ${unit}` : ''}`;

  const commit = () => {
    const next = Number.isFinite(parsed) ? clampToSpec(parsed, spec, ctx) : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  const fieldCls =
    'neu-inset px-2 py-1 rounded-md bg-transparent text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {unit && <span className="font-normal text-slate-600 dark:text-slate-400"> ({unit})</span>}
      </label>

      {spec.options ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onCommit(Number(e.target.value))}
          className={`${fieldCls} w-full`}
        >
          {spec.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={spec.step}
            value={Math.min(max, Math.max(min, value))}
            onChange={(e) => onCommit(clampToSpec(Number(e.target.value), spec, ctx))}
            aria-label={label}
            aria-valuetext={`${fmt(value)}${unit ? ` ${unit}` : ''}`}
            className="flex-1 min-w-0 accent-sky-600 dark:accent-sky-400"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              id={id}
              type="number"
              inputMode="decimal"
              min={min}
              max={max}
              step={spec.step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
              }}
              aria-invalid={invalid || undefined}
              aria-describedby={`${id}-help`}
              dir="ltr"
              className={`${fieldCls} w-20 text-end ${
                invalid ? 'ring-2 ring-rose-500/70' : ''
              }`}
            />
            {unit && (
              <span aria-hidden="true" className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                {unit}
              </span>
            )}
          </div>
        </div>
      )}

      <p
        id={`${id}-help`}
        className={`text-[10px] ${
          invalid && !spec.options
            ? 'text-rose-700 dark:text-rose-400'
            : 'text-slate-600 dark:text-slate-400'
        }`}
      >
        {invalid && !spec.options
          ? isFa
            ? `مقدار خارج از بازه است و هنگام ثبت محدود می‌شود — ${rangeMsg}`
            : `Out of range; will be clamped on commit — ${rangeMsg}`
          : [hint, spec.options ? '' : rangeMsg].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export const PipelineEditor: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { experiment, setExperiment, computed, lang } = useLab();
  const isFa = lang === 'fa';
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(
    Math.max(0, experiment.processing.length - 1)
  );
  const [blockToAdd, setBlockToAdd] = useState<PipelineBlockType>('bandpass');
  const addSelectId = useId();
  const paramsHeadingId = useId();

  const stageNum = (i: number) =>
    isFa ? `۰${(i + 1).toLocaleString('fa-IR')}` : `0${i + 1}`;

  const getBlockLabel = (blk: PipelineBlock) => {
    if (!isFa) return blk.name;
    const found = AVAILABLE_BLOCKS.find((b) => b.type === blk.type);
    return found ? found.faName : blk.name;
  };

  const updateBlocks = (blocks: PipelineBlock[]) => {
    setExperiment((prev) => ({ ...prev, processing: blocks }));
  };

  const toggleBlock = (idx: number) => {
    const next = [...experiment.processing];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    updateBlocks(next);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= experiment.processing.length) return;
    const next = [...experiment.processing];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    updateBlocks(next);
    setSelectedStageIdx(target);
  };

  const removeBlock = (idx: number) => {
    if (experiment.processing.length <= 1) return;
    const next = experiment.processing.filter((_, i) => i !== idx);
    updateBlocks(next);
    setSelectedStageIdx(Math.max(0, Math.min(selectedStageIdx, next.length - 1)));
  };

  const addBlock = () => {
    const template =
      AVAILABLE_BLOCKS.find((b) => b.type === blockToAdd) || AVAILABLE_BLOCKS[1];
    const newBlk: PipelineBlock = {
      id: `blk-${Date.now()}`,
      type: template.type,
      name: template.name,
      enabled: true,
      params: { ...template.defaultParams },
    };
    const next = [...experiment.processing, newBlk];
    updateBlocks(next);
    setSelectedStageIdx(next.length - 1);
  };

  const updateParam = (idx: number, key: string, val: number) => {
    const next = [...experiment.processing];
    next[idx] = {
      ...next[idx],
      params: { ...next[idx].params, [key]: val },
    };
    updateBlocks(next);
  };

  const safeIdx = Math.min(selectedStageIdx, Math.max(0, experiment.processing.length - 1));
  const selectedBlock = experiment.processing[safeIdx];
  const nyquist = experiment.signal.samplingRate / 2;
  const paramSpecs = selectedBlock ? PARAM_SCHEMA[selectedBlock.type] ?? [] : [];
  const paramCtx: ParamContext = { nyquist, params: selectedBlock?.params ?? {} };

  // Stage input/output for the inspect plot
  const stages = computed.pipelineStages;
  const inspectIdx = Math.min(safeIdx, Math.max(0, stages.length - 1));
  const inspectedStage = stages[inspectIdx];
  const stageInput = inspectIdx > 0 ? stages[inspectIdx - 1]?.signal : computed.cleanSignal;
  const isSpectralAt = (i: number) =>
    stages.slice(0, i + 1).some((s) => s.block.enabled && s.block.type === 'fft');
  const outputIsSpectrum = inspectedStage ? isSpectralAt(inspectIdx) : false;
  const inputIsSpectrum = inspectIdx > 0 ? isSpectralAt(inspectIdx - 1) : false;
  const canOverlay =
    !!inspectedStage &&
    !!stageInput &&
    inputIsSpectrum === outputIsSpectrum &&
    stageInput.length === inspectedStage.signal.length;

  return (
    <div className="neu-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <span>
              {isFa
                ? 'خط لوله تعاملی پردازش سیگنال دیجیتال (DSP Pipeline)'
                : 'Interactive Client-Side Processing Pipeline'}
            </span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isFa
              ? 'بلوک‌های پردازشی را اضافه، جابه‌جا یا فعال/غیرفعال کنید و هر مرحله را انتخاب کنید تا پارامترها و ورودی/خروجی آن را ببینید.'
              : 'Add, reorder, toggle, or tune DSP blocks, and select any stage to edit its parameters and compare its input vs. output.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={addSelectId} className="sr-only">
            {isFa ? 'نوع بلوک جدید' : 'New block type'}
          </label>
          <select
            id={addSelectId}
            value={blockToAdd}
            onChange={(e) => setBlockToAdd(e.target.value as PipelineBlockType)}
            className="neu-inset px-3 py-1.5 text-xs font-medium rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {AVAILABLE_BLOCKS.map((b) => (
              <option key={b.type} value={b.type}>
                {isFa ? b.faName : b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addBlock}
            className="btn-primary-pill px-3.5 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isFa ? 'افزودن مرحله' : 'Add Stage'}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Visual Flow Chain */}
      <ol
        className="flex items-stretch gap-2 overflow-x-auto pb-2 pt-1 px-1"
        aria-label={isFa ? 'مراحل خط لوله' : 'Pipeline stages'}
      >
        {experiment.processing.map((blk, idx) => {
          const isSelected = idx === safeIdx;
          const label = getBlockLabel(blk);
          const iconBtn =
            'p-1 rounded hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-30 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500';
          return (
            <li key={blk.id} className="flex items-stretch gap-2">
              <div
                className={`min-w-[185px] p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 focus-within:ring-2 focus-within:ring-sky-500/50 ${
                  isSelected
                    ? 'neu-inset border-sky-500/60'
                    : 'neu-card-sm border-transparent hover:border-slate-400/40'
                } ${!blk.enabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    {isFa ? `مرحله ${stageNum(idx)}` : `Stage ${stageNum(idx)}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveBlock(idx, -1)}
                      disabled={idx === 0}
                      className={iconBtn}
                      aria-label={isFa ? `انتقال «${label}» به قبل` : `Move “${label}” earlier`}
                      title={isFa ? 'انتقال به قبل' : 'Move earlier'}
                    >
                      <ArrowLeft className="w-3 h-3 rtl:-scale-x-100" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(idx, 1)}
                      disabled={idx === experiment.processing.length - 1}
                      className={iconBtn}
                      aria-label={isFa ? `انتقال «${label}» به بعد` : `Move “${label}” later`}
                      title={isFa ? 'انتقال به بعد' : 'Move later'}
                    >
                      <ArrowRight className="w-3 h-3 rtl:-scale-x-100" aria-hidden="true" />
                    </button>
                    {experiment.processing.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(idx)}
                        className="p-1 rounded hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500"
                        aria-label={isFa ? `حذف «${label}»` : `Delete “${label}”`}
                        title={isFa ? 'حذف بلوک' : 'Delete Block'}
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Primary select control for the stage */}
                <button
                  type="button"
                  onClick={() => setSelectedStageIdx(idx)}
                  aria-pressed={isSelected}
                  aria-current={isSelected ? 'step' : undefined}
                  className="text-start rounded-md -mx-1 px-1 py-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  <span className="block text-xs font-semibold truncate">{label}</span>
                  <span className="block text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                    {blk.enabled
                      ? isFa
                        ? '● فعال'
                        : '● ACTIVE'
                      : isFa
                      ? '○ غیرفعال'
                      : '○ BYPASSED'}
                  </span>
                  <span className="sr-only">
                    {isSelected
                      ? isFa
                        ? ' (انتخاب‌شده)'
                        : ' (selected)'
                      : isFa
                      ? ' — انتخاب برای ویرایش و بررسی'
                      : ' — select to edit and inspect'}
                  </span>
                </button>

                <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleBlock(idx)}
                    className="text-[11px] font-mono underline text-sky-700 dark:text-sky-400 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-sky-500"
                  >
                    {blk.enabled
                      ? isFa
                        ? 'غیرفعال‌سازی'
                        : 'Disable'
                      : isFa
                      ? 'فعال‌سازی'
                      : 'Enable'}
                    <span className="sr-only"> {label}</span>
                  </button>
                </div>
              </div>

              {idx < experiment.processing.length - 1 && (
                <span
                  aria-hidden="true"
                  className="flex items-center justify-center text-slate-400 font-mono text-xs px-0.5 rtl:-scale-x-100"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Schema-driven parameter panel for the selected stage */}
      {selectedBlock && (
        <section
          aria-labelledby={paramsHeadingId}
          className="neu-inset p-4 rounded-xl flex flex-col gap-3"
        >
          <h4 id={paramsHeadingId} className="text-xs font-semibold tracking-tight">
            {isFa
              ? `پارامترهای مرحله ${stageNum(safeIdx)}: ${getBlockLabel(selectedBlock)}`
              : `Stage ${stageNum(safeIdx)} parameters: ${selectedBlock.name}`}
          </h4>
          {paramSpecs.length === 0 ? (
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {isFa
                ? 'این بلوک پارامتر قابل تنظیمی ندارد.'
                : 'This block has no tunable parameters.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paramSpecs.map((spec) => {
                const raw = Number(selectedBlock.params[spec.key]);
                const value = Number.isFinite(raw) ? raw : spec.defaultValue;
                return (
                  <ParamField
                    key={`${selectedBlock.id}-${spec.key}`}
                    spec={spec}
                    ctx={paramCtx}
                    value={value}
                    isFa={isFa}
                    onCommit={(v) => updateParam(safeIdx, spec.key, v)}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {!compact && inspectedStage && (
        <InteractivePlot
          title={
            isFa
              ? `ورودی و خروجی مرحله ${stageNum(inspectIdx)}: ${getBlockLabel(inspectedStage.block)}`
              : `Stage ${stageNum(inspectIdx)} Input vs Output — ${inspectedStage.block.name}`
          }
          subtitle={
            !inspectedStage.block.enabled
              ? isFa
                ? 'این مرحله غیرفعال (بای‌پس) است؛ خروجی برابر ورودی است'
                : 'This stage is bypassed — output equals input'
              : canOverlay
              ? isFa
                ? 'خط‌چین کهربایی: ورودی مرحله · خط پیوسته آبی: خروجی مرحله'
                : 'Dashed amber: stage input · solid cyan: stage output'
              : inputIsSpectrum !== outputIsSpectrum
              ? isFa
                ? 'ورودی در حوزه زمان و خروجی در حوزه فرکانس است؛ فقط خروجی نمایش داده می‌شود'
                : 'Input is time-domain and output is a spectrum, so only the output is shown'
              : isFa
              ? 'ورودی این مرحله قابل هم‌پوشانی نیست؛ فقط خروجی نمایش داده می‌شود'
              : 'Stage input cannot be overlaid here, so only the output is shown'
          }
          xData={outputIsSpectrum ? computed.spectrum.frequencies : computed.time}
          xLabel={
            outputIsSpectrum
              ? isFa
                ? 'فرکانس (هرتز)'
                : 'Frequency (Hz)'
              : isFa
              ? 'زمان (ثانیه)'
              : 'Time (s)'
          }
          yLabel={
            outputIsSpectrum ? (isFa ? 'اندازه' : 'Magnitude') : isFa ? 'دامنه' : 'Amplitude'
          }
          height={200}
          series={[
            ...(canOverlay && stageInput
              ? [
                  {
                    id: 'stage-in',
                    label: isFa ? 'ورودی مرحله' : 'Stage input',
                    data: stageInput,
                    color: '#f59e0b',
                    lineWidth: 1.5,
                    dashed: true,
                  },
                ]
              : []),
            {
              id: 'stage-out',
              label: isFa ? 'خروجی مرحله' : 'Stage output',
              data: inspectedStage.signal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
          ]}
        />
      )}
    </div>
  );
};
