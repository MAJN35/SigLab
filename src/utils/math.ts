/**
 * Seeded Mulberry32 PRNG for reproducible scientific simulations
 */
export function createPRNG(seed: number) {
  let state = seed >>> 0;
  return {
    next(): number {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextGaussian(): number {
      let u = 0;
      let v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },
  };
}

export function signalPower(signal: number[]): number {
  if (signal.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < signal.length; i++) {
    sumSq += signal[i] * signal[i];
  }
  return sumSq / signal.length;
}

export function calculateRMS(signal: number[]): number {
  return Math.sqrt(signalPower(signal));
}

export function calculateSNR(clean: number[], noisy: number[]): number {
  const n = Math.min(clean.length, noisy.length);
  if (n === 0) return 0;
  let pSig = 0;
  let pNoise = 0;
  for (let i = 0; i < n; i++) {
    pSig += clean[i] * clean[i];
    const diff = noisy[i] - clean[i];
    pNoise += diff * diff;
  }
  if (pNoise < 1e-15) return 60;
  if (pSig < 1e-15) return -40;
  return 10 * Math.log10(pSig / pNoise);
}

export function calculateRMSE(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / n);
}

export function calculateCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  return denom < 1e-12 ? 0 : num / denom;
}

export function normalizeSignal(signal: number[]): number[] {
  const n = signal.length;
  if (n === 0) return [];
  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i];
  mean /= n;
  let maxAbs = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(signal[i] - mean);
    if (v > maxAbs) maxAbs = v;
  }
  if (maxAbs < 1e-12) return signal.map(() => 0);
  return signal.map((x) => (x - mean) / maxAbs);
}

export interface FrequencyPeak {
  frequency: number;
  magnitude: number;
  magnitudeDb: number;
}

export function findFrequencyPeaks(
  frequencies: number[],
  magnitudes: number[],
  maxPeaks = 5
): FrequencyPeak[] {
  const peaks: FrequencyPeak[] = [];
  for (let i = 1; i < magnitudes.length - 1; i++) {
    if (
      frequencies[i] > 0.2 &&
      magnitudes[i] > magnitudes[i - 1] &&
      magnitudes[i] >= magnitudes[i + 1] &&
      magnitudes[i] > 0.015
    ) {
      peaks.push({
        frequency: frequencies[i],
        magnitude: magnitudes[i],
        magnitudeDb: 20 * Math.log10(Math.max(magnitudes[i], 1e-8)),
      });
    }
  }
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  return peaks.slice(0, maxPeaks);
}

/**
 * Complementary error function erfc(x) approximation (Abramowitz and Stegun 7.1.26)
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2 - ans;
}

export function qFunc(x: number): number {
  return 0.5 * erfc(x / Math.SQRT2);
}

/**
 * Theoretical Bit Error Rate (BER) as a function of Eb/N0 (in dB)
 */
export function theoreticalBER(scheme: string, ebNoDb: number): number {
  const ebNo = Math.pow(10, ebNoDb / 10);
  switch (scheme) {
    case 'BPSK':
    case 'QPSK':
      return Math.max(1e-7, 0.5 * erfc(Math.sqrt(ebNo)));
    case 'ASK':
      return Math.max(1e-7, 0.5 * erfc(Math.sqrt(ebNo / 2)));
    case 'FSK':
      return Math.max(1e-7, 0.5 * erfc(Math.sqrt(ebNo / 2)));
    case '8-PSK': {
      const k = 3;
      const esNo = k * ebNo;
      const ber = (1 / k) * erfc(Math.sqrt(esNo) * Math.sin(Math.PI / 8));
      return Math.max(1e-7, Math.min(0.5, ber));
    }
    case '16-QAM': {
      const M = 16;
      const k = 4;
      const arg = Math.sqrt((3 * k * ebNo) / (2 * (M - 1)));
      const ber = ((2 * (1 - 1 / Math.sqrt(M))) / k) * erfc(arg);
      return Math.max(1e-7, Math.min(0.5, ber));
    }
    case '64-QAM': {
      const M = 64;
      const k = 6;
      const arg = Math.sqrt((3 * k * ebNo) / (2 * (M - 1)));
      const ber = ((2 * (1 - 1 / Math.sqrt(M))) / k) * erfc(arg);
      return Math.max(1e-7, Math.min(0.5, ber));
    }
    default:
      return Math.max(1e-7, 0.5 * erfc(Math.sqrt(ebNo)));
  }
}
