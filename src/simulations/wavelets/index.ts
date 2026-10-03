import { WaveletFamily } from '../../types';

const INV_SQRT2 = 1 / Math.SQRT2;

// Orthogonal wavelet low-pass decomposition filter banks
const FILTER_BANKS: Record<'haar' | 'db4' | 'sym4', number[]> = {
  haar: [INV_SQRT2, INV_SQRT2],
  db4: [
    0.4829629131445341,
    0.8365163037378079,
    0.2241438680420134,
    -0.1294095225512604,
  ],
  sym4: [
    -0.07576571478927333,
    -0.02963552764599851,
    0.49761866763201545,
    0.8037387518059161,
    0.29785779560527736,
    -0.09921954357684722,
    -0.012603967262037833,
    0.0322231006040427,
  ],
};

function getQMFHighPass(h: number[]): number[] {
  const L = h.length;
  const g = new Array<number>(L);
  for (let k = 0; k < L; k++) {
    g[k] = (k % 2 === 0 ? 1 : -1) * h[L - 1 - k];
  }
  return g;
}

function dwtStep(signal: number[], h: number[], g: number[]): { approx: number[]; detail: number[] } {
  const N = signal.length;
  const half = Math.floor(N / 2);
  const L = h.length;
  const approx = new Array<number>(half).fill(0);
  const detail = new Array<number>(half).fill(0);

  for (let k = 0; k < half; k++) {
    let sumA = 0;
    let sumD = 0;
    for (let m = 0; m < L; m++) {
      const idx = (2 * k + m) % N;
      sumA += signal[idx] * h[m];
      sumD += signal[idx] * g[m];
    }
    approx[k] = sumA;
    detail[k] = sumD;
  }

  return { approx, detail };
}

function idwtStep(approx: number[], detail: number[], h: number[], g: number[]): number[] {
  const half = approx.length;
  const N = half * 2;
  const L = h.length;
  const rec = new Array<number>(N).fill(0);

  for (let k = 0; k < half; k++) {
    for (let m = 0; m < L; m++) {
      const idx = (2 * k + m) % N;
      rec[idx] += approx[k] * h[m] + detail[k] * g[m];
    }
  }
  return rec;
}

export interface WaveletAnalysisResult {
  approximation: number[];
  details: number[][]; // Level 1 (finest) to Level J (coarsest)
  denoisedSignal: number[];
  scales: number[];
  scalogram: number[][]; // [timeIdx][scaleIdx] normalized energy [0..1]
}

export function computeWaveletAnalysis(
  signal: number[],
  family: WaveletFamily,
  levels = 4,
  denoiseThreshold = 0.25,
  numScales = 24
): WaveletAnalysisResult {
  // Pad or truncate to power of 2 for clean DWT
  const pow2 = Math.pow(2, Math.floor(Math.log2(Math.max(64, signal.length))));
  const work = signal.slice(0, pow2);
  const bankKey = family === 'morlet' ? 'sym4' : family;
  const h = FILTER_BANKS[bankKey];
  const g = getQMFHighPass(h);

  const maxLevels = Math.max(1, Math.min(6, levels));
  const details: number[][] = [];
  let currentApprox = [...work];

  for (let lvl = 0; lvl < maxLevels; lvl++) {
    if (currentApprox.length < 8) break;
    const { approx, detail } = dwtStep(currentApprox, h, g);
    details.push(detail);
    currentApprox = approx;
  }

  // Soft-thresholding on detail coefficients for wavelet denoising
  const thresholdedDetails = details.map((det) =>
    det.map((c) => {
      if (Math.abs(c) <= denoiseThreshold) return 0;
      return Math.sign(c) * (Math.abs(c) - denoiseThreshold);
    })
  );

  // Reconstruct signal from thresholded coefficients
  let rec = [...currentApprox];
  for (let lvl = thresholdedDetails.length - 1; lvl >= 0; lvl--) {
    rec = idwtStep(rec, thresholdedDetails[lvl], h, g);
  }

  // Continuous Wavelet Transform (CWT) Morlet Scalogram for time-frequency localization
  const nTime = Math.min(256, work.length);
  const step = Math.max(1, Math.floor(work.length / nTime));
  const scales = Array.from({ length: numScales }, (_, i) => 1.5 + i * 1.6);
  const rawScalogram: number[][] = [];
  let maxEnergy = 1e-8;

  for (let ti = 0; ti < nTime; ti++) {
    const centerIdx = ti * step;
    const row = new Array<number>(numScales);

    for (let si = 0; si < numScales; si++) {
      const scale = scales[si];
      const halfWin = Math.min(48, Math.ceil(scale * 3));
      let sumR = 0;
      let sumI = 0;
      const norm = 1 / Math.sqrt(scale);

      for (let tau = -halfWin; tau <= halfWin; tau++) {
        const idx = centerIdx + tau;
        if (idx >= 0 && idx < work.length) {
          const u = tau / scale;
          const env = Math.exp(-0.5 * u * u);
          const w0 = 5.0; // Morlet central frequency
          sumR += work[idx] * env * Math.cos(w0 * u);
          sumI += work[idx] * env * Math.sin(w0 * u);
        }
      }
      const mag = norm * Math.hypot(sumR, sumI);
      row[si] = mag;
      if (mag > maxEnergy) maxEnergy = mag;
    }
    rawScalogram.push(row);
  }

  const scalogram = rawScalogram.map((row) =>
    row.map((val) => Math.min(1, Math.max(0, val / maxEnergy)))
  );

  return {
    approximation: currentApprox,
    details,
    denoisedSignal: rec,
    scales,
    scalogram,
  };
}
