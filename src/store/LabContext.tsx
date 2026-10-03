import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
import { DEFAULT_EXPERIMENT, EDUCATIONAL_PRESETS, EducationalPreset } from './presets';

interface LabContextValue {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  experiment: Experiment;
  setExperiment: React.Dispatch<React.SetStateAction<Experiment>>;
  mlConfig: MLConfig;
  setMlConfig: React.Dispatch<React.SetStateAction<MLConfig>>;
  savedExperiments: Experiment[];
  customSamples: CustomSample[];
  saveCurrentExperiment: (customName?: string) => Promise<void>;
  loadExperiment: (exp: Experiment) => void;
  deleteExperiment: (id: string) => Promise<void>;
  duplicateExperiment: (exp: Experiment) => Promise<void>;
  renameExperiment: (id: string, newName: string) => Promise<void>;
  applyEducationalPreset: (preset: EducationalPreset) => void;
  saveCustomSample: (sample: CustomSample) => Promise<void>;
  deleteCustomSample: (id: string) => Promise<void>;
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

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePage] = useState<PageId>(() => {
    const hash = window.location.hash.replace('#/', '') as PageId;
    const validPages: PageId[] = [
      'dashboard',
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
    return validPages.includes(hash) ? hash : 'dashboard';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('signallab_dark_mode');
    return saved ? saved === 'true' : true;
  });

  const [experiment, setExperiment] = useState<Experiment>(DEFAULT_EXPERIMENT);
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

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('signallab_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    window.location.hash = `#/${activePage}`;
  }, [activePage]);

  useEffect(() => {
    getAllExperiments().then((exps) => {
      if (exps.length === 0) {
        saveExperimentToDB(DEFAULT_EXPERIMENT).then(() => {
          setSavedExperiments([DEFAULT_EXPERIMENT]);
        });
      } else {
        setSavedExperiments(exps);
      }
    });
    getAllSamples().then((samps) => {
      if (samps.length === 0) {
        Promise.all(INITIAL_SAMPLES.map((s) => saveSampleToDB(s))).then(() => {
          setCustomSamples(INITIAL_SAMPLES);
        });
      } else {
        setCustomSamples(samps);
      }
    });
  }, []);

  const saveCurrentExperiment = async (customName?: string) => {
    const expToSave: Experiment = {
      ...experiment,
      id: customName ? `exp-${Date.now()}` : experiment.id,
      name: customName || experiment.name,
      createdAt: new Date().toISOString(),
    };
    await saveExperimentToDB(expToSave);
    setExperiment(expToSave);
    const updated = await getAllExperiments();
    setSavedExperiments(updated);
  };

  const loadExperiment = (exp: Experiment) => {
    setExperiment(structuredClone(exp));
  };

  const deleteExperiment = async (id: string) => {
    await deleteExperimentFromDB(id);
    const updated = await getAllExperiments();
    setSavedExperiments(updated);
  };

  const duplicateExperiment = async (exp: Experiment) => {
    const copy: Experiment = {
      ...structuredClone(exp),
      id: `exp-${Date.now()}`,
      name: `${exp.name} (Copy)`,
      createdAt: new Date().toISOString(),
    };
    await saveExperimentToDB(copy);
    const updated = await getAllExperiments();
    setSavedExperiments(updated);
  };

  const renameExperiment = async (id: string, newName: string) => {
    const target = savedExperiments.find((e) => e.id === id);
    if (!target) return;
    const updatedExp = { ...target, name: newName };
    await saveExperimentToDB(updatedExp);
    if (experiment.id === id) {
      setExperiment(updatedExp);
    }
    const updated = await getAllExperiments();
    setSavedExperiments(updated);
  };

  const applyEducationalPreset = (preset: EducationalPreset) => {
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
  };

  const saveCustomSample = async (sample: CustomSample) => {
    await saveSampleToDB(sample);
    const updated = await getAllSamples();
    setCustomSamples(updated);
  };

  const deleteCustomSample = async (id: string) => {
    await deleteSampleFromDB(id);
    const updated = await getAllSamples();
    setCustomSamples(updated);
  };

  // Real-time DSP pipeline computation
  const computed = useMemo(() => {
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
        // Zero-phase smoothing projection approximation on 1D channel
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
      } else if (blk.type === 'fft') {
        const spec = computeFFTSpectrum(
          currentStage,
          experiment.signal.samplingRate,
          experiment.analysis.fft.fftSize,
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
  }, [experiment]);

  return (
    <LabContext.Provider
      value={{
        activePage,
        setActivePage,
        darkMode,
        setDarkMode,
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
        computed,
      }}
    >
      {children}
    </LabContext.Provider>
  );
};

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used inside a LabProvider');
  return ctx;
}

export { EDUCATIONAL_PRESETS };
