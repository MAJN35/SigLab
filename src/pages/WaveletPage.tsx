import React, { useMemo } from 'react';
import { InteractiveHeatmap, InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { computeWaveletAnalysis } from '../simulations/wavelets';
import { useLab } from '../store/LabContext';
import { WaveletFamily } from '../types';
import { calculateSNR } from '../utils/math';

const WAVELET_FAMILIES: { id: WaveletFamily; label: string; faLabel: string; desc: string }[] = [
  {
    id: 'haar',
    label: 'Haar (Daubechies D2)',
    faLabel: 'موجک هار (Haar / D2)',
    desc: 'Discontinuous step wavelet optimal for sharp edge/step detection',
  },
  {
    id: 'db4',
    label: 'Daubechies D4 (db4)',
    faLabel: 'موجک دوبشی D4 (db4)',
    desc: 'Compactly supported orthogonal wavelet with 2 vanishing moments',
  },
  {
    id: 'sym4',
    label: 'Symlet S4 (sym4)',
    faLabel: 'موجک سیملت S4 (sym4)',
    desc: 'Near-symmetric orthogonal wavelet minimizing phase distortion',
  },
  {
    id: 'morlet',
    label: 'Morlet CWT',
    faLabel: 'موجک مورله پیوسته (Morlet CWT)',
    desc: 'Gaussian-modulated complex sinusoid for continuous time-frequency scalograms',
  },
];

export const WaveletPage: React.FC = () => {
  const { experiment, setExperiment, computed, lang } = useLab();
  const wavCfg = experiment.analysis.wavelet;

  const updateWavelet = (patch: Partial<typeof wavCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        wavelet: { ...prev.analysis.wavelet, ...patch },
      },
    }));
  };

  const wavResult = useMemo(
    () =>
      computeWaveletAnalysis(
        computed.noisySignal,
        wavCfg.family,
        wavCfg.levels,
        wavCfg.denoiseThreshold,
        wavCfg.numScales
      ),
    [computed.noisySignal, wavCfg]
  );

  const denoisedSnr = useMemo(
    () =>
      calculateSNR(
        computed.cleanSignal.slice(0, wavResult.denoisedSignal.length),
        wavResult.denoisedSignal
      ),
    [computed.cleanSignal, wavResult.denoisedSignal]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'fa'
                ? 'آزمایشگاه تحلیل چندتفکیکی موجک (Wavelet) و اسکالوگرام'
                : 'Multi-Resolution Wavelet & Scalogram Laboratory'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'تجزیه بانک فیلتر تبدیل موجک گسسته (DWT)، حذف نویز با آستانه‌گذاری نرم دونوهو (Donoho) و تحلیل زمان-مقیاس با تبدیل موجک پیوسته (CWT).'
                : 'Perform Discrete Wavelet Transform (DWT) filter-bank decomposition, Donoho soft-threshold wavelet denoising, and Continuous Wavelet Transform (CWT) time-scale analysis.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WAVELET_FAMILIES.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => updateWavelet({ family: wf.id })}
                className={`neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  wavCfg.family === wf.id ? 'neu-btn-active text-sky-500' : ''
                }`}
              >
                {lang === 'fa' ? wf.faLabel : wf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'تعداد سطوح تجزیه (J)' : 'Decomposition Levels (J)'}</span>
              <span className="text-sky-500 font-semibold">
                {lang === 'fa' ? `سطح ${wavCfg.levels}` : `Level ${wavCfg.levels}`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={wavCfg.levels}
              onChange={(e) => updateWavelet({ levels: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>
                {lang === 'fa' ? 'آستانه حذف نویز نرم (λ)' : 'Soft Denoising Threshold (λ)'}
              </span>
              <span className="text-emerald-500 font-semibold">
                {wavCfg.denoiseThreshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={wavCfg.denoiseThreshold}
              onChange={(e) => updateWavelet({ denoiseThreshold: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>
                {lang === 'fa' ? 'تعداد مقیاس‌های اسکالوگرام CWT' : 'CWT Scalogram Dyadic Scales'}
              </span>
              <span className="text-sky-500 font-semibold">
                {lang === 'fa' ? `${wavCfg.numScales} مقیاس` : `${wavCfg.numScales} scales`}
              </span>
            </div>
            <input
              type="range"
              min={12}
              max={40}
              step={4}
              value={wavCfg.numScales}
              onChange={(e) => updateWavelet({ numScales: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
        </div>
      </div>

      {/* Scalogram & Wavelet Denoised Reconstruction */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractiveHeatmap
          title={
            lang === 'fa'
              ? `اسکالوگرام زمان-مقیاس تبدیل موجک پیوسته (CWT) [${wavCfg.family.toUpperCase()}]`
              : `Continuous Wavelet Transform (CWT) Time-Scale Scalogram [${wavCfg.family.toUpperCase()}]`
          }
          subtitle={
            lang === 'fa'
              ? 'مقیاس‌های بالا متناظر با فرکانس‌های پایین و مقیاس‌های پایین متناظر با گذارهای فرکانس بالا هستند'
              : 'High scale corresponds to low frequency; low scale resolves transient high-frequency singularities'
          }
          xValues={computed.time}
          yValues={wavResult.scales}
          matrix={wavResult.scalogram}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'مقیاس موجک (a)' : 'Wavelet Scale (a)'}
          height={275}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'حذف نویز با انقباض موجک و بازسازی چندتفکیکی'
              : 'Wavelet Shrinkage Denoising & Multi-Resolution Reconstruction'
          }
          subtitle={
            lang === 'fa'
              ? `نسبت سیگنال به نویز ورودی: ${computed.empiricalSnrDb.toFixed(2)} dB ← پس از بازسازی موجک: ${denoisedSnr.toFixed(2)} dB`
              : `Input SNR: ${computed.empiricalSnrDb.toFixed(2)} dB → Wavelet Reconstructed SNR: ${denoisedSnr.toFixed(2)} dB`
          }
          xData={computed.time.slice(0, wavResult.denoisedSignal.length)}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
          height={275}
          series={[
            {
              id: 'wav-clean',
              label: lang === 'fa' ? 'سیگنال تمیز اصلی' : 'Original Clean',
              data: computed.cleanSignal.slice(0, wavResult.denoisedSignal.length),
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'wav-noisy',
              label: lang === 'fa' ? 'ورودی نویزی' : 'Noisy Input',
              data: computed.noisySignal.slice(0, wavResult.denoisedSignal.length),
              color: '#f59e0b',
              lineWidth: 1.15,
            },
            {
              id: 'wav-rec',
              label:
                lang === 'fa'
                  ? `سیگنال نویززدایی‌شده موجک (λ=${wavCfg.denoiseThreshold})`
                  : `Wavelet Denoised (λ=${wavCfg.denoiseThreshold})`,
              data: wavResult.denoisedSignal,
              color: '#10b981',
              lineWidth: 2.2,
            },
          ]}
        />
      </div>

      {/* Multi-Level Detail & Approximation Coefficients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? `ضرایب تقریب درشت‌مقیاس cA_${wavCfg.levels} (روند فرکانس پایین)`
              : `Coarse Approximation Coefficients cA_${wavCfg.levels} (Low-Frequency Trend)`
          }
          subtitle={
            lang === 'fa'
              ? `کاهش نرخ نمونه‌برداری به نسبت 2^${wavCfg.levels} توسط بانک فیلترهای پایین‌گذر متعامد`
              : `Downsampled by 2^${wavCfg.levels} via cascaded quadrature mirror low-pass filters`
          }
          xData={Array.from({ length: wavResult.approximation.length }, (_, i) => i)}
          xLabel={lang === 'fa' ? 'اندیس ضریب (k)' : 'Coefficient Index (k)'}
          yLabel={lang === 'fa' ? 'دامنه ضریب تقریب cA' : 'cA Amplitude'}
          height={220}
          series={[
            {
              id: 'ca-coeff',
              label: lang === 'fa' ? `ضرایب تقریب cA_${wavCfg.levels}` : `Approximation cA_${wavCfg.levels}`,
              data: wavResult.approximation,
              color: '#38bdf8',
              lineWidth: 2,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'ضرایب جزئیات چندسطحی (سطح اول cD₁ در برابر سطح دوم cD₂)'
              : 'Multi-Level Detail Coefficients (cD₁ Finest vs. cD₂ Mid-Scale)'
          }
          subtitle={
            lang === 'fa'
              ? 'زیرباندهای جزئیات بالاگذر موجک که گذارهای سریع و نویز را استخراج می‌کنند'
              : 'High-pass wavelet detail subbands capturing localized transients and noise'
          }
          xData={Array.from({ length: wavResult.details[0]?.length ?? 1 }, (_, i) => i)}
          xLabel={lang === 'fa' ? 'اندیس ضریب زیرباند (k)' : 'Subband Coefficient Index (k)'}
          yLabel={lang === 'fa' ? 'دامنه ضریب جزئیات cD' : 'cD Amplitude'}
          height={220}
          series={[
            {
              id: 'cd1',
              label: lang === 'fa' ? 'جزئیات سطح ۱ (cD₁)' : 'Level 1 Detail (cD₁)',
              data: wavResult.details[0] ?? [],
              color: '#f59e0b',
              lineWidth: 1.5,
            },
            {
              id: 'cd2',
              label: lang === 'fa' ? 'جزئیات سطح ۲ (cD₂)' : 'Level 2 Detail (cD₂)',
              data: wavResult.details[1] ?? [],
              color: '#ec4899',
              lineWidth: 1.8,
            },
          ]}
        />
      </div>

      <TheoryAccordion
        items={[
          {
            title:
              lang === 'fa'
                ? 'تبدیل موجک پیوسته (CWT) و موجک مادر مورله (Morlet)'
                : 'Continuous Wavelet Transform (CWT) & Morlet Mother Wavelet',
            formula:
              'W_x(a, b) = \\frac{1}{\\sqrt{|a|}}\\int_{-\\infty}^{\\infty} x(t)\\,\\psi^*\\!\\left(\\frac{t - b}{a}\\right)dt, \\quad \\psi_{\\text{Morlet}}(t) = \\pi^{-1/4}e^{j\\omega_0 t}e^{-t^2/2}',
            explanation:
              lang === 'fa'
                ? 'برخلاف پنجره ثابت STFT، تبدیل موجک عرض پنجره زمانی خود را به صورت معکوس با فرکانس (مقیاس a) تغییر می‌دهد؛ بنابراین در فرکانس‌های بالا دقت زمانی عالی و در فرکانس‌های پایین دقت فرکانسی بالا فراهم می‌کند.'
                : 'Unlike the fixed window of the STFT, the Wavelet Transform scales its window duration inversely with frequency (scale a), providing fine time resolution at high frequencies and sharp frequency resolution at low frequencies.',
          },
          {
            title:
              lang === 'fa'
                ? 'بانک فیلتر تبدیل موجک گسسته سریع مالات (Mallat DWT) و آستانه‌گذاری نرم'
                : 'Mallat Fast DWT Filter Bank & Soft Thresholding',
            formula:
              'cA_{j+1}[k] = \\sum_n cA_j[n]\\,h[n-2k], \\quad \\eta_\\lambda(w) = \\text{sgn}(w)\\max(|w| - \\lambda, 0)',
            explanation:
              lang === 'fa'
                ? 'تجزیه موجک گسسته سیگنال را به صورت بازگشتی از فیلترهای آینه‌ای متعامد پایین‌گذر h[n] و بالاگذر g[n] همراه با کاهش نرخ نمونه دوتایی (↓2) عبور می‌دهد. آستانه‌گذاری نرم ضرایب جزئیات، نویز پهن‌باند را حذف و لبه‌های تیز سیگنال را حفظ می‌کند.'
                : 'Discrete Wavelet Decomposition iteratively splits the signal through Quadrature Mirror Filters (low-pass h[n] and high-pass g[n]) followed by dyadic decimation (↓2). Soft-thresholding detail coefficients removes broadband Gaussian noise while preserving sharp signal edges.',
          },
        ]}
      />
    </div>
  );
};
