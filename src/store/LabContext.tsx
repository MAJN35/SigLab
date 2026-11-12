import React, {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ToastApi, ToastProvider, ToastViewport, useToast } from '../components/feedback/Toast';
import { computeFFTSpectrum, computeSTFTSpectrogram, SpectrumResult, SpectrogramResult } from '../simulations/fft';
import { applyFilter } from '../simulations/filters';
import { simulateDigitalModulation } from '../simulations/modulation';
import { applyNoiseToSignal, generateSignal } from '../simulations/signals';
import { computeWaveletAnalysis } from '../simulations/wavelets';
import {
  CustomSample,
  Experiment,
  MLConfig,
  PageId,
  PipelineBlock,
} from '../types';
import {
  deleteExperimentFromDB,
  deleteSampleFromDB,
  getAllExperiments,
  getAllSamples,
  saveExperimentToDB,
  saveSampleToDB,
} from '../utils/idb';
import { calculateSNR, findFrequencyPeaks, FrequencyPeak } from '../utils/math';
import {
  buildShareUrl,
  clampOnSamplingRateChange,
  decodeSharedExperiment,
  getAliasingFrequencies,
  loadPersistedExperiment,
  normalizeExperiment,
  parseHash,
  persistExperiment,
  SHARE_PARAM,
} from './experimentState';
import { ssaSubspaceProject } from './pipelineDsp';
import { DEFAULT_EXPERIMENT, EDUCATIONAL_PRESETS, EducationalPreset } from './presets';

interface LabContextValue {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  lang: 'en' | 'fa';
  setLang: React.Dispatch<React.SetStateAction<'en' | 'fa'>>;
  experiment: Experiment;
  /** Updates the working experiment. Filter cutoffs are auto-clamped below fs/2 when a sampling rate changes. */
  setExperiment: React.Dispatch<React.SetStateAction<Experiment>>;
  mlConfig: MLConfig;
  setMlConfig: React.Dispatch<React.SetStateAction<MLConfig>>;
  savedExperiments: Experiment[];
  customSamples: CustomSample[];
  /** Saves the working experiment (or `source`, if given) to the saved-experiments library. */
  saveCurrentExperiment: (customName?: string, source?: Experiment) => Promise<void>;
  loadExperiment: (exp: Experiment) => void;
  deleteExperiment: (id: string) => Promise<void>;
  duplicateExperiment: (exp: Experiment) => Promise<void>;
  renameExperiment: (id: string, newName: string) => Promise<void>;
  /** Applies a preset, navigates to its page, and shows an "Undo" toast. */
  applyEducationalPreset: (preset: EducationalPreset) => void;
  saveCustomSample: (sample: CustomSample) => Promise<void>;
  deleteCustomSample: (id: string) => Promise<void>;

  // ---- Additive API (all optional to consume) ----
  /** Nyquist frequency of the main signal: samplingRate / 2 (Hz). */
  nyquist: number;
  /** True when any active signal component frequency exceeds fs/2. Signal frequencies are never auto-changed. */
  isAliasing: boolean;
  /** The offending component frequencies (Hz) above fs/2; empty when not aliasing. */
  aliasingFrequencies: number[];
  /** True while heavy DSP results (`computed`) lag behind the latest `experiment` (deferred rendering). */
  isComputing: boolean;
  /** Restores DEFAULT_EXPERIMENT (undoable, shows a toast). */
  resetExperiment: () => void;
  /** Absolute URL `…#/<page>?s=<base64url>` that reproduces the working experiment. Defaults to the active page. */
  getShareUrl: (page?: PageId) => string;
  /** Reverts the most recent destructive action (preset apply, reset, shared-link load). */
  undo: () => void;
  canUndo: boolean;
  /** Short description of what `undo()` would revert, or null. */
  undoLabel: string | null;
  /** Re-inserts a previously deleted experiment into the saved library (used for delete-undo). */
  restoreSavedExperiment: (exp: Experiment) => Promise<void>;
  /** Global toast API (same as `useToast()`). */
  showToast: ToastApi['showToast'];
  dismissToast: ToastApi['dismissToast'];

  // Real-time computed core signals for Dashboard & global inspection
  computed: {
    time: number[];
    cleanSignal: number[];
    noisySignal: number[];
    filteredSignal: number[];
    residualSignal: number[];
    filterFreqAxis: number[];
    filterMagResponse: number[];
    filterMagResponseDb: number[];
    empiricalSnrDb: number;
    filteredSnrDb: number;
    currentBer: number;
    spectrum: SpectrumResult;
    peaks: FrequencyPeak[];
    spectrogram: SpectrogramResult;
    pipelineStages: { block: PipelineBlock; signal: number[] }[];
  };
}

const LabContext = createContext<LabContextValue | null>(null);

const INITIAL_SAMPLES: CustomSample[] = [
  {
    id: 'sample-alpha-spindle',
    name: 'Synthetic Alpha Burst 10 Hz',
    createdAt: '2026-10-03T10:15:00.000Z',
    signalType: 'sine',
    samplingRate: 256,
    duration: 2.0,
    channels: 4,
    frequency: 10.0,
    amplitude: 1.8,
    phase: 0,
    noiseType: 'awgn',
    noiseSnrDb: 14,
    modulation: 'None',
    artifacts: ['Eye Blink', '50Hz Hum'],
    pipeline: DEFAULT_EXPERIMENT.processing,
    previewData: Array.from({ length: 128 }, (_, i) =>
      1.8 * Math.sin((2 * Math.PI * 10 * i) / 256) + 0.2 * Math.cos((2 * Math.PI * 50 * i) / 256)
    ),
  },
  {
    id: 'sample-qpsk-telemetry',
    name: 'QPSK Telemetry Carrier 32 Bd',
    createdAt: '2026-10-03T11:30:00.000Z',
    signalType: 'cosine',
    samplingRate: 512,
    duration: 1.5,
    channels: 2,
    frequency: 32.0,
    amplitude: 1.2,
    phase: 45,
    noiseType: 'gaussian',
    noiseSnrDb: 10,
    modulation: 'QPSK',
    artifacts: ['Burst Noise'],
    pipeline: DEFAULT_EXPERIMENT.processing,
    previewData: Array.from({ length: 128 }, (_, i) =>
      1.2 * Math.cos((2 * Math.PI * 16 * i) / 512 + (i % 16 < 8 ? 0.78 : -0.78))
    ),
  },
];


interface UndoSnapshot {
  id: number;
  label: string;
  experiment: Experiment;
  mlConfig: MLConfig;
  page: PageId;
}

const MAX_UNDO = 10;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

type ShareStatus = 'none' | 'applied' | 'invalid';

/** Initial working experiment: shared link (?s=) > persisted localStorage > defaults. */
function computeInitialExperiment(): { experiment: Experiment; previous: Experiment; share: ShareStatus } {
  const persisted = loadPersistedExperiment() ?? structuredClone(DEFAULT_EXPERIMENT);
  let share: ShareStatus = 'none';
  try {
    const { params } = parseHash(window.location.hash);
    const data = params.get(SHARE_PARAM);
    if (data !== null) {
      const shared = decodeSharedExperiment(data);
      if (shared) return { experiment: shared, previous: persisted, share: 'applied' };
      share = 'invalid';
    }
  } catch {
    /* ignore */
  }
  return { experiment: persisted, previous: persisted, share };
}

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <LabProviderInner>{children}</LabProviderInner>
  </ToastProvider>
);

const LabProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, dismissToast } = useToast();

  const [activePage, setActivePage] = useState<PageId>(
    () => parseHash(window.location.hash).page ?? 'dashboard'
  );

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    let theme = params.get('theme');
    if (!theme) {
      const attrTheme = document.documentElement.getAttribute('data-theme');
      if (attrTheme === 'dark' || attrTheme === 'light') {
        theme = attrTheme;
      }
    }
    if (!theme) {
      const match = document.cookie.match(/(^|;)\s*theme\s*=\s*([^;]+)/);
      theme = match ? match[2] : safeGet('theme');
    }
    if (!theme) {
      const legacy = safeGet('signallab_theme_dark');
      if (legacy !== null) {
        theme = legacy === 'true' ? 'dark' : 'light';
      }
    }
    return theme === 'dark';
  });

  const [lang, setLang] = useState<'en' | 'fa'>(() => {
    const saved = safeGet('signallab_lang');
    return saved === 'fa' ? 'fa' : 'en';
  });

  const [initial] = useState(computeInitialExperiment);
  const [experiment, setExperimentRaw] = useState<Experiment>(initial.experiment);
  const [savedExperiments, setSavedExperiments] = useState<Experiment[]>([]);
  const [customSamples, setCustomSamples] = useState<CustomSample[]>(INITIAL_SAMPLES);

  const [mlConfig, setMlConfig] = useState<MLConfig>({
    architecture: 'cnn1d',
    task: 'sine-vs-square',
    epochs: 18,
    learningRate: 0.015,
    batchSize: 16,
    hiddenUnits: 24,
    datasetSize: 120,
    noiseLevel: 0.25,
  });

  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  // Refs mirror the latest state so callbacks can stay referentially stable.
  const experimentRef = useRef(experiment);
  const mlConfigRef = useRef(mlConfig);
  const activePageRef = useRef(activePage);
  const savedExperimentsRef = useRef(savedExperiments);
  const undoStackRef = useRef(undoStack);
  const langRef = useRef(lang);
  const undoIdRef = useRef(0);
  useEffect(() => {
    experimentRef.current = experiment;
    mlConfigRef.current = mlConfig;
    activePageRef.current = activePage;
    savedExperimentsRef.current = savedExperiments;
    undoStackRef.current = undoStack;
    langRef.current = lang;
  });

  /** Wrapped setter: clamps filter cutoffs below Nyquist whenever a sampling rate changes. */
  const setExperiment = useCallback<React.Dispatch<React.SetStateAction<Experiment>>>((action) => {
    setExperimentRaw((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      return next === prev ? prev : clampOnSamplingRateChange(prev, next);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------

  const pushUndoSnapshot = useCallback((label: string, base?: Experiment): number => {
    undoIdRef.current += 1;
    const snap: UndoSnapshot = {
      id: undoIdRef.current,
      label,
      experiment: base ?? experimentRef.current,
      mlConfig: mlConfigRef.current,
      page: activePageRef.current,
    };
    const next = [...undoStackRef.current, snap].slice(-MAX_UNDO);
    undoStackRef.current = next;
    setUndoStack(next);
    return snap.id;
  }, []);

  /** Restores snapshot `id` (or the latest) and discards it and any newer snapshots. */
  const restoreSnapshot = useCallback(
    (id?: number) => {
      const stack = undoStackRef.current;
      const index = id === undefined ? stack.length - 1 : stack.findIndex((s) => s.id === id);
      if (index < 0) return;
      const snap = stack[index];
      const next = stack.slice(0, index);
      undoStackRef.current = next;
      setUndoStack(next);
      setExperimentRaw(snap.experiment);
      setMlConfig(snap.mlConfig);
      setActivePage(snap.page);
      showToast({
        kind: 'info',
        duration: 3500,
        message: langRef.current === 'fa' ? 'تغییر برگردانده شد.' : 'Change undone.',
      });
    },
    [showToast]
  );

  const undo = useCallback(() => restoreSnapshot(), [restoreSnapshot]);


  /** Shows a toast whose action reverts exactly the given snapshot. */
  const showUndoToast = useCallback(
    (message: string, snapshotId: number) => {
      showToast({
        kind: 'success',
        message,
        action: {
          label: langRef.current === 'fa' ? 'بازگردانی' : 'Undo',
          onAction: () => restoreSnapshot(snapshotId),
        },
      });
    },
    [showToast, restoreSnapshot]
  );

  // ---------------------------------------------------------------------------
  // Side effects: theme, language, hash routing, persistence
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
    }
    safeSet('theme', theme);
    safeSet('signallab_theme_dark', String(darkMode));
    document.cookie = `theme=${theme}; domain=.majn35.ir; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;

    // Keep URL ?theme= parameter synced if present
    const url = new URL(window.location.href);
    if (url.searchParams.has('theme') && url.searchParams.get('theme') !== theme) {
      url.searchParams.set('theme', theme);
      window.history.replaceState({}, '', url.toString());
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    safeSet('signallab_lang', lang);
  }, [lang]);

  /** Removes `?s=…` (and any other query) from the hash without adding a history entry. */
  const cleanHashQuery = useCallback(() => {
    const { page } = parseHash(window.location.hash);
    if (window.location.hash.includes('?')) {
      const target = `#/${page ?? activePageRef.current}`;
      try {
        window.history.replaceState(window.history.state, '', target);
      } catch {
        window.location.hash = target;
      }
    }
  }, []);

  // Apply / report a shared setup that was present in the URL at load time.
  const initialShareHandled = useRef(false);
  useEffect(() => {
    if (initialShareHandled.current) return;
    initialShareHandled.current = true;
    cleanHashQuery();
    const fa = langRef.current === 'fa';
    if (initial.share === 'applied') {
      const id = pushUndoSnapshot(fa ? 'بارگذاری تنظیمات اشتراکی' : 'Load shared setup', initial.previous);
      showUndoToast(fa ? 'تنظیمات اشتراک‌گذاشته‌شده بارگذاری شد.' : 'Shared setup loaded.', id);
    } else if (initial.share === 'invalid') {
      showToast({
        kind: 'error',
        message: fa
          ? 'پیوند اشتراک‌گذاری نامعتبر یا ناقص است؛ تنظیمات فعلی حفظ شد.'
          : 'The shared link is invalid or incomplete; your current setup was kept.',
      });
    }
  }, [initial, cleanHashQuery, pushUndoSnapshot, showUndoToast, showToast]);

  useEffect(() => {
    // Compare parsed page ids so `#/filtering?s=…` counts as page "filtering".
    if (parseHash(window.location.hash).page !== activePage) {
      window.location.hash = `#/${activePage}`;
    }
  }, [activePage]);

  useEffect(() => {
    const onHashChange = () => {
      const { page, params } = parseHash(window.location.hash);
      if (page) {
        setActivePage(page);
      }
      const data = params.get(SHARE_PARAM);
      if (data !== null) {
        const fa = langRef.current === 'fa';
        const shared = decodeSharedExperiment(data);
        if (shared) {
          const id = pushUndoSnapshot(fa ? 'بارگذاری تنظیمات اشتراکی' : 'Load shared setup');
          setExperimentRaw(shared);
          showUndoToast(fa ? 'تنظیمات اشتراک‌گذاشته‌شده بارگذاری شد.' : 'Shared setup loaded.', id);
        } else {
          showToast({
            kind: 'error',
            message: fa
              ? 'پیوند اشتراک‌گذاری نامعتبر یا ناقص است؛ تنظیمات فعلی حفظ شد.'
              : 'The shared link is invalid or incomplete; your current setup was kept.',
          });
        }
      }
      if (window.location.hash.includes('?')) cleanHashQuery();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [cleanHashQuery, pushUndoSnapshot, showUndoToast, showToast]);

  // Debounced persistence of the working experiment (+ flush when the page is hidden).
  useEffect(() => {
    const timer = window.setTimeout(() => persistExperiment(experiment), 400);
    return () => window.clearTimeout(timer);
  }, [experiment]);

  useEffect(() => {
    const flush = () => persistExperiment(experimentRef.current);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    getAllExperiments()
      .then((exps) => {
        if (exps.length === 0) {
          return saveExperimentToDB(DEFAULT_EXPERIMENT).then(() => {
            setSavedExperiments([DEFAULT_EXPERIMENT]);
          });
        }
        setSavedExperiments(exps);
      })
      .catch(() => {
        /* storage unavailable */
      });
    getAllSamples()
      .then((samps) => {
        if (samps.length === 0) {
          return Promise.all(INITIAL_SAMPLES.map((s) => saveSampleToDB(s))).then(() => {
            setCustomSamples(INITIAL_SAMPLES);
          });
        }
        setCustomSamples(samps);
      })
      .catch(() => {
        /* storage unavailable */
      });
  }, []);

  // ---------------------------------------------------------------------------
  // Library actions (stable callbacks)
  // ---------------------------------------------------------------------------

  const refreshSaved = useCallback(async () => {
    const updated = await getAllExperiments();
    setSavedExperiments(updated);
  }, []);

  const saveCurrentExperiment = useCallback(
    async (customName?: string, source?: Experiment) => {
      const base = source ?? experimentRef.current;
      const expToSave: Experiment = {
        ...base,
        id: customName ? `exp-${Date.now()}` : base.id,
        name: customName || base.name,
        createdAt: new Date().toISOString(),
      };
      await saveExperimentToDB(expToSave);
      setExperimentRaw(expToSave);
      await refreshSaved();
    },
    [refreshSaved]
  );

  const loadExperiment = useCallback(
    (exp: Experiment) => {
      const cloned = structuredClone(exp);
      setExperiment(normalizeExperiment(cloned) ?? cloned);
    },
    [setExperiment]
  );

  const deleteExperiment = useCallback(
    async (id: string) => {
      await deleteExperimentFromDB(id);
      await refreshSaved();
    },
    [refreshSaved]
  );

  const restoreSavedExperiment = useCallback(
    async (exp: Experiment) => {
      await saveExperimentToDB(exp);
      await refreshSaved();
    },
    [refreshSaved]
  );

  const duplicateExperiment = useCallback(
    async (exp: Experiment) => {
      const copy: Experiment = {
        ...structuredClone(exp),
        id: `exp-${Date.now()}`,
        name: `${exp.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      await saveExperimentToDB(copy);
      await refreshSaved();
    },
    [refreshSaved]
  );

  const renameExperiment = useCallback(
    async (id: string, newName: string) => {
      const target = savedExperimentsRef.current.find((e) => e.id === id);
      if (!target) return;
      const updatedExp = { ...target, name: newName };
      await saveExperimentToDB(updatedExp);
      if (experimentRef.current.id === id) {
        setExperimentRaw((prev) => ({ ...prev, name: newName }));
      }
      await refreshSaved();
    },
    [refreshSaved]
  );

  const applyEducationalPreset = useCallback(
    (preset: EducationalPreset) => {
      const fa = langRef.current === 'fa';
      const title = fa && preset.faTitle ? preset.faTitle : preset.title;
      const snapId = pushUndoSnapshot(fa ? `اعمال «${title}»` : `Apply “${title}”`);

      setExperiment((prev) => ({
        ...prev,
        ...preset.applyPatch,
        signal: preset.applyPatch.signal ? { ...prev.signal, ...preset.applyPatch.signal } : prev.signal,
        noise: preset.applyPatch.noise ? { ...prev.noise, ...preset.applyPatch.noise } : prev.noise,
        filter: preset.applyPatch.filter ? { ...prev.filter, ...preset.applyPatch.filter } : prev.filter,
        modulation: preset.applyPatch.modulation
          ? { ...prev.modulation, ...preset.applyPatch.modulation }
          : prev.modulation,
        eeg: preset.applyPatch.eeg ? { ...prev.eeg, ...preset.applyPatch.eeg } : prev.eeg,
        analysis: preset.applyPatch.analysis
          ? { ...prev.analysis, ...preset.applyPatch.analysis }
          : prev.analysis,
      }));

      if (preset.id === 'preset-ml-cnn') {
        setMlConfig((m) => ({ ...m, architecture: 'cnn1d', task: 'sine-vs-square' }));
      } else if (preset.id === 'preset-ml-autoencoder') {
        setMlConfig((m) => ({ ...m, architecture: 'autoencoder', task: 'clean-vs-noisy' }));
      } else if (preset.id === 'preset-ml-eeg') {
        setMlConfig((m) => ({ ...m, architecture: 'dense', task: 'eeg-band-class' }));
      }

      setActivePage(preset.targetPage);
      showUndoToast(fa ? `سناریوی «${title}» اعمال شد.` : `Preset “${title}” applied.`, snapId);
    },
    [pushUndoSnapshot, setExperiment, showUndoToast]
  );

  const resetExperiment = useCallback(() => {
    const fa = langRef.current === 'fa';
    const snapId = pushUndoSnapshot(fa ? 'بازنشانی به پیش‌فرض' : 'Reset to defaults');
    setExperimentRaw(structuredClone(DEFAULT_EXPERIMENT));
    showUndoToast(
      fa ? 'تنظیمات آزمایشگاه به حالت پیش‌فرض بازنشانی شد.' : 'Lab setup reset to defaults.',
      snapId
    );
  }, [pushUndoSnapshot, showUndoToast]);

  const getShareUrl = useCallback(
    (page?: PageId) => buildShareUrl(experimentRef.current, page ?? activePageRef.current),
    []
  );

  const saveCustomSample = useCallback(async (sample: CustomSample) => {
    await saveSampleToDB(sample);
    const updated = await getAllSamples();
    setCustomSamples(updated);
  }, []);

  const deleteCustomSample = useCallback(async (id: string) => {
    await deleteSampleFromDB(id);
    const updated = await getAllSamples();
    setCustomSamples(updated);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const nyquist = experiment.signal.samplingRate / 2;
  const aliasingFrequencies = useMemo(() => getAliasingFrequencies(experiment), [experiment]);
  const isAliasing = aliasingFrequencies.length > 0;

  // Heavy DSP runs on a deferred copy so slider dragging stays responsive.
  const deferredExperiment = useDeferredValue(experiment);
  const isComputing = deferredExperiment !== experiment;

  // Real-time DSP pipeline computation
  const computed = useMemo(() => {
    const experiment = deferredExperiment;
    const { time, clean } = generateSignal(experiment.signal);
    const { noisy } = applyNoiseToSignal(clean, time, experiment.noise, experiment.randomSeed);
    const filterOut = applyFilter(noisy, experiment.filter, experiment.signal.samplingRate);

    // Evaluate sequential interactive pipeline blocks
    const pipelineStages: { block: PipelineBlock; signal: number[] }[] = [];
    let currentStage = [...clean];

    for (const blk of experiment.processing) {
      if (!blk.enabled) {
        pipelineStages.push({ block: blk, signal: [...currentStage] });
        continue;
      }
      if (blk.type === 'generator') {
        currentStage = [...clean];
      } else if (blk.type === 'noise') {
        const snr = Number(blk.params.snrDb ?? experiment.noise.snrDb);
        currentStage = applyNoiseToSignal(
          currentStage,
          time,
          { ...experiment.noise, enabled: true, snrDb: snr },
          experiment.randomSeed
        ).noisy;
      } else if (blk.type === 'bandpass') {
        const cLow = Number(blk.params.cutoffLow ?? experiment.filter.cutoffLow);
        const cHigh = Number(blk.params.cutoffHigh ?? experiment.filter.cutoffHigh);
        currentStage = applyFilter(
          currentStage,
          {
            enabled: true,
            type: 'bandpass',
            cutoffLow: cLow,
            cutoffHigh: cHigh,
            order: Number(blk.params.order ?? 4),
            qFactor: 0.707,
          },
          experiment.signal.samplingRate
        ).filtered;
      } else if (blk.type === 'notch') {
        const fNotch = Number(blk.params.freq ?? 50);
        currentStage = applyFilter(
          currentStage,
          {
            enabled: true,
            type: 'notch',
            cutoffLow: fNotch,
            cutoffHigh: fNotch + 2,
            order: 4,
            qFactor: 4.0,
          },
          experiment.signal.samplingRate
        ).filtered;
      } else if (blk.type === 'wavelet-denoise') {
        const thresh = Number(blk.params.threshold ?? 0.22);
        const wav = computeWaveletAnalysis(currentStage, 'sym4', 3, thresh, 12);
        currentStage = wav.denoisedSignal.slice(0, currentStage.length);
      } else if (blk.type === 'pca' || blk.type === 'ica') {
        const comps = blk.params.components;
        if (comps !== undefined && Number.isFinite(Number(comps))) {
          // Single-channel PCA/ICA: SSA subspace projection keeping `components` eigen-components.
          currentStage = ssaSubspaceProject(currentStage, Math.min(16, Math.max(1, Number(comps))));
        } else {
          // Legacy fallback: zero-phase smoothing projection approximation on 1D channel
          currentStage = applyFilter(
            currentStage,
            {
              enabled: true,
              type: 'lowpass',
              cutoffLow: experiment.filter.cutoffLow * 1.15,
              cutoffHigh: 50,
              order: 2,
              qFactor: 0.707,
            },
            experiment.signal.samplingRate
          ).filtered;
        }
      } else if (blk.type === 'fft') {
        const blkFft = Number(blk.params.fftSize);
        const spec = computeFFTSpectrum(
          currentStage,
          experiment.signal.samplingRate,
          Number.isFinite(blkFft) && blkFft >= 64
            ? Math.min(4096, blkFft)
            : experiment.analysis.fft.fftSize,
          experiment.analysis.fft.windowType
        );
        currentStage = spec.magnitude;
      }
      pipelineStages.push({ block: blk, signal: [...currentStage] });
    }

    const empiricalSnrDb = calculateSNR(clean, noisy);
    const filteredSnrDb = calculateSNR(clean, filterOut.filtered);

    const spectrum = computeFFTSpectrum(
      noisy,
      experiment.signal.samplingRate,
      experiment.analysis.fft.fftSize,
      experiment.analysis.fft.windowType
    );
    const peaks = findFrequencyPeaks(spectrum.frequencies, spectrum.magnitude, 5);
    const spectrogram = computeSTFTSpectrogram(
      noisy,
      experiment.signal.samplingRate,
      experiment.analysis.fft.stftWindowSize,
      experiment.analysis.fft.stftHopSize,
      experiment.analysis.fft.windowType
    );

    const digSim = simulateDigitalModulation(
      experiment.modulation.digital,
      experiment.randomSeed
    );

    return {
      time,
      cleanSignal: clean,
      noisySignal: noisy,
      filteredSignal: filterOut.filtered,
      residualSignal: filterOut.residual,
      filterFreqAxis: filterOut.freqAxis,
      filterMagResponse: filterOut.magResponse,
      filterMagResponseDb: filterOut.magResponseDb,
      empiricalSnrDb,
      filteredSnrDb,
      currentBer: digSim.ber,
      spectrum,
      peaks,
      spectrogram,
      pipelineStages,
    };
  }, [deferredExperiment]);

  const value = useMemo<LabContextValue>(
    () => ({
      activePage,
      setActivePage,
      darkMode,
      setDarkMode,
      lang,
      setLang,
      experiment,
      setExperiment,
      mlConfig,
      setMlConfig,
      savedExperiments,
      customSamples,
      saveCurrentExperiment,
      loadExperiment,
      deleteExperiment,
      duplicateExperiment,
      renameExperiment,
      applyEducationalPreset,
      saveCustomSample,
      deleteCustomSample,
      nyquist,
      isAliasing,
      aliasingFrequencies,
      isComputing,
      resetExperiment,
      getShareUrl,
      undo,
      canUndo: undoStack.length > 0,
      undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
      restoreSavedExperiment,
      showToast,
      dismissToast,
      computed,
    }),
    [
      activePage,
      darkMode,
      lang,
      experiment,
      setExperiment,
      mlConfig,
      savedExperiments,
      customSamples,
      saveCurrentExperiment,
      loadExperiment,
      deleteExperiment,
      duplicateExperiment,
      renameExperiment,
      applyEducationalPreset,
      saveCustomSample,
      deleteCustomSample,
      nyquist,
      isAliasing,
      aliasingFrequencies,
      isComputing,
      resetExperiment,
      getShareUrl,
      undo,
      undoStack,
      restoreSavedExperiment,
      showToast,
      dismissToast,
      computed,
    ]
  );

  return (
    <LabContext.Provider value={value}>
      {children}
      <ToastViewport lang={lang} />
    </LabContext.Provider>
  );
};

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used inside a LabProvider');
  return ctx;
}

export { useToast } from '../components/feedback/Toast';
export type { ToastOptions, ToastKind } from '../components/feedback/Toast';
export { EDUCATIONAL_PRESETS };
