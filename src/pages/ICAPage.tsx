import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { runICAExperiment } from '../simulations/ica';
import { useLab } from '../store/LabContext';
import { DEFAULT_EXPERIMENT } from '../store/presets';

export const ICAPage: React.FC = () => {
  const { experiment, setExperiment, lang } = useLab();
  const icaCfg = experiment.analysis.ica;

  const updateICA = (patch: Partial<typeof icaCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        ica: { ...prev.analysis.ica, ...patch },
      },
    }));
  };

  const updateMatrixEntry = (r: number, c: number, val: number) => {
    const nextMat = icaCfg.mixingMatrix.map((row, ri) =>
      row.map((v, ci) => (ri === r && ci === c ? val : v))
    );
    updateICA({ mixingMatrix: nextMat });
  };

  const resetMatrix = () => {
    updateICA({
      mixingMatrix: structuredClone(DEFAULT_EXPERIMENT.analysis.ica.mixingMatrix),
    });
  };

  const res = useMemo(
    () => runICAExperiment(icaCfg, experiment.randomSeed),
    [icaCfg, experiment.randomSeed]
  );

  const avgCorr =
    res.recoveredComponents.reduce((acc, c) => acc + c.correlation, 0) /
    Math.max(1, res.recoveredComponents.length);

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'fa'
                ? 'تحلیل مؤلفه‌های مستقل (جداسازی کور منابع با الگوریتم FastICA)'
                : 'Independent Component Analysis (FastICA Blind Source Separation)'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'ترکیب ۴ منبع آماری مستقل (سینوسی، مربعی، دندان‌اره‌ای و اسپایک گذرای EEG) توسط ماتریس اختلاط A و بازیابی کور آن‌ها با بیشینه‌سازی نِگ‌انتروپی در FastICA.'
                : 'Mix 4 statistically independent sources (Sine, Square, Sawtooth, Transient EEG Spike) through a configurable mixing matrix A and recover them blindly via FastICA negentropy maximization.'}
            </p>
          </div>
          <div className="text-xs font-mono">
            {lang === 'fa' ? 'میانگین همبستگی بازیابی منابع |r|: ' : 'Mean Source Recovery |r|: '}
            <strong className="text-emerald-500">{(avgCorr * 100).toFixed(1)}%</strong> ·{' '}
            {lang === 'fa' ? 'تکرارهای نقطه ثابت FastICA: ' : 'FastICA Fixed-Point Iterations: '}
            <strong className="text-sky-500">{res.iterationsUsed}</strong>
          </div>
        </div>

        {/* Visual Pipeline: Original Sources -> Mixed Signals -> ICA -> Recovered Components */}
        <div className="neu-inset p-3 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] text-xs font-mono">
            {[
              {
                step: lang === 'fa' ? '۱. منابع اصلی S(t)' : '1. Original Sources S(t)',
                sub:
                  lang === 'fa'
                    ? 'سینوسی · مربعی · دندان‌اره‌ای · اسپایک EEG'
                    : 'Sine · Square · Sawtooth · EEG Spike',
              },
              {
                step: lang === 'fa' ? '۲. ماتریس اختلاط A' : '2. Mixing Matrix A',
                sub: 'X(t) = A · S(t) + n(t)',
              },
              {
                step: lang === 'fa' ? '۳. سفیدسازی (Whitening)' : '3. PCA Sphering (Whitening)',
                sub: 'Z = D^(-1/2) E^T X_c',
              },
              {
                step: lang === 'fa' ? '۴. جداسازی FastICA (W)' : '4. FastICA Unmixing W',
                sub: 'Max Negentropy E{G(w^T z)}',
              },
              {
                step: lang === 'fa' ? '۵. منابع بازیابی‌شده Ŝ(t)' : '5. Recovered Sources Ŝ(t)',
                sub:
                  lang === 'fa'
                    ? `میانگین همبستگی ${(avgCorr * 100).toFixed(1)}%`
                    : `Mean Correlation ${(avgCorr * 100).toFixed(1)}%`,
              },
            ].map((st, idx, arr) => (
              <React.Fragment key={st.step}>
                <div className="neu-card-sm px-3 py-2 text-center">
                  <div className="font-semibold text-sky-500">{st.step}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{st.sub}</div>
                </div>
                {idx < arr.length - 1 && <span className="text-slate-400 font-bold">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Mixing Matrix Interactive Editor + Algorithm Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-1">
          <div className="lg:col-span-7 neu-inset p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold">
                {lang === 'fa'
                  ? 'ماتریس اختلاط خطی ۴×۴ قابل ویرایش A (X = A · S)'
                  : 'Interactive 4×4 Linear Mixing Matrix A (X = A · S)'}
              </span>
              <button
                type="button"
                onClick={resetMatrix}
                className="neu-btn px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{lang === 'fa' ? 'بازنشانی ماتریس' : 'Reset Matrix'}</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2" dir="ltr">
              {icaCfg.mixingMatrix.map((row, rIdx) =>
                row.map((val, cIdx) => (
                  <div key={`${rIdx}-${cIdx}`} className="neu-card-sm p-2 flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-slate-400">
                      a_{rIdx + 1},{cIdx + 1}
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      min={-2}
                      max={2}
                      value={val}
                      onChange={(e) => updateMatrixEntry(rIdx, cIdx, Number(e.target.value))}
                      className="w-full bg-transparent font-mono text-xs font-semibold text-right outline-none"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>
                  {lang === 'fa' ? 'تعداد منابع مستقل فعال (K)' : 'Number of Active Sources (K)'}
                </span>
                <span className="text-sky-500 font-semibold">
                  {lang === 'fa' ? `${icaCfg.numSources} منبع` : `${icaCfg.numSources} Sources`}
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={4}
                step={1}
                value={icaCfg.numSources}
                onChange={(e) => updateICA({ numSources: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>
                  {lang === 'fa' ? 'حداکثر تکرارهای FastICA' : 'Max FastICA Iterations'}
                </span>
                <span className="text-sky-500 font-semibold">{icaCfg.maxIterations}</span>
              </div>
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={icaCfg.maxIterations}
                onChange={(e) => updateICA({ maxIterations: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span>
                  {lang === 'fa' ? 'نویز جمع‌شونده حسگرها (σ)' : 'Sensor Additive Noise (σ)'}
                </span>
                <span className="text-amber-500 font-semibold">{icaCfg.noiseStd.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.25}
                step={0.01}
                value={icaCfg.noiseStd}
                onChange={(e) => updateICA({ noiseStd: Number(e.target.value) })}
                className="sci-slider"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3-Stage Comparison Plots: Original Sources -> Mixed Signals -> Recovered Components */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <InteractivePlot
          title={lang === 'fa' ? '۱. منابع پنهان اصلی S(t)' : '1. Original Latent Sources S(t)'}
          subtitle={
            lang === 'fa'
              ? 'منابع غیرگوسی و آماری مستقل اولیه'
              : 'Ground-truth statistically independent non-Gaussian sources'
          }
          xData={res.time}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'دامنه نرمال‌شده' : 'Normalized Amp'}
          height={280}
          series={res.originalSources.map((s, idx) => ({
            id: `src-${idx}`,
            label: s.name,
            data: s.data.map((v) => v + (res.originalSources.length - 1 - idx) * 2.5),
            color: COLORS[idx % COLORS.length],
            lineWidth: 1.8,
          }))}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? '۲. سیگنال‌های مخلوط ثبت‌شده حسگرها X(t) = A · S(t)'
              : '2. Observed Sensor Mixtures X(t) = A · S(t)'
          }
          subtitle={
            lang === 'fa'
              ? 'ترکیب‌های خطی درهم‌تنیده ثبت‌شده در آرایه حسگرها'
              : 'Entangled linear combinations recorded at the sensor array'
          }
          xData={res.time}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'خروجی حسگر' : 'Sensor Output'}
          height={280}
          series={res.mixedSignals.map((m, idx) => ({
            id: `mix-${idx}`,
            label: m.name,
            data: m.data.map((v) => v + (res.mixedSignals.length - 1 - idx) * 2.5),
            color: '#f59e0b',
            lineWidth: 1.6,
          }))}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? '۳. مؤلفه‌های مستقل بازیابی‌شده با FastICA Ŝ(t)'
              : '3. FastICA Recovered Independent Components Ŝ(t)'
          }
          subtitle={
            lang === 'fa'
              ? 'سیگنال‌های تفکیک‌شده کور با تکرار نقطه ثابت نِگ‌انتروپی'
              : 'Blindly separated signals via negentropy fixed-point iteration'
          }
          xData={res.time}
          xLabel={lang === 'fa' ? 'زمان (ثانیه)' : 'Time (s)'}
          yLabel={lang === 'fa' ? 'مؤلفه بازیابی‌شده' : 'Recovered IC'}
          height={280}
          series={res.recoveredComponents.map((rc, idx) => ({
            id: `rec-${idx}`,
            label: `${rc.name} (|r|=${(rc.correlation * 100).toFixed(0)}%)`,
            data: rc.data.map((v) => v + (res.recoveredComponents.length - 1 - idx) * 2.5),
            color: COLORS[idx % COLORS.length],
            lineWidth: 2,
          }))}
        />
      </div>

      <TheoryAccordion
        items={[
          {
            title:
              lang === 'fa'
                ? 'جداسازی کور منابع (مسئله مهمانی کوکتل) و قضیه حد مرکزی'
                : 'Cocktail-Party Blind Source Separation & Central Limit Theorem',
            formula:
              '\\mathbf{x}(t) = \\mathbf{A}\\mathbf{s}(t), \\quad \\mathbf{\\hat{s}}(t) = \\mathbf{W}\\mathbf{x}(t)',
            explanation:
              lang === 'fa'
                ? 'بر اساس قضیه حد مرکزی، ترکیب خطی متغیرهای تصادفی مستقل، توزیعی نزدیک‌تر به توزیع گوسی نسبت به هر یک از منابع اصلی دارد. الگوریتم ICA با بیشینه‌سازی غیرگوسی بودن آماری (کشیدگی یا نگ‌انتروپی)، ماتریس جداسازی W را بازیابی می‌کند.'
                : 'By the Central Limit Theorem, a linear mixture of independent random variables is more Gaussian than any of the original underlying sources. ICA recovers the unmixing matrix W by maximizing statistical non-Gaussianity (kurtosis or negentropy).',
          },
          {
            title:
              lang === 'fa'
                ? 'الگوریتم تکرار نقطه ثابت FastICA هیوارینن (Hyvärinen)'
                : 'Hyvärinen FastICA Fixed-Point Iteration',
            formula:
              '\\mathbf{w}^+ = \\mathbb{E}\\!\\left\\{\\mathbf{z}\\,g(\\mathbf{w}^\\top\\mathbf{z})\\right\\} - \\mathbb{E}\\!\\left\\{g\'(\\mathbf{w}^\\top\\mathbf{z})\\right\\}\\mathbf{w}, \\quad g(u) = \\tanh(u)',
            explanation:
              lang === 'fa'
                ? 'پس از مرکزگرایی و سفیدسازی مشاهدات با PCA به بردار z، الگوریتم FastICA از به‌روزرسانی نقطه ثابت نیوتن با همگرایی مکعبی و تابع کنتراست غیرخطی g(u) = tanh(u) به همراه متعامدسازی گرام-اشمیت استفاده می‌نماید.'
                : 'After centering and PCA whitening the observations into z, FastICA uses a cubic-convergence Newton fixed-point update with contrast function g(u) = tanh(u) followed by Gram-Schmidt orthogonalization.',
          },
        ]}
      />
    </div>
  );
};
