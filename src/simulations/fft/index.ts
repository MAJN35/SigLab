import { WindowFunctionType } from '../../types';

export function applyWindow(signal: number[], windowType: WindowFunctionType): number[] {
  const N = signal.length;
  if (N <= 1 || windowType === 'rectangular') return [...signal];
  const out = new Array<number>(N);

  for (let n = 0; n < N; n++) {
    const ratio = (2 * Math.PI * n) / (N - 1);
    let w = 1;
    switch (windowType) {
      case 'hann':
        w = 0.5 * (1 - Math.cos(ratio));
        break;
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos(ratio);
        break;
      case 'blackman':
        w = 0.42 - 0.5 * Math.cos(ratio) + 0.08 * Math.cos(2 * ratio);
        break;
      case 'flattop':
        w =
          0.21557895 -
          0.41663158 * Math.cos(ratio) +
          0.277263158 * Math.cos(2 * ratio) -
          0.083578947 * Math.cos(3 * ratio) +
          0.006947368 * Math.cos(4 * ratio);
        break;
      default:
        w = 1;
    }
    out[n] = signal[n] * w;
  }
  return out;
}

/**
 * In-place Radix-2 Cooley-Tukey FFT
 */
export function fftRadix2(real: number[], imag: number[], invert = false): void {
  const n = real.length;
  if (n <= 1) return;

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((2 * Math.PI) / len) * (invert ? 1 : -1);
    const wlenR = Math.cos(ang);
    const wlenI = Math.sin(ang);
    const half = len >> 1;

    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + half] * wR - imag[i + k + half] * wI;
        const vI = real[i + k + half] * wI + imag[i + k + half] * wR;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + half] = uR - vR;
        imag[i + k + half] = uI - vI;

        const nextWR = wR * wlenR - wI * wlenI;
        wI = wR * wlenI + wI * wlenR;
        wR = nextWR;
      }
    }
  }

  if (invert) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

export interface SpectrumResult {
  frequencies: number[];
  magnitude: number[];
  magnitudeDb: number[];
  phaseDeg: number[];
  psdDb: number[];
  realFull: number[];
  imagFull: number[];
  ifftReconstructed: number[];
}

export function computeFFTSpectrum(
  signal: number[],
  samplingRate: number,
  fftSize = 1024,
  windowType: WindowFunctionType = 'hann'
): SpectrumResult {
  // Ensure power of 2
  const N = Math.pow(2, Math.round(Math.log2(Math.max(64, fftSize))));
  const padded = new Array<number>(N).fill(0);
  const copyLen = Math.min(signal.length, N);
  const sliced = signal.slice(0, copyLen);
  const windowed = applyWindow(sliced, windowType);

  for (let i = 0; i < copyLen; i++) {
    padded[i] = windowed[i];
  }

  const real = [...padded];
  const imag = new Array<number>(N).fill(0);
  fftRadix2(real, imag, false);

  const half = N >> 1;
  const frequencies = new Array<number>(half);
  const magnitude = new Array<number>(half);
  const magnitudeDb = new Array<number>(half);
  const phaseDeg = new Array<number>(half);
  const psdDb = new Array<number>(half);

  // Coherent gain compensation for window
  const windowGain =
    windowType === 'hann' || windowType === 'hamming'
      ? 2.0
      : windowType === 'blackman'
      ? 2.38
      : windowType === 'flattop'
      ? 4.63
      : 1.0;

  for (let k = 0; k < half; k++) {
    frequencies[k] = (k * samplingRate) / N;
    const mag = (Math.hypot(real[k], imag[k]) * 2 * windowGain) / copyLen;
    magnitude[k] = k === 0 ? mag / 2 : mag;
    magnitudeDb[k] = 20 * Math.log10(Math.max(magnitude[k], 1e-6));
    phaseDeg[k] = mag > 0.01 ? (Math.atan2(imag[k], real[k]) * 180) / Math.PI : 0;
    const psd = (real[k] * real[k] + imag[k] * imag[k]) / (samplingRate * copyLen);
    psdDb[k] = 10 * Math.log10(Math.max(psd, 1e-10));
  }

  // Also compute IFFT on unwindowed copy to demonstrate exact inverse reconstruction
  const rawReal = new Array<number>(N).fill(0);
  const rawImag = new Array<number>(N).fill(0);
  for (let i = 0; i < copyLen; i++) rawReal[i] = signal[i];
  fftRadix2(rawReal, rawImag, false);
  const invReal = [...rawReal];
  const invImag = [...rawImag];
  fftRadix2(invReal, invImag, true);

  return {
    frequencies,
    magnitude,
    magnitudeDb,
    phaseDeg,
    psdDb,
    realFull: rawReal,
    imagFull: rawImag,
    ifftReconstructed: invReal.slice(0, copyLen),
  };
}

export interface SpectrogramResult {
  times: number[];
  frequencies: number[];
  matrix: number[][]; // [timeIdx][freqIdx] in dB normalized [0..1]
}

export function computeSTFTSpectrogram(
  signal: number[],
  samplingRate: number,
  windowSize = 128,
  hopSize = 32,
  windowType: WindowFunctionType = 'hann'
): SpectrogramResult {
  const N = Math.pow(2, Math.round(Math.log2(Math.max(32, windowSize))));
  const hop = Math.max(8, hopSize);
  const half = N >> 1;

  const frequencies = new Array<number>(half);
  for (let k = 0; k < half; k++) {
    frequencies[k] = (k * samplingRate) / N;
  }

  const times: number[] = [];
  const rawDbFrames: number[][] = [];
  let minDb = -65;
  let maxDb = -60;

  for (let start = 0; start + N <= signal.length; start += hop) {
    const segment = signal.slice(start, start + N);
    const windowed = applyWindow(segment, windowType);
    const real = [...windowed];
    const imag = new Array<number>(N).fill(0);
    fftRadix2(real, imag, false);

    const frameDb = new Array<number>(half);
    for (let k = 0; k < half; k++) {
      const mag = (Math.hypot(real[k], imag[k]) * 2) / N;
      const db = 20 * Math.log10(Math.max(mag, 1e-4));
      frameDb[k] = db;
      if (db > maxDb) maxDb = db;
    }
    times.push((start + N / 2) / samplingRate);
    rawDbFrames.push(frameDb);
  }

  if (rawDbFrames.length === 0) {
    return { times: [0], frequencies, matrix: [new Array(half).fill(0)] };
  }

  minDb = Math.max(-75, maxDb - 55);
  const span = Math.max(1, maxDb - minDb);
  const matrix = rawDbFrames.map((frame) =>
    frame.map((db) => Math.max(0, Math.min(1, (db - minDb) / span)))
  );

  return { times, frequencies, matrix };
}
