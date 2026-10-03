import { NoiseConfig, SignalComponent, SignalConfig, SignalWaveType } from '../../types';
import { createPRNG, signalPower } from '../../utils/math';

export function evaluateWavePoint(
  type: Exclude<SignalWaveType, 'composite'>,
  t: number,
  freq: number,
  amp: number,
  phaseDeg: number,
  duration: number,
  freqEnd = freq * 3,
  dutyCycle = 0.25
): number {
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const arg = 2 * Math.PI * freq * t + phaseRad;

  switch (type) {
    case 'sine':
      return amp * Math.sin(arg);
    case 'cosine':
      return amp * Math.cos(arg);
    case 'square':
      return amp * (Math.sin(arg) >= 0 ? 1 : -1);
    case 'triangle': {
      const p = ((freq * t + phaseDeg / 360) % 1 + 1) % 1;
      return amp * (1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25)));
    }
    case 'sawtooth': {
      const p = ((freq * t + phaseDeg / 360) % 1 + 1) % 1;
      return amp * (2 * p - 1);
    }
    case 'pulse': {
      const p = ((freq * t + phaseDeg / 360) % 1 + 1) % 1;
      return amp * (p < dutyCycle ? 1 : 0);
    }
    case 'chirp': {
      const k = (freqEnd - freq) / Math.max(duration, 0.01);
      const instPhase = 2 * Math.PI * (freq * t + 0.5 * k * t * t) + phaseRad;
      return amp * Math.sin(instPhase);
    }
    case 'multitone': {
      return (
        amp *
        (0.55 * Math.sin(arg) +
          0.3 * Math.sin(2 * Math.PI * (freq * 2.5) * t + phaseRad) +
          0.15 * Math.cos(2 * Math.PI * (freq * 5.0) * t))
      );
    }
    default:
      return amp * Math.sin(arg);
  }
}

export function generateSignal(config: SignalConfig): {
  time: number[];
  clean: number[];
  numSamples: number;
} {
  const numSamples = Math.max(
    32,
    Math.min(8192, Math.round(config.samplingRate * config.duration))
  );
  const time = new Array<number>(numSamples);
  const clean = new Array<number>(numSamples);
  const dt = 1 / config.samplingRate;

  const activeComponents: SignalComponent[] =
    config.type === 'composite'
      ? config.components.filter((c) => c.enabled)
      : [
          {
            id: 'primary',
            type: config.type,
            amplitude: config.amplitude,
            frequency: config.frequency,
            frequencyEnd: config.frequencyEnd,
            dutyCycle: config.dutyCycle,
            phase: config.phase,
            enabled: true,
          },
        ];

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    time[i] = t;
    let val = config.dcOffset;
    for (const comp of activeComponents) {
      val += evaluateWavePoint(
        comp.type,
        t,
        comp.frequency,
        comp.amplitude,
        comp.phase,
        config.duration,
        comp.frequencyEnd ?? comp.frequency * 3,
        comp.dutyCycle ?? 0.25
      );
    }
    clean[i] = val;
  }

  return { time, clean, numSamples };
}

export function getSignalLatexExpression(config: SignalConfig): string {
  const dcStr =
    Math.abs(config.dcOffset) > 1e-4
      ? `${config.dcOffset >= 0 ? '+ ' : '- '}${Math.abs(config.dcOffset).toFixed(2)}`
      : '';

  const formatSingle = (
    type: Exclude<SignalWaveType, 'composite'>,
    A: number,
    f: number,
    phi: number,
    fEnd?: number
  ) => {
    const aStr = A.toFixed(2);
    const fStr = f.toFixed(1);
    const phiStr =
      Math.abs(phi) > 1e-3
        ? ` ${phi >= 0 ? '+' : '-'} ${Math.abs(phi).toFixed(0)}^\\circ`
        : '';

    switch (type) {
      case 'sine':
        return `${aStr}\\sin(2\\pi \\cdot ${fStr}t${phiStr})`;
      case 'cosine':
        return `${aStr}\\cos(2\\pi \\cdot ${fStr}t${phiStr})`;
      case 'square':
        return `${aStr}\\,\\text{sgn}\\!\\left(\\sin(2\\pi \\cdot ${fStr}t${phiStr})\\right)`;
      case 'triangle':
        return `\\frac{2\\cdot ${aStr}}{\\pi}\\arcsin\\!\\left(\\sin(2\\pi \\cdot ${fStr}t${phiStr})\\right)`;
      case 'sawtooth':
        return `2\\cdot ${aStr}\\left(${fStr}t - \\lfloor ${fStr}t + \\tfrac{1}{2}\\rfloor\\right)`;
      case 'pulse':
        return `${aStr}\\,\\Pi_{D}\\!\\left(${fStr}t${phiStr}\\right)`;
      case 'chirp': {
        const fe = (fEnd ?? f * 3).toFixed(1);
        return `${aStr}\\sin\\!\\left(2\\pi\\left(${fStr}t + \\frac{${fe}-${fStr}}{2T}t^2\\right)\\right)`;
      }
      case 'multitone':
        return `${aStr}\\sum_{m \\in \\{1, 2.5, 5\\}} \\alpha_m \\sin(2\\pi m \\cdot ${fStr}t)`;
    }
  };

  if (config.type !== 'composite') {
    return `x(t) = ${formatSingle(
      config.type,
      config.amplitude,
      config.frequency,
      config.phase,
      config.frequencyEnd
    )} ${dcStr}`;
  }

  const enabled = config.components.filter((c) => c.enabled);
  if (enabled.length === 0) return `x(t) = ${config.dcOffset.toFixed(2)}`;
  const terms = enabled.map((c) =>
    formatSingle(c.type, c.amplitude, c.frequency, c.phase, c.frequencyEnd)
  );
  return `x(t) = ${terms.join(' + ')} ${dcStr}`;
}

export function applyNoiseToSignal(
  clean: number[],
  time: number[],
  noise: NoiseConfig,
  seed = 12345
): { noisy: number[]; noiseOnly: number[] } {
  const n = clean.length;
  const noisy = new Array<number>(n);
  const noiseOnly = new Array<number>(n);

  if (!noise.enabled) {
    for (let i = 0; i < n; i++) {
      noisy[i] = clean[i];
      noiseOnly[i] = 0;
    }
    return { noisy, noiseOnly };
  }

  const rng = createPRNG(seed);
  const pSig = Math.max(signalPower(clean), 1e-6);
  const targetNoisePower = pSig / Math.pow(10, noise.snrDb / 10);
  const stdFromSnr = Math.sqrt(targetNoisePower);

  for (let i = 0; i < n; i++) {
    const t = time[i] ?? i * 0.001;
    let w = 0;

    switch (noise.type) {
      case 'awgn':
        w = stdFromSnr * rng.nextGaussian();
        break;
      case 'gaussian':
        w = Math.sqrt(Math.max(0.001, noise.variance)) * noise.amplitude * rng.nextGaussian();
        break;
      case 'uniform':
        w = noise.amplitude * (rng.next() * 2 - 1) * Math.sqrt(3) * stdFromSnr;
        break;
      case 'impulse': {
        const p = rng.next();
        if (p < noise.impulseProbability) {
          w = (rng.next() > 0.5 ? 1 : -1) * noise.amplitude * 3.5;
        } else {
          w = 0.12 * stdFromSnr * rng.nextGaussian();
        }
        break;
      }
      case 'burst': {
        // Periodic high-energy burst windows
        const inBurst = Math.sin(2 * Math.PI * 3.5 * t) > 0.65;
        w = inBurst
          ? noise.amplitude * 2.4 * rng.nextGaussian()
          : 0.15 * stdFromSnr * rng.nextGaussian();
        break;
      }
      case 'powerline': {
        const fLine = noise.interferenceFreq || 50;
        w =
          noise.amplitude *
            (0.8 * Math.sin(2 * Math.PI * fLine * t) +
              0.25 * Math.sin(2 * Math.PI * (3 * fLine) * t)) +
          0.15 * stdFromSnr * rng.nextGaussian();
        break;
      }
      case 'sinusoidal':
        w =
          noise.amplitude * Math.sin(2 * Math.PI * noise.interferenceFreq * t) +
          0.1 * stdFromSnr * rng.nextGaussian();
        break;
      case 'custom':
        w =
          0.6 * stdFromSnr * rng.nextGaussian() +
          0.4 * noise.amplitude * Math.sin(2 * Math.PI * noise.interferenceFreq * t) +
          (rng.next() < noise.impulseProbability ? noise.amplitude * 2.5 : 0);
        break;
    }

    noiseOnly[i] = w;
    noisy[i] = clean[i] + w;
  }

  return { noisy, noiseOnly };
}
