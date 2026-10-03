import { PCAConfig } from '../../types';
import { calculateRMSE, createPRNG } from '../../utils/math';

export interface PCAResult {
  dataMatrix: number[][]; // [N][D] centered original data
  reconstructedMatrix: number[][]; // [N][D] rank-k reconstructed
  eigenvalues: number[];
  explainedVarianceRatio: number[];
  cumulativeVarianceRatio: number[];
  principalAxes: number[][]; // [D][D] eigenvectors (rows = PCs)
  projected2D: { pc1: number; pc2: number; cluster: number }[];
  projected3D: { pc1: number; pc2: number; pc3: number; cluster: number }[];
  reconstructionRmse: number;
  timeSeriesOriginal: number[];
  timeSeriesReconstructed: number[];
}

/**
 * Symmetric matrix Jacobi eigenvalue algorithm (returns sorted eigenvalues and eigenvectors)
 */
export function jacobiEigenDecomposition(cov: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][]; // Each row is a unit eigenvector
} {
  const D = cov.length;
  const A = cov.map((r) => [...r]);
  const V: number[][] = Array.from({ length: D }, (_, i) =>
    Array.from({ length: D }, (__, j) => (i === j ? 1 : 0))
  );

  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < D; i++) {
      for (let j = i + 1; j < D; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxVal < 1e-10) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];
    const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let i = 0; i < D; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = c * aip - s * aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * aip + c * aiq;
        A[q][i] = A[i][q];
      }
    }

    A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < D; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip - s * viq;
      V[i][q] = s * vip + c * viq;
    }
  }

  const indices = Array.from({ length: D }, (_, i) => i);
  indices.sort((a, b) => A[b][b] - A[a][a]);

  const eigenvalues = indices.map((idx) => Math.max(0, A[idx][idx]));
  // Transpose columns of V into rows
  const eigenvectors = indices.map((colIdx) => V.map((row) => row[colIdx]));

  return { eigenvalues, eigenvectors };
}

export function runPCAExperiment(config: PCAConfig, seed = 12345): PCAResult {
  const rng = createPRNG(seed);
  const N = Math.max(60, Math.min(600, config.numSamples));
  const D = Math.max(3, Math.min(8, config.numDimensions));
  const k = Math.max(1, Math.min(D, config.numComponents));

  // Generate latent structured oscillatory + cluster signals embedded in D dimensions
  const rawData: number[][] = [];
  const clusters: number[] = [];

  for (let i = 0; i < N; i++) {
    const t = (i / N) * 4 * Math.PI;
    const cluster = i % 3;
    clusters.push(cluster);

    // 3 underlying latent factors
    const z1 = 2.8 * Math.sin(t) + (cluster - 1) * 1.2 * config.correlationStrength;
    const z2 = 1.6 * Math.cos(2 * t) + (cluster === 1 ? 1.1 : -0.6);
    const z3 = 0.85 * Math.sin(3 * t + 0.5);

    const row = new Array<number>(D);
    for (let d = 0; d < D; d++) {
      const w1 = Math.cos((d * Math.PI) / D + 0.2);
      const w2 = Math.sin((d * Math.PI) / D + 0.5) * (1.1 - 0.3 * config.correlationStrength);
      const w3 = (d % 2 === 0 ? 0.5 : -0.5) * (1 - config.correlationStrength * 0.6);
      row[d] = w1 * z1 + w2 * z2 + w3 * z3 + config.noiseLevel * rng.nextGaussian();
    }
    rawData.push(row);
  }

  // Mean center each dimension
  const means = new Array<number>(D).fill(0);
  for (let i = 0; i < N; i++) {
    for (let d = 0; d < D; d++) means[d] += rawData[i][d];
  }
  for (let d = 0; d < D; d++) means[d] /= N;

  const dataMatrix = rawData.map((row) => row.map((v, d) => v - means[d]));

  // Covariance matrix (D x D)
  const cov: number[][] = Array.from({ length: D }, () => new Array<number>(D).fill(0));
  for (let i = 0; i < N; i++) {
    for (let r = 0; r < D; r++) {
      for (let c = r; c < D; c++) {
        cov[r][c] += dataMatrix[i][r] * dataMatrix[i][c];
      }
    }
  }
  for (let r = 0; r < D; r++) {
    for (let c = r; c < D; c++) {
      cov[r][c] /= N - 1;
      cov[c][r] = cov[r][c];
    }
  }

  const { eigenvalues, eigenvectors } = jacobiEigenDecomposition(cov);
  const totalVar = Math.max(1e-9, eigenvalues.reduce((a, b) => a + b, 0));
  const explainedVarianceRatio = eigenvalues.map((ev) => (ev / totalVar) * 100);
  const cumulativeVarianceRatio: number[] = [];
  let running = 0;
  for (const r of explainedVarianceRatio) {
    running += r;
    cumulativeVarianceRatio.push(Math.min(100, running));
  }

  // Project onto Principal Components & reconstruct using top k components
  const projected2D: { pc1: number; pc2: number; cluster: number }[] = [];
  const projected3D: { pc1: number; pc2: number; pc3: number; cluster: number }[] = [];
  const reconstructedMatrix: number[][] = [];

  for (let i = 0; i < N; i++) {
    const x = dataMatrix[i];
    const scores = new Array<number>(D).fill(0);
    for (let c = 0; c < D; c++) {
      let dot = 0;
      for (let d = 0; d < D; d++) dot += x[d] * eigenvectors[c][d];
      scores[c] = dot;
    }

    projected2D.push({ pc1: scores[0] ?? 0, pc2: scores[1] ?? 0, cluster: clusters[i] });
    projected3D.push({
      pc1: scores[0] ?? 0,
      pc2: scores[1] ?? 0,
      pc3: scores[2] ?? 0,
      cluster: clusters[i],
    });

    const xHat = new Array<number>(D).fill(0);
    for (let c = 0; c < k; c++) {
      for (let d = 0; d < D; d++) {
        xHat[d] += scores[c] * eigenvectors[c][d];
      }
    }
    reconstructedMatrix.push(xHat);
  }

  const flatOrig = dataMatrix.flat();
  const flatRec = reconstructedMatrix.flat();
  const reconstructionRmse = calculateRMSE(flatOrig, flatRec);

  return {
    dataMatrix,
    reconstructedMatrix,
    eigenvalues,
    explainedVarianceRatio,
    cumulativeVarianceRatio,
    principalAxes: eigenvectors,
    projected2D,
    projected3D,
    reconstructionRmse,
    timeSeriesOriginal: dataMatrix.map((r) => r[0]),
    timeSeriesReconstructed: reconstructedMatrix.map((r) => r[0]),
  };
}
