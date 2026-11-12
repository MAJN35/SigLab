/**
 * Shared rendering helpers for Signal3DStage (Babylon.js, deep imports only).
 * Everything here is generated procedurally in code: no remote textures/HDRs.
 */
import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export type StageFinish = 'studio-chrome' | 'gold-obsidian' | 'bioluminescent';

/* ------------------------------------------------------------------------- */
/* Theme tokens                                                              */
/* ------------------------------------------------------------------------- */

export interface StageTheme {
  dark: boolean;
  /** Canvas background (sRGB hex) — matches the page surface. */
  background: string;
  /** Vignette edge colour (sRGB hex). */
  vignette: string;
  gridMinor: string;
  gridMajor: string;
  gridMinorAlpha: number;
  gridMajorAlpha: number;
  pool: string;
  poolAlpha: number;
  labelText: string;
  labelMuted: string;
  axis: string;
  /** Main time-domain trace colour. */
  trace: string;
  /** Emissive multiplier for glowing traces (feeds bloom in dark mode only). */
  glow: number;
  peakCap: string;
  harmonics: [string, string, string, string];
}

export function getStageTheme(dark: boolean): StageTheme {
  return dark
    ? {
        dark,
        background: '#070c18',
        vignette: '#02050c',
        gridMinor: '#38bdf8',
        gridMajor: '#7dd3fc',
        gridMinorAlpha: 0.16,
        gridMajorAlpha: 0.34,
        pool: '#0c2a4a',
        poolAlpha: 0.55,
        labelText: '#cbd5e1',
        labelMuted: '#7c8ba1',
        axis: '#64748b',
        trace: '#38bdf8',
        glow: 1.25,
        peakCap: '#7dd3fc',
        harmonics: ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6'],
      }
    : {
        dark,
        background: '#f8fbfe',
        vignette: '#dbe5f0',
        gridMinor: '#64748b',
        gridMajor: '#475569',
        gridMinorAlpha: 0.12,
        gridMajorAlpha: 0.26,
        pool: '#ffffff',
        poolAlpha: 0.6,
        labelText: '#1e293b',
        labelMuted: '#64748b',
        axis: '#94a3b8',
        trace: '#0284c7',
        glow: 0.35,
        peakCap: '#0f172a',
        harmonics: ['#0284c7', '#16a34a', '#d97706', '#db2777'],
      };
}

/* ------------------------------------------------------------------------- */
/* Perceptual colormaps (8 sRGB stops, monotonic lightness)                  */
/* ------------------------------------------------------------------------- */

const COLORMAPS: Record<'dark' | 'light', Record<StageFinish, string[]>> = {
  dark: {
    // "Ice" — deep navy → sky → cyan → near-white (matches app accent)
    'studio-chrome': ['#15284f', '#14336a', '#13468f', '#1269b5', '#0e95d8', '#30c2ee', '#8ce3f7', '#ecfbff'],
    // Inferno-like
    'gold-obsidian': ['#25124d', '#3b0f70', '#6a176e', '#9c2e5f', '#cc4248', '#ed6925', '#fbb61a', '#fcffa4'],
    // Viridis
    bioluminescent: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
  },
  light: {
    'studio-chrome': ['#d6e7f7', '#acd0f0', '#7cb5e6', '#4b97d9', '#2479c4', '#155ea4', '#0d457f', '#0a2c57'],
    'gold-obsidian': ['#fbecc9', '#f9d48b', '#f5b24f', '#ec8a2c', '#d8641d', '#b54419', '#862b14', '#541808'],
    bioluminescent: ['#dcf1d6', '#ade0a6', '#74c99d', '#42ab9b', '#2a8996', '#2b6a8e', '#2f4c7c', '#2b2b5c'],
  },
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function hexToColor3(hex: string): Color3 {
  const [r, g, b] = hexToRgb(hex);
  return new Color3(r, g, b);
}

export function getColormapStops(dark: boolean, finish: StageFinish): Float32Array {
  const list = COLORMAPS[dark ? 'dark' : 'light'][finish];
  const out = new Float32Array(list.length * 3);
  list.forEach((hex, i) => out.set(hexToRgb(hex), i * 3));
  return out;
}

/** Samples a colormap (sRGB, linear interpolation between stops) into `out`. */
export function sampleColormap(stops: Float32Array, t: number, out: Float32Array | number[], offset = 0): void {
  const n = stops.length / 3;
  const x = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  for (let c = 0; c < 3; c++) {
    out[offset + c] = stops[i * 3 + c] + (stops[(i + 1) * 3 + c] - stops[i * 3 + c]) * f;
  }
}

/** sRGB → linear (approx. gamma 2.2) for values written into post-processed render targets. */
export function toLinear(v: number): number {
  return Math.pow(v, 2.2);
}

/* ------------------------------------------------------------------------- */
/* Shaders                                                                   */
/* ------------------------------------------------------------------------- */

const GRID_VS = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vW;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = viewProjection * w;
}`;

const GRID_FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vW;
uniform vec3 minorColor;
uniform vec3 majorColor;
uniform vec3 poolColor;
uniform vec4 params;   // minorStep, majorStep, fadeRadius, poolAlpha
uniform vec2 alphas;   // minorAlpha, majorAlpha
uniform vec2 center;

float gridLine(vec2 p, float stepSize, float widthPx) {
  vec2 c = p / stepSize;
  vec2 fw = max(fwidth(c), vec2(1e-4));
  vec2 g = abs(fract(c - 0.5) - 0.5) / (fw * widthPx);
  float l = 1.0 - min(min(g.x, g.y), 1.0);
  // fade lines that become sub-pixel (prevents moiré at grazing angles)
  float density = max(fw.x, fw.y);
  return l * (1.0 - smoothstep(0.25, 0.6, density));
}

void main(void) {
  vec2 p = vW.xz;
  float d = length(p - center);
  float fade = 1.0 - smoothstep(params.z * 0.3, params.z, d);
  float minor = gridLine(p, params.x, 1.0) * alphas.x;
  float major = gridLine(p, params.y, 1.4) * alphas.y;
  float a = max(minor, major) * fade;
  vec3 lineC = major >= minor ? majorColor : minorColor;
  float pool = (1.0 - smoothstep(0.0, params.z * 0.85, d)) * params.w;
  float outA = a + pool * (1.0 - a);
  vec3 col = (lineC * a + poolColor * pool * (1.0 - a)) / max(outA, 1e-4);
  gl_FragColor = vec4(pow(col, vec3(2.2)), outA);
}`;

const SURFACE_VS = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float maxElev;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUV;
varying float vH;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(world) * normal);
  vUV = uv;
  vH = clamp(position.y / maxElev, 0.0, 1.0);
  gl_Position = viewProjection * w;
}`;

const SURFACE_FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUV;
varying float vH;
uniform vec3 stops[8];
uniform vec3 lightDir;
uniform vec3 camPos;
uniform vec3 gridColor;
uniform vec4 look;     // gridAmount, contourAmount, glowAmount, specAmount
uniform vec2 gridCells;

vec3 cmap(float t) {
  float x = clamp(t, 0.0, 1.0) * 7.0;
  float fi = floor(x);
  float f = x - fi;
  vec3 a = stops[0];
  vec3 b = stops[1];
  for (int k = 0; k < 8; k++) {
    if (float(k) == fi) a = stops[k];
    if (float(k) == fi + 1.0) b = stops[k];
  }
  if (fi >= 7.0) { a = stops[7]; b = stops[7]; }
  return mix(a, b, f);
}

float aaLine(vec2 c, float w) {
  vec2 fw = max(fwidth(c), vec2(1e-4));
  vec2 g = abs(fract(c - 0.5) - 0.5) / (fw * w);
  return 1.0 - min(min(g.x, g.y), 1.0);
}

void main(void) {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(camPos - vW);
  vec3 L = normalize(-lightDir);
  vec3 base = cmap(vH);

  float diff = max(dot(n, L), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  vec3 col = base * (0.42 + 0.22 * hemi + 0.5 * diff);
  vec3 h = normalize(L + v);
  col += vec3(pow(max(dot(n, h), 0.0), 56.0)) * look.w;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += base * rim * 0.18;

  // mesh-aligned grid (wireframe-like overlay, anti-aliased)
  float g = aaLine(vUV * gridCells, 1.0);
  col = mix(col, gridColor, g * look.x);
  // iso-amplitude contour lines
  float c = vH * 10.0;
  float cfw = max(fwidth(c), 1e-4);
  float cl = 1.0 - min(abs(fract(c - 0.5) - 0.5) / (cfw * 1.1), 1.0);
  col = mix(col, col * 0.55 + gridColor * 0.15, cl * look.y * step(0.04, vH));

  vec3 lin = pow(max(col, vec3(0.0)), vec3(2.2));
  // emissive lift on spectral peaks (picked up by bloom in dark mode)
  lin += pow(base, vec3(2.2)) * smoothstep(0.55, 1.0, vH) * look.z;
  gl_FragColor = vec4(lin, 1.0);
}`;

let shadersRegistered = false;
function registerShaders(): void {
  if (shadersRegistered) return;
  ShaderStore.ShadersStore['signalStageGridVertexShader'] = GRID_VS;
  ShaderStore.ShadersStore['signalStageGridFragmentShader'] = GRID_FS;
  ShaderStore.ShadersStore['signalStageSurfaceVertexShader'] = SURFACE_VS;
  ShaderStore.ShadersStore['signalStageSurfaceFragmentShader'] = SURFACE_FS;
  shadersRegistered = true;
}

/** Infinite-looking anti-aliased floor grid that fades out radially. */
export function createGroundGrid(scene: Scene, theme: StageTheme, y: number, size = 60): Mesh {
  registerShaders();
  const ground = CreateGround('ssGround', { width: size, height: size, subdivisions: 1 }, scene);
  ground.position.y = y;
  ground.isPickable = false;
  const mat = new ShaderMaterial(
    'ssGridMat',
    scene,
    { vertex: 'signalStageGrid', fragment: 'signalStageGrid' },
    {
      attributes: ['position'],
      uniforms: ['world', 'viewProjection', 'minorColor', 'majorColor', 'poolColor', 'params', 'alphas', 'center'],
      needAlphaBlending: true,
    }
  );
  mat.backFaceCulling = false;
  mat.setColor3('minorColor', hexToColor3(theme.gridMinor));
  mat.setColor3('majorColor', hexToColor3(theme.gridMajor));
  mat.setColor3('poolColor', hexToColor3(theme.pool));
  mat.setVector4('params', new Vector4(0.5, 2.0, 15, theme.poolAlpha));
  mat.setVector2('alphas', new Vector2(theme.gridMinorAlpha, theme.gridMajorAlpha));
  mat.setVector2('center', new Vector2(0, -0.5));
  ground.material = mat;
  ground.alphaIndex = 0;
  return ground;
}

/** Colormapped, lit height-field material with grid + contour overlay. */
export function createSurfaceMaterial(scene: Scene): ShaderMaterial {
  registerShaders();
  const mat = new ShaderMaterial(
    'ssSurfaceMat',
    scene,
    { vertex: 'signalStageSurface', fragment: 'signalStageSurface' },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: [
        'world',
        'viewProjection',
        'maxElev',
        'stops',
        'lightDir',
        'camPos',
        'gridColor',
        'look',
        'gridCells',
      ],
    }
  );
  mat.backFaceCulling = false;
  return mat;
}

/* ------------------------------------------------------------------------- */
/* Text labels                                                               */
/* ------------------------------------------------------------------------- */

export interface LabelOptions {
  color: string;
  /** World-space height of the label quad. */
  height?: number;
  /** Optional swatch colour drawn before the text (legend style). */
  swatch?: string;
  mono?: boolean;
  weight?: number;
  align?: 'center' | 'left' | 'right';
}

export interface StageLabel {
  mesh: Mesh;
  redraw: () => void;
}

/**
 * Crisp billboarded text label rendered into a DynamicTexture at 2× density.
 * `redraw()` re-rasterises (call after web fonts finish loading).
 */
export function createTextLabel(
  scene: Scene,
  name: string,
  text: string,
  parent: TransformNode | null,
  position: Vector3,
  opts: LabelOptions
): StageLabel {
  const PX_H = 64; // texture pixel height
  const fontSize = 38;
  const family = opts.mono
    ? '"IBM Plex Mono", ui-monospace, monospace'
    : 'Inter, "Vazirmatn", system-ui, sans-serif';
  const font = `${opts.weight ?? 600} ${fontSize}px ${family}`;
  const measureCanvas = document.createElement('canvas').getContext('2d');
  let textW = text.length * fontSize * 0.6;
  if (measureCanvas) {
    measureCanvas.font = font;
    textW = measureCanvas.measureText(text).width;
  }
  const swatchW = opts.swatch ? 34 : 0;
  const pxW = Math.ceil(textW + swatchW + 20);

  const worldH = opts.height ?? 0.26;
  const worldW = worldH * (pxW / PX_H);
  const plane = CreatePlane(name, { width: worldW, height: worldH }, scene);
  if (parent) plane.parent = parent;
  plane.position.copyFrom(position);
  if (opts.align === 'left') plane.position.x += worldW / 2;
  if (opts.align === 'right') plane.position.x -= worldW / 2;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const dt = new DynamicTexture(`${name}_dt`, { width: pxW, height: PX_H }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  dt.hasAlpha = true;
  dt.anisotropicFilteringLevel = 4;

  const redraw = () => {
    const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, pxW, PX_H);
    if (opts.swatch) {
      ctx.fillStyle = opts.swatch;
      ctx.beginPath();
      ctx.roundRect(10, PX_H / 2 - 9, 18, 18, 5);
      ctx.fill();
    }
    ctx.font = font;
    ctx.fillStyle = opts.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 10 + swatchW, PX_H / 2 + 2);
    dt.update(true);
  };
  redraw();

  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseTexture = dt;
  mat.emissiveTexture = dt;
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.fogEnabled = false;
  plane.material = mat;
  return { mesh: plane, redraw };
}
