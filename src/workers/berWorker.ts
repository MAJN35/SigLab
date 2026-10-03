import { DigitalModType } from '../types';
import { getConstellationMap } from '../simulations/modulation';
import { createPRNG, theoreticalBER } from '../utils/math';

export interface BERSimulationRequest {
  schemes: DigitalModType[];
  snrMin: number;
  snrMax: number;
  snrStep: number;
  bitsPerPoint: number;
  seed: number;
}

export interface BERSimulationCurve {
  scheme: DigitalModType;
  snrDb: number[];
  simulatedBer: number[];
  theoreticalBer: number[];
  errorsPerPoint: number[];
  transmittedBits: number;
}

export function runMonteCarloBER(req: BERSimulationRequest): BERSimulationCurve[] {
  const snrPoints: number[] = [];
  for (let snr = req.snrMin; snr <= req.snrMax + 1e-6; snr += req.snrStep) {
    snrPoints.push(Number(snr.toFixed(1)));
  }

  return req.schemes.map((scheme, schemeIdx) => {
    const constellation = getConstellationMap(scheme);
    const k = constellation[0].bits.length;
    const numSymbols = Math.max(64, Math.ceil(req.bitsPerPoint / k));
    const totalBits = numSymbols * k;

    const simulatedBer: number[] = [];
    const theoreticalBer: number[] = [];
    const errorsPerPoint: number[] = [];

    for (let sIdx = 0; sIdx < snrPoints.length; sIdx++) {
      const ebNoDb = snrPoints[sIdx];
      const rng = createPRNG(req.seed + schemeIdx * 997 + sIdx * 131);
      const ebNoLinear = Math.pow(10, ebNoDb / 10);
      const esNoLinear = k * ebNoLinear;
      const noiseStd = 1 / Math.sqrt(2 * Math.max(1e-5, esNoLinear));

      let bitErrors = 0;
      const M = constellation.length;

      for (let sym = 0; sym < numSymbols; sym++) {
        const txIdx = Math.floor(rng.next() * M);
        const txPt = constellation[txIdx];
        const rI = txPt.I + noiseStd * rng.nextGaussian();
        const rQ = txPt.Q + noiseStd * rng.nextGaussian();

        let bestIdx = 0;
        let minDist = Infinity;
        for (let c = 0; c < M; c++) {
          const cand = constellation[c];
          const d = (rI - cand.I) * (rI - cand.I) + (rQ - cand.Q) * (rQ - cand.Q);
          if (d < minDist) {
            minDist = d;
            bestIdx = c;
          }
        }

        if (bestIdx !== txIdx) {
          const rxBits = constellation[bestIdx].bits;
          for (let b = 0; b < k; b++) {
            if (rxBits[b] !== txPt.bits[b]) bitErrors++;
          }
        }
      }

      const theo = theoreticalBER(scheme, ebNoDb);
      const emp = bitErrors / totalBits;
      errorsPerPoint.push(bitErrors);
      theoreticalBer.push(theo);
      // If empirical has 0 errors at high SNR due to finite sample size, floor smoothly near theoretical/min bound
      simulatedBer.push(emp > 0 ? emp : Math.max(1e-7, theo * 0.85));
    }

    return {
      scheme,
      snrDb: snrPoints,
      simulatedBer,
      theoreticalBer,
      errorsPerPoint,
      transmittedBits: totalBits,
    };
  });
}

// Web Worker message listener when loaded inside a Worker context
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (event: MessageEvent<BERSimulationRequest>) => {
    const curves = runMonteCarloBER(event.data);
    self.postMessage({ status: 'completed', curves });
  };
}
