import React from 'react';
import { Activity, BookOpen, Brain, Cpu, Filter, Radio, Waves } from 'lucide-react';
import { MathFormula } from '../components/MathBlock';

export const DocumentationPage: React.FC = () => {
  const EQUATIONS = [
    {
      name: 'Discrete Fourier Transform (DFT) & Radix-2 FFT',
      tex: 'X[k] = \\sum_{n=0}^{N-1} x[n]\\,e^{-j\\frac{2\\pi}{N}kn}, \\quad x[n] = \\frac{1}{N}\\sum_{k=0}^{N-1} X[k]\\,e^{+j\\frac{2\\pi}{N}kn}',
      desc: 'Transforms discrete time-domain signals into frequency-domain complex phasors with O(N log₂ N) Cooley-Tukey Radix-2 butterfly computation.',
    },
    {
      name: 'Signal-to-Noise Ratio (SNR) & Bit Error Rate (BER)',
      tex: '\\text{SNR}_{\\text{dB}} = 10\\log_{10}\\!\\left(\\frac{P_{\\text{signal}}}{P_{\\text{noise}}}\\right), \\quad \\text{BER} = \\frac{N_{\\text{errors}}}{N_{\\text{transmitted}}}, \\quad P_{b,\\text{BPSK}} = \\frac{1}{2}\\text{erfc}\\!\\left(\\sqrt{\\frac{E_b}{N_0}}\\right)',
      desc: 'Fundamental performance benchmarks for analog and digital telecommunications links over Additive White Gaussian Noise (AWGN) channels.',
    },
    {
      name: 'Continuous & Discrete Wavelet Transform (CWT / DWT)',
      tex: 'W_x(a, b) = \\frac{1}{\\sqrt{|a|}}\\int_{-\\infty}^{\\infty} x(t)\\,\\psi^*\\!\\left(\\frac{t - b}{a}\\right)dt, \\quad cA_{j+1}[k] = \\sum_n cA_j[n]\\,h[n-2k]',
      desc: 'Multi-resolution time-frequency localization using Haar, Daubechies D4, Symlet S4, and Morlet wavelet bases.',
    },
    {
      name: 'Digital Filtering (FIR Convolution & Biquad IIR Transfer Function)',
      tex: 'H(z) = \\frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}, \\quad y[n] = \\sum_{k=0}^{M} h[k]\\,x[n-k]',
      desc: 'Frequency-selective attenuation of out-of-band noise and power-line interference.',
    },
    {
      name: 'Principal Component Analysis (PCA) & FastICA Blind Source Separation',
      tex: '\\mathbf{\\Sigma}\\mathbf{v}_i = \\lambda_i\\mathbf{v}_i, \\quad \\mathbf{w}^+ = \\mathbb{E}\\{\\mathbf{z}\\tanh(\\mathbf{w}^\\top\\mathbf{z})\\} - \\mathbb{E}\\{1-\\tanh^2(\\mathbf{w}^\\top\\mathbf{z})\\}\\mathbf{w}',
      desc: 'Orthogonal variance maximization (PCA) and higher-order non-Gaussian negentropy maximization (FastICA) for multi-channel source separation.',
    },
    {
      name: '1D Convolutional Neural Networks & Denoising Autoencoders',
      tex: 'z_k[n] = \\sigma\\!\\left(b_k + \\sum_{m=0}^{K-1} w_k[m]x[n+m]\\right), \\quad \\mathcal{L}_{\\text{AE}} = \\frac{1}{N}\\left\\|\\mathbf{x}_{\\text{clean}} - g_\\phi(f_\\theta(\\mathbf{\\tilde{x}}))\\right\\|_2^2',
      desc: 'Shift-invariant temporal feature extraction and nonlinear bottleneck manifold compression trained directly in the browser.',
    },
  ];

  const MODULES_OVERVIEW = [
    {
      icon: Waves,
      title: 'Signal Synthesis & Spectral Analysis',
      body: 'Generate canonical periodic waveforms, linear frequency-swept chirps, and multi-harmonic composite signals. Analyze spectral leakage across Rectangular, Hann, Hamming, Blackman, and Flat-top windows using Radix-2 FFT and Short-Time Fourier Transform (STFT) spectrograms.',
    },
    {
      icon: Radio,
      title: 'Analog & Digital Telecommunications',
      body: 'Simulate AM, DSB-SC, SSB, FM, and PM analog transceivers alongside ASK, FSK, BPSK, QPSK, 8-PSK, 16-QAM, and 64-QAM digital constellations. Compare empirical Monte Carlo BER curves against theoretical Q-function bounds.',
    },
    {
      icon: Activity,
      title: 'Synthetic EEG & Artifact Rejection',
      body: 'Synthesize Delta (0.5–4 Hz), Theta (4–8 Hz), Alpha (8–13 Hz), Beta (13–30 Hz), and Gamma (30–80 Hz) cortical rhythms corrupted by EOG eye blinks, cranial EMG bursts, baseline drift, and 50/60 Hz hum.',
    },
    {
      icon: Filter,
      title: 'Wavelets & Digital Filter Design',
      body: 'Design Butterworth Biquad IIR, Windowed-Sinc FIR, Notch, and Moving Average filters or decompose non-stationary transients via Haar, Daubechies D4, Symlet S4, and Morlet wavelet scalograms.',
    },
    {
      icon: Cpu,
      title: 'Subspace Projection (PCA & FastICA)',
      body: 'Diagonalize multidimensional sensor covariance matrices via Jacobi eigendecomposition (PCA) and unmix statistically independent sources from linear sensor mixtures using FastICA.',
    },
    {
      icon: Brain,
      title: 'In-Browser Neural Network Laboratory',
      body: 'Train Dense MLP, 1D-CNN, Denoising Autoencoder, and Simple RNN architectures in TensorFlow.js with real-time epoch loss/accuracy telemetry, confusion matrices, and learned filter inspection.',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-6 flex flex-col gap-3">
        <div className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400">
          Academic Reference Manual · by Mohammadali Javadinasab
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Signal Processing, Telecommunications, EEG & Machine Learning Laboratory Reference
        </h1>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-4xl">
          Comprehensive mathematical formulations, digital signal processing theory, and laboratory module specifications for academic education, algorithm experimentation, and interactive engineering visualization.
        </p>
      </div>

      {/* Mathematical Compendium */}
      <div className="neu-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-base font-bold tracking-tight">
            Core Mathematical Formulations (LaTeX Reference)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EQUATIONS.map((eq) => (
            <div key={eq.name} className="neu-inset p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-sky-700 dark:text-sky-400">{eq.name}</h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{eq.desc}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-slate-300/60 dark:border-slate-800 overflow-x-auto">
                <MathFormula tex={eq.tex} block={true} className="text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Laboratory Modules Engineering Guide */}
      <div className="neu-card p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold tracking-tight">
          Laboratory Modules & Scientific Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES_OVERVIEW.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.title} className="neu-inset p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <h3 className="text-xs font-bold">{mod.title}</h3>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {mod.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
