/**
 * Single-channel subspace projection used by the PCA / ICA pipeline blocks.
 *
 * Interpretation: Singular Spectrum Analysis (SSA). The 1-D signal is
 * delay-embedded into L-dimensional vectors (L = 16), PCA is run on the
 * L×L lag-covariance matrix, and the signal is reconstructed from the top
 * `components` eigenvectors (diagonal averaging). Fewer components ⇒ stronger
 * denoising/smoothing; components ≥ L ⇒ identity. ICA uses the same
 * PCA-whitening subspace (on one channel there is nothing further to unmix).
 */

const EMBED_DIM = 16;

/** Symmetric eigen-decomposition (cyclic Jacobi). Returns eigenpairs sorted by descending eigenvalue. */
function jacobiEigen(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j): number => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: order.map((i) => a[i][i]),
    vectors: order.map((i) => v.map((row) => row[i])), // each entry is one eigenvector
  };
}

export function ssaSubspaceProject(signal: number[], components: number): number[] {
  const N = signal.length;
  const L = Math.min(EMBED_DIM, Math.floor(N / 2));
  const k = Math.round(components);
  if (L < 2 || !Number.isFinite(k) || k >= L) return signal.slice();
  const keep = Math.max(1, k);

  const mean = signal.reduce((s, x) => s + x, 0) / N;
  const x = signal.map((s) => s - mean);
  const K = N - L + 1;

  const cov = Array.from({ length: L }, () => new Array<number>(L).fill(0));
  for (let i = 0; i < K; i++) {
    for (let r = 0; r < L; r++) {
      const xr = x[i + r];
      for (let c = r; c < L; c++) cov[r][c] += xr * x[i + c];
    }
  }
  for (let r = 0; r < L; r++) {
    for (let c = r; c < L; c++) {
      cov[r][c] /= K;
      cov[c][r] = cov[r][c];
    }
  }

  const basis = jacobiEigen(cov).vectors.slice(0, keep);
  const out = new Array<number>(N).fill(0);
  const counts = new Array<number>(N).fill(0);
  const coeffs = new Array<number>(keep);
  for (let i = 0; i < K; i++) {
    for (let m = 0; m < keep; m++) {
      let dot = 0;
      const u = basis[m];
      for (let j = 0; j < L; j++) dot += u[j] * x[i + j];
      coeffs[m] = dot;
    }
    for (let j = 0; j < L; j++) {
      let val = 0;
      for (let m = 0; m < keep; m++) val += coeffs[m] * basis[m][j];
      out[i + j] += val;
      counts[i + j] += 1;
    }
  }
  return out.map((v, i) => v / counts[i] + mean);
}
