export type PageId =
  | 'dashboard'
  | 'signal-generator'
  | 'telecommunications'
  | 'eeg-simulator'
  | 'fft-spectrum'
  | 'wavelet-analysis'
  | 'filtering'
  | 'pca'
  | 'ica'
  | 'modulation-ber'
  | 'deep-learning'
  | 'custom-samples'
  | 'experiments'
  | 'documentation';

export type SignalWaveType =
  | 'sine'
  | 'cosine'
  | 'square'
  | 'triangle'
  | 'sawtooth'
  | 'pulse'
  | 'chirp'
  | 'multitone'
  | 'composite';

export interface SignalComponent {
  id: string;
  type: Exclude<SignalWaveType, 'composite'>;
  amplitude: number;
  frequency: number;
  frequencyEnd?: number; // for chirp
  dutyCycle?: number; // for pulse (0.05 to 0.95)
  phase: number; // in degrees
  enabled: boolean;
}

export interface SignalConfig {
  type: SignalWaveType;
  amplitude: number;
  frequency: number;
  frequencyEnd: number;
  dutyCycle: number;
  phase: number;
  samplingRate: number;
  duration: number;
  dcOffset: number;
  components: SignalComponent[];
}

export type NoiseType =
  | 'awgn'
  | 'gaussian'
  | 'uniform'
  | 'impulse'
  | 'burst'
  | 'powerline'
  | 'sinusoidal'
  | 'custom';

export interface NoiseConfig {
  enabled: boolean;
  type: NoiseType;
  snrDb: number;
  amplitude: number;
  variance: number;
  interferenceFreq: number;
  impulseProbability: number;
}

export type FilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'bandstop'
  | 'notch'
  | 'moving-average'
  | 'fir'
  | 'iir';

export interface FilterConfig {
  enabled: boolean;
  type: FilterType;
  cutoffLow: number;
  cutoffHigh: number;
  order: number;
  qFactor: number;
}

export type AnalogModType = 'AM' | 'DSB-SC' | 'SSB' | 'FM' | 'PM';

export interface AnalogModConfig {
  type: AnalogModType;
  messageFreq: number;
  messageAmp: number;
  carrierFreq: number;
  carrierAmp: number;
  modulationIndex: number;
  snrDb: number;
}

export type DigitalModType =
  | 'ASK'
  | 'FSK'
  | 'BPSK'
  | 'QPSK'
  | '8-PSK'
  | '16-QAM'
  | '64-QAM';

export interface DigitalModConfig {
  type: DigitalModType;
  numBits: number;
  symbolRate: number;
  carrierFreq: number;
  snrDb: number;
}

export interface EEGBands {
  delta: { amp: number; freq: number }; // 0.5 - 4 Hz
  theta: { amp: number; freq: number }; // 4 - 8 Hz
  alpha: { amp: number; freq: number }; // 8 - 13 Hz
  beta: { amp: number; freq: number };  // 13 - 30 Hz
  gamma: { amp: number; freq: number }; // 30 - 80 Hz
}

export interface EEGArtifacts {
  eyeBlink: boolean;
  eyeBlinkAmp: number;
  muscleArtifact: boolean;
  muscleAmp: number;
  baselineDrift: boolean;
  driftAmp: number;
  powerline: boolean;
  powerlineAmp: number;
  powerlineFreq: 50 | 60;
  movement: boolean;
  movementAmp: number;
  electrodeNoise: boolean;
  electrodeAmp: number;
}

export interface EEGConfig {
  preset: string;
  samplingRate: number;
  duration: number;
  bands: EEGBands;
  artifacts: EEGArtifacts;
  preprocessHighpass: number;
  preprocessLowpass: number;
  preprocessNotch: boolean;
  preprocessArtifactThreshold: number;
}

export type WindowFunctionType = 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'flattop';

export interface FFTConfig {
  fftSize: 128 | 256 | 512 | 1024 | 2048;
  windowType: WindowFunctionType;
  logScale: boolean;
  maxFreqLimit: number;
  stftWindowSize: 64 | 128 | 256;
  stftHopSize: 16 | 32 | 64;
}

export type WaveletFamily = 'haar' | 'db4' | 'sym4' | 'morlet';

export interface WaveletConfig {
  family: WaveletFamily;
  levels: number;
  denoiseThreshold: number;
  numScales: number;
}

export interface PCAConfig {
  numDimensions: number;
  numComponents: number;
  noiseLevel: number;
  numSamples: number;
  correlationStrength: number;
}

export interface ICAConfig {
  numSources: number;
  mixingMatrix: number[][];
  maxIterations: number;
  tolerance: number;
  noiseStd: number;
}

export type MLArchitectureType = 'dense' | 'cnn1d' | 'autoencoder' | 'rnn';
export type MLTaskType =
  | 'sine-vs-square'
  | 'low-vs-high-freq'
  | 'clean-vs-noisy'
  | 'eeg-band-class'
  | 'modulation-class';

export interface MLConfig {
  architecture: MLArchitectureType;
  task: MLTaskType;
  epochs: number;
  learningRate: number;
  batchSize: number;
  hiddenUnits: number;
  datasetSize: number;
  noiseLevel: number;
}

export type PipelineBlockType =
  | 'generator'
  | 'noise'
  | 'bandpass'
  | 'notch'
  | 'ica'
  | 'pca'
  | 'wavelet-denoise'
  | 'fft';

export interface PipelineBlock {
  id: string;
  type: PipelineBlockType;
  name: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

export interface CustomSample {
  id: string;
  name: string;
  createdAt: string;
  signalType: SignalWaveType;
  samplingRate: number;
  duration: number;
  channels: number;
  frequency: number;
  amplitude: number;
  phase: number;
  noiseType: NoiseType;
  noiseSnrDb: number;
  modulation: DigitalModType | AnalogModType | 'None';
  artifacts: string[];
  pipeline: PipelineBlock[];
  previewData: number[];
}

export interface Experiment {
  id: string;
  name: string;
  category?: 'Telecommunications' | 'Signal Processing' | 'EEG' | 'Machine Learning' | 'Custom';
  description?: string;
  createdAt: string;
  randomSeed: number;
  signal: SignalConfig;
  noise: NoiseConfig;
  filter: FilterConfig;
  processing: PipelineBlock[];
  modulation: {
    analog: AnalogModConfig;
    digital: DigitalModConfig;
  };
  eeg: EEGConfig;
  analysis: {
    fft: FFTConfig;
    wavelet: WaveletConfig;
    pca: PCAConfig;
    ica: ICAConfig;
  };
}
