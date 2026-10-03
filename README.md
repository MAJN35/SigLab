# SignalLab — Signal Processing, Telecommunications, EEG & Machine Learning Educational Laboratory

A **100% client-side, static browser-based interactive engineering laboratory** for exploring signal generation, analog & digital modulation, bit-error-rate (BER) vs. SNR Monte Carlo simulations, synthetic EEG brainwave & artifact filtering, Fast Fourier Transform (FFT) & STFT spectrograms, discrete & continuous Wavelet transforms, FIR/IIR filtering, Principal Component Analysis (PCA), FastICA blind source separation, and in-browser TensorFlow.js neural networks.

> **Educational Simulation Notice**
> Synthetic data only. Designed for academic education, signal-processing demonstrations, visualization, and research experimentation. Not intended for clinical EEG diagnosis or real-world telecommunications monitoring.

---

## Architecture Highlights

- **Zero Backend Required**: Runs 100% in the user's browser using TypeScript numerical DSP routines, HTML5 Canvas interactive plotting, Web Workers for Monte Carlo BER simulations, IndexedDB for persistent experiment and custom sample storage, and TensorFlow.js for client-side deep learning.
- **GitHub Pages Ready**: Configured with `base: './'` in `vite.config.ts`, hash-compatible SPA state routing, and an automated `.github/workflows/deploy.yml` pipeline so it deploys cleanly to `https://USERNAME.github.io/REPOSITORY/` without path configuration issues.
- **Neumorphic Scientific Interface**: Supports both **Light** and **Dark** calibrated laboratory themes, interactive zoom/pan/hover/crosshair/PNG-export scientific charts, LaTeX mathematical derivations via KaTeX, and reproducible random seeds.

---

## Project Structure

```text
signal-lab/
├── public/
├── src/
│   ├── components/          # Neumorphic UI controls, Interactive Scientific Canvas Plot, LaTeX Math block, Pipeline Editor
│   ├── pages/               # 14 Laboratory Modules (Dashboard, Signal Gen, Telecom, EEG, FFT, Wavelets, Filters, PCA, ICA, BER, ML, etc.)
│   ├── simulations/
│   │   ├── signals/         # Waveform synthesis, composite generator, noise injection (AWGN, impulse, burst, power-line)
│   │   ├── modulation/      # Analog (AM, DSB-SC, SSB, FM, PM) & Digital (ASK, FSK, BPSK, QPSK, 8-PSK, 16-QAM, 64-QAM)
│   │   ├── eeg/             # 5-band Synthetic EEG generator & physiological artifact simulator
│   │   ├── fft/             # Radix-2 Cooley-Tukey FFT, IFFT, Window functions, PSD, STFT Spectrogram
│   │   ├── wavelets/        # Haar, Daubechies D4, Symlet S4, and Morlet Continuous Wavelet Scalogram
│   │   ├── filters/         # Low-pass, High-pass, Band-pass, Band-stop, Notch, Moving Average, Windowed-Sinc FIR & Biquad IIR
│   │   ├── pca/             # Covariance matrix eigendecomposition (Jacobi method), 2D/3D projection & subspace reconstruction
│   │   ├── ica/             # FastICA kurtosis/negentropy fixed-point iteration for blind source separation
│   │   └── ml/              # TensorFlow.js browser training (Dense, 1D-CNN, Autoencoder, Sequence RNN)
│   ├── workers/             # Web Worker for high-speed Monte Carlo BER vs. SNR simulation
│   ├── store/               # Global reactive lab state, presets, and IndexedDB storage manager
│   ├── utils/               # Seeded PRNG (Mulberry32), complex math, DSP metrics (SNR, THD, RMSE, Peak finder)
│   ├── types/               # TypeScript interfaces for signals, pipelines, samples, and experiments
│   └── App.tsx
├── .github/
│   └── workflows/
│       └── deploy.yml       # Automated GitHub Pages build & deployment workflow
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Local Development

Install dependencies and launch the development server:

```bash
npm install
npm run dev
```

The application will start at `http://localhost:3000`.

---

## Production Build & Local Preview

Generate the static production bundle into `dist/`:

```bash
npm run build
```

Preview the compiled static output locally:

```bash
npm run preview
```

---

## GitHub Pages Deployment Instructions

This project is pre-configured to run under any GitHub Pages URL structure (`https://USERNAME.github.io/REPOSITORY/` or a custom domain).

### Step-by-Step Deployment

1. **Create a GitHub Repository**:
   Create a new repository on GitHub (e.g., `signal-lab`).

2. **Push the Project**:
   Initialize git (if not already initialized) and push to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Signal Processing, Telecom, EEG & ML Laboratory"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Open your repository on GitHub.
   - Navigate to **Settings** → **Pages** (in the left sidebar).
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.

4. **Automatic Build & Deployment**:
   - Pushing to the `main` branch triggers `.github/workflows/deploy.yml`.
   - GitHub Actions installs dependencies (`npm install`), runs `npm run build`, and deploys `dist/` directly to GitHub Pages.
   - Once the workflow completes, your live laboratory URL (`https://USERNAME.github.io/REPOSITORY/`) will appear in the **Actions** tab and under **Settings → Pages**.

### Configuring the Base Path (Optional)

By default, `vite.config.ts` uses `base: './'` (relative asset paths), which automatically works for **any** repository name without manual editing. If you prefer an explicit subpath, you can set:

```ts
// vite.config.ts
export default defineConfig({
  base: '/REPOSITORY_NAME/',
  // ...
});
```
