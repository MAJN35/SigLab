import React from 'react';
import type { PageId } from '../../types';

/**
 * Route-level code splitting. Each page lives in its own chunk so heavy
 * dependencies (TensorFlow.js, Babylon.js, KaTeX) are only fetched when needed.
 * Loaders are exposed so navigation can prefetch a chunk on hover/focus.
 */
type PageModuleLoader = () => Promise<{ default: React.ComponentType }>;

export const PAGE_LOADERS: Record<PageId, PageModuleLoader> = {
  dashboard: () => import('../../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
  'audio-lab': () =>
    import('../../pages/AudioSpectrogramPage').then((m) => ({ default: m.AudioSpectrogramPage })),
  'dna-simulator': () =>
    import('../../pages/DNASimulatorPage').then((m) => ({ default: m.DNASimulatorPage })),
  'signal-generator': () =>
    import('../../pages/SignalGeneratorPage').then((m) => ({ default: m.SignalGeneratorPage })),
  telecommunications: () =>
    import('../../pages/TelecommunicationsPage').then((m) => ({
      default: m.TelecommunicationsPage,
    })),
  'eeg-simulator': () =>
    import('../../pages/EEGSimulatorPage').then((m) => ({ default: m.EEGSimulatorPage })),
  'fft-spectrum': () =>
    import('../../pages/FFTSpectrumPage').then((m) => ({ default: m.FFTSpectrumPage })),
  'wavelet-analysis': () =>
    import('../../pages/WaveletPage').then((m) => ({ default: m.WaveletPage })),
  filtering: () => import('../../pages/FilteringPage').then((m) => ({ default: m.FilteringPage })),
  pca: () => import('../../pages/PCAPage').then((m) => ({ default: m.PCAPage })),
  ica: () => import('../../pages/ICAPage').then((m) => ({ default: m.ICAPage })),
  'modulation-ber': () =>
    import('../../pages/ModulationBERPage').then((m) => ({ default: m.ModulationBERPage })),
  'deep-learning': () =>
    import('../../pages/DeepLearningPage').then((m) => ({ default: m.DeepLearningPage })),
  'custom-samples': () =>
    import('../../pages/CustomSamplesPage').then((m) => ({ default: m.CustomSamplesPage })),
  experiments: () =>
    import('../../pages/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage })),
  documentation: () =>
    import('../../pages/DocumentationPage').then((m) => ({ default: m.DocumentationPage })),
};

export const LAZY_PAGES = Object.fromEntries(
  Object.entries(PAGE_LOADERS).map(([id, loader]) => [id, React.lazy(loader)])
) as Record<PageId, React.LazyExoticComponent<React.ComponentType>>;

const prefetched = new Set<PageId>();

/** Warm a page chunk (e.g. on hover/focus of a nav link). Safe to call repeatedly. */
export function prefetchPage(id: PageId): void {
  if (prefetched.has(id)) return;
  prefetched.add(id);
  PAGE_LOADERS[id]().catch(() => prefetched.delete(id));
}
