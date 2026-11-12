import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, ScatterChart } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { LiveEquation, TheoryAccordion } from '../components/MathBlock';
import { PageHeader, ParamSlider } from '../components/ui';
import { useElementSize } from '../hooks/useElementSize';
import { runPCAExperiment } from '../simulations/pca';
import { useLab } from '../store/LabContext';
import { getSeriesColor, PLOT_SURFACE_BG } from '../theme/palette';

/** One colour + one marker shape per cluster so clusters are not colour-only. */
const CLUSTER_COLORS = [getSeriesColor(0), getSeriesColor(2), getSeriesColor(1)];
const CLUSTER_SHAPES = ['circle', 'square', 'triangle'] as const;
const CLUSTER_SHAPE_GLYPHS = ['●', '■', '▲'];
const CANVAS_HEIGHT = 270;

function drawClusterPoint(ctx: CanvasRenderingContext2D, x: number, y: number, cluster: number, r: number) {
  const i = ((cluster % 3) + 3) % 3;
  ctx.fillStyle = CLUSTER_COLORS[i];
  ctx.beginPath();
  if (CLUSTER_SHAPES[i] === 'square') {
    ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
  } else if (CLUSTER_SHAPES[i] === 'triangle') {
    ctx.moveTo(x, y - r * 1.15);
    ctx.lineTo(x + r, y + r * 0.85);
    ctx.lineTo(x - r, y + r * 0.85);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  ctx.fill();
}

/** Size a canvas for the device pixel ratio and return a scaled 2D context. */
function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export const PCAPage: React.FC = () => {
  const { experiment, setExperiment, darkMode, lang, resetExperiment } = useLab();
  const isFa = lang === 'fa';
  const pcaCfg = experiment.analysis.pca;
  const [rotYaw, setRotYaw] = useState(34);
  const [rotPitch, setRotPitch] = useState(22);

  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);
  const box2DRef = useRef<HTMLDivElement | null>(null);
  const box3DRef = useRef<HTMLDivElement | null>(null);
  const size2D = useElementSize(box2DRef);
  const size3D = useElementSize(box3DRef);

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
    const width = size2D.width || 460;
    const height = CANVAS_HEIGHT;
    const ctx = prepareCanvas(canvas, width, height);
    if (!ctx) return;

    ctx.fillStyle = PLOT_SURFACE_BG;
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

    for (const pt of res.projected2D) {
      drawClusterPoint(ctx, cx + pt.pc1 * scale, cy - pt.pc2 * scale, pt.cluster, 3.2);
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
  }, [darkMode, res, size2D.width]);

  // Render Interactive 3D PC1-PC2-PC3 Subspace Projection
  useEffect(() => {
    const canvas = canvas3DRef.current;
    if (!canvas) return;
    const width = size3D.width || 460;
    const height = CANVAS_HEIGHT;
    const ctx = prepareCanvas(canvas, width, height);
    if (!ctx) return;

    ctx.fillStyle = PLOT_SURFACE_BG;
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

    for (const pt of res.projected3D) {
      const { px, py } = project3D(pt.pc1, pt.pc2, pt.pc3);
      drawClusterPoint(ctx, px, py, pt.cluster, 3);
    }
  }, [darkMode, res, rotYaw, rotPitch, size3D.width]);

  const retainedPct = res.cumulativeVarianceRatio[pcaCfg.numComponents - 1] ?? 100;
  const clusterCount = new Set(res.projected2D.map((p) => p.cluster % 3)).size;
  const clusterLegend = (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption font-mono text-slate-500 dark:text-slate-400">
      {CLUSTER_COLORS.map((c, i) => (
        <li key={i} className="flex items-center gap-1">
          <span aria-hidden="true" style={{ color: c }}>
            {CLUSTER_SHAPE_GLYPHS[i]}
          </span>
          {isFa ? `خوشه ${i + 1}` : `Cluster ${i + 1}`}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <PageHeader
          icon={<ScatterChart className="w-5 h-5" />}
          title={
            isFa
              ? 'تحلیل مؤلفه‌های اصلی (PCA) و بازسازی زیرفضای متعامد'
              : 'Principal Component Analysis (PCA) & Subspace Reconstruction'
          }
          subtitle={
            isFa
              ? 'تجزیه مقادیر ویژه ماتریس کوواریانس چندکاناله، بررسی نسبت واریانس تبیین‌شده و ارزیابی خطای بازسازی با رتبه کاهش‌یافته k.'
              : 'Perform orthogonal eigendecomposition of multi-channel covariance matrices, inspect Explained Variance ratios, and evaluate rank-k reconstruction error.'
          }
          stats={[
            {
              label: isFa
                ? `واریانس حفظ‌شده (${pcaCfg.numComponents}/${pcaCfg.numDimensions})`
                : `Retained Variance (${pcaCfg.numComponents}/${pcaCfg.numDimensions} PCs)`,
              value: <span role="status" aria-live="polite">{retainedPct.toFixed(1)}%</span>,
            },
            {
              label: isFa ? 'خطای بازسازی RMSE' : 'Reconstruction RMSE',
              value: res.reconstructionRmse.toFixed(4),
            },
          ]}
          actions={
            <button
              type="button"
              onClick={resetExperiment}
              className="neu-btn rounded-control px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {isFa ? 'بازنشانی پیش‌فرض‌ها' : 'Reset to defaults'}
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ParamSlider
            label="Sensor Dimensions (D)"
            faLabel="ابعاد حسگرها (D)"
            value={pcaCfg.numDimensions}
            min={3}
            max={8}
            step={1}
            unit="D"
            lang={lang}
            onChange={(d) =>
              updatePCA({
                numDimensions: d,
                numComponents: Math.min(pcaCfg.numComponents, d),
              })
            }
          />
          <ParamSlider
            label="Retained Components (k)"
            faLabel="مؤلفه‌های نگه‌داشته‌شده (k)"
            value={pcaCfg.numComponents}
            min={1}
            max={pcaCfg.numDimensions}
            step={1}
            unit="PCs"
            lang={lang}
            onChange={(v) => updatePCA({ numComponents: v })}
          />
          <ParamSlider
            label="Observation Noise (σ)"
            faLabel="نویز مشاهده (σ)"
            value={pcaCfg.noiseLevel}
            min={0.02}
            max={1.2}
            step={0.02}
            lang={lang}
            onChange={(v) => updatePCA({ noiseLevel: v })}
          />
          <ParamSlider
            label="Latent Correlation"
            faLabel="همبستگی پنهان کانال‌ها"
            value={pcaCfg.correlationStrength}
            min={0.1}
            max={0.98}
            step={0.02}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            lang={lang}
            onChange={(v) => updatePCA({ correlationStrength: v })}
          />
        </div>
      </div>

      {/* Explained Variance Breakdown + 2D & 3D Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Explained Variance Spectrum */}
        <div className="neu-card p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'طیف مقادیر ویژه و واریانس تبیین‌شده'
                : 'Eigenvalue Spectrum & Explained Variance'}
            </h2>
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

          <div role="status" aria-live="polite" className="neu-inset p-3 text-xs font-mono flex justify-between gap-2">
            <span>{lang === 'fa' ? 'خطای زیرفضا (RMSE):' : 'Subspace Error (RMSE):'}</span>
            <strong className="text-emerald-500">{res.reconstructionRmse.toFixed(4)}</strong>
          </div>
        </div>

        {/* 2D Projection Canvas */}
        <div className="neu-card p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'تصویر دوبعدی زیرفضای اصلی (PC1 در برابر PC2)'
                : '2D Principal Subspace Projection (PC1 vs. PC2)'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'fa'
                ? 'محورهای متعامد بیشینه‌ساز واریانس به همراه توزیع خوشه‌ها'
                : 'Orthogonal variance-maximizing axes with cluster distributions'}
            </p>
          </div>
          <div className="oscilloscope-frame p-1 overflow-hidden">
            <div ref={box2DRef} className="w-full" dir="ltr">
              <canvas
                ref={canvas2DRef}
                role="img"
                aria-label={
                  isFa
                    ? `نمودار پراکندگی PC1 در برابر PC2: ${res.projected2D.length} نقطه در ${clusterCount} خوشه؛ PC1 ${res.explainedVarianceRatio[0]?.toFixed(1)}٪ و PC2 ${res.explainedVarianceRatio[1]?.toFixed(1)}٪ واریانس`
                    : `Scatter of PC1 vs PC2: ${res.projected2D.length} points in ${clusterCount} clusters; PC1 explains ${res.explainedVarianceRatio[0]?.toFixed(1)}% and PC2 ${res.explainedVarianceRatio[1]?.toFixed(1)}% of variance`
                }
                className="block w-full rounded-xl"
                style={{ height: CANVAS_HEIGHT }}
              />
            </div>
          </div>
          {clusterLegend}
        </div>

        {/* 3D Projection Canvas */}
        <div className="neu-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {lang === 'fa'
                  ? 'منیفولد سه‌بعدی مؤلفه‌های اصلی (PC1 · PC2 · PC3)'
                  : '3D Principal Manifold (PC1 · PC2 · PC3)'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'fa' ? 'چرخش زاویه دید دوربین سه‌بعدی' : 'Rotate 3D camera yaw & pitch'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <ParamSlider
              label="Camera yaw"
              faLabel="چرخش افقی دوربین"
              value={rotYaw}
              min={-180}
              max={180}
              step={1}
              unit="°"
              lang={lang}
              onChange={setRotYaw}
            />
            <ParamSlider
              label="Camera pitch"
              faLabel="چرخش عمودی دوربین"
              value={rotPitch}
              min={-90}
              max={90}
              step={1}
              unit="°"
              lang={lang}
              onChange={setRotPitch}
            />
          </div>
          <div className="oscilloscope-frame p-1 overflow-hidden">
            <div ref={box3DRef} className="w-full" dir="ltr">
              <canvas
                ref={canvas3DRef}
                role="img"
                aria-label={
                  isFa
                    ? `تصویر سه‌بعدی PC1، PC2 و PC3 با ${res.projected3D.length} نقطه در ${clusterCount} خوشه؛ چرخش ${rotYaw}° و شیب ${rotPitch}°`
                    : `3D projection onto PC1, PC2 and PC3: ${res.projected3D.length} points in ${clusterCount} clusters; yaw ${rotYaw}°, pitch ${rotPitch}°`
                }
                className="block w-full rounded-xl"
                style={{ height: CANVAS_HEIGHT }}
              />
            </div>
          </div>
          {clusterLegend}
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
            color: getSeriesColor(0),
            lineWidth: 1.8,
          },
          {
            id: 'pca-rec',
            label:
              lang === 'fa'
                ? `سیگنال بازسازی‌شده PCA با رتبه ${pcaCfg.numComponents}`
                : `Rank-${pcaCfg.numComponents} PCA Reconstructed x̂₁[n]`,
            data: res.timeSeriesReconstructed,
            color: getSeriesColor(1),
            dash: [7, 4],
            lineWidth: 2.2,
          },
        ]}
      />

      <div className="neu-card px-4 py-3 overflow-x-auto">
        <LiveEquation
          tex={'\\frac{\\sum_{i=1}^{{{k}}} \\lambda_i}{\\sum_{i=1}^{{{D}}} \\lambda_i} = {{pct}}\\%, \\quad \\text{RMSE} = {{rmse}}'}
          values={{ k: pcaCfg.numComponents, D: pcaCfg.numDimensions, pct: Number(retainedPct.toFixed(1)), rmse: res.reconstructionRmse }}
          precision={4}
          caption={
            isFa
              ? 'سهم واریانس حفظ‌شده با k مؤلفه اول و خطای بازسازی حاصل'
              : 'Variance retained by the top k components and the resulting reconstruction error'
          }
        />
      </div>

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
