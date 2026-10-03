import { EEGConfig } from '../../types';
import { createPRNG } from '../../utils/math';
import { applyFilter } from '../filters';

export interface EEGSimulationResult {
  time: number[];
  cleanEEG: number[];
  artifactSignal: number[];
  noisyEEG: number[];
  recoveredEEG: number[];
  bandContributions: {
    delta: number[];
    theta: number[];
    alpha: number[];
    beta: number[];
    gamma: number[];
  };
}

export const EEG_PRESETS: Record<
  string,
  {
    label: string;
    description: string;
    bands: EEGConfig['bands'];
    artifacts: Partial<EEGConfig['artifacts']>;
  }
> = {
  resting: {
    label: 'Resting-like EEG',
    description: 'Balanced occipital alpha and moderate theta/beta physiological baseline.',
    bands: {
      delta: { amp: 15, freq: 2.2 },
      theta: { amp: 18, freq: 6.0 },
      alpha: { amp: 38, freq: 10.2 },
      beta: { amp: 14, freq: 20.0 },
      gamma: { amp: 5, freq: 42.0 },
    },
    artifacts: {
      eyeBlink: true,
      muscleArtifact: false,
      baselineDrift: true,
      powerline: false,
      movement: false,
      electrodeNoise: false,
    },
  },
  'alpha-dominant': {
    label: 'Alpha Dominant (Eyes Closed)',
    description: 'Strong 10 Hz synchronized alpha spindles typical of relaxed wakefulness.',
    bands: {
      delta: { amp: 10, freq: 2.0 },
      theta: { amp: 12, freq: 5.5 },
      alpha: { amp: 68, freq: 10.0 },
      beta: { amp: 10, freq: 18.5 },
      gamma: { amp: 4, freq: 40.0 },
    },
    artifacts: {
      eyeBlink: false,
      muscleArtifact: false,
      baselineDrift: false,
      powerline: false,
      movement: false,
      electrodeNoise: false,
    },
  },
  'high-beta': {
    label: 'High Beta (Active Cognitive)',
    description: 'Elevated 18–26 Hz beta and gamma activity with attenuated alpha rhythm.',
    bands: {
      delta: { amp: 8, freq: 2.5 },
      theta: { amp: 14, freq: 6.5 },
      alpha: { amp: 15, freq: 11.0 },
      beta: { amp: 52, freq: 22.5 },
      gamma: { amp: 18, freq: 45.0 },
    },
    artifacts: {
      eyeBlink: true,
      muscleArtifact: true,
      baselineDrift: false,
      powerline: false,
      movement: false,
      electrodeNoise: false,
    },
  },
  'high-noise': {
    label: 'High Artifact Contamination',
    description: 'Synthetic EEG heavily corrupted by eye blinks, EMG bursts, 50Hz hum, and baseline drift.',
    bands: {
      delta: { amp: 18, freq: 2.2 },
      theta: { amp: 20, freq: 6.0 },
      alpha: { amp: 32, freq: 10.5 },
      beta: { amp: 18, freq: 21.0 },
      gamma: { amp: 8, freq: 40.0 },
    },
    artifacts: {
      eyeBlink: true,
      muscleArtifact: true,
      baselineDrift: true,
      powerline: true,
      movement: true,
      electrodeNoise: true,
    },
  },
  'multi-band': {
    label: 'Multi-band Composite Rhythm',
    description: 'Simultaneous Delta, Theta, Alpha, Beta, and Gamma oscillations for spectral decomposition.',
    bands: {
      delta: { amp: 35, freq: 2.0 },
      theta: { amp: 30, freq: 6.0 },
      alpha: { amp: 35, freq: 10.5 },
      beta: { amp: 28, freq: 21.0 },
      gamma: { amp: 20, freq: 44.0 },
    },
    artifacts: {
      eyeBlink: false,
      muscleArtifact: false,
      baselineDrift: true,
      powerline: true,
      movement: false,
      electrodeNoise: false,
    },
  },
};

export function simulateSyntheticEEG(config: EEGConfig, seed = 12345): EEGSimulationResult {
  const rng = createPRNG(seed);
  const fs = config.samplingRate;
  const N = Math.min(4096, Math.max(128, Math.round(fs * config.duration)));
  const dt = 1 / fs;

  const time = new Array<number>(N);
  const cleanEEG = new Array<number>(N);
  const artifactSignal = new Array<number>(N);
  const noisyEEG = new Array<number>(N);

  const deltaArr = new Array<number>(N);
  const thetaArr = new Array<number>(N);
  const alphaArr = new Array<number>(N);
  const betaArr = new Array<number>(N);
  const gammaArr = new Array<number>(N);

  const b = config.bands;
  const a = config.artifacts;

  for (let i = 0; i < N; i++) {
    const t = i * dt;
    time[i] = t;

    // Realistic spindle envelope modulation for brain rhythms
    const alphaSpindle = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.45 * t);
    const betaMod = 0.75 + 0.25 * Math.cos(2 * Math.PI * 0.8 * t);

    const dVal =
      b.delta.amp *
      (0.75 * Math.sin(2 * Math.PI * b.delta.freq * t + 0.3) +
        0.25 * Math.sin(2 * Math.PI * (b.delta.freq * 1.35) * t));
    const tVal =
      b.theta.amp *
      (0.7 * Math.sin(2 * Math.PI * b.theta.freq * t + 1.1) +
        0.3 * Math.cos(2 * Math.PI * (b.theta.freq * 1.18) * t));
    const aVal =
      b.alpha.amp *
      alphaSpindle *
      (0.8 * Math.sin(2 * Math.PI * b.alpha.freq * t) +
        0.2 * Math.sin(2 * Math.PI * (b.alpha.freq * 0.94) * t + 0.7));
    const bVal =
      b.beta.amp *
      betaMod *
      (0.65 * Math.sin(2 * Math.PI * b.beta.freq * t + 0.5) +
        0.35 * Math.sin(2 * Math.PI * (b.beta.freq * 1.24) * t));
    const gVal =
      b.gamma.amp *
      (0.6 * Math.sin(2 * Math.PI * b.gamma.freq * t) +
        0.4 * Math.cos(2 * Math.PI * (b.gamma.freq * 1.15) * t));

    deltaArr[i] = dVal;
    thetaArr[i] = tVal;
    alphaArr[i] = aVal;
    betaArr[i] = bVal;
    gammaArr[i] = gVal;

    // Subtle 1/f background pink-like cortical micro-fluctuation
    const bgCortical = 2.0 * rng.nextGaussian();
    cleanEEG[i] = dVal + tVal + aVal + bVal + gVal + bgCortical;

    // Physiological & Instrumental Artifacts
    let art = 0;

    // 1. Eye blink (EOG): large biphasic/Gaussian slow deflection at t=0.8s and t=2.4s
    if (a.eyeBlink) {
      const blink1 = Math.exp(-Math.pow((t - 0.75) / 0.11, 2));
      const blink2 = Math.exp(-Math.pow((t - 2.25) / 0.13, 2));
      art += a.eyeBlinkAmp * (blink1 + 0.85 * blink2);
    }

    // 2. Muscle artifact (EMG): high-frequency 45-95 Hz burst around t=1.3s..1.8s
    if (a.muscleArtifact) {
      const emgWindow = t >= 1.2 && t <= 1.85 ? Math.sin(Math.PI * ((t - 1.2) / 0.65)) : 0;
      art +=
        emgWindow *
        a.muscleAmp *
        (0.6 * Math.sin(2 * Math.PI * 68 * t) + 0.7 * rng.nextGaussian());
    }

    // 3. Baseline drift: ultra-low frequency 0.25 Hz respiration/sweat potential
    if (a.baselineDrift) {
      art += a.driftAmp * Math.sin(2 * Math.PI * 0.28 * t + 0.4);
    }

    // 4. Power-line interference (50 or 60 Hz sinusoidal hum)
    if (a.powerline) {
      art += a.powerlineAmp * Math.sin(2 * Math.PI * a.powerlineFreq * t);
    }

    // 5. Movement artifact: transient large sway around t=2.8s
    if (a.movement) {
      const movEnv = Math.exp(-Math.pow((t - 2.8) / 0.25, 2));
      art += a.movementAmp * movEnv * Math.sin(2 * Math.PI * 2.2 * (t - 2.8));
    }

    // 6. Electrode pop / thermal noise
    if (a.electrodeNoise) {
      const pop = Math.abs(t - 1.55) < 0.02 ? a.electrodeAmp * 3.0 : 0;
      art += pop + a.electrodeAmp * 0.35 * rng.nextGaussian();
    }

    artifactSignal[i] = art;
    noisyEEG[i] = cleanEEG[i] + art;
  }

  // Preprocessing Pipeline:
  // Step 1: High-pass filter to remove baseline drift
  let stage = applyFilter(
    noisyEEG,
    {
      enabled: true,
      type: 'highpass',
      cutoffLow: Math.max(0.2, config.preprocessHighpass),
      cutoffHigh: 45,
      order: 4,
      qFactor: 0.707,
    },
    fs
  ).filtered;

  // Step 2: Optional 50/60 Hz Notch filter
  if (config.preprocessNotch) {
    stage = applyFilter(
      stage,
      {
        enabled: true,
        type: 'notch',
        cutoffLow: config.artifacts.powerlineFreq,
        cutoffHigh: config.artifacts.powerlineFreq + 2,
        order: 4,
        qFactor: 4.0,
      },
      fs
    ).filtered;
  }

  // Step 3: Low-pass filter to attenuate high-frequency EMG/electrode noise
  stage = applyFilter(
    stage,
    {
      enabled: true,
      type: 'lowpass',
      cutoffLow: config.preprocessLowpass,
      cutoffHigh: config.preprocessLowpass + 10,
      order: 4,
      qFactor: 0.707,
    },
    fs
  ).filtered;

  // Step 4: Ocular/Movement transient artifact soft-attenuation threshold
  const thresh = Math.max(25, config.preprocessArtifactThreshold);
  const recoveredEEG = stage.map((val) => {
    if (Math.abs(val) <= thresh) return val;
    return Math.sign(val) * (thresh + 0.2 * (Math.abs(val) - thresh));
  });

  return {
    time,
    cleanEEG,
    artifactSignal,
    noisyEEG,
    recoveredEEG,
    bandContributions: {
      delta: deltaArr,
      theta: thetaArr,
      alpha: alphaArr,
      beta: betaArr,
      gamma: gammaArr,
    },
  };
}
