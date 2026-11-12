/**
 * Babylon.js scene for the "3D DNA & 47 Chromosomes" page.
 *
 * Scientific-illustration style: PBR "glossy ceramic" materials lit by a key/fill/rim rig and a
 * procedural (in-code) reflection environment, ACES tone mapping, MSAA/FXAA, bloom that only
 * catches emissive highlights (dark theme), optional SSAO2 on capable desktops.
 *
 * Geometry:
 *  - Right-handed B-DNA: 10.5 bp/turn (34.3°/bp), backbones offset 135° so the minor and major
 *    grooves read clearly; smooth sugar-phosphate tubes + phosphate beads; bases as flattened
 *    capsules (purine longer than pyrimidine) drawn with thin instances.
 *  - Chromosomes: one custom mesh per chromosome (two sister chromatids, centromere pinch,
 *    rounded telomeres) with procedural G-banding baked into vertex colours, aligned on the
 *    centromere like a clinical karyogram.
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
// Side-effect registrations (thin instances, ray picking, scene components)
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';

import type { ChromosomeId, ChromosomeSpec, GeneLocus, KaryotypeInstance } from '../../simulations/dna';

export type DNA3DViewMode = 'dual-3d' | 'chrom-closeup' | 'karyotype-3d' | 'helix-3d';
export type DNACameraPreset = 'overview' | 'karyotype' | 'helix-macro' | 'groove-top';
export type DNAFinishMode = 'cryo-studio' | 'cpk-metallic' | 'bioluminescent';
type Base = 'A' | 'T' | 'G' | 'C';

/** Colour-blind-considerate nucleotide palette (Okabe–Ito derived). Always paired with letters in UI. */
export const DNA_BASE_PALETTE: Record<Base, string> = {
  A: '#3b8fd9', // blue
  T: '#f0a52c', // orange
  G: '#17a589', // bluish green
  C: '#d670ad', // reddish purple
};

const COMPLEMENT: Record<Base, Base> = { A: 'T', T: 'A', G: 'C', C: 'G' };
const isPurine = (b: Base) => b === 'A' || b === 'G';

export interface DNASceneState {
  karyotypeInstances: KaryotypeInstance[];
  selectedChromId: ChromosomeId;
  activeLocus: GeneLocus;
  activeSequence: string;
  mutatedBpIndex: number;
  viewMode3D: DNA3DViewMode;
  cameraPreset: DNACameraPreset;
  finishMode: DNAFinishMode;
  autoRotate: boolean;
  dark: boolean;
}

export interface DNASceneOptions {
  coarsePointer: boolean;
  lowEnd: boolean;
  onSelectChromosome: (id: ChromosomeId) => void;
}

export interface DNASceneController {
  update: (patch: Partial<DNASceneState>) => void;
  setInteractive: (on: boolean) => void;
  setRunning: (on: boolean) => void;
  dispose: () => void;
}

const lin = (hex: string) => Color3.FromHexString(hex).toLinearSpace();

const GROUP_ORDER: ChromosomeId[] = [
  '1', '2', '3', '4', '5', '6', '7', '8',
  '9', '10', '11', '12', '13', '14', '15', '16',
  '17', '18', '19', '20', '21', '22', 'X', 'Y',
];

// ---- layout constants -------------------------------------------------------------------
const CELL_W = 1.5;
const ROW_H = 3.0;
const COPY_DX = 0.4;
const CHROM_R = 0.085;

const NUM_BP = 28;
const HELIX_R = 0.9;
const RISE = 0.29;
const TWIST = (34.3 * Math.PI) / 180; // 10.5 bp per turn
const GROOVE = (135 * Math.PI) / 180; // angular offset of the 2nd backbone (minor groove side)
const HELIX_H = (NUM_BP - 1) * RISE;
const BASE_R = HELIX_R * 0.86;
const BASE_RADIUS = 0.1;

const LABEL_FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_FONT = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** Chromosome total height in world units for a spec. */
const chromHeight = (spec: ChromosomeSpec) => 0.5 + 1.75 * spec.lengthNorm;

// ---- small helpers --------------------------------------------------------------------------
function hash01(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));

const STAIN_LUM: Record<string, number> = {
  gneg: 1.0,
  gpos25: 0.8,
  gpos50: 0.62,
  gpos75: 0.47,
  gpos100: 0.33,
  acen: 0.72,
};

/** G-band luminance along the chromosome, t = 0 at p-telomere → 1 at q-telomere. */
function bandLum(spec: ChromosomeSpec, t: number, seed: number) {
  const n = spec.bands.length || 1;
  const sample = (tt: number) => {
    const ct = Math.min(0.9999, Math.max(0, tt));
    const bi = Math.floor(ct * n);
    const f = ct * n - bi;
    const band = spec.bands[bi];
    let l = STAIN_LUM[band?.stain ?? 'gneg'] ?? 1;
    const h = hash01(bi + 1, seed);
    if (band && band.stain !== 'gneg' && band.stain !== 'acen' && h > 0.45) {
      l += (1 - l) * 0.75 * bump(f, 0.3 + h * 0.4, 0.1); // light sub-band splits dark band
    } else if (band?.stain === 'gneg' && h > 0.55) {
      l -= 0.22 * bump(f, 0.5, 0.09); // faint grey sub-band
    }
    return l;
  };
  const d = 0.012; // box filter to soften band edges
  return (sample(t - d) + sample(t) + sample(t + d)) / 3;
}

/** Builds one chromosome (two sister chromatids) as a single mesh with vertex-colour banding. */
function buildChromosomeMesh(name: string, spec: ChromosomeSpec, seed: number, scene: Scene): Mesh {
  const H = chromHeight(spec);
  const yTop = H / 2;
  const cenY = yTop - H * spec.centromereRatio;
  const RINGS = 72;
  const TESS = 22;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const capLen = CHROM_R * 1.15;

  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= RINGS; i++) {
      const s = i / RINGS;
      const t = 0.5 * s + 0.25 * (1 - Math.cos(Math.PI * s)); // denser near telomeres
      const y = yTop - t * H;
      const dEnd = Math.min(y - -yTop, yTop - y);
      const cap = dEnd < capLen ? Math.sqrt(Math.max(0, 1 - (1 - dEnd / capLen) ** 2)) : 1;
      const pinch = 1 - 0.42 * Math.exp(-(((y - cenY) / (0.05 + CHROM_R * 0.45)) ** 2));
      const belly = 1 + 0.05 * Math.sin(Math.PI * Math.min(1, Math.abs(y - cenY) / Math.max(0.2, H * 0.6)));
      const r = CHROM_R * cap * pinch * belly;
      const splay = Math.pow(Math.min(1, Math.abs(y - cenY) / (H * 0.5)), 1.3);
      const cx = side * (CHROM_R * 0.8 + 0.045 * splay);
      const lum = bandLum(spec, t, seed);
      for (let k = 0; k < TESS; k++) {
        const a = (k / TESS) * Math.PI * 2;
        positions.push(cx + Math.cos(a) * r, y, Math.sin(a) * r * 0.92);
        colors.push(lum, lum, lum, 1);
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let k = 0; k < TESS; k++) {
        const a = base + i * TESS + k;
        const b = base + i * TESS + ((k + 1) % TESS);
        const c = a + TESS;
        const d = b + TESS;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.colors = colors;
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh);
  return mesh;
}

interface LabelHandle {
  mesh: Mesh;
  dt: DynamicTexture;
  draw: (text: string, style: LabelStyle) => void;
}
interface LabelStyle {
  font: string;
  color: string;
  bg?: string;
  border?: string;
  dot?: string;
  /** draw the pill from the texture's left edge (plane then anchors on its left side) */
  alignLeft?: boolean;
}

/** Billboarded text label backed by a mip-mapped DynamicTexture. */
function createLabel(name: string, scene: Scene, worldH: number, texW: number, parent: TransformNode): LabelHandle {
  const texH = 128;
  const dt = new DynamicTexture(`${name}_dt`, { width: texW, height: texH }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  dt.hasAlpha = true;
  dt.anisotropicFilteringLevel = 8;
  const plane = CreatePlane(name, { width: (worldH * texW) / texH, height: worldH }, scene);
  plane.parent = parent;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.emissiveTexture = dt;
  mat.opacityTexture = dt;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  plane.material = mat;

  const draw = (text: string, style: LabelStyle) => {
    const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, texW, texH);
    ctx.font = style.font;
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    const dotW = style.dot ? 34 : 0;
    if (style.bg) {
      const padX = 26;
      const w = Math.min(texW - 8, tw + padX * 2 + dotW);
      const x = style.alignLeft ? 4 : (texW - w) / 2;
      ctx.beginPath();
      ctx.roundRect(x, 18, w, texH - 36, (texH - 36) / 2);
      ctx.fillStyle = style.bg;
      ctx.fill();
      if (style.border) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = style.border;
        ctx.stroke();
      }
      if (style.dot) {
        ctx.beginPath();
        ctx.arc(x + padX + 9, texH / 2, 9, 0, Math.PI * 2);
        ctx.fillStyle = style.dot;
        ctx.fill();
      }
      ctx.fillStyle = style.color;
      ctx.textAlign = 'left';
      ctx.fillText(text, x + padX + dotW, texH / 2 + 2);
    } else {
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.fillText(text, texW / 2, texH / 2 + 2);
    }
    dt.update(true);
  };
  return { mesh: plane, dt, draw };
}

function roundedPlateTexture(name: string, scene: Scene, fill: string, stroke: string): DynamicTexture {
  const w = 256;
  const h = 512;
  const dt = new DynamicTexture(name, { width: w, height: h }, scene, true);
  dt.hasAlpha = true;
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 34);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  dt.update(true);
  return dt;
}

// ============================================================================================

export function createDNAScene(
  canvas: HTMLCanvasElement,
  initial: DNASceneState,
  opts: DNASceneOptions
): DNASceneController {
  const state: DNASceneState = { ...initial };

  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: false, // MSAA handled by the post-process pipeline
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    },
    false
  );
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  // Babylon forces touch-action:none on the canvas; on phones we only want that while interacting.
  if (opts.coarsePointer) canvas.style.touchAction = 'pan-y';

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0); // transparent: the themed CSS backdrop shows through
  scene.skipPointerMovePicking = true;
  scene.ambientColor = new Color3(0, 0, 0);

  // ---- camera ----------------------------------------------------------------------------
  const camera = new ArcRotateCamera('dnaCam', -Math.PI / 2, Math.PI / 2.05, 12, Vector3.Zero(), scene);
  camera.fov = 0.72;
  camera.minZ = 0.1;
  camera.maxZ = 200;
  camera.inertia = 0.88;
  camera.angularSensibilityX = 1600;
  camera.angularSensibilityY = 1600;
  camera.wheelDeltaPercentage = 0.012;
  camera.pinchDeltaPercentage = 0.008;
  camera.panningSensibility = 220;
  camera.lowerRadiusLimit = 2.2;
  camera.upperRadiusLimit = 36;
  camera.lowerBetaLimit = 0.12;
  camera.upperBetaLimit = Math.PI - 0.12;
  let controlsAttached = false;
  const attachControls = (on: boolean) => {
    if (on && !controlsAttached) {
      camera.attachControl(true);
      canvas.style.touchAction = 'none';
      controlsAttached = true;
    } else if (!on && controlsAttached) {
      camera.detachControl();
      canvas.style.touchAction = opts.coarsePointer ? 'pan-y' : 'none';
      controlsAttached = false;
    }
  };
  if (!opts.coarsePointer) attachControls(true);

  // ---- lights: key / fill / rim + soft hemispheric ambient -------------------------------
  const hemi = new HemisphericLight('dnaHemi', new Vector3(0, 1, -0.3), scene);
  hemi.intensity = 0.35;
  hemi.diffuse = new Color3(1, 1, 1);
  hemi.groundColor = new Color3(0.32, 0.36, 0.46);
  hemi.specular = Color3.Black();

  const key = new DirectionalLight('dnaKey', new Vector3(0.55, -0.65, 0.55), scene);
  key.intensity = 2.4;
  key.diffuse = new Color3(1.0, 0.97, 0.92);
  const fill = new DirectionalLight('dnaFill', new Vector3(-0.7, -0.15, 0.6), scene);
  fill.intensity = 0.7;
  fill.diffuse = new Color3(0.78, 0.86, 1.0);
  fill.specular = new Color3(0.2, 0.2, 0.25);
  const rim = new DirectionalLight('dnaRim', new Vector3(0.15, -0.35, -1), scene);
  rim.intensity = 1.8;
  rim.diffuse = new Color3(0.9, 0.95, 1.0);

  // ---- procedural reflection environment (rendered once into a cube map) -----------------
  const ENV_LAYER = 0x10000000;
  const envMeshes: Mesh[] = [];
  const sky = CreateSphere('envSky', { diameter: 60, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  {
    const pos = sky.getVerticesData('position')!;
    const cols: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const t = pos[i + 1] / 30; // -1 .. 1
      const top = [0.95, 0.97, 1.0];
      const hor = [0.55, 0.6, 0.7];
      const bot = [0.12, 0.13, 0.17];
      const c = t >= 0 ? hor.map((h, k) => h + (top[k] - h) * Math.pow(t, 0.7)) : hor.map((h, k) => h + (bot[k] - h) * Math.pow(-t, 0.6));
      cols.push(c[0], c[1], c[2], 1);
    }
    sky.setVerticesData('color', cols);
    const skyMat = new StandardMaterial('envSkyMat', scene);
    skyMat.disableLighting = true;
    skyMat.diffuseColor = Color3.White();
    skyMat.emissiveColor = Color3.Black();
    skyMat.backFaceCulling = false;
    sky.material = skyMat;
    envMeshes.push(sky);
  }
  const softbox = (name: string, w: number, h: number, pos: Vector3, power: number) => {
    const p = CreatePlane(name, { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, scene);
    p.position.copyFrom(pos);
    p.lookAt(Vector3.Zero());
    const m = new StandardMaterial(`${name}_m`, scene);
    m.disableLighting = true;
    m.emissiveColor = new Color3(power, power, power);
    m.diffuseColor = Color3.Black();
    p.material = m;
    envMeshes.push(p);
  };
  softbox('envKeyBox', 16, 10, new Vector3(-14, 16, -12), 2.2);
  softbox('envStrip', 4, 22, new Vector3(22, 2, 4), 1.4);
  softbox('envBack', 18, 6, new Vector3(0, 6, 24), 0.9);
  envMeshes.forEach((m) => {
    m.layerMask = ENV_LAYER;
    m.isPickable = false;
  });
  const probe = new ReflectionProbe('dnaEnvProbe', 128, scene, true, true);
  envMeshes.forEach((m) => probe.renderList!.push(m));
  probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  probe.cubeTexture.clearColor = new Color4(0.3, 0.32, 0.38, 1);
  scene.environmentTexture = probe.cubeTexture;
  scene.environmentIntensity = 0.75;

  // ---- post-processing -------------------------------------------------------------------
  const webgl2 = engine.webGLVersion >= 2;
  let ssao: SSAO2RenderingPipeline | null = null;
  if (!opts.coarsePointer && !opts.lowEnd && webgl2 && SSAO2RenderingPipeline.IsSupported) {
    try {
      ssao = new SSAO2RenderingPipeline('dnaSSAO', scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera]);
      ssao.radius = 0.55;
      ssao.totalStrength = 0.9;
      ssao.base = 0.2;
      ssao.samples = 12;
      ssao.maxZ = 60;
      ssao.minZAspect = 0.5;
      ssao.expensiveBlur = false;
    } catch {
      ssao = null;
    }
  }

  const pipeline = new DefaultRenderingPipeline('dnaPipeline', true, scene, [camera]);
  pipeline.samples = webgl2 && !opts.coarsePointer ? 4 : 1;
  pipeline.fxaaEnabled = pipeline.samples <= 1;
  pipeline.imageProcessingEnabled = true;
  const ip = pipeline.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.vignetteEnabled = true;
  ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
  ip.vignetteWeight = 1.1;
  ip.vignetteStretch = 0.6;
  ip.vignetteCameraFov = camera.fov;
  ip.vignetteColor = new Color4(0, 0, 0, 1);
  pipeline.bloomKernel = 48;
  pipeline.bloomScale = 0.5;

  // ---- materials ---------------------------------------------------------------------------
  const pbr = (name: string, hex: string) => {
    const m = new PBRMaterial(name, scene);
    m.albedoColor = lin(hex);
    m.metallic = 0;
    m.roughness = 0.35;
    m.clearCoat.isEnabled = true;
    m.clearCoat.intensity = 0.6;
    m.clearCoat.roughness = 0.12;
    m.environmentIntensity = 1;
    return m;
  };
  const strand1Mat = pbr('strand1Mat', '#8796b8');
  const strand2Mat = pbr('strand2Mat', '#ae9fcc');
  const purineMat = pbr('purineMat', '#ffffff');
  const pyrimidineMat = pbr('pyrimidineMat', '#ffffff');
  const beadMat = pbr('beadMat', '#ffffff');
  const hlPurMat = pbr('hlPurMat', '#ffffff');
  const hlPyrMat = pbr('hlPyrMat', '#ffffff');
  const helixMats = [strand1Mat, strand2Mat, purineMat, pyrimidineMat, beadMat, hlPurMat, hlPyrMat];

  const unlit = (name: string, hex: string) => {
    const m = new StandardMaterial(name, scene);
    m.disableLighting = true;
    m.emissiveColor = Color3.FromHexString(hex);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    return m;
  };
  const snpRingMat = unlit('snpRingMat', '#10b981');
  const locusRingMat = unlit('locusRingMat', '#10b981');

  // ======================================================================================
  // HELIX
  // ======================================================================================
  const helixRoot = new TransformNode('helixRoot', scene);
  const helixSpin = new TransformNode('helixSpin', scene);
  helixSpin.parent = helixRoot;

  const bpY = (i: number) => (i - (NUM_BP - 1) / 2) * RISE;
  const strandPoint = (bp: number, strand: 0 | 1, r: number) => {
    const a = bp * TWIST + (strand === 1 ? GROOVE : 0);
    return new Vector3(Math.cos(a) * r, bpY(bp), Math.sin(a) * r);
  };

  const SAMPLES_PER_BP = 8;
  const strandMeshes: Mesh[] = [];
  ([0, 1] as const).forEach((s) => {
    const path: Vector3[] = [];
    for (let k = -SAMPLES_PER_BP / 2; k <= (NUM_BP - 1) * SAMPLES_PER_BP + SAMPLES_PER_BP / 2; k++) {
      path.push(strandPoint(k / SAMPLES_PER_BP, s, HELIX_R));
    }
    const tube = CreateTube(`dnaStrand${s}`, { path, radius: 0.075, tessellation: 24, cap: Mesh.CAP_ALL }, scene);
    tube.parent = helixSpin;
    tube.isPickable = false;
    tube.material = s === 0 ? strand1Mat : strand2Mat;
    strandMeshes.push(tube);
  });

  // phosphate beads (thin instances, coloured per strand)
  const bead = CreateSphere('phosphateBead', { diameter: 0.25, segments: 16 }, scene);
  bead.parent = helixSpin;
  bead.isPickable = false;
  bead.material = beadMat;
  {
    const mats = new Float32Array(NUM_BP * 2 * 16);
    const cols = new Float32Array(NUM_BP * 2 * 4);
    const c1 = lin('#8796b8');
    const c2 = lin('#ae9fcc');
    for (let i = 0; i < NUM_BP; i++) {
      ([0, 1] as const).forEach((s) => {
        const idx = i * 2 + s;
        // phosphates sit between consecutive nucleotides along the backbone
        const p = strandPoint(i, s, HELIX_R);
        Matrix.Translation(p.x, p.y, p.z).copyToArray(mats, idx * 16);
        const c = s === 0 ? c1 : c2;
        cols.set([c.r * 1.1, c.g * 1.1, c.b * 1.1, 1], idx * 4);
      });
    }
    bead.thinInstanceSetBuffer('matrix', mats, 16, true);
    bead.thinInstanceSetBuffer('color', cols, 4, true);
  }

  // base capsules
  const chordLen = Vector3.Distance(strandPoint(0, 0, BASE_R), strandPoint(0, 1, BASE_R));
  const GAP = 0.05;
  const PUR_LEN = chordLen * 0.54 - GAP / 2;
  const PYR_LEN = chordLen * 0.46 - GAP / 2;
  const makeBaseMesh = (name: string, len: number) => {
    const m = CreateCapsule(name, { height: len, radius: BASE_RADIUS, tessellation: 18, subdivisions: 2, capSubdivisions: 6 }, scene);
    m.scaling.set(1, 1, 0.5); // flatten into a slab (local z → helix axis)
    m.bakeCurrentTransformIntoVertices();
    m.parent = helixSpin;
    m.isPickable = false;
    return m;
  };
  const purineMesh = makeBaseMesh('purines', PUR_LEN);
  const pyrimidineMesh = makeBaseMesh('pyrimidines', PYR_LEN);
  purineMesh.material = purineMat;
  pyrimidineMesh.material = pyrimidineMat;
  const hlPur = makeBaseMesh('snpPurine', PUR_LEN);
  const hlPyr = makeBaseMesh('snpPyrimidine', PYR_LEN);
  hlPur.material = hlPurMat;
  hlPyr.material = hlPyrMat;
  const purMats = new Float32Array(NUM_BP * 16);
  const pyrMats = new Float32Array(NUM_BP * 16);
  const purCols = new Float32Array(NUM_BP * 4);
  const pyrCols = new Float32Array(NUM_BP * 4);
  purineMesh.thinInstanceSetBuffer('matrix', purMats, 16, false);
  pyrimidineMesh.thinInstanceSetBuffer('matrix', pyrMats, 16, false);
  purineMesh.thinInstanceSetBuffer('color', purCols, 4, false);
  pyrimidineMesh.thinInstanceSetBuffer('color', pyrCols, 4, false);

  const up = new Vector3(0, 1, 0);
  const tmpM = new Matrix();
  const segMatrix = (from: Vector3, dir: Vector3, len: number, out: Matrix) => {
    const xAxis = Vector3.Cross(dir, up).normalize();
    Matrix.FromXYZAxesToRef(xAxis, dir, up, out);
    out.setTranslation(from.add(dir.scale(len / 2)));
    return out;
  };

  // SNP scanner ring & label (not spinning)
  const snpRing = CreateTorus('snpRing', { diameter: HELIX_R * 2 + 0.6, thickness: 0.03, tessellation: 96 }, scene);
  snpRing.parent = helixRoot;
  snpRing.isPickable = false;
  snpRing.material = snpRingMat;
  const snpLabel = createLabel('snpLabel', scene, 0.5, 1024, helixRoot);
  snpLabel.mesh.renderingGroupId = 1;

  // contact shadow under the helix
  const shadow = CreateDisc('helixShadow', { radius: 1.7, tessellation: 64 }, scene);
  shadow.parent = helixRoot;
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = -HELIX_H / 2 - 0.75;
  shadow.isPickable = false;
  const shadowDT = new DynamicTexture('helixShadowDT', { width: 256, height: 256 }, scene, true);
  shadowDT.hasAlpha = true;
  {
    const ctx = shadowDT.getContext() as unknown as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(15,23,42,0.55)');
    g.addColorStop(0.55, 'rgba(15,23,42,0.18)');
    g.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    shadowDT.update();
  }
  const shadowMat = new StandardMaterial('helixShadowMat', scene);
  shadowMat.disableLighting = true;
  shadowMat.diffuseColor = Color3.Black();
  shadowMat.emissiveColor = Color3.Black();
  shadowMat.opacityTexture = shadowDT;
  shadowMat.backFaceCulling = false;
  shadow.material = shadowMat;

  const layoutBases = () => {
    const seq = state.activeSequence.toUpperCase();
    const mut = Math.max(0, Math.min(NUM_BP - 1, state.mutatedBpIndex));
    const zero = Matrix.Scaling(0, 0, 0);
    for (let i = 0; i < NUM_BP; i++) {
      const b = ((seq[i] as Base) in COMPLEMENT ? (seq[i] as Base) : 'A') as Base;
      const comp = COMPLEMENT[b];
      const purStrand: 0 | 1 = isPurine(b) ? 0 : 1;
      const purBase = isPurine(b) ? b : comp;
      const pyrBase = COMPLEMENT[purBase];
      const pPur = strandPoint(i, purStrand, BASE_R);
      const pPyr = strandPoint(i, purStrand === 0 ? 1 : 0, BASE_R);
      const dirPur = pPyr.subtract(pPur).normalize();
      const dirPyr = dirPur.scale(-1);
      const cPur = lin(DNA_BASE_PALETTE[purBase]);
      const cPyr = lin(DNA_BASE_PALETTE[pyrBase]);
      purCols.set([cPur.r, cPur.g, cPur.b, 1], i * 4);
      pyrCols.set([cPyr.r, cPyr.g, cPyr.b, 1], i * 4);
      if (i === mut) {
        zero.copyToArray(purMats, i * 16);
        zero.copyToArray(pyrMats, i * 16);
        segMatrix(pPur, dirPur, PUR_LEN, tmpM).decomposeToTransformNode(hlPur);
        segMatrix(pPyr, dirPyr, PYR_LEN, tmpM).decomposeToTransformNode(hlPyr);
        hlPurMat.albedoColor = cPur.clone();
        hlPyrMat.albedoColor = cPyr.clone();
        hlPurMat.emissiveColor = Color3.FromHexString(DNA_BASE_PALETTE[purBase]).scale(state.dark ? 0.75 : 0.35);
        hlPyrMat.emissiveColor = Color3.FromHexString(DNA_BASE_PALETTE[pyrBase]).scale(state.dark ? 0.75 : 0.35);
        snpRing.position.y = bpY(i);
        snpLabel.mesh.position.set(HELIX_R + 0.42 + snpLabelHalfW, bpY(i), 0);
        snpText = `SNP · bp ${i + 1} · ${b}${b === 'G' || b === 'C' ? '≡' : '='}${comp}`;
      } else {
        segMatrix(pPur, dirPur, PUR_LEN, tmpM).copyToArray(purMats, i * 16);
        segMatrix(pPyr, dirPyr, PYR_LEN, tmpM).copyToArray(pyrMats, i * 16);
      }
    }
    purineMesh.thinInstanceBufferUpdated('matrix');
    pyrimidineMesh.thinInstanceBufferUpdated('matrix');
    purineMesh.thinInstanceBufferUpdated('color');
    pyrimidineMesh.thinInstanceBufferUpdated('color');
    purineMesh.thinInstanceRefreshBoundingInfo();
    pyrimidineMesh.thinInstanceRefreshBoundingInfo();
    drawSnpLabel();
  };
  const snpLabelHalfW = (0.5 * 1024) / 128 / 2;
  let snpText = '';
  const drawSnpLabel = () => {
    snpLabel.draw(snpText, {
      font: `600 50px ${MONO_FONT}`,
      color: state.dark ? '#d1fae5' : '#065f46',
      bg: state.dark ? 'rgba(6, 18, 24, 0.86)' : 'rgba(255, 255, 255, 0.92)',
      border: state.dark ? 'rgba(52, 211, 153, 0.7)' : 'rgba(5, 150, 105, 0.55)',
      dot: '#10b981',
      alignLeft: true,
    });
  };

  // ======================================================================================
  // KARYOTYPE
  // ======================================================================================
  const karyoRoot = new TransformNode('karyoRoot', scene);

  interface ChromEntry {
    inst: KaryotypeInstance;
    root: TransformNode;
    mesh: Mesh;
    mat: PBRMaterial;
    H: number;
    gridPos: Vector3;
    groupIdx: number;
  }
  interface GroupEntry {
    id: ChromosomeId;
    node: TransformNode;
    plate: Mesh;
    label: LabelHandle;
    count: number;
    trisomic: boolean;
    pos: Vector3;
  }
  let chromEntries: ChromEntry[] = [];
  let groups: GroupEntry[] = [];

  const plateMats: Record<'sel' | 'tri' | 'hover', StandardMaterial> = {
    sel: new StandardMaterial('plateSel', scene),
    tri: new StandardMaterial('plateTri', scene),
    hover: new StandardMaterial('plateHover', scene),
  };
  Object.values(plateMats).forEach((m) => {
    m.disableLighting = true;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
  });
  const paintPlates = () => {
    const d = state.dark;
    const spec: Record<keyof typeof plateMats, [string, string]> = {
      sel: d ? ['rgba(56,189,248,0.12)', 'rgba(56,189,248,0.75)'] : ['rgba(14,165,233,0.10)', 'rgba(2,132,199,0.7)'],
      tri: d ? ['rgba(245,158,11,0.12)', 'rgba(251,191,36,0.7)'] : ['rgba(245,158,11,0.12)', 'rgba(217,119,6,0.7)'],
      hover: d ? ['rgba(148,163,184,0.10)', 'rgba(148,163,184,0.45)'] : ['rgba(100,116,139,0.08)', 'rgba(100,116,139,0.4)'],
    };
    (Object.keys(plateMats) as (keyof typeof plateMats)[]).forEach((k) => {
      plateMats[k].emissiveTexture?.dispose();
      const tex = roundedPlateTexture(`plateTex_${k}`, scene, spec[k][0], spec[k][1]);
      plateMats[k].emissiveTexture = tex;
      plateMats[k].opacityTexture = tex;
    });
  };
  paintPlates();

  const chromTint = (e: ChromEntry, selected: boolean): string => {
    if (e.inst.isTrisomicExtra) return '#f5c46e';
    if (selected && state.viewMode3D !== 'chrom-closeup') return '#8fd3fb';
    if (e.inst.isSexChromosome) return '#f2b6cf';
    return '#bcc6ee';
  };

  const buildKaryotype = () => {
    chromEntries.forEach((e) => {
      e.mesh.dispose();
      e.mat.dispose();
      e.root.dispose();
    });
    groups.forEach((g) => {
      g.label.dt.dispose();
      g.label.mesh.material?.dispose();
      g.label.mesh.dispose();
      g.plate.dispose();
      g.node.dispose();
    });
    chromEntries = [];
    groups = [];

    const byGroup = new Map<ChromosomeId, KaryotypeInstance[]>();
    state.karyotypeInstances.forEach((inst) => {
      const arr = byGroup.get(inst.chromId) ?? [];
      arr.push(inst);
      byGroup.set(inst.chromId, arr);
    });

    GROUP_ORDER.forEach((id, gi) => {
      const insts = byGroup.get(id);
      if (!insts || insts.length === 0) return;
      const col = gi % 8;
      const row = Math.floor(gi / 8);
      const rowY = (1 - row) * ROW_H;
      const gx = (col - 3.5) * CELL_W;
      const cenLine = rowY + 0.3;

      const node = new TransformNode(`group_${id}`, scene);
      node.parent = karyoRoot;
      node.position.set(gx, rowY, 0);

      const plate = CreatePlane(`plate_${id}`, { width: 1.36, height: 2.95 }, scene);
      plate.parent = node;
      plate.position.set(0, 0.08, 0.3);
      plate.isPickable = false;
      plate.setEnabled(false);

      const label = createLabel(`grpLabel_${id}`, scene, 0.42, 256, node);
      label.mesh.position.set(0, -1.34, 0);

      const trisomic = insts.some((i) => i.isTrisomicExtra);
      groups.push({ id, node, plate, label, count: insts.length, trisomic, pos: new Vector3(gx, rowY, 0) });

      insts.forEach((inst, k) => {
        const spec = inst.spec;
        const H = chromHeight(spec);
        const yTop = H / 2;
        const cenY = yTop - H * spec.centromereRatio;
        const root = new TransformNode(`chrom_${inst.instanceIndex}`, scene);
        root.parent = karyoRoot;
        const gridPos = new Vector3(gx + (k - (insts.length - 1) / 2) * COPY_DX, cenLine - cenY, 0);
        root.position.copyFrom(gridPos);
        const mesh = buildChromosomeMesh(`chromMesh_${inst.instanceIndex}`, spec, GROUP_ORDER.indexOf(id) + 1, scene);
        mesh.parent = root;
        mesh.metadata = { chromId: id };
        const mat = new PBRMaterial(`chromMat_${inst.instanceIndex}`, scene);
        mat.metallic = 0;
        mat.roughness = 0.42;
        mat.clearCoat.isEnabled = true;
        mat.clearCoat.intensity = 0.45;
        mat.clearCoat.roughness = 0.18;
        mesh.material = mat;
        chromEntries.push({ inst, root, mesh, mat, H, gridPos, groupIdx: groups.length - 1 });
      });
    });

    // locus marker lives on the karyotype root, re-parented to the active chromosome each sync
    paintKaryotype();
    applyFinish();
  };

  const locusRing = CreateTorus('locusRing', { diameter: 0.46, thickness: 0.035, tessellation: 48 }, scene);
  locusRing.scaling.set(1, 1, 0.62);
  locusRing.isPickable = false;
  locusRing.material = locusRingMat;
  const locusLabelRoot = new TransformNode('locusLabelRoot', scene);
  const locusLabel = createLabel('locusLabel', scene, 0.42, 1024, locusLabelRoot);
  locusLabel.mesh.renderingGroupId = 1;
  const LOCUS_LABEL_HALF = (0.42 * 1024) / 128 / 2;

  let hoveredId: ChromosomeId | null = null;

  const paintKaryotype = () => {
    const d = state.dark;
    groups.forEach((g) => {
      const sel = g.id === state.selectedChromId;
      const text = g.trisomic ? `${g.id} ×${g.count}` : g.id;
      g.label.draw(text, {
        font: `${sel || g.trisomic ? 700 : 600} 76px ${LABEL_FONT}`,
        color: sel ? (d ? '#7dd3fc' : '#0369a1') : g.trisomic ? (d ? '#fcd34d' : '#b45309') : d ? '#cbd5e1' : '#334155',
      });
    });
    chromEntries.forEach((e) => {
      const sel = e.inst.chromId === state.selectedChromId;
      e.mat.albedoColor = lin(chromTint(e, sel));
    });
    drawLocusLabel();
    syncHighlights();
  };

  const syncHighlights = () => {
    const closeup = state.viewMode3D === 'chrom-closeup';
    groups.forEach((g) => {
      const sel = g.id === state.selectedChromId;
      const hov = g.id === hoveredId;
      const mat = sel ? plateMats.sel : g.trisomic ? plateMats.tri : hov ? plateMats.hover : null;
      g.plate.setEnabled(!!mat && !closeup);
      if (mat) g.plate.material = mat;
    });
    chromEntries.forEach((e) => {
      const sel = e.inst.chromId === state.selectedChromId;
      const hov = e.inst.chromId === hoveredId;
      const base = state.finishMode === 'bioluminescent' ? Color3.FromHexString(chromTint(e, sel)).scale(state.dark ? 0.32 : 0.12) : Color3.Black();
      if (sel) base.addInPlace(new Color3(0.02, 0.07, 0.11).scale(state.dark ? 1.4 : 0.6));
      if (hov && !sel) base.addInPlace(new Color3(0.05, 0.05, 0.06));
      e.mat.emissiveColor = base;
    });
  };

  const drawLocusLabel = () => {
    locusLabel.draw(`${state.activeLocus.geneSymbol} · ${state.activeLocus.cytogeneticBand}`, {
      font: `600 54px ${MONO_FONT}`,
      color: state.dark ? '#d1fae5' : '#065f46',
      bg: state.dark ? 'rgba(6, 18, 24, 0.88)' : 'rgba(255, 255, 255, 0.94)',
      border: state.dark ? 'rgba(52, 211, 153, 0.7)' : 'rgba(5, 150, 105, 0.55)',
      dot: '#10b981',
      alignLeft: true,
    });
  };

  // ======================================================================================
  // FINISH & THEME
  // ======================================================================================
  const applyFinish = () => {
    const f = state.finishMode;
    const rough = f === 'cpk-metallic' ? 0.18 : f === 'bioluminescent' ? 0.5 : 0.34;
    const metal = f === 'cpk-metallic' ? 0.4 : 0;
    const coat = f === 'cpk-metallic' ? 1 : f === 'bioluminescent' ? 0.2 : 0.6;
    helixMats.forEach((m) => {
      m.roughness = rough;
      m.metallic = metal;
      m.clearCoat.intensity = coat;
    });
    const glow = f === 'bioluminescent' ? (state.dark ? 0.35 : 0.12) : 0;
    strand1Mat.emissiveColor = Color3.FromHexString('#8796b8').scale(glow);
    strand2Mat.emissiveColor = Color3.FromHexString('#ae9fcc').scale(glow);
    // instance colours drive base albedo; emissive approximated with a uniform lift
    // (bases keep their pure instance colours; bloom on the backbone carries the glow)
    chromEntries.forEach((e) => {
      e.mat.roughness = f === 'cpk-metallic' ? 0.26 : 0.42;
      e.mat.metallic = f === 'cpk-metallic' ? 0.15 : 0;
    });
    pipeline.bloomEnabled = state.dark;
    pipeline.bloomThreshold = f === 'bioluminescent' ? 0.55 : 0.8;
    pipeline.bloomWeight = f === 'bioluminescent' ? 0.45 : 0.25;
    syncHighlights();
  };

  const applyTheme = () => {
    const d = state.dark;
    ip.exposure = d ? 1.25 : 1.12;
    ip.contrast = d ? 1.12 : 1.06;
    ip.vignetteWeight = d ? 0.9 : 0.6;
    hemi.groundColor = d ? new Color3(0.16, 0.18, 0.26) : new Color3(0.42, 0.45, 0.52);
    hemi.intensity = d ? 0.3 : 0.45;
    scene.environmentIntensity = d ? 0.7 : 0.85;
    shadow.visibility = d ? 0.9 : 0.6;
    snpRingMat.emissiveColor = Color3.FromHexString(d ? '#34d399' : '#059669');
    locusRingMat.emissiveColor = Color3.FromHexString(d ? '#34d399' : '#059669');
    paintPlates();
    paintKaryotype();
    drawSnpLabel();
    layoutBases();
    applyFinish();
  };

  // ======================================================================================
  // LAYOUT & CAMERA FRAMING
  // ======================================================================================
  interface Frame {
    target: Vector3;
    alpha: number;
    beta: number;
    w: number;
    h: number;
    radius?: number;
  }
  const KARYO_W = 8 * CELL_W;
  const KARYO_TOP = ROW_H + 1.45;
  const KARYO_BOT = -ROW_H - 1.6;

  const layout = () => {
    const mode = state.viewMode3D;
    const showKaryo = mode !== 'helix-3d';
    const showHelix = mode !== 'karyotype-3d';
    karyoRoot.setEnabled(showKaryo);
    helixRoot.setEnabled(showHelix);
    const closeup = mode === 'chrom-closeup';

    if (mode === 'dual-3d') {
      karyoRoot.position.set(-3.15, 0, 0);
      karyoRoot.scaling.setAll(0.78);
      helixRoot.position.set(4.5, 0.05, 0);
      helixRoot.scaling.setAll(0.8);
    } else if (mode === 'karyotype-3d') {
      karyoRoot.position.set(0, 0, 0);
      karyoRoot.scaling.setAll(1);
    } else if (closeup) {
      karyoRoot.position.set(0, 0, 0);
      karyoRoot.scaling.setAll(1);
      helixRoot.position.set(2.7, 0.05, 0);
      helixRoot.scaling.setAll(0.8);
    } else {
      helixRoot.position.set(0, 0, 0);
      helixRoot.scaling.setAll(1);
    }

    const selected = chromEntries.filter((e) => e.inst.chromId === state.selectedChromId);
    chromEntries.forEach((e) => {
      if (closeup) {
        const k = selected.indexOf(e);
        e.root.setEnabled(k >= 0);
        if (k >= 0) {
          e.root.position.set(-2.4 + (k - (selected.length - 1) / 2) * 1.15, 0, 0);
          e.root.scaling.setAll(2.6);
        }
      } else {
        e.root.setEnabled(true);
        e.root.position.copyFrom(e.gridPos);
        e.root.scaling.setAll(1);
        e.root.rotation.y = 0;
      }
    });
    groups.forEach((g) => {
      g.node.setEnabled(!closeup);
    });

    // locus marker on copy #1 of the selected chromosome
    const host = selected.find((e) => e.inst.copyNumber === 1) ?? selected[0];
    const hasLocus = !!host && state.activeLocus.chromosome === host.inst.chromId && showKaryo;
    locusRing.setEnabled(hasLocus);
    locusLabelRoot.setEnabled(hasLocus);
    if (hasLocus && host) {
      const ly = host.H / 2 - state.activeLocus.normPos * host.H;
      locusRing.parent = host.root;
      locusRing.position.set(0, ly, 0);
      locusLabelRoot.parent = host.root;
      // keep the callout to the right of the chromosome and all of its homologs
      const s = host.root.scaling.x;
      const hostIdx = selected.indexOf(host);
      const rightOfHomologs = closeup
        ? ((selected.length - 1 - hostIdx) * 1.15) / s + 0.3
        : (selected.length - 1 - hostIdx) * COPY_DX + 0.3;
      locusLabelRoot.position.set(rightOfHomologs + LOCUS_LABEL_HALF / s, ly, 0);
      locusLabelRoot.scaling.setAll(1 / s);
    }
    syncHighlights();
  };

  const frameFor = (): Frame => {
    const mode = state.viewMode3D;
    const preset = state.cameraPreset;
    const helixCenter = helixRoot.position.clone();
    const hs = helixRoot.scaling.x;
    if (preset === 'helix-macro' && mode !== 'karyotype-3d') {
      return { target: helixCenter.add(new Vector3(0, HELIX_H * hs * 0.18, 0)), alpha: -Math.PI / 2.35, beta: Math.PI / 2.25, w: 3.2 * hs, h: HELIX_H * hs * 0.6 };
    }
    if (preset === 'groove-top' && mode !== 'karyotype-3d') {
      return { target: helixCenter, alpha: -Math.PI / 2, beta: 0.28, w: 4.2 * hs, h: 4.2 * hs };
    }
    const ks = karyoRoot.scaling.x;
    const kx = karyoRoot.position.x;
    const karyoBox = { x0: kx - (KARYO_W / 2) * ks, x1: kx + (KARYO_W / 2) * ks, y0: KARYO_BOT * ks, y1: KARYO_TOP * ks };
    const helixBox = {
      x0: helixCenter.x - (HELIX_R + 0.45) * hs,
      x1: helixCenter.x + (HELIX_R + 0.45) * hs + 2.1 * hs,
      y0: helixCenter.y - (HELIX_H / 2 + 0.6) * hs,
      y1: helixCenter.y + (HELIX_H / 2 + 0.35) * hs,
    };
    let box = helixBox;
    if (preset === 'karyotype' || mode === 'karyotype-3d') box = karyoBox;
    else if (mode === 'dual-3d') box = { x0: karyoBox.x0, x1: helixBox.x1, y0: Math.min(karyoBox.y0, helixBox.y0), y1: Math.max(karyoBox.y1, helixBox.y1) };
    else if (mode === 'chrom-closeup') {
      const sel = chromEntries.filter((e) => e.inst.chromId === state.selectedChromId);
      const hMax = Math.max(1, ...sel.map((e) => e.H)) * 2.6;
      box = { x0: -2.4 - 1.4, x1: helixBox.x1, y0: Math.min(-hMax / 2, helixBox.y0), y1: Math.max(hMax / 2, helixBox.y1) };
    }
    return {
      target: new Vector3((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 - 0.035 * (box.y1 - box.y0), 0),
      alpha: -Math.PI / 2,
      beta: Math.PI / 2.04,
      w: box.x1 - box.x0,
      h: box.y1 - box.y0,
    };
  };

  const fitRadius = (f: Frame) => {
    const tanHalf = Math.tan(camera.fov / 2);
    const aspect = Math.max(0.3, engine.getAspectRatio(camera));
    const hPad = opts.coarsePointer ? 1.3 : 1.52; // room for the HUD bar + control dock overlays
    const byH = ((f.h * hPad) / 2) / tanHalf;
    const byW = ((f.w * 1.06) / 2) / (tanHalf * aspect);
    return Math.min(camera.upperRadiusLimit ?? 36, Math.max(byH, byW) + 0.6);
  };

  const camAnim = { active: false, alpha: camera.alpha, beta: camera.beta, radius: camera.radius, target: Vector3.Zero() };
  let userMoved = false;
  const reframe = (animate: boolean) => {
    const f = frameFor();
    camAnim.alpha = f.alpha;
    camAnim.beta = f.beta;
    camAnim.radius = fitRadius(f);
    camAnim.target.copyFrom(f.target);
    userMoved = false;
    if (animate) {
      camAnim.active = true;
    } else {
      camera.alpha = f.alpha;
      camera.beta = f.beta;
      camera.radius = camAnim.radius;
      camera.setTarget(f.target.clone());
      camAnim.active = false;
    }
  };

  // ======================================================================================
  // INTERACTION
  // ======================================================================================
  const pickChrom = (): ChromosomeId | null => {
    const pick = scene.pick(scene.pointerX, scene.pointerY, (m: AbstractMesh) => Boolean(m.metadata?.chromId) && m.isEnabled());
    return pick?.hit ? (pick.pickedMesh?.metadata?.chromId as ChromosomeId) : null;
  };
  const pointerObs = scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN || info.type === PointerEventTypes.POINTERWHEEL) {
      camAnim.active = false;
      userMoved = true;
    }
    if (info.type === PointerEventTypes.POINTERTAP) {
      const id = pickChrom();
      if (id) opts.onSelectChromosome(id);
    } else if (info.type === PointerEventTypes.POINTERMOVE && !opts.coarsePointer) {
      if (!karyoRoot.isEnabled()) return;
      const id = pickChrom();
      if (id !== hoveredId) {
        hoveredId = id;
        canvas.style.cursor = id ? 'pointer' : '';
        syncHighlights();
      }
    }
  });

  // ======================================================================================
  // RENDER LOOP
  // ======================================================================================
  scene.registerBeforeRender(() => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    if (camAnim.active) {
      const k = 1 - Math.exp(-6 * dt);
      camera.alpha += (camAnim.alpha - camera.alpha) * k;
      camera.beta += (camAnim.beta - camera.beta) * k;
      camera.radius += (camAnim.radius - camera.radius) * k;
      camera.setTarget(Vector3.Lerp(camera.target, camAnim.target, k));
      if (
        Math.abs(camera.alpha - camAnim.alpha) < 0.002 &&
        Math.abs(camera.beta - camAnim.beta) < 0.002 &&
        Math.abs(camera.radius - camAnim.radius) < 0.01
      ) {
        camAnim.active = false;
      }
    }
    if (state.autoRotate && helixRoot.isEnabled()) {
      helixSpin.rotation.y -= dt * 0.45;
    }
  });

  let running = false;
  const renderFrame = () => scene.render();
  const setRunning = (on: boolean) => {
    if (on && !running) {
      engine.runRenderLoop(renderFrame);
      running = true;
    } else if (!on && running) {
      engine.stopRenderLoop(renderFrame);
      running = false;
    }
  };

  const resizeObs = new ResizeObserver(() => {
    engine.resize();
    if (!userMoved) reframe(false);
  });
  resizeObs.observe(canvas);

  // ---- initial build ---------------------------------------------------------------------
  buildKaryotype();
  layout();
  applyTheme();
  reframe(false);
  setRunning(true);

  // Repaint canvas text once web fonts are ready (Inter / IBM Plex Mono)
  let disposed = false;
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (disposed) return;
      paintKaryotype();
      drawSnpLabel();
    });
  }

  const update = (patch: Partial<DNASceneState>) => {
    const prev = { ...state };
    Object.assign(state, patch);
    const changed = (k: keyof DNASceneState) => k in patch && patch[k] !== prev[k];
    if (changed('karyotypeInstances')) buildKaryotype();
    if (changed('dark')) applyTheme();
    if (changed('finishMode')) applyFinish();
    if (changed('activeSequence') || changed('mutatedBpIndex') || changed('activeLocus')) layoutBases();
    if (changed('selectedChromId') || changed('activeLocus') || changed('viewMode3D')) paintKaryotype();
    if (changed('viewMode3D') || changed('selectedChromId') || changed('activeLocus') || changed('karyotypeInstances')) layout();
    if (changed('viewMode3D') || changed('cameraPreset')) reframe(true);
  };

  return {
    update,
    setInteractive: attachControls,
    setRunning,
    dispose: () => {
      disposed = true;
      setRunning(false);
      resizeObs.disconnect();
      scene.onPointerObservable.remove(pointerObs);
      attachControls(false);
      pipeline.dispose();
      ssao?.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
