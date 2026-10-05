import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import { runPCAExperiment } from '../simulations/pca';
import { useLab } from '../store/LabContext';

export const PCAPage: React.FC = () => {
  const { experiment, setExperiment, darkMode, lang } = useLab();
  const pcaCfg = experiment.analysis.pca;
  const [rotYaw, setRotYaw] = useState(34);
  const [rotPitch, setRotPitch] = useState(22);

  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);

  const updatePCA = (patch: Partial<typeof pcaCfg>) => {
    setExperiment((prev) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        pca: { ...prev.analysis.pca, ...patch },
      },
    }));
  };

  const res = useMemo(
    () => runPCAExperiment(pcaCfg, experiment.randomSeed),
    [pcaCfg, experiment.randomSeed]
  );

  // Render 2D PC1 vs PC2 Scatter + Principal Eigenvector Axes
  useEffect(() => {
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth || 460;
    const height = 270;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050912';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 9.5;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.beginPath();
    ctx.moveTo(20, cy);
    ctx.lineTo(width - 20, cy);
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx, height - 20);
    ctx.stroke();

    const colors = ['#22d3ee', '#10b981', '#f59e0b'];
    for (const pt of res.projected2D) {
      const px = cx + pt.pc1 * scale;
      const py = cy - pt.pc2 * scale;
      ctx.fillStyle = colors[pt.cluster % 3];
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw orthogonal Principal Component direction vectors
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sqrt(res.eigenvalues[0] ?? 1) * scale * 1.3, cy);
    ctx.stroke();

    ctx.strokeStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - Math.sqrt(res.eigenvalues[1] ?? 1) * scale * 1.3);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(`PC1 (${res.explainedVarianceRatio[0]?.toFixed(1)}%)`, width - 115, cy - 8);
    ctx.fillText(`PC2 (${res.explainedVarianceRatio[1]?.toFixed(1)}%)`, cx + 8, 28);
  }, [darkMode, res]);

  // Render Interactive 3D PC1-PC2-PC3 Subspace Projection
  useEffect(() => {
    const canvas = canvas3DRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth || 460;
    const height = 270;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050912';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 10;

    const yaw = (rotYaw * Math.PI) / 180;
    const pitch = (rotPitch * Math.PI) / 180;

    const project3D = (x: number, y: number, z: number) => {
      const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
      const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
      const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
      const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
      return { px: cx + x1 * scale, py: cy - y2 * scale, depth: z2 };
    };

    const axes = [
      { label: 'PC1', v: [3.2, 0, 0], color: '#22d3ee' },
      { label: 'PC2', v: [0, 3.2, 0], color: '#a855f7' },
      { label: 'PC3', v: [0, 0, 3.2], color: '#38bdf8' },
    ];
    for (const ax of axes) {
      const p0 = project3D(0, 0, 0);
      const p1 = project3D(ax.v[0], ax.v[1], ax.v[2]);
      ctx.strokeStyle = ax.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p1.px, p1.py);
      ctx.stroke();
      ctx.fillStyle = ax.color;
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(ax.label, p1.px + 4, p1.py);
    }

    const colors = ['#22d3ee', '#10b981', '#f59e0b'];
    for (const pt of res.projected3D) {
      const { px, py } = project3D(pt.pc1, pt.pc2, pt.pc3);
      ctx.fillStyle = colors[pt.cluster % 3];
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [darkMode, res, rotYaw, rotPitch]);

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'fa'
                ? 'تحلیل مؤلفه‌های اصلی (PCA) و بازسازی زیرفضای متعامد'
                : 'Principal Component Analysis (PCA) & Subspace Reconstruction'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'تجزیه مقادیر ویژه ماتریس کوواریانس چندکاناله، بررسی نسبت واریانس تبیین‌شده و ارزیابی خطای بازسازی با رتبه کاهش‌یافته k.'
                : 'Perform orthogonal eigendecomposition of multi-channel covariance matrices, inspect Explained Variance ratios, and evaluate rank-k reconstruction error.'}
            </p>
          </div>
          <div className="text-xs font-mono">
            {lang === 'fa'
              ? `واریانس حفظ‌شده (${pcaCfg.numComponents}/${pcaCfg.numDimensions} مؤلفه): `
              : `Retained Variance (${pcaCfg.numComponents}/${pcaCfg.numDimensions} PCs): `}
            <strong className="text-emerald-500">
              {(res.cumulativeVarianceRatio[pcaCfg.numComponents - 1] ?? 100).toFixed(1)}%
            </strong>{' '}
            · {lang === 'fa' ? 'خطای بازسازی RMSE: ' : 'Reconstruction RMSE: '}
            <strong className="text-sky-500">{res.reconstructionRmse.toFixed(4)}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'ابعاد حسگرها (D)' : 'Sensor Dimensions (D)'}</span>
              <span className="text-sky-500 font-semibold">{pcaCfg.numDimensions}D</span>
            </div>
            <input
              type="range"
              min={3}
              max={8}
              step={1}
              value={pcaCfg.numDimensions}
              onChange={(e) => {
                const d = Number(e.target.value);
                updatePCA({
                  numDimensions: d,
                  numComponents: Math.min(pcaCfg.numComponents, d),
                });
              }}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'مؤلفه‌های نگه‌داشته‌شده (k)' : 'Retained Components (k)'}</span>
              <span className="text-emerald-500 font-semibold">{pcaCfg.numComponents} PCs</span>
            </div>
            <input
              type="range"
              min={1}
              max={pcaCfg.numDimensions}
              step={1}
              value={pcaCfg.numComponents}
              onChange={(e) => updatePCA({ numComponents: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'نویز مشاهده (σ)' : 'Observation Noise (σ)'}</span>
              <span className="text-amber-500 font-semibold">{pcaCfg.noiseLevel.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.02}
              max={1.2}
              step={0.02}
              value={pcaCfg.noiseLevel}
              onChange={(e) => updatePCA({ noiseLevel: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'همبستگی پنهان کانال‌ها' : 'Latent Correlation'}</span>
              <span className="text-sky-500 font-semibold">
                {(pcaCfg.correlationStrength * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.98}
              step={0.02}
              value={pcaCfg.correlationStrength}
              onChange={(e) => updatePCA({ correlationStrength: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
        </div>
      </div>

      {/* Explained Variance Breakdown + 2D & 3D Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Explained Variance Spectrum */}
        <div className="neu-card p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'طیف مقادیر ویژه و واریانس تبیین‌شده'
                : 'Eigenvalue Spectrum & Explained Variance'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'fa'
                ? 'درصد واریانس تک‌تک مقادیر ویژه λ_i و واریانس تجمعی k مؤلفه اول'
                : 'Individual λ_i% and cumulative variance captured by top k components'}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {res.explainedVarianceRatio.map((ratio, idx) => {
              const isRetained = idx < pcaCfg.numComponents;
              return (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className={isRetained ? 'font-bold text-sky-500' : 'text-slate-400'}>
                      PC{idx + 1} (λ={res.eigenvalues[idx].toFixed(2)})
                    </span>
                    <span className="tabular-nums">
                      {ratio.toFixed(1)}% · {lang === 'fa' ? 'تجمعی:' : 'Cum:'}{' '}
                      {res.cumulativeVarianceRatio[idx].toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full neu-inset overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full ${
                        isRetained ? 'bg-sky-500' : 'bg-slate-400/40'
                      }`}
                      style={{ width: `${Math.max(3, ratio)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="neu-inset p-3 text-xs font-mono flex justify-between">
            <span>{lang === 'fa' ? 'خطای زیرفضا (RMSE):' : 'Subspace Error (RMSE):'}</span>
            <strong className="text-emerald-500">{res.reconstructionRmse.toFixed(4)}</strong>
          </div>
        </div>

        {/* 2D Projection Canvas */}
        <div className="neu-card p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'تصویر دوبعدی زیرفضای اصلی (PC1 در برابر PC2)'
                : '2D Principal Subspace Projection (PC1 vs. PC2)'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'fa'
                ? 'محورهای متعامد بیشینه‌ساز واریانس به همراه توزیع خوشه‌ها'
                : 'Orthogonal variance-maximizing axes with cluster distributions'}
            </p>
          </div>
          <div className="oscilloscope-frame p-1 overflow-hidden">
            <canvas ref={canvas2DRef} className="block w-full rounded-xl" />
          </div>
        </div>

        {/* 3D Projection Canvas */}
        <div className="neu-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                {lang === 'fa'
                  ? 'منیفولد سه‌بعدی مؤلفه‌های اصلی (PC1 · PC2 · PC3)'
                  : '3D Principal Manifold (PC1 · PC2 · PC3)'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'fa' ? 'چرخش زاویه دید دوربین سه‌بعدی' : 'Rotate 3D camera yaw & pitch'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span>{lang === 'fa' ? 'چرخش' : 'Yaw'}</span>
              <input
                type="range"
                min={-180}
                max={180}
                value={rotYaw}
                onChange={(e) => setRotYaw(Number(e.target.value))}
                className="w-16 sci-slider"
              />
            </div>
          </div>
          <div className="oscilloscope-frame p-1 overflow-hidden">
            <canvas ref={canvas3DRef} className="block w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Rank-k Signal Reconstruction Plot */}
      <InteractivePlot
        title={
          lang === 'fa'
            ? `بازسازی سیگنال با رتبه ${pcaCfg.numComponents} در مقایسه با کانال حسگر اصلی ۱`
            : `Rank-${pcaCfg.numComponents} PCA Signal Reconstruction vs. Original Sensor Channel 1`
        }
        subtitle={
          lang === 'fa'
            ? `بازسازی آرایه حسگر ${pcaCfg.numDimensions}-بعدی از ${pcaCfg.numComponents} مؤلفه اصلی اول (RMSE = ${res.reconstructionRmse.toFixed(4)})`
            : `Reconstructing ${pcaCfg.numDimensions}-dimensional sensor array from top k = ${pcaCfg.numComponents} Principal Components (RMSE = ${res.reconstructionRmse.toFixed(4)})`
        }
        xData={Array.from({ length: res.timeSeriesOriginal.length }, (_, i) => i)}
        xLabel={lang === 'fa' ? 'اندیس نمونه (n)' : 'Sample Index (n)'}
        yLabel={lang === 'fa' ? 'دامنه مرکزگراشده' : 'Centered Amplitude'}
        height={250}
        series={[
          {
            id: 'pca-orig',
            label: lang === 'fa' ? 'کانال حسگر اصلی x₁[n]' : 'Original Sensor Channel x₁[n]',
            data: res.timeSeriesOriginal,
            color: '#0ea5e9',
            lineWidth: 1.8,
          },
          {
            id: 'pca-rec',
            label:
              lang === 'fa'
                ? `سیگنال بازسازی‌شده PCA با رتبه ${pcaCfg.numComponents}`
                : `Rank-${pcaCfg.numComponents} PCA Reconstructed x̂₁[n]`,
            data: res.timeSeriesReconstructed,
            color: '#10b981',
            lineWidth: 2.2,
          },
        ]}
      />

      <TheoryAccordion
        items={[
          {
            title:
              lang === 'fa'
                ? 'ماتریس کوواریانس نمونه و تجزیه مقادیر ویژه متعامد'
                : 'Sample Covariance Matrix & Orthogonal Eigendecomposition',
            formula:
              '\\mathbf{\\Sigma} = \\frac{1}{N-1}\\mathbf{X}_c^\\top \\mathbf{X}_c, \\quad \\mathbf{\\Sigma}\\mathbf{v}_i = \\lambda_i \\mathbf{v}_i',
            explanation:
              lang === 'fa'
                ? 'تحلیل مؤلفه‌های اصلی (PCA) بردارهای یکه متعامد v_i را می‌یابد که ماتریس کوواریانس نمونه Σ را قطری می‌کنند. مقادیر ویژه λ_i برابر با واریانس داده‌های تصویرشده روی هر محور اصلی هستند.'
                : 'Principal Component Analysis finds mutually orthogonal unit vectors v_i that diagonalize the sample covariance matrix Σ. The eigenvalues λ_i equal the variance of the data projected onto each principal axis.',
          },
          {
            title:
              lang === 'fa'
                ? 'بازسازی زیرفضای کم‌رتبه اکارت-یانگ (Eckart-Young)'
                : 'Eckart-Young Low-Rank Subspace Reconstruction',
            formula:
              '\\mathbf{\\hat{X}}_k = \\mathbf{X}_c \\mathbf{V}_k \\mathbf{V}_k^\\top, \\quad \\|\\mathbf{X}_c - \\mathbf{\\hat{X}}_k\\|_F^2 = \\sum_{i=k+1}^{D} (N-1)\\lambda_i',
            explanation:
              lang === 'fa'
                ? 'تصویر کردن مشاهدات نویزی D-بعدی روی k بردار ویژه اول V_k کمترین خطای بازسازی نرم فروبنیوس ممکن را در میان تمام نگاشت‌های خطی با رتبه k به دست می‌دهد.'
                : 'Projecting D-dimensional noisy sensor observations onto the top k eigenvectors V_k achieves the minimum possible Frobenius-norm reconstruction error among all rank-k linear projections.',
          },
        ]}
      />
    </div>
  );
};
