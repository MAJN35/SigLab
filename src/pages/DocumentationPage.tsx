import React from 'react';
import { Activity, BookOpen, Brain, Cpu, Filter, Radio, Waves } from 'lucide-react';
import { MathFormula } from '../components/MathBlock';
import { useLab } from '../store/LabContext';

export const DocumentationPage: React.FC = () => {
  const { lang } = useLab();

  const EQUATIONS = [
    {
      name:
        lang === 'fa'
          ? 'تبدیل فوریه گسسته (DFT) و الگوریتم سریع پایه ۲ (Radix-2 FFT)'
          : 'Discrete Fourier Transform (DFT) & Radix-2 FFT',
      tex: 'X[k] = \\sum_{n=0}^{N-1} x[n]\\,e^{-j\\frac{2\\pi}{N}kn}, \\quad x[n] = \\frac{1}{N}\\sum_{k=0}^{N-1} X[k]\\,e^{+j\\frac{2\\pi}{N}kn}',
      desc:
        lang === 'fa'
          ? 'تبدیل سیگنال‌های حوزه زمان گسسته به فازورهای مختلط حوزه فرکانس با پیچیدگی محاسباتی O(N log₂ N) به روش پروانه‌ای کولی-توکی.'
          : 'Transforms discrete time-domain signals into frequency-domain complex phasors with O(N log₂ N) Cooley-Tukey Radix-2 butterfly computation.',
    },
    {
      name:
        lang === 'fa'
          ? 'نسبت سیگنال به نویز (SNR) و نرخ خطای بیت (BER)'
          : 'Signal-to-Noise Ratio (SNR) & Bit Error Rate (BER)',
      tex: '\\text{SNR}_{\\text{dB}} = 10\\log_{10}\\!\\left(\\frac{P_{\\text{signal}}}{P_{\\text{noise}}}\\right), \\quad \\text{BER} = \\frac{N_{\\text{errors}}}{N_{\\text{transmitted}}}, \\quad P_{b,\\text{BPSK}} = \\frac{1}{2}\\text{erfc}\\!\\left(\\sqrt{\\frac{E_b}{N_0}}\\right)',
      desc:
        lang === 'fa'
          ? 'معیارهای بنیادین ارزیابی عملکرد لینک‌های مخابرات آنالوگ و دیجیتال در کانال‌های نویز سفید گوسی جمع‌شونده (AWGN).'
          : 'Fundamental performance benchmarks for analog and digital telecommunications links over Additive White Gaussian Noise (AWGN) channels.',
    },
    {
      name:
        lang === 'fa'
          ? 'تبدیل موجک پیوسته و گسسته (CWT / DWT)'
          : 'Continuous & Discrete Wavelet Transform (CWT / DWT)',
      tex: 'W_x(a, b) = \\frac{1}{\\sqrt{|a|}}\\int_{-\\infty}^{\\infty} x(t)\\,\\psi^*\\!\\left(\\frac{t - b}{a}\\right)dt, \\quad cA_{j+1}[k] = \\sum_n cA_j[n]\\,h[n-2k]',
      desc:
        lang === 'fa'
          ? 'مکان‌یابی چندتفکیکی زمان-فرکانس با استفاده از پایه‌های موجک هار (Haar)، دوبشی D4، سیملت S4 و مورله (Morlet).'
          : 'Multi-resolution time-frequency localization using Haar, Daubechies D4, Symlet S4, and Morlet wavelet bases.',
    },
    {
      name:
        lang === 'fa'
          ? 'فیلترینگ دیجیتال (کانولوشن FIR و تابع تبدیل IIR دوقطبی)'
          : 'Digital Filtering (FIR Convolution & Biquad IIR Transfer Function)',
      tex: 'H(z) = \\frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}, \\quad y[n] = \\sum_{k=0}^{M} h[k]\\,x[n-k]',
      desc:
        lang === 'fa'
          ? 'تضعیف انتخاب‌گر فرکانسی نویز خارج از باند و تداخل برق شهر ۵۰/۶۰ هرتز.'
          : 'Frequency-selective attenuation of out-of-band noise and power-line interference.',
    },
    {
      name:
        lang === 'fa'
          ? 'تحلیل مؤلفه‌های اصلی (PCA) و جداسازی کور منابع با FastICA'
          : 'Principal Component Analysis (PCA) & FastICA Blind Source Separation',
      tex: '\\mathbf{\\Sigma}\\mathbf{v}_i = \\lambda_i\\mathbf{v}_i, \\quad \\mathbf{w}^+ = \\mathbb{E}\\{\\mathbf{z}\\tanh(\\mathbf{w}^\\top\\mathbf{z})\\} - \\mathbb{E}\\{1-\\tanh^2(\\mathbf{w}^\\top\\mathbf{z})\\}\\mathbf{w}',
      desc:
        lang === 'fa'
          ? 'بیشینه‌سازی واریانس متعامد (PCA) و بیشینه‌سازی نِگ‌انتروپی غیرگوسی مرتبه بالا (FastICA) برای جداسازی سیگنال‌های چندکاناله.'
          : 'Orthogonal variance maximization (PCA) and higher-order non-Gaussian negentropy maximization (FastICA) for multi-channel source separation.',
    },
    {
      name:
        lang === 'fa'
          ? 'شبکه‌های عصبی کانولوشنی یک‌بعدی (1D-CNN) و خودرمزگذارهای حذف نویز'
          : '1D Convolutional Neural Networks & Denoising Autoencoders',
      tex: 'z_k[n] = \\sigma\\!\\left(b_k + \\sum_{m=0}^{K-1} w_k[m]x[n+m]\\right), \\quad \\mathcal{L}_{\\text{AE}} = \\frac{1}{N}\\left\\|\\mathbf{x}_{\\text{clean}} - g_\\phi(f_\\theta(\\mathbf{\\tilde{x}}))\\right\\|_2^2',
      desc:
        lang === 'fa'
          ? 'استخراج ویژگی‌های زمانی تغییرناپذیر با شیفت و فشرده‌سازی منیفولد غیرخطی مستقیماً در مرورگر با TensorFlow.js.'
          : 'Shift-invariant temporal feature extraction and nonlinear bottleneck manifold compression trained directly in the browser.',
    },
  ];

  const MODULES_OVERVIEW = [
    {
      icon: Waves,
      title:
        lang === 'fa'
          ? 'تولید سیگنال و تحلیل طیفی فوریه'
          : 'Signal Synthesis & Spectral Analysis',
      body:
        lang === 'fa'
          ? 'تولید شکل‌موج‌های متناوب استاندارد، سیگنال‌های چرپ با جاروب فرکانسی خطی و سیگنال‌های ترکیبی چندهارمونیکی همراه با تحلیل نشت طیفی در پنجره‌های مستطیلی، هان، همینگ، بلک‌من و فلت‌تاپ.'
          : 'Generate canonical periodic waveforms, linear frequency-swept chirps, and multi-harmonic composite signals. Analyze spectral leakage across Rectangular, Hann, Hamming, Blackman, and Flat-top windows using Radix-2 FFT and Short-Time Fourier Transform (STFT) spectrograms.',
    },
    {
      icon: Radio,
      title:
        lang === 'fa'
          ? 'مخابرات آنالوگ و دیجیتال'
          : 'Analog & Digital Telecommunications',
      body:
        lang === 'fa'
          ? 'شبیه‌سازی فرستنده و گیرنده AM، DSB-SC، SSB، FM و PM در کنار صورت‌های فلکی دیجیتال ASK، FSK، BPSK، QPSK، 8-PSK، 16-QAM و 64-QAM و مقایسه منحنی‌های BER مونت‌کارلو با تئوری.'
          : 'Simulate AM, DSB-SC, SSB, FM, and PM analog transceivers alongside ASK, FSK, BPSK, QPSK, 8-PSK, 16-QAM, and 64-QAM digital constellations. Compare empirical Monte Carlo BER curves against theoretical Q-function bounds.',
    },
    {
      icon: Activity,
      title:
        lang === 'fa'
          ? 'شبیه‌ساز سیگنال مغزی (EEG) و حذف آرتیفکت'
          : 'Synthetic EEG & Artifact Rejection',
      body:
        lang === 'fa'
          ? 'تولید ریتم‌های قشری دلتا (۰.۵ تا ۴ هرتز)، تتا (۴ تا ۸ هرتز)، آلفا (۸ تا ۱۳ هرتز)، بتا (۱۳ تا ۳۰ هرتز) و گاما (۳۰ تا ۸۰ هرتز) همراه با آرتیفکت پلک زدن، عضله (EMG) و برق شهر.'
          : 'Synthesize Delta (0.5–4 Hz), Theta (4–8 Hz), Alpha (8–13 Hz), Beta (13–30 Hz), and Gamma (30–80 Hz) cortical rhythms corrupted by EOG eye blinks, cranial EMG bursts, baseline drift, and 50/60 Hz hum.',
    },
    {
      icon: Filter,
      title:
        lang === 'fa'
          ? 'تبدیل موجک و طراحی فیلتر دیجیتال'
          : 'Wavelets & Digital Filter Design',
      body:
        lang === 'fa'
          ? 'طراحی فیلترهای باترورث IIR، فیلترهای FIR سینک پنجره‌دار، فیلتر ناچ و میانگین متحرک، و تجزیه سیگنال‌های غیرایستا با موجک‌های Haar، db4، sym4 و Morlet.'
          : 'Design Butterworth Biquad IIR, Windowed-Sinc FIR, Notch, and Moving Average filters or decompose non-stationary transients via Haar, Daubechies D4, Symlet S4, and Morlet wavelet scalograms.',
    },
    {
      icon: Cpu,
      title:
        lang === 'fa'
          ? 'تصویرسازی زیرفضا (PCA و FastICA)'
          : 'Subspace Projection (PCA & FastICA)',
      body:
        lang === 'fa'
          ? 'قطری‌سازی ماتریس کوواریانس حسگرهای چندبعدی با تجزیه مقادیر ویژه ژاکوبی (PCA) و جداسازی کور منابع مستقل آماری از مخلوط‌های خطی با الگوریتم FastICA.'
          : 'Diagonalize multidimensional sensor covariance matrices via Jacobi eigendecomposition (PCA) and unmix statistically independent sources from linear sensor mixtures using FastICA.',
    },
    {
      icon: Brain,
      title:
        lang === 'fa'
          ? 'آزمایشگاه شبکه عصبی و یادگیری عمیق در مرورگر'
          : 'In-Browser Neural Network Laboratory',
      body:
        lang === 'fa'
          ? 'آموزش معماری‌های Dense MLP، 1D-CNN، خودرمزگذار حذف نویز (Autoencoder) و RNN در TensorFlow.js با نمایش زنده منحنی خطا و دقت، ماتریس درهم‌ریختگی و وزن فیلترها.'
          : 'Train Dense MLP, 1D-CNN, Denoising Autoencoder, and Simple RNN architectures in TensorFlow.js with real-time epoch loss/accuracy telemetry, confusion matrices, and learned filter inspection.',
    },
  ];

  const VISUAL_GUIDES = [
    {
      img: '/src/assets/images/dsp_fourier_diagram_1791208364636.jpg',
      title:
        lang === 'fa'
          ? 'تجزیه طیفی فوریه و زمان-فرکانس'
          : 'Fourier & Time-Frequency Decomposition',
      caption:
        lang === 'fa'
          ? 'نگاشت سیگنال‌های ترکیبی حوزه زمان به مؤلفه‌های هارمونیکی فرکانسی و اسکالوگرام‌های موجک.'
          : 'Mapping composite time-domain waveforms into orthogonal harmonic phasors and wavelet scalograms.',
    },
    {
      img: '/src/assets/images/telecom_modulation_diagram_1791208389939.jpg',
      title:
        lang === 'fa'
          ? 'مدولاسیون حامل و صورت فلکی IQ'
          : 'Carrier Modulation & IQ Constellations',
      caption:
        lang === 'fa'
          ? 'انتقال اطلاعات باند پایه روی حامل‌های RF آنالوگ و سمبل‌های متعامد QPSK/QAM در حضور نویز AWGN.'
          : 'Encoding baseband information onto passband RF carriers and quadrature QPSK/QAM symbol constellations.',
    },
    {
      img: '/src/assets/images/eeg_cortical_map_1791208377997.jpg',
      title:
        lang === 'fa'
          ? 'ریتم‌های قشری EEG و جداسازی آرتیفکت'
          : 'Cortical EEG Rhythms & Artifact Rejection',
      caption:
        lang === 'fa'
          ? 'شبیه‌سازی باندهای فرکانسی مغز (δ, θ, α, β, γ) و پاک‌سازی تداخل‌های فیزیولوژیک با فیلترهای دیجیتال و ICA.'
          : 'Synthesizing brain frequency bands (δ, θ, α, β, γ) and suppressing physiological artifacts via DSP & ICA.',
    },
    {
      img: '/src/assets/images/neural_dsp_architecture_1791208404112.jpg',
      title:
        lang === 'fa'
          ? 'یادگیری عمیق و فیلترهای کانولوشنی ۱ بعدی'
          : 'Deep Learning & 1D Convolutional Kernels',
      caption:
        lang === 'fa'
          ? 'آموزش مستقیم شبکه‌های عصبی در مرورگر برای طبقه‌بندی شکل‌موج و بازسازی سیگنال‌های نویزی.'
          : 'In-browser neural network training for automatic waveform classification and autoencoder denoising.',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-6 flex flex-col gap-3">
        <div className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400">
          {lang === 'fa'
            ? 'مرجع علمی و راهنمای مهندسی آزمایشگاه · محمدعلی جوادی‌نسب'
            : 'Academic Reference Manual · by Mohammadali Javadinasab'}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {lang === 'fa'
            ? 'مرجع جامع آزمایشگاه پردازش سیگنال، مخابرات، سیگنال‌های مغزی (EEG) و یادگیری ماشین'
            : 'Signal Processing, Telecommunications, EEG & Machine Learning Laboratory Reference'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-4xl">
          {lang === 'fa'
            ? 'مجموعه کامل فرمول‌بندی‌های ریاضی، تئوری پردازش سیگنال دیجیتال و مشخصات ماژول‌های آزمایشگاهی برای آموزش دانشگاهی، آزمودن الگوریتم‌ها و تجسم مهندسی تعاملی.'
            : 'Comprehensive mathematical formulations, digital signal processing theory, and laboratory module specifications for academic education, algorithm experimentation, and interactive engineering visualization.'}
        </p>
      </div>

      {/* Visual Architecture & Concept Diagrams */}
      <div className="neu-card p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold tracking-tight">
          {lang === 'fa'
            ? 'دیاگرام‌های مفهومی و معماری بصری آزمایشگاه'
            : 'Visual Architecture & Signal Processing Concept Diagrams'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VISUAL_GUIDES.map((vg) => (
            <div key={vg.title} className="neu-inset p-3 flex flex-col justify-between gap-2.5">
              <div className="oscilloscope-frame overflow-hidden">
                <img
                  src={vg.img}
                  alt={vg.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-36 object-cover opacity-90"
                />
              </div>
              <div>
                <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400">{vg.title}</h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {vg.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mathematical Compendium */}
      <div className="neu-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-base font-bold tracking-tight">
            {lang === 'fa'
              ? 'فرمول‌بندی‌های ریاضی هسته آزمایشگاه (مرجع LaTeX)'
              : 'Core Mathematical Formulations (LaTeX Reference)'}
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
          {lang === 'fa'
            ? 'ماژول‌های آزمایشگاهی و قابلیت‌های علمی'
            : 'Laboratory Modules & Scientific Capabilities'}
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
