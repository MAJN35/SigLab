/**
 * Pure helpers for the working-experiment state layer:
 * persistence (localStorage), validation/merging over defaults,
 * share-link encoding, hash parsing and Nyquist-aware clamping.
 */
import { Experiment, PageId, PipelineBlock, SignalComponent } from '../types';
import { DEFAULT_EXPERIMENT } from './presets';

export const EXPERIMENT_STORAGE_KEY = 'siglab:experiment:v1';
export const SHARE_PARAM = 's';

export const VALID_PAGES: readonly PageId[] = [
  'dashboard',
  'audio-lab',
  'dna-simulator',
  'signal-generator',
  'telecommunications',
  'eeg-simulator',
  'fft-spectrum',
  'wavelet-analysis',
  'filtering',
  'pca',
  'ica',
  'modulation-ber',
  'deep-learning',
  'custom-samples',
  'experiments',
  'documentation',
];

export function isPageId(value: string): value is PageId {
  return (VALID_PAGES as readonly string[]).includes(value);
}

/** Parses `#/<page>?a=b` into page + query params. `#/filtering?s=...` → page "filtering". */
export function parseHash(hash: string): { page: PageId | null; params: URLSearchParams } {
  const raw = hash.replace(/^#\/?/, '');
  const qIndex = raw.indexOf('?');
  const pagePart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  let page: string = pagePart;
  try {
    page = decodeURIComponent(pagePart);
  } catch {
    /* keep raw */
  }
  return { page: isPageId(page) ? page : null, params: new URLSearchParams(query) };
}

// ---------------------------------------------------------------------------
// Validation / merge
// ---------------------------------------------------------------------------

type Plain = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const COMPONENT_TYPES = ['sine', 'cosine', 'square', 'triangle', 'sawtooth', 'pulse', 'chirp', 'multitone'];
const BLOCK_TYPES = ['generator', 'noise', 'bandpass', 'notch', 'ica', 'pca', 'wavelet-denoise', 'fft'];

function sanitizeComponent(v: unknown, index: number): SignalComponent | null {
  if (!isPlainObject(v)) return null;
  if (typeof v.type !== 'string' || !COMPONENT_TYPES.includes(v.type)) return null;
  if (!isFiniteNumber(v.frequency) || !isFiniteNumber(v.amplitude)) return null;
  const comp: SignalComponent = {
    id: typeof v.id === 'string' ? v.id.slice(0, 64) : `c${index + 1}`,
    type: v.type as SignalComponent['type'],
    amplitude: v.amplitude,
    frequency: v.frequency,
    phase: isFiniteNumber(v.phase) ? v.phase : 0,
    enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
  };
  if (isFiniteNumber(v.frequencyEnd)) comp.frequencyEnd = v.frequencyEnd;
  if (isFiniteNumber(v.dutyCycle)) comp.dutyCycle = v.dutyCycle;
  return comp;
}

function sanitizeBlock(v: unknown, index: number): PipelineBlock | null {
  if (!isPlainObject(v)) return null;
  if (typeof v.type !== 'string' || !BLOCK_TYPES.includes(v.type)) return null;
  const params: PipelineBlock['params'] = {};
  if (isPlainObject(v.params)) {
    for (const [k, p] of Object.entries(v.params)) {
      if (typeof p === 'string') params[k] = p.slice(0, 200);
      else if (typeof p === 'boolean' || isFiniteNumber(p)) params[k] = p;
    }
  }
  return {
    id: typeof v.id === 'string' ? v.id.slice(0, 64) : `blk-${index + 1}`,
    type: v.type as PipelineBlock['type'],
    name: typeof v.name === 'string' ? v.name.slice(0, 200) : v.type,
    enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
    params,
  };
}

/**
 * Recursively merges `input` over `base`, accepting only values whose runtime
 * type matches the base value. Unknown keys are dropped, so new fields keep
 * their defaults and malformed data cannot crash computations.
 */
function typedMerge(base: unknown, input: unknown, path: string): unknown {
  if (input === undefined) return base;

  if (path === 'signal.components') {
    if (!Array.isArray(input)) return base;
    return input.map(sanitizeComponent).filter((c): c is SignalComponent => c !== null).slice(0, 32);
  }
  if (path === 'processing') {
    if (!Array.isArray(input)) return base;
    return input.map(sanitizeBlock).filter((b): b is PipelineBlock => b !== null).slice(0, 32);
  }
  if (Array.isArray(base)) {
    // Numeric matrices / arrays (e.g. ICA mixing matrix)
    if (!Array.isArray(input)) return base;
    const ok = input.every((row) =>
      Array.isArray(row) ? row.every(isFiniteNumber) : isFiniteNumber(row)
    );
    return ok ? input.slice(0, 64) : base;
  }
  if (isPlainObject(base)) {
    if (!isPlainObject(input)) return base;
    const out: Plain = {};
    for (const key of Object.keys(base)) {
      out[key] = typedMerge(base[key], input[key], path ? `${path}.${key}` : key);
    }
    return out;
  }
  if (typeof base === 'number') return isFiniteNumber(input) ? input : base;
  if (typeof base === 'string') return typeof input === 'string' ? input.slice(0, 500) : base;
  if (typeof base === 'boolean') return typeof input === 'boolean' ? input : base;
  return base;
}

/** Merge an untrusted, possibly partial/older experiment over DEFAULT_EXPERIMENT. */
export function normalizeExperiment(input: unknown): Experiment | null {
  if (!isPlainObject(input)) return null;
  const merged = typedMerge(DEFAULT_EXPERIMENT, input, '') as Experiment;
  return clampExperimentToNyquist(merged);
}

// ---------------------------------------------------------------------------
// localStorage persistence (all access guarded)
// ---------------------------------------------------------------------------

export function loadPersistedExperiment(): Experiment | null {
  try {
    const raw = window.localStorage.getItem(EXPERIMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; experiment?: unknown };
    if (!parsed || parsed.v !== 1) return null;
    return normalizeExperiment(parsed.experiment);
  } catch {
    return null;
  }
}

export function persistExperiment(exp: Experiment): void {
  try {
    window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, JSON.stringify({ v: 1, experiment: exp }));
  } catch {
    /* quota exceeded / storage disabled — ignore */
  }
}

export function clearPersistedExperiment(): void {
  try {
    window.localStorage.removeItem(EXPERIMENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Share links: diff vs defaults → JSON → base64url
// ---------------------------------------------------------------------------

function diffFromBase(base: unknown, value: unknown): unknown {
  if (Array.isArray(value) || Array.isArray(base)) {
    return JSON.stringify(base) === JSON.stringify(value) ? undefined : value;
  }
  if (isPlainObject(base) && isPlainObject(value)) {
    const out: Plain = {};
    let changed = false;
    for (const key of Object.keys(value)) {
      const d = diffFromBase(base[key], value[key]);
      if (d !== undefined) {
        out[key] = d;
        changed = true;
      }
    }
    return changed ? out : undefined;
  }
  return Object.is(base, value) ? undefined : value;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeExperimentForShare(exp: Experiment): string {
  const { id: _id, createdAt: _createdAt, ...rest } = exp;
  void _id;
  void _createdAt;
  const diff = (diffFromBase(DEFAULT_EXPERIMENT, rest) as Plain | undefined) ?? {};
  return toBase64Url(JSON.stringify({ v: 1, d: diff }));
}

/** Returns a validated experiment, or null if the payload is malformed. */
export function decodeSharedExperiment(data: string): Experiment | null {
  try {
    if (!data || data.length > 100_000) return null;
    const parsed = JSON.parse(fromBase64Url(data)) as { v?: number; d?: unknown };
    if (!parsed || parsed.v !== 1 || !isPlainObject(parsed.d)) return null;
    const exp = normalizeExperiment(parsed.d);
    if (!exp) return null;
    return { ...exp, id: `exp-shared-${Date.now()}`, createdAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

export function buildShareUrl(exp: Experiment, page: PageId): string {
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}#/${page}?${SHARE_PARAM}=${encodeExperimentForShare(exp)}`;
}

// ---------------------------------------------------------------------------
// Nyquist helpers
// ---------------------------------------------------------------------------

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Clamp a (low, high) cutoff pair to (0, maxCut) and keep low < high. */
function clampPair(low: number, high: number, nyq: number): [number, number] {
  const maxCut = round2(nyq * 0.99);
  const gap = Math.min(1, maxCut * 0.05);
  let h = Math.min(high, maxCut);
  let l = Math.min(low, maxCut);
  if (l >= h) {
    if (h - gap > 0) l = round2(h - gap);
    else h = Math.min(maxCut, round2(l + gap));
  }
  l = Math.max(0, l);
  return [l, h];
}

/**
 * Keep filter parameters valid for the current sampling rate(s):
 * cutoffs strictly below fs/2 and low < high. Signal frequencies are NOT
 * touched (aliasing is a teaching topic — see `getAliasingFrequencies`).
 * Returns the same object reference when nothing changed.
 */
export function clampExperimentToNyquist(exp: Experiment): Experiment {
  let next = exp;
  const fs = exp.signal?.samplingRate;
  if (isFiniteNumber(fs) && fs > 0) {
    const nyq = fs / 2;
    const [lo, hi] = clampPair(exp.filter.cutoffLow, exp.filter.cutoffHigh, nyq);
    if (lo !== exp.filter.cutoffLow || hi !== exp.filter.cutoffHigh) {
      next = { ...next, filter: { ...exp.filter, cutoffLow: lo, cutoffHigh: hi } };
    }

    let blocksChanged = false;
    const processing = exp.processing.map((blk) => {
      if (blk.type === 'bandpass') {
        const cl = blk.params.cutoffLow;
        const ch = blk.params.cutoffHigh;
        if (typeof cl === 'number' && typeof ch === 'number') {
          const [l, h] = clampPair(cl, ch, nyq);
          if (l !== cl || h !== ch) {
            blocksChanged = true;
            return { ...blk, params: { ...blk.params, cutoffLow: l, cutoffHigh: h } };
          }
        }
      } else if (blk.type === 'notch') {
        const f = blk.params.freq;
        const maxNotch = round2(nyq * 0.99 - 2); // notch occupies [f, f + 2]
        if (typeof f === 'number' && f > maxNotch && maxNotch > 0) {
          blocksChanged = true;
          return { ...blk, params: { ...blk.params, freq: maxNotch } };
        }
      }
      return blk;
    });
    if (blocksChanged) next = { ...next, processing };
  }

  const eegFs = exp.eeg?.samplingRate;
  if (isFiniteNumber(eegFs) && eegFs > 0) {
    const [hp, lp] = clampPair(exp.eeg.preprocessHighpass, exp.eeg.preprocessLowpass, eegFs / 2);
    if (hp !== exp.eeg.preprocessHighpass || lp !== exp.eeg.preprocessLowpass) {
      next = { ...next, eeg: { ...exp.eeg, preprocessHighpass: hp, preprocessLowpass: lp } };
    }
  }
  return next;
}

/** Apply clamping only when a sampling rate actually changed between states. */
export function clampOnSamplingRateChange(prev: Experiment, next: Experiment): Experiment {
  if (
    prev.signal.samplingRate === next.signal.samplingRate &&
    prev.eeg.samplingRate === next.eeg.samplingRate
  ) {
    return next;
  }
  return clampExperimentToNyquist(next);
}

/** Highest frequencies of active signal content that exceed fs/2. */
export function getAliasingFrequencies(exp: Experiment): number[] {
  const { signal } = exp;
  const nyq = signal.samplingRate / 2;
  const freqs: number[] = [];
  const push = (type: string, f: number, fEnd?: number) => {
    if (type === 'chirp') freqs.push(Math.max(f, fEnd ?? f * 3));
    else if (type === 'multitone') freqs.push(f * 5);
    else freqs.push(f);
  };
  if (signal.type === 'composite') {
    signal.components.filter((c) => c.enabled).forEach((c) => push(c.type, c.frequency, c.frequencyEnd));
  } else {
    push(signal.type, signal.frequency, signal.frequencyEnd);
  }
  return freqs.filter((f) => Math.abs(f) > nyq);
}
