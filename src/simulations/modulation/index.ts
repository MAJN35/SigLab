import { AnalogModConfig, DigitalModConfig, DigitalModType } from '../../types';
import { createPRNG, signalPower } from '../../utils/math';
import { applyFilter } from '../filters';

export interface AnalogModResult {
  time: number[];
  message: number[];
  carrier: number[];
  modulated: number[];
  noisy: number[];
  recovered: number[];
  samplingRate: number;
}

export function simulateAnalogModulation(
  config: AnalogModConfig,
  seed = 12345
): AnalogModResult {
  const samplingRate = Math.max(1000, config.carrierFreq * 16);
  const duration = 0.5;
  const N = Math.min(2048, Math.round(samplingRate * duration));
  const dt = 1 / samplingRate;

  const time = new Array<number>(N);
  const message = new Array<number>(N);
  const carrier = new Array<number>(N);
  const modulated = new Array<number>(N);

  const fm = config.messageFreq;
  const fc = config.carrierFreq;
  const Am = config.messageAmp;
  const Ac = config.carrierAmp;
  const m = config.modulationIndex;

  for (let i = 0; i < N; i++) {
    const t = i * dt;
    time[i] = t;
    // Multi-harmonic message for visual richness
    const msgNorm =
      0.75 * Math.sin(2 * Math.PI * fm * t) + 0.25 * Math.cos(2 * Math.PI * (2 * fm) * t);
    const msgHilbert =
      -0.75 * Math.cos(2 * Math.PI * fm * t) + 0.25 * Math.sin(2 * Math.PI * (2 * fm) * t);

    message[i] = Am * msgNorm;
    carrier[i] = Ac * Math.cos(2 * Math.PI * fc * t);

    switch (config.type) {
      case 'AM':
        modulated[i] = Ac * (1 + m * msgNorm) * Math.cos(2 * Math.PI * fc * t);
        break;
      case 'DSB-SC':
        modulated[i] = Ac * m * msgNorm * Math.cos(2 * Math.PI * fc * t);
        break;
      case 'SSB':
        // Upper Sideband (USB) via analytic Hilbert pair
        modulated[i] =
          0.5 *
          Ac *
          m *
          (msgNorm * Math.cos(2 * Math.PI * fc * t) -
            msgHilbert * Math.sin(2 * Math.PI * fc * t));
        break;
      case 'FM': {
        // Integral of msgNorm:
        const intMsg =
          (0.75 * (1 - Math.cos(2 * Math.PI * fm * t))) / (2 * Math.PI * fm) +
          (0.25 * Math.sin(2 * Math.PI * 2 * fm * t)) / (2 * Math.PI * 2 * fm);
        const kf = m * fm * 2 * Math.PI;
        modulated[i] = Ac * Math.cos(2 * Math.PI * fc * t + kf * intMsg);
        break;
      }
      case 'PM': {
        modulated[i] = Ac * Math.cos(2 * Math.PI * fc * t + m * msgNorm);
        break;
      }
    }
  }

  // Add AWGN channel noise
  const rng = createPRNG(seed);
  const pMod = Math.max(signalPower(modulated), 1e-6);
  const noiseStd = Math.sqrt(pMod / Math.pow(10, config.snrDb / 10));
  const noisy = modulated.map((s) => s + noiseStd * rng.nextGaussian());

  // Demodulate
  const rawDemod = new Array<number>(N).fill(0);
  if (config.type === 'AM') {
    // Full-wave rectifier envelope detector
    for (let i = 0; i < N; i++) {
      rawDemod[i] = ((Math.abs(noisy[i]) * Math.PI) / 2 - Ac) / Math.max(0.1, Ac * m) * Am;
    }
  } else if (config.type === 'DSB-SC' || config.type === 'SSB') {
    // Coherent product detector
    const scale = config.type === 'SSB' ? 4 : 2;
    for (let i = 0; i < N; i++) {
      rawDemod[i] =
        (noisy[i] * Math.cos(2 * Math.PI * fc * time[i]) * scale) /
        Math.max(0.1, Ac * m) *
        Am;
    }
  } else if (config.type === 'FM') {
    // Differentiator + Envelope discriminator
    for (let i = 1; i < N; i++) {
      const diff = (noisy[i] - noisy[i - 1]) * samplingRate;
      const env = Math.abs(diff) / (2 * Math.PI * fc * Math.max(0.1, Ac));
      rawDemod[i] = ((env - 0.63) / Math.max(0.15, m * 0.25)) * Am;
    }
  } else {
    // PM coherent quadrature phase detector approximation
    for (let i = 0; i < N; i++) {
      rawDemod[i] =
        (-noisy[i] * Math.sin(2 * Math.PI * fc * time[i]) * 2) /
        Math.max(0.1, Ac * m) *
        Am;
    }
  }

  const { filtered: recovered } = applyFilter(
    rawDemod,
    {
      enabled: true,
      type: 'lowpass',
      cutoffLow: fm * 3.2,
      cutoffHigh: fm * 5,
      order: 4,
      qFactor: 0.707,
    },
    samplingRate
  );

  return { time, message, carrier, modulated, noisy, recovered, samplingRate };
}

export interface ConstellationPoint {
  I: number;
  Q: number;
  bits: number[];
  label: string;
}

export function getConstellationMap(type: DigitalModType): ConstellationPoint[] {
  switch (type) {
    case 'ASK':
      return [
        { I: 0.2, Q: 0, bits: [0], label: '0' },
        { I: 1.38, Q: 0, bits: [1], label: '1' },
      ];
    case 'FSK':
      return [
        { I: 1, Q: 0, bits: [0], label: '0' },
        { I: 0, Q: 1, bits: [1], label: '1' },
      ];
    case 'BPSK':
      return [
        { I: -1, Q: 0, bits: [0], label: '0' },
        { I: 1, Q: 0, bits: [1], label: '1' },
      ];
    case 'QPSK': {
      const s = 1 / Math.SQRT2;
      return [
        { I: -s, Q: -s, bits: [0, 0], label: '00' },
        { I: -s, Q: s, bits: [0, 1], label: '01' },
        { I: s, Q: s, bits: [1, 1], label: '11' },
        { I: s, Q: -s, bits: [1, 0], label: '10' },
      ];
    }
    case '8-PSK': {
      const gray3 = [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
        [1, 0, 0],
      ];
      return gray3.map((bits, idx) => {
        const ang = (2 * Math.PI * idx) / 8;
        return {
          I: Math.cos(ang),
          Q: Math.sin(ang),
          bits,
          label: bits.join(''),
        };
      });
    }
    case '16-QAM': {
      // Normalized 16-QAM (average energy = 1, norm = 1/sqrt(10))
      const norm = 1 / Math.sqrt(10);
      const levels = [-3, -1, 1, 3];
      const gray2 = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      const pts: ConstellationPoint[] = [];
      for (let i = 0; i < 4; i++) {
        for (let q = 0; q < 4; q++) {
          const bits = [...gray2[i], ...gray2[q]];
          pts.push({
            I: levels[i] * norm,
            Q: levels[q] * norm,
            bits,
            label: bits.join(''),
          });
        }
      }
      return pts;
    }
    case '64-QAM': {
      // Normalized 64-QAM (average energy = 1, norm = 1/sqrt(42))
      const norm = 1 / Math.sqrt(42);
      const levels = [-7, -5, -3, -1, 1, 3, 5, 7];
      const gray3 = [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
        [1, 0, 0],
      ];
      const pts: ConstellationPoint[] = [];
      for (let i = 0; i < 8; i++) {
        for (let q = 0; q < 8; q++) {
          const bits = [...gray3[i], ...gray3[q]];
          pts.push({
            I: levels[i] * norm,
            Q: levels[q] * norm,
            bits,
            label: bits.join(''),
          });
        }
      }
      return pts;
    }
  }
}

export interface DigitalModResult {
  txBits: number[];
  rxBits: number[];
  bitErrorIndices: number[];
  numErrors: number;
  ber: number;
  idealConstellation: ConstellationPoint[];
  txSymbols: { I: number; Q: number; label: string }[];
  rxSymbols: { I: number; Q: number; isError: boolean }[];
  waveformTime: number[];
  waveformClean: number[];
  waveformNoisy: number[];
  bitsPerSymbol: number;
}

export function simulateDigitalModulation(
  config: DigitalModConfig,
  seed = 12345
): DigitalModResult {
  const rng = createPRNG(seed);
  const constellation = getConstellationMap(config.type);
  const k = constellation[0].bits.length; // bits per symbol
  const numSymbols = Math.max(8, Math.ceil(config.numBits / k));
  const totalBits = numSymbols * k;

  const txBits = new Array<number>(totalBits);
  for (let i = 0; i < totalBits; i++) {
    txBits[i] = rng.next() >= 0.5 ? 1 : 0;
  }

  // Convert Eb/N0 (snrDb) to complex AWGN symbol noise std per dimension
  const ebNoLinear = Math.pow(10, config.snrDb / 10);
  const esNoLinear = k * ebNoLinear;
  const noiseStd = 1 / Math.sqrt(2 * Math.max(1e-4, esNoLinear));

  const txSymbols: { I: number; Q: number; label: string }[] = [];
  const rxSymbols: { I: number; Q: number; isError: boolean }[] = [];
  const rxBits: number[] = [];
  const bitErrorIndices: number[] = [];

  for (let s = 0; s < numSymbols; s++) {
    const chunk = txBits.slice(s * k, (s + 1) * k);
    const label = chunk.join('');
    const pt = constellation.find((c) => c.label === label) || constellation[0];
    txSymbols.push({ I: pt.I, Q: pt.Q, label: pt.label });

    const rI = pt.I + noiseStd * rng.nextGaussian();
    const rQ = pt.Q + noiseStd * rng.nextGaussian();

    // Minimum Euclidean distance detector
    let bestPt = constellation[0];
    let minDist = Infinity;
    for (const cand of constellation) {
      const d = (rI - cand.I) * (rI - cand.I) + (rQ - cand.Q) * (rQ - cand.Q);
      if (d < minDist) {
        minDist = d;
        bestPt = cand;
      }
    }

    let symError = false;
    for (let b = 0; b < k; b++) {
      const bitIdx = s * k + b;
      const decBit = bestPt.bits[b];
      rxBits.push(decBit);
      if (decBit !== txBits[bitIdx]) {
        bitErrorIndices.push(bitIdx);
        symError = true;
      }
    }
    rxSymbols.push({ I: rI, Q: rQ, isError: symError });
  }

  // Generate passband time-domain waveform for first 16 symbols so user can inspect carrier transitions
  const displaySymbols = Math.min(16, numSymbols);
  const samplesPerSymbol = 24;
  const totalWaveSamples = displaySymbols * samplesPerSymbol;
  const waveformTime = new Array<number>(totalWaveSamples);
  const waveformClean = new Array<number>(totalWaveSamples);
  const waveformNoisy = new Array<number>(totalWaveSamples);

  const symDuration = 1 / Math.max(1, config.symbolRate);
  const dt = symDuration / samplesPerSymbol;

  for (let s = 0; s < displaySymbols; s++) {
    const sym = txSymbols[s];
    for (let m = 0; m < samplesPerSymbol; m++) {
      const idx = s * samplesPerSymbol + m;
      const t = idx * dt;
      waveformTime[idx] = t;

      let cleanVal = 0;
      if (config.type === 'FSK') {
        const fShift = sym.I > 0.5 ? config.carrierFreq * 0.65 : config.carrierFreq * 1.45;
        cleanVal = Math.cos(2 * Math.PI * fShift * t);
      } else {
        cleanVal =
          sym.I * Math.cos(2 * Math.PI * config.carrierFreq * t) -
          sym.Q * Math.sin(2 * Math.PI * config.carrierFreq * t);
      }
      waveformClean[idx] = cleanVal;
      waveformNoisy[idx] = cleanVal + noiseStd * rng.nextGaussian();
    }
  }

  return {
    txBits,
    rxBits,
    bitErrorIndices,
    numErrors: bitErrorIndices.length,
    ber: bitErrorIndices.length / totalBits,
    idealConstellation: constellation,
    txSymbols,
    rxSymbols,
    waveformTime,
    waveformClean,
    waveformNoisy,
    bitsPerSymbol: k,
  };
}
