# SignalLab (SigLab.majn35.ir) — Signal Processing, Telecommunications, EEG & Machine Learning Educational Laboratory

**Created by [Mohammadali Javadinasab](https://majn35.ir)** · Subdomain: **[SigLab.majn35.ir](https://SigLab.majn35.ir)**

A **100% client-side, static browser-based interactive engineering laboratory** with a **Glassmorphism UI** for exploring signal generation, analog & digital modulation, bit-error-rate (BER) vs. SNR Monte Carlo simulations, synthetic EEG brainwave & artifact filtering, Fast Fourier Transform (FFT) & STFT spectrograms, discrete & continuous Wavelet transforms, FIR/IIR filtering, Principal Component Analysis (PCA), FastICA blind source separation, and in-browser TensorFlow.js neural networks.

> **Educational Simulation Notice**
> Synthetic data only. Designed for academic education, signal-processing demonstrations, visualization, and research experimentation. Not intended for clinical EEG diagnosis or real-world telecommunications monitoring.

---

## Custom Subdomain Setup (`majn35.ir` → `SigLab.majn35.ir`)

This repository is pre-configured to deploy directly to **`https://SigLab.majn35.ir`** on GitHub Pages:

1. **`public/CNAME` Included**:
   The file `public/CNAME` contains `SigLab.majn35.ir` and is automatically copied to `dist/CNAME` during `npm run build` and in `.github/workflows/deploy.yml`.

2. **Configure DNS on `majn35.ir`**:
   In your DNS provider panel for `majn35.ir` (e.g., Cloudflare, ArvanCloud, or your domain registrar), add a `CNAME` record:
   - **Type**: `CNAME`
   - **Name / Host**: `SigLab` (or `siglab`)
   - **Target / Content**: `<YOUR_GITHUB_USERNAME>.github.io`
   - **Proxy Status**: DNS Only (recommended initially so GitHub Pages can issue the Let's Encrypt TLS certificate)

3. **Enable Custom Domain in GitHub Pages**:
   - Push this repository to GitHub (`main` branch).
   - Go to **Settings → Pages** in your GitHub repository.
   - Set **Build and deployment → Source** to **GitHub Actions**.
   - Under **Custom domain**, enter `SigLab.majn35.ir` and click **Save**.
   - Enable **Enforce HTTPS**.

---

## Local Development & Production Build

### Local development

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

### Preview

```bash
npm run preview
```
