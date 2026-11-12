import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Move,
  RotateCcw,
  Table2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useLab } from '../store/LabContext';
import {
  MARKER_COLOR,
  PEAK_COLOR,
  PLOT_SURFACE_BG,
  SHADE_COLOR,
  THEME_BG,
  THEME_TEXT,
  THEME_TEXT_MUTED,
  colormapGradientCss,
  getColormapLUT,
  getSeriesColor,
  getSeriesDash,
  type ColormapName,
} from '../theme/palette';
import { formatSI, logTicks, makeTickFormatter, niceTicks } from '../utils/plotTicks';
import { useElementSize } from '../hooks/useElementSize';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlotSeries {
  id: string;
  label: string;
  data: number[];
  /** Optional: falls back to the shared colorblind-safe SERIES_PALETTE. */
  color?: string;
  visible?: boolean;
  lineWidth?: number;
  /** Legacy shorthand for dash = [5, 4]. */
  dashed?: boolean;
  stepped?: boolean;
  /** Custom canvas dash pattern in px, e.g. [6, 3]. Overrides `dashed`. */
  dash?: number[];
  /** Which y axis this series is scaled against (default 'left'). */
  yAxis?: 'left' | 'right';
  /** Unit used in readouts and the CSV header, e.g. 'dB/Hz'. */
  unit?: string;
}

export interface PlotPeakAnnotation {
  x: number;
  y: number;
  label: string;
}

/** Vertical (x) and/or horizontal (y) reference line. */
export interface PlotMarker {
  x?: number;
  y?: number;
  label?: string;
  color?: string;
  /** Default true. */
  dashed?: boolean;
  /** Axis for the horizontal (y) line, default 'left'. */
  yAxis?: 'left' | 'right';
}

/** Shaded x-interval (e.g. stopband, above Nyquist). x1 may be Infinity. */
export interface PlotShadeRegion {
  x0: number;
  x1: number;
  color?: string;
  label?: string;
}

export interface InteractivePlotProps {
  title: string;
  subtitle?: string;
  xData: number[];
  xLabel?: string;
  yLabel?: string;
  series: PlotSeries[];
  peaks?: PlotPeakAnnotation[];
  height?: number;
  /** True log10 y mapping (values <= 0 are skipped) with decade ticks. */
  yLogScale?: boolean;
  showVisibilityControls?: boolean;
  yDomainOverride?: [number, number];
  // ---- new (all optional) ----
  /** Label for the right y axis (shown when any series has yAxis: 'right'). */
  yLabelRight?: string;
  /** Fixed domain for the right y axis. */
  yDomainRightOverride?: [number, number];
  /** Unit for x values in readouts / CSV / zoom chip (e.g. 'Hz', 's'). */
  xUnit?: string;
  /** Default unit for left-axis series readouts. */
  yUnit?: string;
  /** Default unit for right-axis series readouts. */
  yUnitRight?: string;
  markers?: PlotMarker[];
  shadeRegions?: PlotShadeRegion[];
  /** Peak marker color (default amber #f59e0b). */
  peakColor?: string;
  /** Overrides the auto-generated canvas description. */
  ariaLabel?: string;
  /** Assign SERIES_DASHES patterns to series that don't set dash/dashed. */
  autoDash?: boolean;
  /** Show zoom/pan toolbar buttons (default true). */
  showZoomControls?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_PEAKS: PlotPeakAnnotation[] = [];
const EMPTY_MARKERS: PlotMarker[] = [];
const EMPTY_REGIONS: PlotShadeRegion[] = [];
const AXIS_FONT = '10px "IBM Plex Mono", monospace';
const AXIS_TEXT = '#94a3b8';
const GRID_COLOR = 'rgba(56, 189, 248, 0.13)';
const SKY_SWAP = new Set(['#0284c7', '#0ea5e9', '#38bdf8']);

/** Renderer-resolved color: legacy sky accents are drawn as bright cyan on the scope. */
function resolveColor(color: string | undefined, index: number): string {
  const base = color ?? getSeriesColor(index);
  return SKY_SWAP.has(base.toLowerCase()) ? '#22d3ee' : base;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'plot';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface LegendEntry {
  label: string;
  color: string;
  dash: number[];
}

/** Composite title, subtitle, legend and the plot canvas onto a themed PNG. */
function exportCompositePng(opts: {
  canvas: HTMLCanvasElement;
  title: string;
  subtitle?: string;
  legend: LegendEntry[];
  dark: boolean;
  rtl: boolean;
  filename: string;
}) {
  const { canvas, title, subtitle, legend, dark, rtl, filename } = opts;
  const cssW = parseFloat(canvas.style.width) || canvas.width;
  const cssH = parseFloat(canvas.style.height) || canvas.height;
  const dpr = canvas.width / cssW || 1;
  const pad = 16;
  const W = cssW + pad * 2;
  const family =
    (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) ||
    'Inter, sans-serif';

  const measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return;
  measureCtx.font = `12px ${family}`;
  // Lay out legend items in rows.
  const items: { e: LegendEntry; x: number; row: number; w: number }[] = [];
  let x = 0;
  let row = 0;
  for (const e of legend) {
    const w = 26 + measureCtx.measureText(e.label).width + 16;
    if (x + w > cssW && x > 0) {
      row += 1;
      x = 0;
    }
    items.push({ e, x, row, w });
    x += w;
  }
  const titleH = 22;
  const subH = subtitle ? 18 : 0;
  const legendH = legend.length ? (row + 1) * 18 + 6 : 0;
  const H = pad + titleH + subH + legendH + 6 + cssH + pad;

  const out = document.createElement('canvas');
  out.width = Math.round(W * dpr);
  out.height = Math.round(H * dpr);
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = dark ? THEME_BG.dark : THEME_BG.light;
  ctx.fillRect(0, 0, W, H);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.textBaseline = 'top';
  const tx = rtl ? W - pad : pad;
  let y = pad;
  ctx.fillStyle = dark ? THEME_TEXT.dark : THEME_TEXT.light;
  ctx.font = `700 15px ${family}`;
  ctx.fillText(title, tx, y, cssW);
  y += titleH;
  if (subtitle) {
    ctx.fillStyle = dark ? THEME_TEXT_MUTED.dark : THEME_TEXT_MUTED.light;
    ctx.font = `12px ${family}`;
    ctx.fillText(subtitle, tx, y, cssW);
    y += subH;
  }
  ctx.font = `12px ${family}`;
  for (const it of items) {
    const ix = rtl ? W - pad - it.x - it.w : pad + it.x;
    const iy = y + it.row * 18;
    ctx.save();
    ctx.strokeStyle = it.e.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(it.e.dash);
    ctx.beginPath();
    const sx = rtl ? ix + it.w - 22 : ix;
    ctx.moveTo(sx, iy + 7);
    ctx.lineTo(sx + 20, iy + 7);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = dark ? THEME_TEXT.dark : THEME_TEXT.light;
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillText(it.e.label, rtl ? ix + it.w - 26 : ix + 26, iy);
  }
  y += legendH + 6;
  ctx.drawImage(canvas, pad, y, cssW, cssH);
  out.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

const LineSwatch: React.FC<{ color: string; dash: number[] }> = ({ color, dash }) => (
  <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" className="shrink-0">
    <line
      x1="1"
      y1="4"
      x2="21"
      y2="4"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap={dash.length ? 'butt' : 'round'}
      strokeDasharray={dash.length ? dash.join(' ') : undefined}
    />
  </svg>
);

const STR = {
  en: {
    reset: 'Reset zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    pan: 'Pan mode (drag to move the view)',
    png: 'Export plot as PNG',
    csv: 'Export data as CSV',
    viewData: 'View data',
    hideData: 'Hide data',
    zoomed: 'Zoomed',
    toggleSeries: 'Toggle series',
    help:
      'Interactive plot. Left and right arrows move the cursor, plus and minus zoom, 0 resets. Ctrl or Command plus wheel zooms time/frequency; Shift plus wheel zooms the y axis.',
    chart: 'Line chart',
    series: 'series',
    from: 'from',
    to: 'to',
    peak: 'Peak',
    at: 'at',
    rowsNote: (shown: number, total: number) => `Showing ${shown} of ${total} samples in view`,
    heatmap: 'Heatmap',
    low: 'Low',
    high: 'High Energy',
  },
  fa: {
    reset: 'بازنشانی بزرگ‌نمایی',
    zoomIn: 'بزرگ‌نمایی',
    zoomOut: 'کوچک‌نمایی',
    pan: 'حالت جابه‌جایی (برای حرکت نما بکشید)',
    png: 'ذخیره تصویر نمودار (PNG)',
    csv: 'ذخیره داده‌ها (CSV)',
    viewData: 'نمایش داده‌ها',
    hideData: 'پنهان کردن داده‌ها',
    zoomed: 'بزرگ‌نمایی',
    toggleSeries: 'نمایش/پنهان سری',
    help:
      'نمودار تعاملی. کلیدهای چپ و راست نشانگر را جابه‌جا می‌کنند، مثبت و منفی بزرگ‌نمایی می‌کنند و صفر بازنشانی می‌کند. Ctrl یا Command همراه چرخ ماوس محور افقی و Shift همراه چرخ محور عمودی را بزرگ‌نمایی می‌کند.',
    chart: 'نمودار خطی',
    series: 'سری',
    from: 'از',
    to: 'تا',
    peak: 'قله',
    at: 'در',
    rowsNote: (shown: number, total: number) => `نمایش ${shown} از ${total} نمونه در نما`,
    heatmap: 'نقشه حرارتی',
    low: 'کم',
    high: 'انرژی بالا',
  },
};

interface ActiveSeries {
  s: PlotSeries;
  index: number;
  color: string;
  dash: number[];
  axis: 'left' | 'right';
}

interface AxisDomain {
  min: number;
  max: number;
}

interface PlotLayout {
  width: number;
  height: number;
  padLeft: number;
  padTop: number;
  plotW: number;
  plotH: number;
  startIdx: number;
  endIdx: number;
  totalLen: number;
}

const fmt = (v: number | undefined, unit?: string) =>
  v === undefined || !Number.isFinite(v) ? '–' : formatSI(v, { precision: 4, unit });

// ---------------------------------------------------------------------------
// InteractivePlot
// ---------------------------------------------------------------------------

export const InteractivePlot: React.FC<InteractivePlotProps> = ({
  title,
  subtitle,
  xData,
  xLabel = 'Time (s)',
  yLabel = 'Amplitude',
  series,
  peaks = EMPTY_PEAKS,
  height = 260,
  yLogScale = false,
  showVisibilityControls = true,
  yDomainOverride,
  yLabelRight,
  yDomainRightOverride,
  xUnit,
  yUnit,
  yUnitRight,
  markers = EMPTY_MARKERS,
  shadeRegions = EMPTY_REGIONS,
  peakColor = PEAK_COLOR,
  ariaLabel,
  autoDash = false,
  showZoomControls = true,
}) => {
  const { darkMode, lang } = useLab();
  const t = STR[lang === 'fa' ? 'fa' : 'en'];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(surfaceRef);

  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [interactionMode, setInteractionMode] = useState<'select-zoom' | 'pan'>('select-zoom');
  const [xRange, setXRange] = useState<[number, number]>([0, 1]);
  const [yScaleFactor, setYScaleFactor] = useState<number>(1);
  /** Vertical pan as a fraction of the auto-scaled y span. */
  const [yPanOffset, setYPanOffset] = useState<number>(0);
  const [probe, setProbe] = useState<{ idx: number; source: 'pointer' | 'key' } | null>(null);
  const [showTable, setShowTable] = useState(false);

  const layoutRef = useRef<PlotLayout | null>(null);
  const viewRef = useRef<{
    left: AxisDomain;
    right: AxisDomain | null;
    active: ActiveSeries[];
    log: boolean;
  } | null>(null);
  const probeRef = useRef(probe);
  const dragRef = useRef<{
    mode: 'select-zoom' | 'pan';
    pointerId: number;
    startX: number;
    currX: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const totalLenRef = useRef(2);

  const toggleSeries = (id: string) => {
    setHiddenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetView = () => {
    setXRange([0, 1]);
    setYScaleFactor(1);
    setYPanOffset(0);
  };

  /** Zoom x by `factor` (<1 zooms in) around `anchor` (0..1 within the current view). */
  const zoomX = (factor: number, anchor = 0.5) => {
    setXRange(([start, end]) => {
      const span = end - start;
      const minSpan = Math.max(4 / Math.max(1, totalLenRef.current - 1), 1e-4);
      const ns = clamp(span * factor, minSpan, 1);
      const a = start + clamp(anchor, 0, 1) * span;
      let s = a - anchor * ns;
      let e = s + ns;
      if (s < 0) {
        e -= s;
        s = 0;
      }
      if (e > 1) {
        s -= e - 1;
        e = 1;
      }
      return [Math.max(0, s), Math.min(1, e)];
    });
  };

  const handleZoom = (factor: number) => zoomX(factor, 0.5);

  // ---- series metadata (resolved colors / dashes) ----
  const seriesMeta = useMemo(
    () =>
      series.map((s, i) => ({
        color: resolveColor(s.color, i),
        dash: s.dash ?? (s.dashed ? [5, 4] : autoDash ? getSeriesDash(i) : []),
      })),
    [series, autoDash]
  );

  const activeSeries: ActiveSeries[] = useMemo(
    () =>
      series
        .map((s, i) => ({
          s,
          index: i,
          color: seriesMeta[i].color,
          dash: seriesMeta[i].dash,
          axis: (s.yAxis === 'right' ? 'right' : 'left') as 'left' | 'right',
        }))
        .filter(({ s }) => s.visible !== false && !hiddenIds[s.id] && s.data.length > 0),
    [series, seriesMeta, hiddenIds]
  );

  // ---- view model (index window + y domains in transformed space) ----
  const view = useMemo(() => {
    const totalLen = Math.max(xData.length, ...activeSeries.map((a) => a.s.data.length), 2);
    const startIdx = Math.max(0, Math.floor(xRange[0] * (totalLen - 1)));
    const endIdx = Math.max(startIdx + 1, Math.min(totalLen - 1, Math.ceil(xRange[1] * (totalLen - 1))));
    const xAt = (i: number) => (Number.isFinite(xData[i]) ? xData[i] : i);
    const xMin = xAt(startIdx);
    const xMax = xAt(endIdx);
    const tf = (v: number) => (yLogScale ? (v > 0 ? Math.log10(v) : NaN) : v);

    const domainFor = (axis: 'left' | 'right', override?: [number, number]): AxisDomain | null => {
      const list = activeSeries.filter((a) => a.axis === axis);
      if (!list.length && !(axis === 'left' && override)) return null;
      let lo = Infinity;
      let hi = -Infinity;
      for (const a of list) {
        const d = a.s.data;
        for (let i = startIdx; i <= endIdx && i < d.length; i++) {
          const v = tf(d[i]);
          if (Number.isFinite(v)) {
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
      }
      let min: number;
      let max: number;
      if (override) {
        if (yLogScale) {
          max = override[1] > 0 ? Math.log10(override[1]) : Number.isFinite(hi) ? hi : 0;
          min = override[0] > 0 ? Math.log10(override[0]) : Number.isFinite(lo) ? lo : max - 6;
        } else {
          [min, max] = override;
        }
      } else if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        [min, max] = yLogScale ? [-1, 1] : [-1, 1];
      } else if (Math.abs(hi - lo) < 1e-9) {
        const pad = yLogScale ? 0.5 : 1;
        min = lo - pad;
        max = hi + pad;
      } else if (yLogScale && hi - lo >= 1) {
        min = Math.floor(lo);
        max = Math.ceil(hi);
      } else {
        const margin = (hi - lo) * 0.12;
        min = lo - margin;
        max = hi + margin;
      }
      if (max <= min) max = min + 1;
      const span = max - min;
      const center = (min + max) / 2 + yPanOffset * span;
      const half = span / 2 / Math.max(0.1, yScaleFactor);
      return { min: center - half, max: center + half };
    };

    const left = domainFor('left', yDomainOverride) ?? null;
    const right = domainFor('right', yDomainRightOverride);
    return {
      totalLen,
      startIdx,
      endIdx,
      xMin,
      xMax,
      left: left ?? right ?? { min: -1, max: 1 },
      right,
      hasLeft: !!left,
    };
  }, [xData, activeSeries, xRange, yLogScale, yDomainOverride, yDomainRightOverride, yPanOffset, yScaleFactor]);

  totalLenRef.current = view.totalLen;
  const hasRight = !!view.right;
  const isZoomed = xRange[0] > 0 || xRange[1] < 1 || yScaleFactor !== 1 || yPanOffset !== 0;

  // ---- overlay (crosshair / probe dots / drag box) ----
  const drawOverlay = () => {
    const ov = overlayRef.current;
    const L = layoutRef.current;
    const V = viewRef.current;
    if (!ov || !L || !V) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(L.width * dpr);
    const bh = Math.round(L.height * dpr);
    if (ov.width !== bw || ov.height !== bh) {
      ov.width = bw;
      ov.height = bh;
      ov.style.width = `${L.width}px`;
      ov.style.height = `${L.height}px`;
    }
    const ctx = ov.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L.width, L.height);

    const d = dragRef.current;
    if (d && d.mode === 'select-zoom' && Math.abs(d.currX - d.startX) > 1) {
      const x0 = clamp(Math.min(d.startX, d.currX), L.padLeft, L.padLeft + L.plotW);
      const x1 = clamp(Math.max(d.startX, d.currX), L.padLeft, L.padLeft + L.plotW);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1;
      ctx.fillRect(x0, L.padTop, x1 - x0, L.plotH);
      ctx.strokeRect(x0 + 0.5, L.padTop + 0.5, x1 - x0, L.plotH);
    }

    const p = probeRef.current;
    if (p && p.idx >= L.startIdx && p.idx <= L.endIdx) {
      const px = L.padLeft + ((p.idx - L.startIdx) / Math.max(1, L.endIdx - L.startIdx)) * L.plotW;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, L.padTop);
      ctx.lineTo(px, L.padTop + L.plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const a of V.active) {
        const raw = a.s.data[p.idx];
        const v = V.log ? (raw > 0 ? Math.log10(raw) : NaN) : raw;
        const dom = a.axis === 'right' && V.right ? V.right : V.left;
        if (!Number.isFinite(v)) continue;
        const py = L.padTop + ((dom.max - v) / Math.max(1e-12, dom.max - dom.min)) * L.plotH;
        if (py < L.padTop || py > L.padTop + L.plotH) continue;
        ctx.fillStyle = a.color;
        ctx.strokeStyle = PLOT_SURFACE_BG;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  };

  // ---- main canvas: redraw only on data / view / size changes ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = size.width || containerRef.current?.clientWidth || 640;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PLOT_SURFACE_BG;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 56;
    const padRight = hasRight ? 56 : 18;
    const padTop = 18;
    const padBottom = 34;
    const plotW = Math.max(40, width - padLeft - padRight);
    const plotH = Math.max(40, height - padTop - padBottom);
    const { startIdx, endIdx, xMin, xMax, left, right } = view;
    const spanIdx = Math.max(1, endIdx - startIdx);
    const xSpan = xMax - xMin || 1;

    const tf = (v: number) => (yLogScale ? (v > 0 ? Math.log10(v) : NaN) : v);
    const yPx = (tv: number, dom: AxisDomain) =>
      padTop + ((dom.max - tv) / Math.max(1e-12, dom.max - dom.min)) * plotH;
    const xValPx = (v: number) => padLeft + ((v - xMin) / xSpan) * plotW;

    // Shaded regions (behind everything)
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();
    for (const r of shadeRegions) {
      const a = Math.min(r.x0, r.x1);
      const b = Math.max(r.x0, r.x1);
      const lo = Math.min(xMin, xMax);
      const hi = Math.max(xMin, xMax);
      if (b < lo || a > hi) continue;
      const p0 = clamp(xValPx(Math.max(a, lo)), padLeft, padLeft + plotW);
      const p1 = clamp(xValPx(Math.min(b, hi)), padLeft, padLeft + plotW);
      ctx.fillStyle = r.color ?? SHADE_COLOR;
      ctx.fillRect(Math.min(p0, p1), padTop, Math.abs(p1 - p0), plotH);
      if (r.label) {
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(r.label, Math.min(p0, p1) + 4, padTop + 4);
      }
    }
    ctx.restore();

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.font = AXIS_FONT;
    ctx.fillStyle = AXIS_TEXT;

    // Y ticks (left axis -> grid)
    const yTickTarget = clamp(Math.round(plotH / 42), 3, 8);
    const drawYTicks = (dom: AxisDomain, side: 'left' | 'right', grid: boolean) => {
      let positions: number[];
      let labels: string[];
      if (yLogScale) {
        const lt = logTicks(dom.min, dom.max, yTickTarget);
        positions = lt.positions;
        labels = lt.labels;
      } else {
        const { ticks, step } = niceTicks(dom.min, dom.max, yTickTarget);
        const f = makeTickFormatter(ticks, step);
        positions = ticks;
        labels = ticks.map(f);
      }
      ctx.textBaseline = 'middle';
      positions.forEach((pos, k) => {
        const py = Math.round(yPx(pos, dom)) + 0.5;
        if (py < padTop - 0.5 || py > padTop + plotH + 0.5) return;
        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        if (grid) {
          ctx.moveTo(padLeft, py);
          ctx.lineTo(padLeft + plotW, py);
        } else {
          ctx.moveTo(padLeft + plotW, py);
          ctx.lineTo(padLeft + plotW + 4, py);
        }
        ctx.stroke();
        ctx.fillStyle = AXIS_TEXT;
        if (side === 'left') {
          ctx.textAlign = 'right';
          ctx.fillText(labels[k], padLeft - 6, py);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(labels[k], padLeft + plotW + 7, py);
        }
      });
    };
    drawYTicks(left, 'left', true);
    if (right) drawYTicks(right, 'right', false);

    // X ticks
    {
      const lo = Math.min(xMin, xMax);
      const hi = Math.max(xMin, xMax);
      const { ticks, step } = niceTicks(lo, hi, clamp(Math.round(plotW / 90), 3, 10));
      const f = makeTickFormatter(ticks, step);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const v of ticks) {
        const px = Math.round(xValPx(v)) + 0.5;
        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(px, padTop);
        ctx.lineTo(px, padTop + plotH);
        ctx.stroke();
        ctx.fillStyle = AXIS_TEXT;
        ctx.fillText(f(v), px, padTop + plotH + 6);
      }
    }

    // Axis labels
    ctx.fillStyle = AXIS_TEXT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(xLabel, padLeft + plotW, height - 6);

    ctx.save();
    ctx.translate(12, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    if (right && yLabelRight) {
      ctx.save();
      ctx.translate(width - 8, padTop + plotH / 2);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(yLabelRight, 0, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    if (!yLogScale && left.min < 0 && left.max > 0) {
      const zeroY = yPx(0, left);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, zeroY);
      ctx.lineTo(padLeft + plotW, zeroY);
      ctx.stroke();
    }

    // Series
    const dense = endIdx - startIdx > plotW * 4;
    for (const a of activeSeries) {
      const s = a.s;
      const dom = a.axis === 'right' && right ? right : left;
      const isCyan = a.color === '#22d3ee';
      ctx.save();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = s.lineWidth ?? 2.0;
      ctx.lineJoin = 'round';
      ctx.lineCap = a.dash.length ? 'butt' : 'round';
      ctx.shadowColor = a.color;
      ctx.shadowBlur = isCyan ? 7 : 4;
      ctx.setLineDash(a.dash);
      ctx.beginPath();

      if (dense && !s.stepped) {
        // Min/max decimation per pixel column
        let col = -1;
        let cMin = 0;
        let cMax = 0;
        let cLast = 0;
        for (let i = startIdx; i <= endIdx && i < s.data.length; i++) {
          const tv = tf(s.data[i]);
          if (!Number.isFinite(tv)) continue;
          const px = padLeft + ((i - startIdx) / spanIdx) * plotW;
          const py = yPx(tv, dom);
          const c = Math.round(px);
          if (c !== col) {
            if (col >= 0) {
              ctx.lineTo(col, cMin);
              ctx.lineTo(col, cMax);
              ctx.lineTo(col, cLast);
            } else {
              ctx.moveTo(px, py);
            }
            col = c;
            cMin = cMax = cLast = py;
          } else {
            if (py < cMin) cMin = py;
            if (py > cMax) cMax = py;
            cLast = py;
          }
        }
        if (col >= 0) {
          ctx.lineTo(col, cMin);
          ctx.lineTo(col, cMax);
          ctx.lineTo(col, cLast);
        }
      } else {
        let penDown = false;
        let prevPy = 0;
        for (let i = startIdx; i <= endIdx && i < s.data.length; i++) {
          const tv = tf(s.data[i]);
          if (!Number.isFinite(tv)) {
            penDown = false;
            continue;
          }
          const px = padLeft + ((i - startIdx) / spanIdx) * plotW;
          const py = yPx(tv, dom);
          if (!penDown) {
            ctx.moveTo(px, py);
            penDown = true;
          } else if (s.stepped) {
            ctx.lineTo(px, prevPy);
            ctx.lineTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
          prevPy = py;
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);

    // Reference markers
    const drawTag = (text: string, x: number, y: number, color: string, align: CanvasTextAlign) => {
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      const w = ctx.measureText(text).width + 8;
      let bx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
      bx = clamp(bx, padLeft + 1, padLeft + plotW - w - 1);
      ctx.fillStyle = 'rgba(5, 9, 18, 0.82)';
      ctx.fillRect(bx, y - 7, w, 14);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 4, y);
    };
    for (const m of markers) {
      const color = m.color ?? MARKER_COLOR;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.setLineDash(m.dashed === false ? [] : [5, 4]);
      if (m.x !== undefined && Number.isFinite(m.x)) {
        const px = xValPx(m.x);
        if (px >= padLeft - 1 && px <= padLeft + plotW + 1) {
          ctx.beginPath();
          ctx.moveTo(px, padTop);
          ctx.lineTo(px, padTop + plotH);
          ctx.stroke();
          if (m.label) {
            ctx.setLineDash([]);
            drawTag(m.label, px + 3, padTop + 10, color, 'left');
            ctx.setLineDash(m.dashed === false ? [] : [5, 4]);
          }
        }
      }
      if (m.y !== undefined && Number.isFinite(m.y)) {
        const dom = m.yAxis === 'right' && right ? right : left;
        const tv = tf(m.y);
        if (Number.isFinite(tv)) {
          const py = yPx(tv, dom);
          if (py >= padTop - 1 && py <= padTop + plotH + 1) {
            ctx.beginPath();
            ctx.moveTo(padLeft, py);
            ctx.lineTo(padLeft + plotW, py);
            ctx.stroke();
            if (m.label) {
              ctx.setLineDash([]);
              drawTag(m.label, padLeft + plotW - 4, py - 9, color, 'right');
            }
          }
        }
      }
      ctx.setLineDash([]);
    }

    // Peaks
    for (const pk of peaks) {
      const tv = tf(pk.y);
      if (!Number.isFinite(tv)) continue;
      if (pk.x >= Math.min(xMin, xMax) && pk.x <= Math.max(xMin, xMax)) {
        const px = xValPx(pk.x);
        const py = yPx(tv, left);
        ctx.fillStyle = peakColor;
        ctx.strokeStyle = PLOT_SURFACE_BG;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(pk.label, px, Math.max(padTop + 10, py - 8));
      }
    }

    ctx.restore();

    layoutRef.current = { width, height, padLeft, padTop, plotW, plotH, startIdx, endIdx, totalLen: view.totalLen };
    viewRef.current = { left, right, active: activeSeries, log: yLogScale };
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    darkMode,
    size.width,
    view,
    activeSeries,
    height,
    peaks,
    peakColor,
    markers,
    shadeRegions,
    yLogScale,
    xLabel,
    yLabel,
    yLabelRight,
    hasRight,
  ]);

  // Overlay redraw on probe change only
  useEffect(() => {
    probeRef.current = probe;
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe]);

  // Wheel zoom: Ctrl/⌘+wheel anywhere, plain wheel only when the plot is focused.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const focused = document.activeElement === el;
      if (!(e.ctrlKey || e.metaKey || focused)) return;
      const L = layoutRef.current;
      if (!L) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      const delta = (e.deltaY !== 0 ? e.deltaY : e.deltaX) * unit;
      const factor = clamp(Math.exp(delta * 0.0015), 0.25, 4);
      if (e.shiftKey) {
        setYScaleFactor((f) => clamp(f / factor, 0.1, 200));
        return;
      }
      const rect = (overlayRef.current ?? el).getBoundingClientRect();
      const anchor = clamp((e.clientX - rect.left - L.padLeft) / L.plotW, 0, 1);
      zoomX(factor, anchor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- pointer interaction (on the overlay canvas) ----
  const localPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const idxFromPx = (px: number) => {
    const L = layoutRef.current;
    if (!L) return 0;
    const ratio = clamp((px - L.padLeft) / L.plotW, 0, 1);
    return clamp(Math.round(L.startIdx + ratio * (L.endIdx - L.startIdx)), 0, L.totalLen - 1);
  };

  const setProbeIdx = (idx: number, source: 'pointer' | 'key') =>
    setProbe((prev) => (prev && prev.idx === idx && prev.source === source ? prev : { idx, source }));

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = localPos(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = { mode: interactionMode, pointerId: e.pointerId, startX: x, currX: x, lastX: x, lastY: y };
    setProbeIdx(idxFromPx(x), 'pointer');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPos(e);
    const d = dragRef.current;
    const L = layoutRef.current;
    if (d && d.pointerId === e.pointerId && L) {
      if (d.mode === 'pan') {
        const dx = x - d.lastX;
        const dy = y - d.lastY;
        d.lastX = x;
        d.lastY = y;
        if (dx) {
          setXRange(([s, en]) => {
            const span = en - s;
            let ns = s - (dx / L.plotW) * span;
            let ne = ns + span;
            if (ns < 0) {
              ne -= ns;
              ns = 0;
            }
            if (ne > 1) {
              ns -= ne - 1;
              ne = 1;
            }
            return [Math.max(0, ns), Math.min(1, ne)];
          });
        }
        if (dy && e.pointerType !== 'touch') {
          setYPanOffset((o) => o + dy / L.plotH / Math.max(0.1, yScaleFactor));
        }
      } else {
        d.currX = x;
        drawOverlay();
      }
    }
    setProbeIdx(idxFromPx(x), 'pointer');
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>, apply: boolean) => {
    const d = dragRef.current;
    const L = layoutRef.current;
    if (apply && d && d.mode === 'select-zoom' && L) {
      const x1 = Math.min(d.startX, d.currX);
      const x2 = Math.max(d.startX, d.currX);
      if (x2 - x1 > 12) {
        const r1 = clamp((x1 - L.padLeft) / L.plotW, 0, 1);
        const r2 = clamp((x2 - L.padLeft) / L.plotW, 0, 1);
        const minSpan = Math.max(4 / Math.max(1, totalLenRef.current - 1), 1e-4);
        setXRange(([s, en]) => {
          const span = en - s;
          const a = s + r1 * span;
          const b = Math.max(a + minSpan, s + r2 * span);
          return [a, Math.min(1, b)];
        });
      }
    }
    dragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drawOverlay();
  };

  // ---- keyboard ----
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const L = layoutRef.current;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (!L) return;
        e.preventDefault();
        const viewSpan = L.endIdx - L.startIdx;
        const step = Math.max(1, Math.round(viewSpan / (e.shiftKey ? 10 : 100)));
        const cur = probe?.idx ?? Math.round((L.startIdx + L.endIdx) / 2);
        const next = clamp(cur + (e.key === 'ArrowRight' ? step : -step), 0, L.totalLen - 1);
        if (next < L.startIdx || next > L.endIdx) {
          const f = next / Math.max(1, L.totalLen - 1);
          setXRange(([s, en]) => {
            const span = en - s;
            return f < s ? [f, f + span] : [Math.max(0, f - span), f];
          });
        }
        setProbeIdx(next, 'key');
        break;
      }
      case 'Home':
      case 'End':
        if (!L) return;
        e.preventDefault();
        setProbeIdx(e.key === 'Home' ? L.startIdx : L.endIdx, 'key');
        break;
      case '+':
      case '=':
        e.preventDefault();
        handleZoom(0.8);
        break;
      case '-':
      case '_':
        e.preventDefault();
        handleZoom(1.25);
        break;
      case '0':
        e.preventDefault();
        resetView();
        break;
      case 'Escape':
        setProbe(null);
        break;
      default:
    }
  };

  // ---- readout values ----
  const unitFor = (a: ActiveSeries) => a.s.unit ?? (a.axis === 'right' ? yUnitRight : yUnit);
  const readout = useMemo(() => {
    if (!probe) return null;
    const idx = probe.idx;
    return {
      xVal: Number.isFinite(xData[idx]) ? xData[idx] : idx,
      values: activeSeries.map((a) => ({
        label: a.s.label,
        color: a.color,
        dash: a.dash,
        val: a.s.data[idx],
        unit: unitFor(a),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe, activeSeries, xData, yUnit, yUnitRight]);

  const liveText =
    probe?.source === 'key' && readout
      ? `x = ${fmt(readout.xVal, xUnit)}; ` +
        readout.values.map((v) => `${v.label}: ${fmt(v.val, v.unit)}`).join('; ')
      : '';

  // ---- auto aria description ----
  const autoAria = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of activeSeries) {
      for (const v of a.s.data) {
        if (Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    const n = Math.max(xData.length, ...activeSeries.map((a) => a.s.data.length), 0);
    const x0 = Number.isFinite(xData[0]) ? xData[0] : 0;
    const x1 = Number.isFinite(xData[n - 1]) ? xData[n - 1] : n - 1;
    const names = activeSeries.map((a) => a.s.label).join(', ');
    let txt =
      `${title}. ${t.chart}, ${activeSeries.length} ${t.series}: ${names}. ` +
      `${xLabel} ${t.from} ${fmt(x0, xUnit)} ${t.to} ${fmt(x1, xUnit)}.`;
    if (Number.isFinite(lo)) txt += ` ${yLabel} ${t.from} ${fmt(lo, yUnit)} ${t.to} ${fmt(hi, yUnit)}.`;
    if (peaks.length) {
      const top = peaks.reduce((m, p) => (p.y > m.y ? p : m), peaks[0]);
      txt += ` ${t.peak}: ${top.label} ${t.at} x = ${fmt(top.x, xUnit)}.`;
    }
    return txt;
  }, [activeSeries, xData, title, xLabel, yLabel, xUnit, yUnit, peaks, t]);

  // ---- data table (<= 50 rows, current view) ----
  const tableRows = useMemo(() => {
    if (!showTable) return [];
    const count = view.endIdx - view.startIdx + 1;
    const stride = Math.max(1, Math.ceil(count / 50));
    const rows: { i: number; x: number; vals: (number | undefined)[] }[] = [];
    for (let i = view.startIdx; i <= view.endIdx && rows.length < 50; i += stride) {
      rows.push({
        i,
        x: Number.isFinite(xData[i]) ? xData[i] : i,
        vals: activeSeries.map((a) => a.s.data[i]),
      });
    }
    return rows;
  }, [showTable, view, xData, activeSeries]);

  // ---- export ----
  const legendEntries = (): LegendEntry[] =>
    activeSeries.map((a) => ({ label: a.s.label, color: a.color, dash: a.dash }));

  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    exportCompositePng({
      canvas,
      title,
      subtitle,
      legend: legendEntries(),
      dark: darkMode,
      rtl: lang === 'fa',
      filename: `${slugify(title)}.png`,
    });
  };

  const handleExportCsv = () => {
    const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const withUnit = (label: string, unit?: string) =>
      unit && !label.includes(unit) ? `${label} (${unit})` : label;
    const header = [withUnit(xLabel, xUnit), ...activeSeries.map((a) => withUnit(a.s.label, unitFor(a)))];
    const n = Math.max(xData.length, ...activeSeries.map((a) => a.s.data.length), 0);
    const lines = [header.map(esc).join(',')];
    for (let i = 0; i < n; i++) {
      const x = Number.isFinite(xData[i]) ? xData[i] : i;
      const vals = activeSeries.map((a) => {
        const v = a.s.data[i];
        return v === undefined || Number.isNaN(v) ? '' : String(v);
      });
      lines.push([String(x), ...vals].join(','));
    }
    downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${slugify(title)}.csv`);
  };

  const iconBtn = 'neu-btn p-1.5 rounded-full cursor-pointer';

  return (
    <div className="neu-card p-5 sm:p-6 flex flex-col gap-4" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {showVisibilityControls &&
            series.map((s, i) => {
              const isHidden = hiddenIds[s.id] || s.visible === false;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSeries(s.id)}
                  aria-pressed={!isHidden}
                  title={`${t.toggleSeries}: ${s.label}`}
                  className={`neu-btn px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isHidden ? 'opacity-45' : ''
                  }`}
                >
                  <LineSwatch color={seriesMeta[i].color} dash={seriesMeta[i].dash} />
                  <span>{s.label}</span>
                  {isHidden ? (
                    <EyeOff className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  ) : (
                    <Eye className="w-3 h-3 text-slate-500" aria-hidden="true" />
                  )}
                </button>
              );
            })}

          {showZoomControls && (
            <>
              <button
                type="button"
                onClick={() => handleZoom(0.7)}
                title={t.zoomIn}
                aria-label={t.zoomIn}
                className={iconBtn}
              >
                <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(1 / 0.7)}
                title={t.zoomOut}
                aria-label={t.zoomOut}
                className={iconBtn}
              >
                <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setInteractionMode((m) => (m === 'pan' ? 'select-zoom' : 'pan'))}
                title={t.pan}
                aria-label={t.pan}
                aria-pressed={interactionMode === 'pan'}
                className={`${iconBtn} ${interactionMode === 'pan' ? 'neu-btn-active' : ''}`}
              >
                <Move className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={resetView}
            title={t.reset}
            aria-label={t.reset}
            className={iconBtn}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            title={showTable ? t.hideData : t.viewData}
            aria-label={showTable ? t.hideData : t.viewData}
            aria-pressed={showTable}
            className={`${iconBtn} ${showTable ? 'neu-btn-active' : ''}`}
          >
            <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleExportImage}
            title={t.png}
            aria-label={t.png}
            className={iconBtn}
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            title={t.csv}
            aria-label={t.csv}
            className={iconBtn}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        onKeyDown={handleKeyDown}
        onDoubleClick={resetView}
        aria-label={`${title}. ${t.help}`}
        className="relative oscilloscope-frame overflow-hidden p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      >
        <div ref={surfaceRef} className="relative" style={{ height }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={ariaLabel ?? autoAria}
            className="block w-full rounded-xl"
          />
          <canvas
            ref={overlayRef}
            aria-hidden="true"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => endDrag(e, true)}
            onPointerCancel={(e) => endDrag(e, false)}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'touch' && !dragRef.current) setProbe(null);
            }}
            style={{ touchAction: 'pan-y' }}
            className={`absolute inset-0 block rounded-xl ${
              interactionMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
            }`}
          />
        </div>

        {isZoomed && (
          <button
            type="button"
            onClick={resetView}
            title={t.reset}
            aria-label={t.reset}
            className="absolute bottom-10 left-16 bg-slate-950/85 text-sky-200 border border-sky-400/30 px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums cursor-pointer hover:border-sky-300/70"
          >
            <span dir="ltr">
              {t.zoomed}: x∈[{fmt(view.xMin, xUnit)}, {fmt(view.xMax, xUnit)}] ×
            </span>
          </button>
        )}

        {readout && (
          <div
            dir="ltr"
            className="pointer-events-none absolute top-2.5 right-3 max-w-[80%] bg-slate-950/90 text-slate-100 shadow-md backdrop-blur-md px-2.5 py-1.5 rounded-lg text-[11px] font-mono tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1 border border-sky-400/30"
          >
            <span>
              x: <strong>{fmt(readout.xVal, xUnit)}</strong>
            </span>
            {readout.values.map((v, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <LineSwatch color={v.color} dash={v.dash} />
                <span>
                  {v.label}: <strong>{fmt(v.val, v.unit)}</strong>
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="sr-only" aria-live="polite">
          {liveText}
        </div>
      </div>

      {showTable && (
        <div className="neu-inset max-h-60 overflow-auto text-[11px] font-mono tabular-nums">
          <table className="w-full border-collapse" dir="ltr">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-900/95">
              <tr>
                <th scope="col" className="px-2 py-1 text-left font-semibold">
                  {xLabel}
                </th>
                {activeSeries.map((a) => (
                  <th key={a.s.id} scope="col" className="px-2 py-1 text-right font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <LineSwatch color={a.color} dash={a.dash} />
                      {a.s.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.i} className="border-t border-slate-400/15">
                  <td className="px-2 py-0.5">{fmt(r.x, xUnit)}</td>
                  {r.vals.map((v, k) => (
                    <td key={k} className="px-2 py-0.5 text-right">
                      {fmt(v, unitFor(activeSeries[k]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 py-1 text-slate-500 dark:text-slate-400">
            {t.rowsNote(tableRows.length, view.endIdx - view.startIdx + 1)}
          </p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// InteractiveHeatmap
// ---------------------------------------------------------------------------

export interface InteractiveHeatmapProps {
  title: string;
  subtitle?: string;
  xValues: number[];
  yValues: number[];
  /** matrix[xi][yi], values normalized to `valueRange` (default 0..1). */
  matrix: number[][];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  // ---- new (all optional) ----
  /** Probe label for x (default 't'). */
  xProbeLabel?: string;
  /** Unit appended verbatim after the x probe value (default 's'). */
  xProbeUnit?: string;
  /** Probe label for y (default 'f/scale'). */
  yProbeLabel?: string;
  /** Unit appended verbatim after the y probe value (default ''). */
  yProbeUnit?: string;
  /** Probe label for the cell value (default 'Norm Energy'). */
  valueProbeLabel?: string;
  /** Cell value formatter (default v => (v*100).toFixed(1) + '%'). */
  formatValue?: (v: number) => string;
  colormap?: ColormapName;
  /** Value range mapped onto the colormap (default [0, 1]). */
  valueRange?: [number, number];
  legendLowLabel?: string;
  legendHighLabel?: string;
  ariaLabel?: string;
}

/** Kept for backward compatibility: viridis via the shared LUT. */
export function colormapViridis(t: number): [number, number, number] {
  const lut = getColormapLUT('viridis');
  const i = Math.round(clamp(Number.isFinite(t) ? t : 0, 0, 1) * 255) * 3;
  return [lut[i], lut[i + 1], lut[i + 2]];
}

const defaultHeatValue = (v: number) => `${(v * 100).toFixed(1)}%`;

export const InteractiveHeatmap: React.FC<InteractiveHeatmapProps> = ({
  title,
  subtitle,
  xValues,
  yValues,
  matrix,
  xLabel = 'Time (s)',
  yLabel = 'Frequency (Hz)',
  height = 240,
  xProbeLabel = 't',
  xProbeUnit = 's',
  yProbeLabel = 'f/scale',
  yProbeUnit = '',
  valueProbeLabel = 'Norm Energy',
  formatValue = defaultHeatValue,
  colormap: cmap = 'viridis',
  valueRange,
  legendLowLabel,
  legendHighLabel,
  ariaLabel,
}) => {
  const { darkMode, lang } = useLab();
  const t = STR[lang === 'fa' ? 'fa' : 'en'];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(surfaceRef);
  const [probe, setProbe] = useState<{ x: number; y: number; val: number } | null>(null);
  const vMin = valueRange?.[0] ?? 0;
  const vMax = valueRange?.[1] ?? 1;

  const handleExport = () => {
    if (!canvasRef.current) return;
    exportCompositePng({
      canvas: canvasRef.current,
      title,
      subtitle,
      legend: [],
      dark: darkMode,
      rtl: lang === 'fa',
      filename: `${slugify(title)}.png`,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = size.width || 600;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PLOT_SURFACE_BG;
    ctx.fillRect(0, 0, width, height);

    const padLeft = 56;
    const padRight = 24;
    const padTop = 16;
    const padBottom = 32;
    const plotW = Math.max(40, width - padLeft - padRight);
    const plotH = Math.max(40, height - padTop - padBottom);

    const nX = Math.max(1, matrix.length);
    const nY = Math.max(1, matrix[0]?.length ?? 1);

    // Render cells into an nX x nY image, then scale up without smoothing.
    const lut = getColormapLUT(cmap);
    const img = document.createElement('canvas');
    img.width = nX;
    img.height = nY;
    const ictx = img.getContext('2d');
    if (ictx) {
      const data = ictx.createImageData(nX, nY);
      const span = vMax - vMin || 1;
      for (let xi = 0; xi < nX; xi++) {
        const col = matrix[xi];
        for (let yi = 0; yi < nY; yi++) {
          const raw = col?.[yi] ?? 0;
          const c = clamp(Number.isFinite(raw) ? (raw - vMin) / span : 0, 0, 1);
          const li = Math.round(c * 255) * 3;
          const o = ((nY - 1 - yi) * nX + xi) * 4;
          data.data[o] = lut[li];
          data.data[o + 1] = lut[li + 1];
          data.data[o + 2] = lut[li + 2];
          data.data[o + 3] = col ? 255 : 0;
        }
      }
      ictx.putImageData(data, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, padLeft, padTop, plotW, plotH);
      ctx.imageSmoothingEnabled = true;
    }

    ctx.fillStyle = AXIS_TEXT;
    ctx.font = AXIS_FONT;
    const yMin = yValues[0] ?? 0;
    const yMax = yValues[yValues.length - 1] ?? 100;
    {
      const { ticks, step } = niceTicks(Math.min(yMin, yMax), Math.max(yMin, yMax), clamp(Math.round(plotH / 45), 3, 6));
      const f = makeTickFormatter(ticks, step);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const v of ticks) {
        const py = padTop + ((yMax - v) / (yMax - yMin || 1)) * plotH;
        ctx.fillText(f(v), padLeft - 6, py);
      }
    }

    const xMin = xValues[0] ?? 0;
    const xMax = xValues[xValues.length - 1] ?? 1;
    {
      const { ticks, step } = niceTicks(Math.min(xMin, xMax), Math.max(xMin, xMax), clamp(Math.round(plotW / 90), 3, 8));
      const f = makeTickFormatter(ticks, step);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const v of ticks) {
        const px = padLeft + ((v - xMin) / (xMax - xMin || 1)) * plotW;
        ctx.fillText(f(v), px, padTop + plotH + 6);
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(xLabel, padLeft + plotW, height - 4);
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [darkMode, size.width, matrix, xValues, yValues, height, xLabel, yLabel, cmap, vMin, vMax]);

  const probeAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const padLeft = 56;
    const padTop = 16;
    const plotW = Math.max(40, rect.width - padLeft - 24);
    const plotH = Math.max(40, height - padTop - 32);

    const rx = clamp((px - padLeft) / plotW, 0, 0.999);
    const ry = clamp(1 - (py - padTop) / plotH, 0, 0.999);

    const xi = Math.floor(rx * matrix.length);
    const yi = Math.floor(ry * (matrix[0]?.length ?? 1));
    setProbe({
      x: xValues[xi] ?? rx,
      y: yValues[yi] ?? ry,
      val: matrix[xi]?.[yi] ?? 0,
    });
  };

  const autoAria = useMemo(() => {
    const x0 = xValues[0] ?? 0;
    const x1 = xValues[xValues.length - 1] ?? 0;
    const y0 = yValues[0] ?? 0;
    const y1 = yValues[yValues.length - 1] ?? 0;
    return `${title}. ${t.heatmap}: ${xLabel} ${t.from} ${fmt(x0)} ${t.to} ${fmt(x1)}, ${yLabel} ${t.from} ${fmt(y0)} ${t.to} ${fmt(y1)}.`;
  }, [title, t, xLabel, yLabel, xValues, yValues]);

  return (
    <div className="neu-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
            <span>{legendLowLabel ?? t.low}</span>
            <div
              className="w-20 h-2.5 rounded-sm"
              style={{ background: colormapGradientCss(cmap) }}
              aria-hidden="true"
            />
            <span>{legendHighLabel ?? t.high}</span>
          </div>
          <button
            type="button"
            onClick={handleExport}
            title={t.png}
            aria-label={t.png}
            className="neu-btn px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      <div className="relative oscilloscope-frame p-1">
        <div ref={surfaceRef} style={{ height }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={ariaLabel ?? autoAria}
            onPointerMove={probeAt}
            onPointerDown={probeAt}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'touch') setProbe(null);
            }}
            style={{ touchAction: 'pan-y' }}
            className="block w-full cursor-crosshair rounded-xl"
          />
        </div>
        {probe && (
          <div
            dir="ltr"
            className="pointer-events-none absolute top-2.5 right-3 bg-slate-950/90 text-slate-100 shadow-md backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums flex items-center gap-3 border border-sky-400/30"
          >
            <span>
              {xProbeLabel}: {probe.x.toFixed(2)}
              {xProbeUnit}
            </span>
            <span>
              {yProbeLabel}: {probe.y.toFixed(1)}
              {yProbeUnit}
            </span>
            <span>
              {valueProbeLabel}: {formatValue(probe.val)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
