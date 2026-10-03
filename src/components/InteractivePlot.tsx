import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Maximize2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useLab } from '../store/LabContext';

export interface PlotSeries {
  id: string;
  label: string;
  data: number[];
  color: string;
  visible?: boolean;
  lineWidth?: number;
  dashed?: boolean;
  stepped?: boolean;
}

export interface PlotPeakAnnotation {
  x: number;
  y: number;
  label: string;
}

interface InteractivePlotProps {
  title: string;
  subtitle?: string;
  xData: number[];
  xLabel?: string;
  yLabel?: string;
  series: PlotSeries[];
  peaks?: PlotPeakAnnotation[];
  height?: number;
  yLogScale?: boolean;
  showVisibilityControls?: boolean;
  yDomainOverride?: [number, number];
}

export const InteractivePlot: React.FC<InteractivePlotProps> = ({
  title,
  subtitle,
  xData,
  xLabel = 'Time (s)',
  yLabel = 'Amplitude',
  series,
  peaks = [],
  height = 260,
  yLogScale = false,
  showVisibilityControls = true,
  yDomainOverride,
}) => {
  const { darkMode } = useLab();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [interactionMode, setInteractionMode] = useState<'select-zoom' | 'pan'>('select-zoom');
  const [xRange, setXRange] = useState<[number, number]>([0, 1]);
  const [yScaleFactor, setYScaleFactor] = useState<number>(1);
  const [yPanOffset, setYPanOffset] = useState<number>(0);

  const [hoverPos, setHoverPos] = useState<{
    px: number;
    py: number;
    dataIdx: number;
    xVal: number;
    values: { label: string; color: string; val: number }[];
  } | null>(null);

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurr, setDragCurr] = useState<{ x: number; y: number } | null>(null);

  const toggleSeries = (id: string) => {
    setHiddenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetView = () => {
    setXRange([0, 1]);
    setYScaleFactor(1);
    setYPanOffset(0);
  };

  const handleZoom = (factor: number) => {
    setXRange(([start, end]) => {
      const center = (start + end) / 2;
      const halfSpan = Math.min(0.5, Math.max(0.02, ((end - start) * factor) / 2));
      const ns = Math.max(0, center - halfSpan);
      const ne = Math.min(1, center + halfSpan);
      return [ns, ne];
    });
  };

  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const activeSeries = series.filter(
    (s) => s.visible !== false && !hiddenIds[s.id] && s.data.length > 0
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth || 640;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const isDark = darkMode;
    const bg = isDark ? 'rgba(10, 14, 23, 0.58)' : 'rgba(255, 255, 255, 0.52)';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.18)';
    const axisText = isDark ? '#94a3b8' : '#334155';

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 56;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 34;
    const plotW = Math.max(40, width - padLeft - padRight);
    const plotH = Math.max(40, height - padTop - padBottom);

    const totalLen = Math.max(
      xData.length,
      ...activeSeries.map((s) => s.data.length),
      2
    );
    const startIdx = Math.max(0, Math.floor(xRange[0] * (totalLen - 1)));
    const endIdx = Math.min(totalLen - 1, Math.ceil(xRange[1] * (totalLen - 1)));

    const xMin = xData[startIdx] ?? startIdx;
    const xMax = xData[endIdx] ?? endIdx;

    let yMin = Infinity;
    let yMax = -Infinity;
    if (yDomainOverride) {
      [yMin, yMax] = yDomainOverride;
    } else {
      for (const s of activeSeries) {
        for (let i = startIdx; i <= endIdx && i < s.data.length; i++) {
          const v = s.data[i];
          if (Number.isFinite(v)) {
            if (v < yMin) yMin = v;
            if (v > yMax) yMax = v;
          }
        }
      }
      if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
        yMin = -1;
        yMax = 1;
      } else if (Math.abs(yMax - yMin) < 1e-6) {
        yMin -= 1;
        yMax += 1;
      } else {
        const margin = (yMax - yMin) * 0.12;
        yMin -= margin;
        yMax += margin;
      }
    }

    const yCenter = (yMin + yMax) / 2 + yPanOffset;
    const yHalf = ((yMax - yMin) / 2) / Math.max(0.1, yScaleFactor);
    const effYMin = yCenter - yHalf;
    const effYMax = yCenter + yHalf;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = axisText;

    const yTicks = 5;
    for (let t = 0; t <= yTicks; t++) {
      const ratio = t / yTicks;
      const py = padTop + ratio * plotH;
      const val = effYMax - ratio * (effYMax - effYMin);

      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(padLeft + plotW, py);
      ctx.stroke();

      const label = yLogScale && val > 0 && val < 1 ? val.toExponential(0) : val.toFixed(2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, padLeft - 6, py);
    }

    const xTicks = 6;
    for (let t = 0; t <= xTicks; t++) {
      const ratio = t / xTicks;
      const px = padLeft + ratio * plotW;
      const val = xMin + ratio * (xMax - xMin);

      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(val.toFixed(val > 50 ? 0 : 2), px, padTop + plotH + 6);
    }

    ctx.fillStyle = axisText;
    ctx.textAlign = 'right';
    ctx.fillText(xLabel, padLeft + plotW, height - 12);

    ctx.save();
    ctx.translate(12, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    if (effYMin < 0 && effYMax > 0) {
      const zeroY = padTop + ((effYMax - 0) / (effYMax - effYMin)) * plotH;
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(71, 85, 105, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, zeroY);
      ctx.lineTo(padLeft + plotW, zeroY);
      ctx.stroke();
    }

    const spanIdx = Math.max(1, endIdx - startIdx);
    for (const s of activeSeries) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth ?? 1.95;
      ctx.setLineDash(s.dashed ? [5, 4] : []);
      ctx.beginPath();

      let started = false;
      for (let i = startIdx; i <= endIdx && i < s.data.length; i++) {
        const px = padLeft + ((i - startIdx) / spanIdx) * plotW;
        const py =
          padTop + ((effYMax - s.data[i]) / Math.max(1e-9, effYMax - effYMin)) * plotH;

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else if (s.stepped) {
          const prevPy =
            padTop + ((effYMax - s.data[i - 1]) / Math.max(1e-9, effYMax - effYMin)) * plotH;
          ctx.lineTo(px, prevPy);
          ctx.lineTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const pk of peaks) {
      if (pk.x >= xMin && pk.x <= xMax) {
        const px = padLeft + ((pk.x - xMin) / Math.max(1e-9, xMax - xMin)) * plotW;
        const py = padTop + ((effYMax - pk.y) / Math.max(1e-9, effYMax - effYMin)) * plotH;
        ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pk.label, px, Math.max(padTop + 10, py - 8));
      }
    }

    if (interactionMode === 'select-zoom' && dragStart && dragCurr) {
      const bx = Math.min(dragStart.x, dragCurr.x);
      const bw = Math.abs(dragCurr.x - dragStart.x);
      ctx.fillStyle = 'rgba(2, 132, 199, 0.16)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, padTop, bw, plotH);
      ctx.strokeRect(bx, padTop, bw, plotH);
    }

    if (hoverPos && hoverPos.px >= padLeft && hoverPos.px <= padLeft + plotW) {
      ctx.strokeStyle = isDark ? 'rgba(226, 232, 240, 0.45)' : 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverPos.px, padTop);
      ctx.lineTo(hoverPos.px, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [
    darkMode,
    xData,
    series,
    hiddenIds,
    xRange,
    yScaleFactor,
    yPanOffset,
    height,
    hoverPos,
    dragStart,
    dragCurr,
    interactionMode,
    peaks,
    yDomainOverride,
    yLogScale,
    xLabel,
    yLabel,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const padLeft = 56;
    const padRight = 18;
    const plotW = Math.max(40, rect.width - padLeft - padRight);

    if (dragStart) {
      if (interactionMode === 'pan') {
        const dx = (px - dragStart.x) / plotW;
        const span = xRange[1] - xRange[0];
        let ns = xRange[0] - dx * span;
        let ne = xRange[1] - dx * span;
        if (ns < 0) {
          ne -= ns;
          ns = 0;
        }
        if (ne > 1) {
          ns -= ne - 1;
          ne = 1;
        }
        setXRange([Math.max(0, ns), Math.min(1, ne)]);
        setDragStart({ x: px, y: py });
      } else {
        setDragCurr({ x: px, y: py });
      }
    }

    const ratio = Math.max(0, Math.min(1, (px - padLeft) / plotW));
    const totalLen = Math.max(xData.length, 2);
    const startIdx = Math.floor(xRange[0] * (totalLen - 1));
    const endIdx = Math.ceil(xRange[1] * (totalLen - 1));
    const dataIdx = Math.min(
      totalLen - 1,
      Math.max(0, Math.round(startIdx + ratio * (endIdx - startIdx)))
    );

    const values = activeSeries.map((s) => ({
      label: s.label,
      color: s.color,
      val: s.data[dataIdx] ?? 0,
    }));

    setHoverPos({
      px,
      py,
      dataIdx,
      xVal: xData[dataIdx] ?? dataIdx,
      values,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setDragStart({ x: px, y: py });
    setDragCurr({ x: px, y: py });
  };

  const handleMouseUp = () => {
    if (interactionMode === 'select-zoom' && dragStart && dragCurr && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const padLeft = 56;
      const plotW = Math.max(40, rect.width - padLeft - 18);
      const x1 = Math.min(dragStart.x, dragCurr.x);
      const x2 = Math.max(dragStart.x, dragCurr.x);
      if (x2 - x1 > 12) {
        const r1 = Math.max(0, Math.min(1, (x1 - padLeft) / plotW));
        const r2 = Math.max(0, Math.min(1, (x2 - padLeft) / plotW));
        const span = xRange[1] - xRange[0];
        setXRange([xRange[0] + r1 * span, xRange[0] + r2 * span]);
      }
    }
    setDragStart(null);
    setDragCurr(null);
  };

  return (
    <div className="neu-card p-4 flex flex-col gap-3" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {showVisibilityControls &&
            series.map((s) => {
              const isHidden = hiddenIds[s.id] || s.visible === false;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSeries(s.id)}
                  className={`neu-btn px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isHidden ? 'opacity-45' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.label}</span>
                  {isHidden ? (
                    <EyeOff className="w-3 h-3 text-slate-400" />
                  ) : (
                    <Eye className="w-3 h-3 text-slate-500" />
                  )}
                </button>
              );
            })}

          <div className="h-4 w-px bg-slate-300/60 dark:bg-slate-700/60 mx-1" />

          <button
            type="button"
            onClick={() =>
              setInteractionMode((m) => (m === 'select-zoom' ? 'pan' : 'select-zoom'))
            }
            className={`neu-btn px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              interactionMode === 'pan' ? 'btn-tool-pill' : ''
            }`}
          >
            {interactionMode === 'pan' ? (
              <>
                <Move className="w-3.5 h-3.5" />
                <span>Pan</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Box Zoom</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleZoom(0.65)}
            title="Zoom In"
            className="neu-btn p-1.5 rounded-full cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.45)}
            title="Zoom Out"
            className="neu-btn p-1.5 rounded-full cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset Axes"
            className="neu-btn p-1.5 rounded-full cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExportImage}
            title="Export Plot as PNG"
            className="neu-btn px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      <div className="relative neu-inset overflow-hidden p-1">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoverPos(null);
            setDragStart(null);
            setDragCurr(null);
          }}
          className="block w-full cursor-crosshair rounded-lg"
        />

        {hoverPos && (
          <div className="pointer-events-none absolute top-2.5 right-3 bg-white/92 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 shadow-sm backdrop-blur-md px-2.5 py-1.5 rounded-md text-[11px] font-mono tabular-nums flex flex-wrap items-center gap-3 border border-slate-300/80 dark:border-slate-700/80">
            <span>
              x: <strong>{hoverPos.xVal.toFixed(3)}</strong>
            </span>
            {hoverPos.values.map((v, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: v.color }}
                />
                <span>
                  {v.label}: <strong>{v.val.toFixed(3)}</strong>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface InteractiveHeatmapProps {
  title: string;
  subtitle?: string;
  xValues: number[];
  yValues: number[];
  matrix: number[][];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

function colormapViridis(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * Math.min(1, Math.max(0, -0.35 + 2.1 * c * c)));
  const g = Math.round(255 * Math.min(1, Math.max(0, 0.08 + 1.15 * c - 0.25 * c * c)));
  const b = Math.round(255 * Math.min(1, Math.max(0, 0.35 + 0.95 * c - 1.1 * c * c)));
  return [r, g, b];
}

export const InteractiveHeatmap: React.FC<InteractiveHeatmapProps> = ({
  title,
  subtitle,
  xValues,
  yValues,
  matrix,
  xLabel = 'Time (s)',
  yLabel = 'Frequency (Hz)',
  height = 240,
}) => {
  const { darkMode } = useLab();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [probe, setProbe] = useState<{ x: number; y: number; val: number } | null>(null);

  const handleExport = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 600;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = darkMode;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = isDark ? 'rgba(10, 14, 23, 0.58)' : 'rgba(255, 255, 255, 0.52)';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 56;
    const padRight = 24;
    const padTop = 16;
    const padBottom = 32;
    const plotW = Math.max(40, width - padLeft - padRight);
    const plotH = Math.max(40, height - padTop - padBottom);

    const nX = Math.max(1, matrix.length);
    const nY = Math.max(1, matrix[0]?.length ?? 1);
    const cellW = plotW / nX;
    const cellH = plotH / nY;

    for (let xi = 0; xi < nX; xi++) {
      const col = matrix[xi];
      if (!col) continue;
      for (let yi = 0; yi < nY; yi++) {
        const v = col[yi] ?? 0;
        const [r, g, b] = colormapViridis(v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const px = padLeft + xi * cellW;
        const py = padTop + plotH - (yi + 1) * cellH;
        ctx.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    ctx.fillStyle = isDark ? '#94a3b8' : '#334155';
    ctx.font = '10px "IBM Plex Mono", monospace';
    const yMin = yValues[0] ?? 0;
    const yMax = yValues[yValues.length - 1] ?? 100;
    for (let t = 0; t <= 4; t++) {
      const ratio = t / 4;
      const py = padTop + ratio * plotH;
      const val = yMax - ratio * (yMax - yMin);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(0), padLeft - 6, py);
    }

    const xMin = xValues[0] ?? 0;
    const xMax = xValues[xValues.length - 1] ?? 1;
    for (let t = 0; t <= 5; t++) {
      const ratio = t / 5;
      const px = padLeft + ratio * plotW;
      const val = xMin + ratio * (xMax - xMin);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(val.toFixed(2), px, padTop + plotH + 6);
    }

    ctx.textAlign = 'right';
    ctx.fillText(xLabel, padLeft + plotW, height - 12);
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [darkMode, matrix, xValues, yValues, height, xLabel, yLabel]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const padLeft = 56;
    const padTop = 16;
    const plotW = Math.max(40, rect.width - padLeft - 24);
    const plotH = Math.max(40, height - padTop - 32);

    const rx = Math.max(0, Math.min(0.999, (px - padLeft) / plotW));
    const ry = Math.max(0, Math.min(0.999, 1 - (py - padTop) / plotH));

    const xi = Math.floor(rx * matrix.length);
    const yi = Math.floor(ry * (matrix[0]?.length ?? 1));
    setProbe({
      x: xValues[xi] ?? rx,
      y: yValues[yi] ?? ry,
      val: matrix[xi]?.[yi] ?? 0,
    });
  };

  return (
    <div className="neu-card p-4 flex flex-col gap-3" ref={containerRef}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
            <span>Low</span>
            <div className="w-20 h-2.5 rounded-sm bg-gradient-to-r from-[#001459] via-[#1f9e89] to-[#fde725]" />
            <span>High Energy</span>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="neu-btn px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      <div className="relative neu-inset p-1">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setProbe(null)}
          className="block w-full cursor-crosshair rounded-lg"
        />
        {probe && (
          <div className="pointer-events-none absolute top-2.5 right-3 bg-white/92 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 shadow-sm backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono tabular-nums flex items-center gap-3 border border-slate-300/80 dark:border-slate-700">
            <span>t: {probe.x.toFixed(2)}s</span>
            <span>f/scale: {probe.y.toFixed(1)}</span>
            <span>Norm Energy: {(probe.val * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
