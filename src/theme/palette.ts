/**
 * Shared plot palette for SigLab.
 *
 * Categorical series colors are based on the Okabe-Ito colorblind-safe set,
 * with lightness tuned so every color reaches >= 3:1 contrast against BOTH the
 * light app background (#edf4fc) and the dark background (#05080e / #050912
 * oscilloscope frame). Order is chosen so the first 4-5 entries stay
 * distinguishable under deuteranopia/protanopia.
 */
export const SERIES_PALETTE: readonly string[] = [
  '#0a93cf', // sky blue
  '#c47a00', // orange
  '#009e73', // bluish green
  '#c26a9c', // reddish purple
  '#e0661a', // vermillion
  '#3b82f6', // blue
  '#9a8c00', // olive (Okabe-Ito yellow, darkened for light bg)
  '#8b7fd6', // violet
] as const;

/** Color for the i-th series (wraps around). */
export function getSeriesColor(i: number): string {
  const n = SERIES_PALETTE.length;
  return SERIES_PALETTE[((Math.floor(i) % n) + n) % n];
}

/**
 * Canvas line-dash patterns (px) so series can be told apart without color.
 * Index 0 is solid.
 */
export const SERIES_DASHES: readonly (readonly number[])[] = [
  [],
  [7, 4],
  [2, 3],
  [9, 3, 2, 3],
  [4, 4],
  [12, 4],
  [2, 2, 6, 2],
  [1, 3],
] as const;

export function getSeriesDash(i: number): number[] {
  const n = SERIES_DASHES.length;
  return [...SERIES_DASHES[((Math.floor(i) % n) + n) % n]];
}

/** Default color for peak markers (amber, matches "amber markers" copy). */
export const PEAK_COLOR = '#f59e0b';

/** Default color for reference-line markers. */
export const MARKER_COLOR = '#cbd5e1';

/** Default fill for shaded x-regions. */
export const SHADE_COLOR = 'rgba(148, 163, 184, 0.14)';

/** Background of the oscilloscope plot surface (always dark). */
export const PLOT_SURFACE_BG = '#050912';

/** App page backgrounds per theme (used for PNG export). */
export const THEME_BG = { dark: '#05080e', light: '#edf4fc' } as const;
export const THEME_TEXT = { dark: '#f8fafc', light: '#0f172a' } as const;
export const THEME_TEXT_MUTED = { dark: '#94a3b8', light: '#334155' } as const;

// ---------------------------------------------------------------------------
// Sequential colormaps (256-entry LUTs interpolated from matplotlib deciles)
// ---------------------------------------------------------------------------

export type ColormapName = 'viridis' | 'magma' | 'inferno';

export const COLORMAP_STOPS: Record<ColormapName, readonly string[]> = {
  viridis: [
    '#440154', '#482475', '#414487', '#355f8d', '#2a788e', '#21918c',
    '#22a884', '#44bf70', '#7ad151', '#bddf26', '#fde725',
  ],
  magma: [
    '#000004', '#140e36', '#3b0f70', '#641a80', '#8c2981', '#b73779',
    '#de4968', '#f7705c', '#fe9f6d', '#fecf92', '#fcfdbf',
  ],
  inferno: [
    '#000004', '#160b39', '#420a68', '#6a176e', '#932667', '#bc3754',
    '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4',
  ],
};

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const lutCache: Partial<Record<ColormapName, Uint8ClampedArray>> = {};

/** 256 x RGB lookup table (flat array, length 768). */
export function getColormapLUT(name: ColormapName = 'viridis'): Uint8ClampedArray {
  const cached = lutCache[name];
  if (cached) return cached;
  const stops = (COLORMAP_STOPS[name] ?? COLORMAP_STOPS.viridis).map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  const segs = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segs;
    const k = Math.min(segs - 1, Math.floor(t));
    const f = t - k;
    const a = stops[k];
    const b = stops[k + 1];
    lut[i * 3] = Math.round(a[0] + (b[0] - a[0]) * f);
    lut[i * 3 + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
  }
  lutCache[name] = lut;
  return lut;
}

/** Map t in [0, 1] to an RGB triple via the LUT. */
export function colormap(t: number, name: ColormapName = 'viridis'): [number, number, number] {
  const lut = getColormapLUT(name);
  const c = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const i = Math.round(c * 255) * 3;
  return [lut[i], lut[i + 1], lut[i + 2]];
}

/** CSS linear-gradient string for a colormap legend. */
export function colormapGradientCss(name: ColormapName = 'viridis', direction = 'to right'): string {
  return `linear-gradient(${direction}, ${(COLORMAP_STOPS[name] ?? COLORMAP_STOPS.viridis).join(', ')})`;
}
