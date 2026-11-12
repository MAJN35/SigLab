import React, { useEffect, useId, useState } from 'react';
import { useLab } from '../../store/LabContext';

export type UiLang = 'en' | 'fa';

/**
 * Resolves the UI language for shared components.
 * An explicit `lang` prop wins; otherwise the LabContext language is used;
 * outside a LabProvider it falls back to `<html lang>` (then English).
 */
export function useUiLang(lang?: UiLang): UiLang {
  let ctxLang: UiLang | undefined;
  try {
    // useLab always calls useContext first, so hook order is stable; it only
    // throws (after that call) when rendered outside a LabProvider.
    ctxLang = useLab().lang;
  } catch {
    ctxLang = undefined;
  }
  if (lang) return lang;
  if (ctxLang) return ctxLang;
  if (typeof document !== 'undefined' && document.documentElement.lang === 'fa') return 'fa';
  return 'en';
}

export interface ParamSliderProps {
  /** Optional id for the range input. A stable id is generated when omitted. */
  id?: string;
  /** English label (also used in FA when `faLabel` is missing). */
  label: string;
  /** Persian label. */
  faLabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Unit shown after the value and announced in aria-valuetext, e.g. "Hz". */
  unit?: string;
  onChange: (value: number) => void;
  /** Custom value formatter (display + aria-valuetext). Defaults to step precision. */
  format?: (value: number) => string;
  /** Helper text under the slider (linked via aria-describedby). */
  description?: React.ReactNode;
  /** Optional warning (e.g. aliasing). Rendered amber in a role="status" region. */
  warning?: React.ReactNode;
  disabled?: boolean;
  /** Force a language; defaults to the LabContext language. */
  lang?: UiLang;
  className?: string;
}

function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const s = String(step);
  if (s.includes('e-')) return Number(s.split('e-')[1]) || 0;
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

function clampToRange(v: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, v));
  const d = decimalsOf(step);
  return Number(clamped.toFixed(d));
}

/**
 * Accessible parameter slider: a real `<label>`, the themed `.sci-slider`
 * range input (with unit-aware `aria-valuetext`), a linked numeric field for
 * exact entry (clamped on blur / Enter, Escape reverts) and an optional
 * warning slot.
 *
 * @example
 * <ParamSlider
 *   label="Sampling Rate (fs)"
 *   faLabel="نرخ نمونه‌برداری (fs)"
 *   value={fs}
 *   min={64}
 *   max={1024}
 *   step={32}
 *   unit="Hz"
 *   onChange={setFs}
 *   warning={fs < 2 * fmax ? (isFa ? 'خطر الیاسینگ' : 'Aliasing risk: fs < 2·fmax') : undefined}
 * />
 */
export function ParamSlider({
  id,
  label,
  faLabel,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  format,
  description,
  warning,
  disabled = false,
  lang,
  className = '',
}: ParamSliderProps) {
  const uiLang = useUiLang(lang);
  const isFa = uiLang === 'fa';
  const autoId = useId();
  const sliderId = id ?? `param-slider-${autoId}`;
  const numberId = `${sliderId}-exact`;
  const descId = `${sliderId}-desc`;
  const warnId = `${sliderId}-warn`;

  const fmt = (v: number) => (format ? format(v) : v.toFixed(decimalsOf(step)));
  const shown = fmt(value);
  const valueText = unit ? `${shown} ${unit}` : shown;
  const shownLabel = isFa && faLabel ? faLabel : label;

  const [draft, setDraft] = useState<string>(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    const parsed = Number(draft.replace(',', '.').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clampToRange(parsed, min, max, step);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const describedBy =
    [description ? descId : null, warning ? warnId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <label htmlFor={sliderId} className="font-medium text-slate-600 dark:text-slate-300">
          {shownLabel}
        </label>
        <span className="font-mono font-semibold tabular-nums text-sky-600 dark:text-sky-400" aria-hidden="true">
          {valueText}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <input
          id={sliderId}
          type="range"
          className="sci-slider min-w-0 flex-1"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={valueText}
          aria-describedby={describedBy}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="flex shrink-0 items-center gap-1">
          <input
            id={numberId}
            type="number"
            inputMode="decimal"
            dir="ltr"
            className="neu-inset w-20 px-2 py-1 text-xs font-mono tabular-nums text-end"
            min={min}
            max={max}
            step={step}
            value={draft}
            disabled={disabled}
            aria-label={isFa ? `${shownLabel} (مقدار دقیق)` : `${shownLabel} (exact value)`}
            aria-describedby={describedBy}
            onFocus={() => setEditing(true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              commit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setDraft(String(value));
              }
            }}
          />
          {unit && (
            <span className="text-caption font-mono text-slate-500 dark:text-slate-400" aria-hidden="true">
              {unit}
            </span>
          )}
        </div>
      </div>

      {description && (
        <p id={descId} className="text-caption leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}

      <div id={warnId} role="status" aria-live="polite">
        {warning && (
          <p
            className="rounded-chip border px-2 py-1 text-caption leading-snug"
            style={{
              color: 'var(--warning-text)',
              background: 'var(--warning-soft)',
              borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)',
            }}
          >
            {warning}
          </p>
        )}
      </div>
    </div>
  );
}

export default ParamSlider;
