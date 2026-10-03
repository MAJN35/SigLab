import { FilterConfig } from '../../types';

/**
 * Compute Biquad IIR filter coefficients (RBJ Audio EQ Cookbook / Butterworth 2nd order cascaded)
 */
function applyBiquadSection(
  signal: number[],
  b0: number,
  b1: number,
  b2: number,
  a1: number,
  a2: number
): number[] {
  const out = new Array<number>(signal.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x0 = signal[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = Number.isFinite(y0) ? y0 : 0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = out[i];
  }
  return out;
}

function designBiquadCoeffs(
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch',
  fc: number,
  fs: number,
  Q = 0.7071
) {
  const nyquist = fs * 0.48;
  const clampedFc = Math.max(0.5, Math.min(nyquist, fc));
  const w0 = (2 * Math.PI * clampedFc) / fs;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Math.max(0.15, Q));

  let b0 = 1,
    b1 = 0,
    b2 = 0,
    a0 = 1,
    a1 = 0,
    a2 = 0;

  switch (type) {
    case 'lowpass':
      b0 = (1 - cosw0) / 2;
      b1 = 1 - cosw0;
      b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;
    case 'highpass':
      b0 = (1 + cosw0) / 2;
      b1 = -(1 + cosw0);
      b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;
    case 'bandpass':
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;
    case 'notch':
      b0 = 1;
      b1 = -2 * cosw0;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;
  }

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * Windowed-Sinc Linear-Phase FIR filter design
 */
export function designFIRKernel(
  type: 'lowpass' | 'highpass' | 'bandpass' | 'bandstop',
  fcLow: number,
  fcHigh: number,
  fs: number,
  order: number
): number[] {
  const M = Math.max(4, Math.min(128, Math.round(order) * 2));
  const half = M / 2;
  const f1 = Math.max(0.002, Math.min(0.48, fcLow / fs));
  const f2 = Math.max(f1 + 0.01, Math.min(0.49, fcHigh / fs));

  const lpSinc = (f: number, n: number) => {
    const x = n - half;
    if (Math.abs(x) < 1e-9) return 2 * f;
    return Math.sin(2 * Math.PI * f * x) / (Math.PI * x);
  };

  const h = new Array<number>(M + 1);
  for (let n = 0; n <= M; n++) {
    // Hamming window
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / M);
    let val = 0;
    if (type === 'lowpass') {
      val = lpSinc(f1, n) * w;
    } else if (type === 'highpass') {
      val = (n === half ? 1 : 0) - lpSinc(f1, n) * w;
    } else if (type === 'bandpass') {
      val = (lpSinc(f2, n) - lpSinc(f1, n)) * w;
    } else {
      val = (n === half ? 1 : 0) - (lpSinc(f2, n) - lpSinc(f1, n)) * w;
    }
    h[n] = val;
  }
  return h;
}

export function applyFIR(signal: number[], kernel: number[]): number[] {
  const N = signal.length;
  const M = kernel.length;
  const half = Math.floor(M / 2);
  const out = new Array<number>(N);

  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < M; k++) {
      const idx = n - k + half;
      if (idx >= 0 && idx < N) {
        sum += signal[idx] * kernel[k];
      }
    }
    out[n] = sum;
  }
  return out;
}

export function applyFilter(
  signal: number[],
  config: FilterConfig,
  samplingRate: number
): {
  filtered: number[];
  residual: number[];
  freqAxis: number[];
  magResponse: number[];
  magResponseDb: number[];
} {
  const n = signal.length;
  if (!config.enabled || n === 0) {
    const freqAxis = Array.from({ length: 128 }, (_, i) => (i * samplingRate) / 256);
    return {
      filtered: [...signal],
      residual: new Array(n).fill(0),
      freqAxis,
      magResponse: new Array(128).fill(1),
      magResponseDb: new Array(128).fill(0),
    };
  }

  let filtered: number[] = [...signal];
  const sections = Math.max(1, Math.min(6, Math.round(config.order / 2)));

  switch (config.type) {
    case 'moving-average': {
      const win = Math.max(2, Math.min(64, Math.round(config.order)));
      filtered = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        let cnt = 0;
        const half = Math.floor(win / 2);
        for (let k = -half; k <= half; k++) {
          const idx = i + k;
          if (idx >= 0 && idx < n) {
            sum += signal[idx];
            cnt++;
          }
        }
        filtered[i] = sum / Math.max(1, cnt);
      }
      break;
    }
    case 'fir': {
      const kernel = designFIRKernel(
        'lowpass',
        config.cutoffLow,
        config.cutoffHigh,
        samplingRate,
        Math.max(8, config.order * 4)
      );
      filtered = applyFIR(signal, kernel);
      break;
    }
    case 'lowpass':
    case 'iir': {
      const c = designBiquadCoeffs('lowpass', config.cutoffLow, samplingRate, config.qFactor);
      for (let s = 0; s < sections; s++) {
        filtered = applyBiquadSection(filtered, c.b0, c.b1, c.b2, c.a1, c.a2);
      }
      break;
    }
    case 'highpass': {
      const c = designBiquadCoeffs('highpass', config.cutoffLow, samplingRate, config.qFactor);
      for (let s = 0; s < sections; s++) {
        filtered = applyBiquadSection(filtered, c.b0, c.b1, c.b2, c.a1, c.a2);
      }
      break;
    }
    case 'bandpass': {
      const lp = designBiquadCoeffs('lowpass', Math.max(config.cutoffLow + 2, config.cutoffHigh), samplingRate, config.qFactor);
      const hp = designBiquadCoeffs('highpass', config.cutoffLow, samplingRate, config.qFactor);
      for (let s = 0; s < sections; s++) {
        filtered = applyBiquadSection(filtered, lp.b0, lp.b1, lp.b2, lp.a1, lp.a2);
        filtered = applyBiquadSection(filtered, hp.b0, hp.b1, hp.b2, hp.a1, hp.a2);
      }
      break;
    }
    case 'bandstop': {
      const kernel = designFIRKernel(
        'bandstop',
        config.cutoffLow,
        config.cutoffHigh,
        samplingRate,
        Math.max(10, config.order * 4)
      );
      filtered = applyFIR(signal, kernel);
      break;
    }
    case 'notch': {
      const c = designBiquadCoeffs('notch', config.cutoffLow, samplingRate, Math.max(2, config.qFactor * 4));
      for (let s = 0; s < sections; s++) {
        filtered = applyBiquadSection(filtered, c.b0, c.b1, c.b2, c.a1, c.a2);
      }
      break;
    }
  }

  const residual = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    residual[i] = signal[i] - filtered[i];
  }

  // Compute analytic/empirical frequency response |H(f)| across 128 frequency bins
  const numBins = 128;
  const freqAxis = new Array<number>(numBins);
  const magResponse = new Array<number>(numBins);
  const magResponseDb = new Array<number>(numBins);
  const nyq = samplingRate / 2;
  const orderExp = Math.max(1, config.order);

  for (let k = 0; k < numBins; k++) {
    const f = (k / (numBins - 1)) * nyq;
    freqAxis[k] = f;
    let h = 1;
    const fc1 = Math.max(0.5, config.cutoffLow);
    const fc2 = Math.max(fc1 + 2, config.cutoffHigh);

    switch (config.type) {
      case 'lowpass':
      case 'iir':
      case 'fir':
        h = 1 / Math.sqrt(1 + Math.pow(f / fc1, 2 * orderExp));
        break;
      case 'highpass':
        h = f < 0.01 ? 0 : 1 / Math.sqrt(1 + Math.pow(fc1 / f, 2 * orderExp));
        break;
      case 'bandpass': {
        const lp = 1 / Math.sqrt(1 + Math.pow(f / fc2, 2 * orderExp));
        const hp = f < 0.01 ? 0 : 1 / Math.sqrt(1 + Math.pow(fc1 / f, 2 * orderExp));
        h = lp * hp;
        break;
      }
      case 'bandstop': {
        const lp = 1 / Math.sqrt(1 + Math.pow(f / fc2, 2 * orderExp));
        const hp = f < 0.01 ? 0 : 1 / Math.sqrt(1 + Math.pow(fc1 / f, 2 * orderExp));
        h = Math.max(0.01, 1 - lp * hp);
        break;
      }
      case 'notch': {
        const bw = fc1 / Math.max(1, config.qFactor * 3);
        const diff = Math.abs(f - fc1);
        h = diff / Math.sqrt(diff * diff + bw * bw);
        break;
      }
      case 'moving-average': {
        const M = Math.max(2, Math.round(config.order));
        const w = (Math.PI * f) / nyq;
        h = w < 1e-5 ? 1 : Math.abs(Math.sin((M * w) / 2) / (M * Math.sin(w / 2)));
        break;
      }
    }
    magResponse[k] = h;
    magResponseDb[k] = 20 * Math.log10(Math.max(h, 1e-4));
  }

  return { filtered, residual, freqAxis, magResponse, magResponseDb };
}
