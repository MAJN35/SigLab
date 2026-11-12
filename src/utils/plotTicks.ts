/**
 * Axis tick generation and engineering (SI) number formatting for SigLab plots.
 */

const MINUS = '−';

/** 1-2-5 "nice" step for a span divided into roughly `targetCount` intervals. */
export function niceStep(span: number, targetCount = 5): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(1, targetCount);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 7) nice = 5;
  else nice = 10;
  return nice * mag;
}

export interface TickSet {
  ticks: number[];
  step: number;
}

/**
 * Nice ticks covering [min, max] (only ticks inside the range are returned).
 * `targetCount` is the approximate number of intervals.
 */
export function niceTicks(min: number, max: number, targetCount = 5): TickSet {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [], step: 1 };
  if (min > max) [min, max] = [max, min];
  if (max - min < 1e-300) {
    return { ticks: [min], step: Math.abs(min) || 1 };
  }
  const step = niceStep(max - min, targetCount);
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  const ticks: number[] = [];
  for (let k = first; k <= last && ticks.length < 200; k++) {
    // Avoid -0 and floating noise such as 0.30000000000000004
    const v = k * step;
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : parseFloat(v.toPrecision(12)));
  }
  return { ticks, step };
}

const SI_PREFIXES: Record<number, string> = {
  [-15]: 'f',
  [-12]: 'p',
  [-9]: 'n',
  [-6]: 'µ',
  [-3]: 'm',
  0: '',
  3: 'k',
  6: 'M',
  9: 'G',
  12: 'T',
};

/** Units for which SI prefixes make no sense (logarithmic or angular). */
const NO_PREFIX_UNITS = new Set(['dB', 'dBm', 'dBW', 'dBV', 'dBc', 'dB/Hz', 'dBFS', '°', 'deg', '%', 'rad']);

function engExponent(absV: number): number {
  if (absV === 0 || !Number.isFinite(absV)) return 0;
  const e = Math.floor(Math.log10(absV) / 3) * 3;
  return Math.max(-15, Math.min(12, e));
}

/** Whether a magnitude should be shown with an SI prefix (k, M, m, µ, ...). */
function wantsPrefix(absV: number): boolean {
  return absV >= 1000 || (absV > 0 && absV < 0.01);
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

function withSign(s: string, negative: boolean, unicodeMinus: boolean): string {
  return negative ? (unicodeMinus ? MINUS : '-') + s : s;
}

export interface FormatOptions {
  /** Significant digits (default 3). */
  precision?: number;
  /** Unit appended after the prefix, e.g. "Hz" -> "4.8 kHz". */
  unit?: string;
  /** Use U+2212 minus sign (default true). */
  unicodeMinus?: boolean;
  /** Disable SI prefixes (e.g. for dB or degrees). Auto for known log/angle units. */
  noPrefix?: boolean;
}

/**
 * Engineering formatter.
 *   formatSI(1e-4)            -> "100µ"
 *   formatSI(4800)            -> "4.8k"
 *   formatSI(4800, {unit:'Hz'}) -> "4.8 kHz"
 *   formatSI(-3.01, {unit:'dB'}) -> "−3.01 dB"
 *   formatSI(0.25)            -> "0.25"
 */
export function formatSI(value: number, opts: FormatOptions = {}): string {
  const { precision = 3, unit, unicodeMinus = true } = opts;
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : withSign('∞', true, unicodeMinus);
  const noPrefix = opts.noPrefix || (unit ? NO_PREFIX_UNITS.has(unit) : false);
  const abs = Math.abs(value);
  const neg = value < 0;
  let body: string;
  let prefix = '';
  if (abs === 0) {
    body = '0';
  } else if (!noPrefix && wantsPrefix(abs)) {
    const e = engExponent(abs);
    prefix = SI_PREFIXES[e] ?? '';
    body = trimZeros((abs / Math.pow(10, e)).toPrecision(precision));
  } else if (noPrefix && (abs >= 1e6 || abs < 1e-4)) {
    body = abs.toExponential(Math.max(0, precision - 1));
  } else {
    // Fixed notation with `precision` significant digits (but no exponent).
    const digits = Math.max(0, precision - 1 - Math.floor(Math.log10(abs)));
    body = trimZeros(abs.toFixed(Math.min(12, digits)));
  }
  const num = withSign(body, neg && body !== '0', unicodeMinus);
  if (!unit) return num + prefix;
  return `${num} ${prefix}${unit}`;
}

/** Shorthand for dB values: formatDb(-3.0103) -> "−3.01 dB". */
export function formatDb(value: number, precision = 3): string {
  return formatSI(value, { unit: 'dB', precision });
}

/**
 * Formatter for a set of linear ticks so all labels share one prefix and the
 * same number of decimals (e.g. 0, 1k, 2k ... or 0, 0.25, 0.5 ...).
 */
export function makeTickFormatter(
  ticks: number[],
  step: number,
  opts: { unicodeMinus?: boolean; noPrefix?: boolean } = {}
): (v: number) => string {
  const { unicodeMinus = true, noPrefix = false } = opts;
  const maxAbs = ticks.reduce((m, t) => Math.max(m, Math.abs(t)), 0);
  const usePrefix = !noPrefix && wantsPrefix(maxAbs);
  const e = usePrefix ? engExponent(maxAbs) : 0;
  const scale = Math.pow(10, e);
  const prefix = usePrefix ? SI_PREFIXES[e] ?? '' : '';
  const scaledStep = Math.abs(step / scale) || 1;
  const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(scaledStep) + 1e-9)));
  return (v: number) => {
    const s = Math.abs(v / scale).toFixed(decimals);
    const isZero = Number(s) === 0;
    if (isZero) return '0';
    return withSign(s, v < 0 && !isZero, unicodeMinus) + (isZero ? '' : prefix);
  };
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** 10^-4 -> "10⁻⁴" */
export function formatPow10(exp: number): string {
  return '10' + String(exp).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

/**
 * Ticks for a log10 axis. `minExp`/`maxExp` are log10 of the visible range.
 * Returns tick positions in log10 space and labels.
 */
export function logTicks(
  minExp: number,
  maxExp: number,
  maxTicks = 6
): { positions: number[]; labels: string[]; decades: boolean } {
  if (!Number.isFinite(minExp) || !Number.isFinite(maxExp) || maxExp <= minExp) {
    return { positions: [], labels: [], decades: true };
  }
  const lo = Math.ceil(minExp - 1e-9);
  const hi = Math.floor(maxExp + 1e-9);
  const nDec = hi - lo + 1;
  const labelDecade = (e: number) =>
    e >= -2 && e <= 3 ? formatSI(Math.pow(10, e), { unicodeMinus: true }) : formatPow10(e);

  if (nDec >= 2) {
    const every = Math.max(1, Math.ceil(nDec / Math.max(2, maxTicks)));
    const positions: number[] = [];
    for (let e = lo; e <= hi; e++) if ((e - lo) % every === 0) positions.push(e);
    return { positions, labels: positions.map(labelDecade), decades: true };
  }

  // Less than two decades visible: use 1-2-5 mantissas.
  const positions: number[] = [];
  const labels: string[] = [];
  for (let e = Math.floor(minExp); e <= Math.ceil(maxExp); e++) {
    for (const m of [1, 2, 5]) {
      const p = e + Math.log10(m);
      if (p >= minExp - 1e-9 && p <= maxExp + 1e-9) {
        positions.push(p);
        labels.push(formatSI(m * Math.pow(10, e)));
      }
    }
  }
  if (positions.length >= 2) return { positions, labels, decades: false };

  // Very narrow range: linear nice ticks on the underlying values.
  const { ticks, step } = niceTicks(Math.pow(10, minExp), Math.pow(10, maxExp), 4);
  const fmt = makeTickFormatter(ticks, step);
  const pos = ticks.filter((t) => t > 0);
  return { positions: pos.map((t) => Math.log10(t)), labels: pos.map(fmt), decades: false };
}
