import { Experiment, PageId } from '../types';

export interface EducationalPreset {
  id: string;
  title: string;
  category: 'Telecommunications' | 'Signal Processing' | 'EEG' | 'Machine Learning';
  targetPage: PageId;
  description: string;
  applyPatch: Partial<Experiment>;
}

export const DEFAULT_EXPERIMENT: Experiment = {
  id: 'default-lab-exp',
  name: 'Multi-Harmonic Telemetry & Filtering Baseline',
  category: 'Signal Processing',
  description:
    'Composite 5 Hz + 18 Hz sinusoidal signal corrupted by AWGN noise and restored using a 4th-order Butterworth Low-pass filter.',
  createdAt: '2026-10-03T12:00:00.000Z',
  randomSeed: 12345,
  signal: {
    type: 'composite',
    amplitude: 1.5,
    frequency: 5,
    frequencyEnd: 25,
    dutyCycle: 0.3,
    phase: 0,
    samplingRate: 256,
    duration: 2.0,
    dcOffset: 0,
    components: [
      {
        id: 'c1',
        type: 'sine',
        amplitude: 1.4,
        frequency: 5,
        phase: 0,
        enabled: true,
      },
      {
        id: 'c2',
        type: 'cosine',
        amplitude: 0.65,
        frequency: 18,
        phase: 30,
        enabled: true,
      },
      {
        id: 'c3',
        type: 'sine',
        amplitude: 0.35,
        frequency: 42,
        phase: 0,
        enabled: false,
      },
    ],
  },
  noise: {
    enabled: true,
    type: 'awgn',
    snrDb: 12,
    amplitude: 0.35,
    variance: 0.25,
    interferenceFreq: 50,
    impulseProbability: 0.03,
  },
  filter: {
    enabled: true,
    type: 'lowpass',
    cutoffLow: 25,
    cutoffHigh: 45,
    order: 4,
    qFactor: 0.707,
  },
  processing: [
    {
      id: 'blk-1',
      type: 'generator',
      name: 'Signal Generator',
      enabled: true,
      params: { waveform: 'Composite (5Hz + 18Hz)', fs: 256 },
    },
    {
      id: 'blk-2',
      type: 'noise',
      name: 'AWGN Channel',
      enabled: true,
      params: { snrDb: 12, type: 'awgn' },
    },
    {
      id: 'blk-3',
      type: 'bandpass',
      name: 'Low-Pass / Band-Pass Filter',
      enabled: true,
      params: { cutoffLow: 1, cutoffHigh: 25, order: 4 },
    },
    {
      id: 'blk-4',
      type: 'wavelet-denoise',
      name: 'Wavelet Soft Denoiser',
      enabled: false,
      params: { family: 'sym4', threshold: 0.2 },
    },
    {
      id: 'blk-5',
      type: 'fft',
      name: 'FFT Spectral Analyzer',
      enabled: true,
      params: { fftSize: 512, window: 'hann' },
    },
  ],
  modulation: {
    analog: {
      type: 'AM',
      messageFreq: 6,
      messageAmp: 1.0,
      carrierFreq: 60,
      carrierAmp: 1.5,
      modulationIndex: 0.75,
      snrDb: 16,
    },
    digital: {
      type: 'QPSK',
      numBits: 256,
      symbolRate: 32,
      carrierFreq: 64,
      snrDb: 10,
    },
  },
  eeg: {
    preset: 'resting',
    samplingRate: 256,
    duration: 3.5,
    bands: {
      delta: { amp: 15, freq: 2.2 },
      theta: { amp: 18, freq: 6.0 },
      alpha: { amp: 38, freq: 10.2 },
      beta: { amp: 14, freq: 20.0 },
      gamma: { amp: 5, freq: 42.0 },
    },
    artifacts: {
      eyeBlink: true,
      eyeBlinkAmp: 85,
      muscleArtifact: false,
      muscleAmp: 30,
      baselineDrift: true,
      driftAmp: 40,
      powerline: true,
      powerlineAmp: 18,
      powerlineFreq: 50,
      movement: false,
      movementAmp: 65,
      electrodeNoise: false,
      electrodeAmp: 22,
    },
    preprocessHighpass: 0.8,
    preprocessLowpass: 35,
    preprocessNotch: true,
    preprocessArtifactThreshold: 65,
  },
  analysis: {
    fft: {
      fftSize: 512,
      windowType: 'hann',
      logScale: false,
      maxFreqLimit: 128,
      stftWindowSize: 128,
      stftHopSize: 32,
    },
    wavelet: {
      family: 'db4',
      levels: 4,
      denoiseThreshold: 0.22,
      numScales: 24,
    },
    pca: {
      numDimensions: 5,
      numComponents: 2,
      noiseLevel: 0.28,
      numSamples: 200,
      correlationStrength: 0.75,
    },
    ica: {
      numSources: 4,
      mixingMatrix: [
        [0.85, 0.42, -0.25, 0.15],
        [-0.35, 0.78, 0.45, -0.2],
        [0.22, -0.48, 0.82, 0.32],
        [0.4, 0.18, -0.35, 0.88],
      ],
      maxIterations: 120,
      tolerance: 1e-5,
      noiseStd: 0.03,
    },
  },
};

export const EDUCATIONAL_PRESETS: EducationalPreset[] = [
  // Telecommunications
  {
    id: 'preset-am-noise',
    title: 'AM with Noise',
    category: 'Telecommunications',
    targetPage: 'telecommunications',
    description:
      'Double-sideband Amplitude Modulation with 80% modulation index transmitted across an AWGN channel (SNR = 11 dB) and recovered via envelope detection.',
    applyPatch: {
      name: 'AM Envelope Modulation under AWGN',
      modulation: {
        ...DEFAULT_EXPERIMENT.modulation,
        analog: {
          type: 'AM',
          messageFreq: 5,
          messageAmp: 1.0,
          carrierFreq: 65,
          carrierAmp: 1.5,
          modulationIndex: 0.8,
          snrDb: 11,
        },
      },
    },
  },
  {
    id: 'preset-fm-noise',
    title: 'FM with Noise',
    category: 'Telecommunications',
    targetPage: 'telecommunications',
    description:
      'Wideband Frequency Modulation (modulation index β = 2.4) demonstrating constant-envelope immunity against amplitude fluctuations.',
    applyPatch: {
      name: 'Wideband FM Noise Immunity',
      modulation: {
        ...DEFAULT_EXPERIMENT.modulation,
        analog: {
          type: 'FM',
          messageFreq: 5,
          messageAmp: 1.0,
          carrierFreq: 75,
          carrierAmp: 1.5,
          modulationIndex: 2.4,
          snrDb: 13,
        },
      },
    },
  },
  {
    id: 'preset-bpsk-ber',
    title: 'BPSK BER Experiment',
    category: 'Telecommunications',
    targetPage: 'modulation-ber',
    description:
      'Antipodal Binary Phase Shift Keying (BPSK) evaluated at Eb/N0 = 6 dB with theoretical Q-function benchmark comparison.',
    applyPatch: {
      name: 'BPSK Antipodal Signaling & BER',
      modulation: {
        ...DEFAULT_EXPERIMENT.modulation,
        digital: {
          type: 'BPSK',
          numBits: 512,
          symbolRate: 32,
          carrierFreq: 64,
          snrDb: 6,
        },
      },
    },
  },
  {
    id: 'preset-qpsk-vs-bpsk',
    title: 'QPSK vs BPSK',
    category: 'Telecommunications',
    targetPage: 'modulation-ber',
    description:
      'Quadrature Phase Shift Keying doubling spectral efficiency (2 bits/symbol) while maintaining identical Eb/N0 bit error probability to BPSK.',
    applyPatch: {
      name: 'QPSK vs BPSK Spectral Efficiency',
      modulation: {
        ...DEFAULT_EXPERIMENT.modulation,
        digital: {
          type: 'QPSK',
          numBits: 512,
          symbolRate: 32,
          carrierFreq: 64,
          snrDb: 8,
        },
      },
    },
  },
  {
    id: 'preset-16qam-vs-64qam',
    title: '16-QAM vs 64-QAM',
    category: 'Telecommunications',
    targetPage: 'modulation-ber',
    description:
      'High-order Quadrature Amplitude Modulation comparison highlighting Euclidean minimum-distance crowding at 4 vs 6 bits/symbol.',
    applyPatch: {
      name: '16-QAM vs 64-QAM High-Order Constellation',
      modulation: {
        ...DEFAULT_EXPERIMENT.modulation,
        digital: {
          type: '16-QAM',
          numBits: 512,
          symbolRate: 32,
          carrierFreq: 64,
          snrDb: 14,
        },
      },
    },
  },
  {
    id: 'preset-constellation-noise',
    title: 'Constellation under Noise',
    category: 'Telecommunications',
    targetPage: 'modulation-ber',
    description:
      '64-QAM IQ symbol clouds under severe AWGN (Eb/N0 = 11 dB) demonstrating Gray-coded decision boundary crossings.',
    applyPatch: {
      name: '64-QAM Constellation Cloud under AWGN',
      modulation: {
        ...DEFAULT_EXPERIMENT.modulation,
        digital: {
          type: '64-QAM',
          numBits: 768,
          symbolRate: 32,
          carrierFreq: 64,
          snrDb: 11,
        },
      },
    },
  },

  // Signal Processing
  {
    id: 'preset-fft-detection',
    title: 'FFT Frequency Detection',
    category: 'Signal Processing',
    targetPage: 'fft-spectrum',
    description:
      'Three-tone composite waveform (7 Hz, 24 Hz, 58 Hz) buried in noise, resolved into sharp spectral peaks using a 1024-point Blackman window FFT.',
    applyPatch: {
      name: 'Multi-Tone FFT Spectral Peak Detection',
      signal: {
        ...DEFAULT_EXPERIMENT.signal,
        type: 'composite',
        samplingRate: 256,
        duration: 2.0,
        components: [
          { id: 'f1', type: 'sine', amplitude: 1.5, frequency: 7, phase: 0, enabled: true },
          { id: 'f2', type: 'cosine', amplitude: 0.9, frequency: 24, phase: 45, enabled: true },
          { id: 'f3', type: 'sine', amplitude: 0.55, frequency: 58, phase: 90, enabled: true },
        ],
      },
      analysis: {
        ...DEFAULT_EXPERIMENT.analysis,
        fft: {
          fftSize: 1024,
          windowType: 'blackman',
          logScale: false,
          maxFreqLimit: 100,
          stftWindowSize: 128,
          stftHopSize: 32,
        },
      },
    },
  },
  {
    id: 'preset-sampling-aliasing',
    title: 'Sampling and Aliasing',
    category: 'Signal Processing',
    targetPage: 'signal-generator',
    description:
      'High-frequency 52 Hz sinusoid sampled near the Nyquist limit (fs = 64 Hz), illustrating spectral folding and apparent 12 Hz alias wave.',
    applyPatch: {
      name: 'Nyquist Sampling Theorem & Aliasing',
      signal: {
        ...DEFAULT_EXPERIMENT.signal,
        type: 'sine',
        amplitude: 1.6,
        frequency: 52,
        samplingRate: 64,
        duration: 2.0,
      },
      noise: {
        ...DEFAULT_EXPERIMENT.noise,
        enabled: false,
      },
    },
  },
  {
    id: 'preset-noisy-filtering',
    title: 'Noisy Signal Filtering',
    category: 'Signal Processing',
    targetPage: 'filtering',
    description:
      '6 Hz fundamental signal corrupted by 50 Hz power-line interference, cleaned via a sharp 6th-order low-pass / notch filter.',
    applyPatch: {
      name: '50 Hz Power-Line Hum Rejection',
      signal: {
        ...DEFAULT_EXPERIMENT.signal,
        type: 'sine',
        amplitude: 1.5,
        frequency: 6,
        samplingRate: 256,
        duration: 2.0,
      },
      noise: {
        ...DEFAULT_EXPERIMENT.noise,
        enabled: true,
        type: 'powerline',
        snrDb: 5,
        amplitude: 0.75,
        interferenceFreq: 50,
      },
      filter: {
        enabled: true,
        type: 'lowpass',
        cutoffLow: 16,
        cutoffHigh: 40,
        order: 6,
        qFactor: 0.707,
      },
    },
  },
  {
    id: 'preset-wavelet-analysis',
    title: 'Wavelet Analysis',
    category: 'Signal Processing',
    targetPage: 'wavelet-analysis',
    description:
      'Linear frequency-swept chirp (4 Hz to 48 Hz) decomposed with Daubechies D4 wavelets and Morlet time-frequency scalogram.',
    applyPatch: {
      name: 'Non-Stationary Chirp Wavelet Scalogram',
      signal: {
        ...DEFAULT_EXPERIMENT.signal,
        type: 'chirp',
        amplitude: 1.5,
        frequency: 4,
        frequencyEnd: 48,
        samplingRate: 256,
        duration: 2.0,
      },
      analysis: {
        ...DEFAULT_EXPERIMENT.analysis,
        wavelet: {
          family: 'db4',
          levels: 4,
          denoiseThreshold: 0.2,
          numScales: 28,
        },
      },
    },
  },

  // EEG
  {
    id: 'preset-eeg-alpha',
    title: 'Synthetic Alpha Rhythm',
    category: 'EEG',
    targetPage: 'eeg-simulator',
    description:
      'Synthetic 10 Hz occipital alpha rhythm spindles simulating eyes-closed relaxed wakefulness (Synthetic educational model only).',
    applyPatch: {
      name: 'Synthetic Occipital Alpha Rhythm (10 Hz)',
      eeg: {
        ...DEFAULT_EXPERIMENT.eeg,
        preset: 'alpha-dominant',
        bands: {
          delta: { amp: 10, freq: 2.0 },
          theta: { amp: 12, freq: 5.5 },
          alpha: { amp: 68, freq: 10.0 },
          beta: { amp: 10, freq: 18.5 },
          gamma: { amp: 4, freq: 40.0 },
        },
      },
    },
  },
  {
    id: 'preset-eeg-artifact',
    title: 'EEG Artifact Simulation',
    category: 'EEG',
    targetPage: 'eeg-simulator',
    description:
      'Simulates ocular eye-blink deflections, high-frequency cranial EMG bursts, and 50 Hz mains interference with automated preprocessing recovery.',
    applyPatch: {
      name: 'EEG Ocular & EMG Artifact Removal',
      eeg: {
        ...DEFAULT_EXPERIMENT.eeg,
        preset: 'high-noise',
        artifacts: {
          eyeBlink: true,
          eyeBlinkAmp: 95,
          muscleArtifact: true,
          muscleAmp: 38,
          baselineDrift: true,
          driftAmp: 45,
          powerline: true,
          powerlineAmp: 22,
          powerlineFreq: 50,
          movement: true,
          movementAmp: 60,
          electrodeNoise: false,
          electrodeAmp: 15,
        },
      },
    },
  },
  {
    id: 'preset-eeg-bandpass',
    title: 'EEG Band-Pass Filtering',
    category: 'EEG',
    targetPage: 'filtering',
    description:
      'Isolates the 8–13 Hz Alpha band from a multi-band composite waveform using a 4th-order Butterworth Band-Pass filter.',
    applyPatch: {
      name: '8–13 Hz Alpha Band-Pass Extraction',
      signal: {
        ...DEFAULT_EXPERIMENT.signal,
        type: 'composite',
        components: [
          { id: 'e1', type: 'sine', amplitude: 1.2, frequency: 2.5, phase: 0, enabled: true },
          { id: 'e2', type: 'sine', amplitude: 1.8, frequency: 10.5, phase: 20, enabled: true },
          { id: 'e3', type: 'cosine', amplitude: 1.0, frequency: 24.0, phase: 60, enabled: true },
        ],
      },
      filter: {
        enabled: true,
        type: 'bandpass',
        cutoffLow: 8,
        cutoffHigh: 13,
        order: 4,
        qFactor: 0.9,
      },
    },
  },
  {
    id: 'preset-ica-separation',
    title: 'ICA Artifact Separation',
    category: 'EEG',
    targetPage: 'ica',
    description:
      'Separates 4 linearly mixed independent sources (Sine, Square, Sawtooth, and Transient EEG Spike) using FastICA fixed-point negentropy maximization.',
    applyPatch: {
      name: 'FastICA Blind Source & Artifact Separation',
      analysis: {
        ...DEFAULT_EXPERIMENT.analysis,
        ica: {
          ...DEFAULT_EXPERIMENT.analysis.ica,
          numSources: 4,
          noiseStd: 0.02,
        },
      },
    },
  },
  {
    id: 'preset-pca-reduction',
    title: 'PCA Dimensionality Reduction',
    category: 'EEG',
    targetPage: 'pca',
    description:
      'Projects 6-channel correlated oscillatory sensor arrays onto the top 2 orthogonal Principal Components, capturing >85% variance.',
    applyPatch: {
      name: '6-Channel Sensor Array PCA Compression',
      analysis: {
        ...DEFAULT_EXPERIMENT.analysis,
        pca: {
          numDimensions: 6,
          numComponents: 2,
          noiseLevel: 0.22,
          numSamples: 240,
          correlationStrength: 0.82,
        },
      },
    },
  },

  // Machine Learning
  {
    id: 'preset-ml-cnn',
    title: 'CNN Signal Classification',
    category: 'Machine Learning',
    targetPage: 'deep-learning',
    description:
      'Trains a 1D Convolutional Neural Network in TensorFlow.js to classify noisy Sine vs. Square waveforms directly in the browser.',
    applyPatch: {
      name: '1D-CNN Waveform Classifier',
    },
  },
  {
    id: 'preset-ml-autoencoder',
    title: 'Autoencoder Denoising',
    category: 'Machine Learning',
    targetPage: 'deep-learning',
    description:
      'Trains a bottleneck Autoencoder neural network to reconstruct clean sinusoidal waveforms from noise-corrupted observations.',
    applyPatch: {
      name: 'Neural Autoencoder Signal Denoiser',
    },
  },
  {
    id: 'preset-ml-eeg',
    title: 'Synthetic EEG Classification',
    category: 'Machine Learning',
    targetPage: 'deep-learning',
    description:
      'Classifies Delta (2 Hz), Alpha (10 Hz), and Beta (21 Hz) synthetic EEG epochs using an in-browser neural network.',
    applyPatch: {
      name: 'Synthetic EEG Band Neural Classifier',
    },
  },
];
