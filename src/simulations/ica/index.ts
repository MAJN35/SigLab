import { ICAConfig } from '../../types';
import { calculateCorrelation, createPRNG, normalizeSignal } from '../../utils/math';
import { jacobiEigenDecomposition } from '../pca';

export interface ICAResult {
  time: number[];
  originalSources: { name: string; data: number[] }[];
  mixedSignals: { name: string; data: number[] }[];
  recoveredComponents: { name: string; data: number[]; matchedSource: string; correlation: number }[];
  iterationsUsed: number;
}

export function runICAExperiment(config: ICAConfig, seed = 12345): ICAResult {
  const rng = createPRNG(seed);
  const N = 512;
  const K = Math.min(4, Math.max(2, config.numSources));
  const time = new Array<number>(N);

  const s1 = new Array<number>(N);
  const s2 = new Array<number>(N);
  const s3 = new Array<number>(N);
  const s4 = new Array<number>(N);

  for (let i = 0; i < N; i++) {
    const t = (i / N) * 2.0;
    time[i] = t;
    // Source 1: Clean Sine wave
    s1[i] = Math.sin(2 * Math.PI * 3.0 * t);
    // Source 2: Square wave
    s2[i] = Math.sin(2 * Math.PI * 5.5 * t) >= 0 ? 1 : -1;
    // Source 3: Frequency-swept Chirp / Sawtooth wave
    const p = ((4.2 * t) % 1 + 1) % 1;
    s3[i] = 2 * p - 1;
    // Source 4: Synthetic spiky EEG/ECG impulse burst
    const spike1 = Math.exp(-Math.pow((t - 0.45) / 0.04, 2)) * 2.4;
    const spike2 = -Math.exp(-Math.pow((t - 1.15) / 0.045, 2)) * 2.2;
    const spike3 = Math.exp(-Math.pow((t - 1.65) / 0.035, 2)) * 2.5;
    s4[i] = spike1 + spike2 + spike3 + 0.25 * Math.sin(2 * Math.PI * 11 * t);
  }

  const allSources = [
    { name: 'Source 1 (Sine 3 Hz)', data: normalizeSignal(s1) },
    { name: 'Source 2 (Square 5.5 Hz)', data: normalizeSignal(s2) },
    { name: 'Source 3 (Sawtooth 4.2 Hz)', data: normalizeSignal(s3) },
    { name: 'Source 4 (Transient EEG Spike)', data: normalizeSignal(s4) },
  ].slice(0, K);

  // Mix signals X = A * S + noise
  const A = config.mixingMatrix;
  const X: number[][] = Array.from({ length: K }, () => new Array<number>(N).fill(0));

  for (let m = 0; m < K; m++) {
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let k = 0; k < K; k++) {
        const weight = A[m]?.[k] ?? (m === k ? 1 : 0.4);
        sum += weight * allSources[k].data[i];
      }
      X[m][i] = sum + config.noiseStd * rng.nextGaussian();
    }
  }

  // Center X
  const Xc = X.map((row) => {
    const mean = row.reduce((a, b) => a + b, 0) / N;
    return row.map((v) => v - mean);
  });

  // Compute covariance of Xc (K x K) for PCA Whitening
  const cov: number[][] = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  for (let r = 0; r < K; r++) {
    for (let c = r; c < K; c++) {
      let s = 0;
      for (let i = 0; i < N; i++) s += Xc[r][i] * Xc[c][i];
      cov[r][c] = s / N;
      cov[c][r] = cov[r][c];
    }
  }

  const { eigenvalues, eigenvectors } = jacobiEigenDecomposition(cov);
  // Whitened data Z = D^(-1/2) * E^T * Xc
  const Z: number[][] = Array.from({ length: K }, () => new Array<number>(N).fill(0));
  for (let k = 0; k < K; k++) {
    const scale = 1 / Math.sqrt(Math.max(eigenvalues[k], 1e-6));
    for (let i = 0; i < N; i++) {
      let dot = 0;
      for (let r = 0; r < K; r++) dot += eigenvectors[k][r] * Xc[r][i];
      Z[k][i] = dot * scale;
    }
  }

  // Deflationary FastICA with G(u) = log cosh(u), g(u) = tanh(u), g'(u) = 1 - tanh^2(u)
  const W: number[][] = [];
  let totalIter = 0;

  for (let comp = 0; comp < K; comp++) {
    let w = Array.from({ length: K }, (_, j) => (comp === j ? 1 : 0.15 * (rng.next() - 0.5)));
    // Normalize w
    let norm = Math.hypot(...w);
    w = w.map((v) => v / norm);

    for (let iter = 0; iter < config.maxIterations; iter++) {
      totalIter++;
      const wNew = new Array<number>(K).fill(0);
      let meanGPrime = 0;

      for (let i = 0; i < N; i++) {
        let wx = 0;
        for (let r = 0; r < K; r++) wx += w[r] * Z[r][i];
        const g = Math.tanh(wx);
        const gPrime = 1 - g * g;
        meanGPrime += gPrime;
        for (let r = 0; r < K; r++) {
          wNew[r] += Z[r][i] * g;
        }
      }

      meanGPrime /= N;
      for (let r = 0; r < K; r++) {
        wNew[r] = wNew[r] / N - meanGPrime * w[r];
      }

      // Gram-Schmidt decorrelation against previously found components
      for (let prev = 0; prev < comp; prev++) {
        let dot = 0;
        for (let r = 0; r < K; r++) dot += wNew[r] * W[prev][r];
        for (let r = 0; r < K; r++) wNew[r] -= dot * W[prev][r];
      }

      norm = Math.max(1e-12, Math.hypot(...wNew));
      for (let r = 0; r < K; r++) wNew[r] /= norm;

      let dotConv = 0;
      for (let r = 0; r < K; r++) dotConv += wNew[r] * w[r];
      w = wNew;
      if (Math.abs(Math.abs(dotConv) - 1) < config.tolerance) break;
    }
    W.push(w);
  }

  // Extract raw independent components Y = W * Z and align sign/order for intuitive visual comparison
  const rawComponents: number[][] = W.map((w) => {
    const out = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let r = 0; r < K; r++) s += w[r] * Z[r][i];
      out[i] = s;
    }
    return normalizeSignal(out);
  });

  const usedComp = new Set<number>();
  const recoveredComponents = allSources.map((src, idx) => {
    let bestCompIdx = 0;
    let bestAbsCorr = -1;
    let bestSignedCorr = 1;

    for (let c = 0; c < K; c++) {
      if (usedComp.has(c)) continue;
      const corr = calculateCorrelation(src.data, rawComponents[c]);
      if (Math.abs(corr) > bestAbsCorr) {
        bestAbsCorr = Math.abs(corr);
        bestSignedCorr = corr;
        bestCompIdx = c;
      }
    }
    usedComp.add(bestCompIdx);
    const sign = bestSignedCorr >= 0 ? 1 : -1;
    const aligned = rawComponents[bestCompIdx].map((v) => v * sign);

    return {
      name: `IC ${idx + 1}`,
      data: aligned,
      matchedSource: src.name,
      correlation: Math.abs(bestSignedCorr),
    };
  });

  return {
    time,
    originalSources: allSources,
    mixedSignals: X.map((row, idx) => ({
      name: `Sensor Mixture ${idx + 1}`,
      data: normalizeSignal(row),
    })),
    recoveredComponents,
    iterationsUsed: Math.round(totalIter / K),
  };
}
