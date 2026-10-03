import React from 'react';
import { BookOpen, Cpu, Globe, ShieldCheck, Terminal } from 'lucide-react';
import { MathFormula } from '../components/MathBlock';

export const DocumentationPage: React.FC = () => {
  const EQUATIONS = [
    {
      name: 'Discrete Fourier Transform (DFT)',
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
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-6 flex flex-col gap-3">
        <div className="text-xs font-mono text-sky-500">
          Architecture & Academic Reference Manual
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Signal Processing, Telecommunications, EEG & Machine Learning Laboratory Documentation
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-4xl">
          This application is a <strong>100% client-side, static browser laboratory</strong> engineered to run natively on GitHub Pages without any backend server, database, or external API dependencies. All numerical DSP algorithms, Monte Carlo simulations, IndexedDB storage, and TensorFlow.js neural networks execute locally inside the user&apos;s browser.
        </p>
      </div>

      {/* Mathematical Compendium */}
      <div className="neu-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-500" />
          <h2 className="text-base font-bold tracking-tight">
            Core Mathematical Formulations (LaTeX Reference)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EQUATIONS.map((eq) => (
            <div key={eq.name} className="neu-inset p-4 flex flex-col justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-sky-500">{eq.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{eq.desc}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/70 dark:bg-slate-900/70 overflow-x-auto">
                <MathFormula tex={eq.tex} block={true} className="text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GitHub Pages Deployment & Local Build Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neu-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <h2 className="text-base font-bold tracking-tight">
              Local Development & Static Build Commands
            </h2>
          </div>

          <div className="neu-inset p-4 font-mono text-xs flex flex-col gap-2">
            <div className="text-slate-400"># 1. Install dependencies</div>
            <div className="font-semibold text-sky-500">npm install</div>
            <div className="text-slate-400 mt-2"># 2. Start local Vite development server</div>
            <div className="font-semibold text-sky-500">npm run dev</div>
            <div className="text-slate-400 mt-2"># 3. Compile static production bundle into dist/</div>
            <div className="font-semibold text-emerald-500">npm run build</div>
            <div className="text-slate-400 mt-2"># 4. Preview production static bundle locally</div>
            <div className="font-semibold text-sky-500">npm run preview</div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Running <code className="font-mono">npm run build</code> outputs a self-contained{' '}
            <code className="font-mono">dist/</code> folder containing <code className="font-mono">index.html</code> and bundled JS/CSS assets configured with relative base paths (<code className="font-mono">base: &apos;./&apos;</code>) so it works on any domain or repository subpath.
          </p>
        </div>

        <div className="neu-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-500" />
            <h2 className="text-base font-bold tracking-tight">
              Deploying to GitHub Pages (Step-by-Step)
            </h2>
          </div>

          <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal list-inside leading-relaxed">
            <li>
              <strong>Create a GitHub Repository</strong> (e.g.,{' '}
              <code className="font-mono">https://github.com/USERNAME/signal-lab</code>).
            </li>
            <li>
              <strong>Push the project</strong> to the <code className="font-mono">main</code> branch.
            </li>
            <li>
              In your GitHub repository, navigate to <strong>Settings → Pages</strong>.
            </li>
            <li>
              Under <strong>Build and deployment → Source</strong>, select{' '}
              <strong>GitHub Actions</strong>.
            </li>
            <li>
              The included workflow <code className="font-mono">.github/workflows/deploy.yml</code>{' '}
              automatically installs dependencies, runs <code className="font-mono">npm run build</code>, and deploys <code className="font-mono">dist/</code> to{' '}
              <code className="font-mono">https://USERNAME.github.io/REPOSITORY/</code>.
            </li>
          </ol>

          <div className="neu-inset p-3.5 flex items-start gap-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong>100% Offline-Friendly Client-Side Execution:</strong> Uses browser Web Workers, HTML5 Canvas, IndexedDB, LocalStorage, and TensorFlow.js WebGL/CPU backends with zero server dependencies.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
