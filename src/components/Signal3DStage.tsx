import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector2, Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import { CreateRibbon } from '@babylonjs/core/Meshes/Builders/ribbonBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorusKnot } from '@babylonjs/core/Meshes/Builders/torusKnotBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
// Side-effect registrations required by the deep imports above
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Culling/ray';
import {
  Activity,
  BarChart3,
  Box,
  ChevronDown,
  ChevronUp,
  Hand,
  Layers,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  createGroundGrid,
  createSurfaceMaterial,
  createTextLabel,
  getColormapStops,
  getStageTheme,
  hexToColor3,
  sampleColormap,
  type StageLabel,
} from './three-d/signalStageKit';

export type Scene3DMode = 'all' | 'fourier-3d' | 'waterfall-3d' | 'fft-arena';
export type Finish3DMode = 'studio-chrome' | 'gold-obsidian' | 'bioluminescent';

export interface Signal3DStageProps {
  /** Real-time time-domain waveform samples [-1..1], length ~256-512 */
  liveWaveformRef?: React.MutableRefObject<Float32Array>;
  /** Real-time logarithmic frequency spectrum dB [-95..0], length ~128 */
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  /** Real-time 2D spectrogram waterfall history (cols x rows of dB [-95..0]) */
  specMatrixRef?: React.MutableRefObject<Float32Array[]>;
  /** Static fallback arrays from LabContext when not using live audio refs */
  fallbackWave?: number[];
  fallbackNoisyWave?: number[];
  fallbackFilteredWave?: number[];
  fallbackSpectrumMag?: number[];
  fallbackSpectrumFreqs?: number[];
  /** Current signal metadata */
  frequency?: number;
  waveType?: string;
  amplitude?: number;
  isPlaying?: boolean;
  isMicActive?: boolean;
  lang?: 'en' | 'fa';
  darkMode?: boolean;
  /** Optional callbacks to control audio directly from the 3D viewport */
  onTogglePlay?: () => void;
  onToggleMic?: () => void;
  onSelectPreset?: (preset: string) => void;
  onPlayFrequencyTone?: (freqHz: number, durationMs?: number) => void;
  /** Height class for the 3D container */
  heightClass?: string;
}

export interface HoveredBarInfo {
  index: number;
  freq: number;
  db: number;
}

const MIN_LOG_FREQ = 10;
const MAX_LOG_FREQ = 20000;

function binToFreqLog(binIdx: number, totalBins: number): number {
  const norm = Math.max(0, Math.min(1, binIdx / Math.max(1, totalBins - 1)));
  return MIN_LOG_FREQ * Math.pow(MAX_LOG_FREQ / MIN_LOG_FREQ, norm);
}

function formatHz(f: number): string {
  if (f >= 1000) {
    const k = f / 1000;
    return Number.isInteger(k) ? `${k} kHz` : `${k.toFixed(k >= 10 ? 0 : 1)} kHz`;
  }
  return `${Math.round(f)} Hz`;
}

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const mq = (q: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;

/** Camera framing per scene mode: bounding-sphere centre + radius in world units. */
const MODE_BOUNDS: Record<Scene3DMode, { center: Vector3; radius: number }> = {
  all: { center: new Vector3(0, 0.1, -0.5), radius: 7.1 },
  'fourier-3d': { center: new Vector3(0.3, -0.1, -0.7), radius: 7.6 },
  'waterfall-3d': { center: new Vector3(0, -0.4, 0.3), radius: 6.8 },
  'fft-arena': { center: new Vector3(0, -0.2, 0), radius: 4.9 },
};

const CAMERA_PRESETS = {
  iso: { alpha: -Math.PI / 2 + 0.62, beta: 1.08, zoom: 1.0 },
  time: { alpha: -Math.PI / 2, beta: 1.42, zoom: 0.92 },
  freq: { alpha: 0, beta: 1.36, zoom: 0.92 },
  top: { alpha: -Math.PI / 2, beta: 0.06, zoom: 0.95 },
} as const;

type CameraPreset = keyof typeof CAMERA_PRESETS;

export const Signal3DStage: React.FC<Signal3DStageProps> = ({
  liveWaveformRef,
  liveSpectrumDbRef,
  specMatrixRef,
  fallbackWave,
  fallbackFilteredWave,
  fallbackSpectrumMag,
  fallbackSpectrumFreqs,
  frequency = 440,
  waveType = 'sine',
  isPlaying = false,
  isMicActive = false,
  lang = 'en',
  darkMode,
  onTogglePlay,
  onToggleMic,
  onSelectPreset,
  onPlayFrequencyTone,
  heightClass = 'h-[480px] sm:h-[540px]',
}) => {
  const isFa = lang === 'fa';
  const isDark = useMemo(
    () =>
      darkMode ??
      (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')),
    [darkMode]
  );
  const reducedMotion = useMemo(() => mq('(prefers-reduced-motion: reduce)'), []);
  const [isCoarse, setIsCoarse] = useState(() => mq('(pointer: coarse)'));

  const [sceneMode, setSceneMode] = useState<Scene3DMode>('all');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [finishMode, setFinishMode] = useState<Finish3DMode>('studio-chrome');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(() => !reducedMotion);
  const [layerSpread, setLayerSpread] = useState(1.0);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<HoveredBarInfo | null>(null);
  const [interactive, setInteractive] = useState(() => !mq('(pointer: coarse)'));
  const [webglFailed, setWebglFailed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia('(pointer: coarse)');
    const onChange = () => {
      setIsCoarse(m.matches);
      if (!m.matches) setInteractive(true);
    };
    m.addEventListener?.('change', onChange);
    return () => m.removeEventListener?.('change', onChange);
  }, []);

  // Latest reactive props stored in ref for zero-recreation render loop
  const stateRef = useRef({
    sceneMode,
    cameraPreset,
    finishMode,
    wireframe,
    autoRotate,
    layerSpread,
    frequency,
    waveType,
    isPlaying,
    fallbackWave,
    fallbackFilteredWave,
    fallbackSpectrumMag,
    fallbackSpectrumFreqs,
    onPlayFrequencyTone,
    interactive,
  });

  useEffect(() => {
    stateRef.current = {
      sceneMode,
      cameraPreset,
      finishMode,
      wireframe,
      autoRotate,
      layerSpread,
      frequency,
      waveType,
      isPlaying,
      fallbackWave,
      fallbackFilteredWave,
      fallbackSpectrumMag,
      fallbackSpectrumFreqs,
      onPlayFrequencyTone,
      interactive,
    };
  }, [
    sceneMode,
    cameraPreset,
    finishMode,
    wireframe,
    autoRotate,
    layerSpread,
    frequency,
    waveType,
    isPlaying,
    fallbackWave,
    fallbackFilteredWave,
    fallbackSpectrumMag,
    fallbackSpectrumFreqs,
    onPlayFrequencyTone,
    interactive,
  ]);

  // Camera framing request (consumed by the render loop, which knows the aspect ratio)
  const frameReqRef = useRef({ pending: true, instant: true });
  // Camera pose persisted across scene rebuilds (theme / language switches)
  const camPoseRef = useRef<{ alpha: number; beta: number; radius: number; target: Vector3 } | null>(
    null
  );
  const cameraRef = useRef<ArcRotateCamera | null>(null);

  const framedOnceRef = useRef(false);
  useEffect(() => {
    if (!framedOnceRef.current) {
      framedOnceRef.current = true;
      return;
    }
    frameReqRef.current = { pending: true, instant: false };
  }, [cameraPreset, sceneMode]);

  // Attach / release camera controls (touch devices opt in with a tap)
  useEffect(() => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!cam || !canvas) return;
    if (interactive) {
      cam.attachControl(true);
      canvas.style.touchAction = 'none';
    } else {
      cam.detachControl();
      canvas.style.touchAction = 'pan-y';
    }
  }, [interactive]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // =========================================================================
  // Babylon.js engine, scene, geometry & render-loop lifecycle
  // =========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine;
    try {
      engine = new Engine(
        canvas,
        true,
        {
          preserveDrawingBuffer: false,
          stencil: false,
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          doNotHandleTouchAction: true,
        },
        false
      );
    } catch {
      setWebglFailed(true);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    engine.setHardwareScalingLevel(1 / dpr);

    const theme = getStageTheme(isDark);
    const T = (en: string, fa: string) => (lang === 'fa' ? fa : en);

    const scene = new Scene(engine);
    scene.skipPointerMovePicking = true;
    const bgSrgb = hexToColor3(theme.background);
    const bgLinear = bgSrgb.toLinearSpace();
    scene.clearColor = new Color4(bgLinear.r, bgLinear.g, bgLinear.b, 1);
    scene.ambientColor = new Color3(0, 0, 0);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = bgLinear;
    scene.fogDensity = isDark ? 0.022 : 0.016;

    // ---------------------------------------------------------------- camera
    const camera = new ArcRotateCamera(
      'signalCam',
      CAMERA_PRESETS.iso.alpha,
      CAMERA_PRESETS.iso.beta,
      18,
      MODE_BOUNDS.all.center.clone(),
      scene
    );
    camera.fov = 0.72;
    camera.minZ = 0.1;
    camera.maxZ = 200;
    camera.inertia = 0.88;
    camera.wheelDeltaPercentage = 0.012;
    camera.pinchDeltaPercentage = 0.004;
    camera.panningSensibility = 900;
    camera.angularSensibilityX = 1400;
    camera.angularSensibilityY = 1400;
    camera.lowerBetaLimit = 0.04;
    camera.upperBetaLimit = Math.PI / 2 - 0.03;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 40;
    camera.panningDistanceLimit = 8;
    const savedPose = camPoseRef.current;
    if (savedPose) {
      camera.alpha = savedPose.alpha;
      camera.beta = savedPose.beta;
      camera.radius = savedPose.radius;
      camera.target.copyFrom(savedPose.target);
      frameReqRef.current.pending = false;
    }
    cameraRef.current = camera;
    if (stateRef.current.interactive) {
      camera.attachControl(true);
      canvas.style.touchAction = 'none';
    } else {
      canvas.style.touchAction = 'pan-y';
    }

    // -------------------------------------------------------- post pipeline
    const webgl2 = engine.webGLVersion >= 2;
    const hdr = Boolean(engine.getCaps().textureHalfFloatRender);
    const pipeline = new DefaultRenderingPipeline('signalStagePipeline', hdr, scene, [camera]);
    pipeline.samples = webgl2 ? 4 : 1;
    pipeline.fxaaEnabled = !webgl2;
    pipeline.imageProcessingEnabled = true;
    const ip = pipeline.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = isDark
      ? ImageProcessingConfiguration.TONEMAPPING_ACES
      : ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    ip.exposure = isDark ? 1.05 : 1.1;
    ip.contrast = isDark ? 1.12 : 1.04;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = isDark ? 1.5 : 1.2;
    ip.vignetteStretch = 0.6;
    ip.vignetteCameraFov = camera.fov;
    ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    const vig = hexToColor3(theme.vignette).toLinearSpace();
    ip.vignetteColor = new Color4(vig.r, vig.g, vig.b, 0);
    if (isDark) {
      ip.vignetteColor = new Color4(0, 0, 0, 0);
    } else {
      ip.vignetteEnabled = false;
    }
    pipeline.bloomEnabled = isDark;
    pipeline.bloomThreshold = 0.78;
    pipeline.bloomWeight = 0.32;
    pipeline.bloomKernel = 48;
    pipeline.bloomScale = 0.5;

    // -------------------------------------------------------------- lights
    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, -0.2), scene);
    hemi.intensity = isDark ? 0.55 : 0.85;
    hemi.diffuse = isDark ? new Color3(0.78, 0.88, 1.0) : new Color3(1, 1, 1);
    hemi.groundColor = isDark ? new Color3(0.04, 0.06, 0.12) : new Color3(0.55, 0.6, 0.7);
    hemi.specular = new Color3(0, 0, 0);

    const keyDir = new Vector3(-0.45, -1, 0.55).normalize();
    const key = new DirectionalLight('key', keyDir, scene);
    key.intensity = isDark ? 0.95 : 0.85;
    key.diffuse = new Color3(1, 0.98, 0.95);
    key.specular = new Color3(0.6, 0.65, 0.7);

    const rim = new DirectionalLight('rim', new Vector3(0.35, -0.4, -1).normalize(), scene);
    rim.intensity = isDark ? 0.55 : 0.3;
    rim.diffuse = hexToColor3(theme.trace);
    rim.specular = new Color3(0.2, 0.3, 0.4);

    const FLOOR_Y = -1.72;
    createGroundGrid(scene, theme, FLOOR_Y - 0.02);

    const labels: StageLabel[] = [];
    const addLabel = (...args: Parameters<typeof createTextLabel>) => {
      const l = createTextLabel(...args);
      labels.push(l);
      return l;
    };

    // Shared material factory (tuned StandardMaterial: soft spec, no blobs)
    const makeMat = (name: string, hex: string, emissive: number, spec = 0.35) => {
      const m = new StandardMaterial(name, scene);
      const c = hexToColor3(hex);
      m.diffuseColor = c;
      m.emissiveColor = c.scale(emissive);
      m.specularColor = new Color3(spec, spec, spec);
      m.specularPower = 72;
      return m;
    };

    // =========================================================================
    // 1. TIME-DOMAIN SIGNAL TUBE + FADE CURTAIN + PHASOR GIMBAL
    // =========================================================================
    const signalRoot = new TransformNode('signalRoot', scene);
    const NUM_WAVE_PTS = 220;
    const SPAN_X = 9.2;
    const START_X = -SPAN_X * 0.5;
    const CURTAIN_Y = -1.6;

    const wavePath: Vector3[] = [];
    const curtainTopPath: Vector3[] = [];
    const curtainBotPath: Vector3[] = [];
    for (let i = 0; i < NUM_WAVE_PTS; i++) {
      const x = START_X + (i / (NUM_WAVE_PTS - 1)) * SPAN_X;
      wavePath.push(new Vector3(x, 0, 0));
      curtainTopPath.push(new Vector3(x, 0, 0));
      curtainBotPath.push(new Vector3(x, CURTAIN_Y, 0));
    }

    const TRACE_R = 0.042;
    let signalTube = CreateTube(
      'signalTube',
      { path: wavePath, radius: TRACE_R, tessellation: 14, cap: Mesh.CAP_ALL, updatable: true },
      scene
    );
    signalTube.parent = signalRoot;
    signalTube.isPickable = false;
    const signalTubeMat = makeMat('signalTubeMat', theme.trace, theme.glow, 0.5);
    signalTube.material = signalTubeMat;

    // Translucent amplitude curtain fading towards the floor (vertex alpha)
    let signalCurtain = CreateRibbon(
      'signalCurtain',
      { pathArray: [curtainTopPath, curtainBotPath], updatable: true, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    signalCurtain.parent = signalRoot;
    signalCurtain.isPickable = false;
    {
      const nVerts = signalCurtain.getTotalVertices();
      const cols = new Float32Array(nVerts * 4);
      const half = nVerts / 2; // DOUBLESIDE duplicates the vertex set
      for (let v = 0; v < nVerts; v++) {
        const local = v % half;
        const top = local < NUM_WAVE_PTS;
        cols[v * 4] = 1;
        cols[v * 4 + 1] = 1;
        cols[v * 4 + 2] = 1;
        cols[v * 4 + 3] = top ? (isDark ? 0.26 : 0.2) : 0;
      }
      signalCurtain.setVerticesData(VertexBuffer.ColorKind, cols, false);
      signalCurtain.hasVertexAlpha = true;
    }
    const curtainMat = new StandardMaterial('curtainMat', scene);
    curtainMat.disableLighting = true;
    curtainMat.emissiveColor = hexToColor3(theme.trace).scale(isDark ? 0.75 : 1);
    curtainMat.backFaceCulling = false;
    curtainMat.alpha = 0.999; // force alpha-blend pass
    curtainMat.disableDepthWrite = true;
    curtainMat.fogEnabled = true;
    signalCurtain.material = curtainMat;

    // Baseline (zero-amplitude) reference line
    const baseline = CreateLines(
      'signalBaseline',
      { points: [new Vector3(START_X, 0, 0), new Vector3(START_X + SPAN_X, 0, 0)] },
      scene
    );
    baseline.parent = signalRoot;
    baseline.color = hexToColor3(theme.axis);
    baseline.alpha = 0.55;
    baseline.isPickable = false;

    // Phasor gimbal at x = START_X
    const gimbalRoot = new TransformNode('gimbalRoot', scene);
    gimbalRoot.parent = signalRoot;
    gimbalRoot.position.set(START_X, 0, 0);
    const ringMat = makeMat('ringMat', theme.axis, isDark ? 0.25 : 0.05, 0.4);
    const outerRing = CreateTorus('outerRing', { diameter: 2.3, thickness: 0.022, tessellation: 96 }, scene);
    outerRing.parent = gimbalRoot;
    outerRing.rotation.z = Math.PI / 2;
    outerRing.material = ringMat;
    outerRing.isPickable = false;
    const innerRing = CreateTorus('innerRing', { diameter: 1.4, thickness: 0.016, tessellation: 80 }, scene);
    innerRing.parent = gimbalRoot;
    innerRing.rotation.z = Math.PI / 2;
    innerRing.material = ringMat;
    innerRing.isPickable = false;

    const phasorMat = makeMat('phasorMat', theme.harmonics[1], isDark ? 0.9 : 0.2, 0.4);
    let phasorArm = CreateTube(
      'phasorArm',
      { path: [new Vector3(START_X, 0, 0), new Vector3(START_X, 0.8, 0)], radius: 0.022, tessellation: 10, updatable: true },
      scene
    );
    phasorArm.parent = signalRoot;
    phasorArm.material = phasorMat;
    phasorArm.isPickable = false;
    const phasorTip = CreateSphere('phasorTip', { diameter: 0.15, segments: 20 }, scene);
    phasorTip.parent = signalRoot;
    phasorTip.isPickable = false;
    phasorTip.material = makeMat('tipMat', theme.harmonics[1], isDark ? 1.3 : 0.35, 0.6);

    addLabel(scene, 'lblSignal', T('x(t) · time domain', 'x(t) · حوزه زمان'), signalRoot, new Vector3(START_X + SPAN_X + 0.15, 1.35, 0), {
      color: theme.labelText,
      height: 0.4,
      align: 'left',
    });

    // Fourier decomposition tubes (visible in 'fourier-3d')
    const harmonicsRoot = new TransformNode('harmonicsRoot', scene);
    harmonicsRoot.parent = signalRoot;
    const harmLabels = [
      T('f₀ fundamental', 'f₀ بنیادی'),
      T('2f₀ harmonic', '2f₀ هارمونیک'),
      T('3f₀ harmonic', '3f₀ هارمونیک'),
      T('5f₀ harmonic', '5f₀ هارمونیک'),
    ];
    const harmPaths: Vector3[][] = [];
    const harmTubes: Mesh[] = [];
    const harmLabelMeshes: Mesh[] = [];
    for (let h = 0; h < 4; h++) {
      const hPath: Vector3[] = [];
      const zOff = -1.8 - (h + 1) * 1.15;
      for (let i = 0; i < NUM_WAVE_PTS; i++) {
        hPath.push(new Vector3(START_X + (i / (NUM_WAVE_PTS - 1)) * SPAN_X, 0, zOff));
      }
      harmPaths.push(hPath);
      const hTube = CreateTube(`harmTube_${h}`, { path: hPath, radius: 0.028, tessellation: 10, updatable: true }, scene);
      hTube.parent = harmonicsRoot;
      hTube.isPickable = false;
      hTube.material = makeMat(`harmMat_${h}`, theme.harmonics[h], isDark ? 0.85 : 0.15, 0.45);
      harmTubes.push(hTube);
      const lbl = addLabel(scene, `harmLbl_${h}`, harmLabels[h], harmonicsRoot, new Vector3(START_X + SPAN_X + 0.2, 0, zOff), {
        color: theme.labelText,
        swatch: theme.harmonics[h],
        height: 0.38,
        align: 'left',
      });
      harmLabelMeshes.push(lbl.mesh);
    }

    // =========================================================================
    // 2. 64-BIN FFT BARS (thin instances: 2 draw calls instead of ~200)
    // =========================================================================
    const fftRoot = new TransformNode('fftRoot', scene);
    const NUM_BARS = 64;
    const smoothHeights = new Float32Array(NUM_BARS).fill(0.18);
    const peakHolds = new Float32Array(NUM_BARS).fill(0.26);

    const barMesh = CreateBox('fftBars', { size: 1 }, scene);
    barMesh.parent = fftRoot;
    const barMat = new StandardMaterial('fftBarMat', scene);
    barMat.diffuseColor = new Color3(1, 1, 1);
    barMat.emissiveColor = new Color3(isDark ? 0.32 : 0.12, isDark ? 0.32 : 0.12, isDark ? 0.32 : 0.12);
    barMat.specularColor = new Color3(0.25, 0.25, 0.25);
    barMat.specularPower = 64;
    barMesh.material = barMat;
    const barMatrices = new Float32Array(NUM_BARS * 16);
    const barColors = new Float32Array(NUM_BARS * 4).fill(1);
    barMesh.thinInstanceSetBuffer('matrix', barMatrices, 16, false);
    barMesh.thinInstanceSetBuffer('color', barColors, 4, false);
    barMesh.thinInstanceEnablePicking = true;
    barMesh.alwaysSelectAsActiveMesh = true;

    const peakMesh = CreateBox('fftPeaks', { size: 1 }, scene);
    peakMesh.parent = fftRoot;
    peakMesh.isPickable = false;
    const peakMat = makeMat('fftPeakMat', theme.peakCap, isDark ? 0.7 : 0.0, 0.2);
    peakMesh.material = peakMat;
    const peakMatrices = new Float32Array(NUM_BARS * 16);
    peakMesh.thinInstanceSetBuffer('matrix', peakMatrices, 16, false);
    peakMesh.alwaysSelectAsActiveMesh = true;

    const railMat = makeMat('railMat', isDark ? '#0f1b30' : '#cbd5e1', 0.0, 0.25);
    const rail = CreateBox('fftRail', { width: SPAN_X + 0.5, height: 0.04, depth: 0.42 }, scene);
    rail.parent = fftRoot;
    rail.position.set(0, FLOOR_Y + 0.02, 0);
    rail.material = railMat;
    rail.isPickable = false;

    const arenaRing = CreateTorus('arenaRail', { diameter: 6.9, thickness: 0.05, tessellation: 128 }, scene);
    arenaRing.parent = fftRoot;
    arenaRing.position.y = FLOOR_Y + 0.02;
    arenaRing.material = railMat;
    arenaRing.isPickable = false;

    const fftTitle = addLabel(scene, 'lblFft', T('|X(f)| · FFT magnitude', '|X(f)| · اندازه FFT'), fftRoot, new Vector3(START_X + SPAN_X + 0.2, FLOOR_Y + 1.05, 0), {
      color: theme.labelText,
      height: 0.4,
      align: 'left',
    });

    // Frequency tick labels (rebuilt when the frequency axis changes)
    const fftLabelsGroup = new TransformNode('fftLabelsGroup', scene);
    fftLabelsGroup.parent = fftRoot;
    let tickLabels: StageLabel[] = [];
    let tickKey = '';
    const barX = (i: number) => START_X + (i / (NUM_BARS - 1)) * SPAN_X;
    const rebuildTicks = (freqs: number[] | undefined, useLive: boolean) => {
      const fmax = !useLive && freqs && freqs.length > 1 ? freqs[freqs.length - 1] : 0;
      const key = useLive || !fmax ? 'log' : `lin:${Math.round(fmax)}`;
      if (key === tickKey) return;
      tickKey = key;
      tickLabels.forEach((l) => {
        l.mesh.material?.dispose(true, true);
        l.mesh.dispose();
        const idx = labels.indexOf(l);
        if (idx >= 0) labels.splice(idx, 1);
      });
      tickLabels = [];
      const ticks: { x: number; text: string }[] = [];
      if (key === 'log') {
        [20, 100, 1000, 10000].forEach((f) => {
          const u = Math.log(f / MIN_LOG_FREQ) / Math.log(MAX_LOG_FREQ / MIN_LOG_FREQ);
          ticks.push({ x: START_X + u * SPAN_X, text: formatHz(f) });
        });
      } else {
        const step = niceStep(fmax, 4);
        for (let f = 0; f <= fmax + 1e-6; f += step) {
          ticks.push({ x: START_X + (f / fmax) * SPAN_X, text: formatHz(f) });
        }
      }
      ticks.forEach((tk, idx) => {
        const l = addLabel(scene, `fftTick_${idx}`, tk.text, fftLabelsGroup, new Vector3(tk.x, FLOOR_Y + 0.02, -0.5), {
          color: theme.labelMuted,
          height: 0.32,
          mono: true,
          weight: 500,
        });
        tickLabels.push(l);
      });
    };

    // =========================================================================
    // 3. SPECTROGRAM TERRAIN (shader-coloured height field) + LIVE CREST
    // =========================================================================
    const waterfallRoot = new TransformNode('waterfallRoot', scene);
    const SEG_X = 80; // time columns
    const SEG_Z = 48; // frequency rows
    const WF_WIDTH = 9.2;
    const WF_DEPTH = 4.6;
    const WF_MAX_ELEV = 2.15;

    const wfPathArray: Vector3[][] = [];
    for (let iz = 0; iz <= SEG_Z; iz++) {
      const rowPath: Vector3[] = [];
      const z = (iz / SEG_Z - 0.5) * WF_DEPTH;
      for (let ix = 0; ix <= SEG_X; ix++) {
        rowPath.push(new Vector3((ix / SEG_X - 0.5) * WF_WIDTH, 0, z));
      }
      wfPathArray.push(rowPath);
    }
    let waterfallRibbon = CreateRibbon('waterfallRibbon', { pathArray: wfPathArray, updatable: true }, scene);
    waterfallRibbon.parent = waterfallRoot;
    waterfallRibbon.isPickable = false;
    waterfallRibbon.alwaysSelectAsActiveMesh = true;

    const surfMat = createSurfaceMaterial(scene);
    surfMat.setFloat('maxElev', WF_MAX_ELEV);
    surfMat.setVector3('lightDir', keyDir);
    surfMat.setColor3('gridColor', isDark ? new Color3(0.85, 0.95, 1) : new Color3(0.06, 0.1, 0.2));
    surfMat.setVector2('gridCells', new Vector2(SEG_X / 4, SEG_Z / 4));
    // gridAmount, contourAmount, glowAmount, specAmount
    const surfLook = new Vector4(0.08, isDark ? 0.22 : 0.18, isDark ? 0.22 : 0, isDark ? 0.14 : 0.1);
    waterfallRibbon.material = surfMat;
    let lastFinish: Finish3DMode | null = null;
    let stops = getColormapStops(isDark, 'studio-chrome');
    const applyFinish = (f: Finish3DMode) => {
      stops = getColormapStops(isDark, f);
      surfMat.setArray3('stops', Array.from(stops));
      lastFinish = f;
    };
    applyFinish(stateRef.current.finishMode);

    // Frame around the terrain base
    const hw = WF_WIDTH / 2;
    const hd = WF_DEPTH / 2;
    const wfFrame = CreateLines(
      'wfFrame',
      {
        points: [
          new Vector3(-hw, 0, -hd),
          new Vector3(hw, 0, -hd),
          new Vector3(hw, 0, hd),
          new Vector3(-hw, 0, hd),
          new Vector3(-hw, 0, -hd),
        ],
      },
      scene
    );
    wfFrame.parent = waterfallRoot;
    wfFrame.color = hexToColor3(theme.axis);
    wfFrame.alpha = 0.7;
    wfFrame.isPickable = false;

    addLabel(scene, 'lblWfTime', T('time →', 'زمان ←'), waterfallRoot, new Vector3(0, -0.02, -hd - 0.38), {
      color: theme.labelMuted,
      height: 0.32,
      mono: true,
      weight: 500,
    });
    addLabel(scene, 'lblWfFreq', T('frequency (log) →', 'فرکانس (لگاریتمی)'), waterfallRoot, new Vector3(-hw - 0.25, -0.02, 0), {
      color: theme.labelMuted,
      height: 0.32,
      mono: true,
      weight: 500,
      align: 'right',
    });
    addLabel(scene, 'lblWf', T('spectrogram · |STFT|', 'طیف‌نگار · |STFT|'), waterfallRoot, new Vector3(hw + 0.25, 0.4, hd), {
      color: theme.labelText,
      height: 0.4,
      align: 'left',
    });

    const crestPath: Vector3[] = [];
    for (let iz = 0; iz <= SEG_Z; iz++) {
      crestPath.push(new Vector3(WF_WIDTH * 0.5, 0.04, (iz / SEG_Z - 0.5) * WF_DEPTH));
    }
    let frontCrestTube = CreateTube('frontCrestTube', { path: crestPath, radius: 0.016, tessellation: 10, updatable: true }, scene);
    frontCrestTube.parent = waterfallRoot;
    frontCrestTube.isPickable = false;
    frontCrestTube.material = makeMat('crestMat', theme.trace, isDark ? 0.55 : 0.1, 0.3);

    const localWfHistory: Float32Array[] = Array.from({ length: SEG_X + 1 }, () => new Float32Array(SEG_Z + 1).fill(-92));
    let wfAccum = 0;
    let wfPrefilled = false;

    // =========================================================================
    // 4. FFT ARENA CORE (audio-reactive torus knot)
    // =========================================================================
    const arenaCoreRoot = new TransformNode('arenaCoreRoot', scene);
    arenaCoreRoot.position.set(0, 0.55, 0);
    const torusKnot = CreateTorusKnot(
      'arenaTorusKnot',
      { radius: 0.62, tube: 0.13, radialSegments: 192, tubularSegments: 24, p: 2, q: 3 },
      scene
    );
    torusKnot.parent = arenaCoreRoot;
    torusKnot.isPickable = false;
    const knotMat = makeMat('knotMat', theme.trace, isDark ? 0.45 : 0.08, 0.6);
    knotMat.specularPower = 96;
    torusKnot.material = knotMat;
    const arenaGyroRing = CreateTorus('arenaGyroRing', { diameter: 2.4, thickness: 0.018, tessellation: 96 }, scene);
    arenaGyroRing.parent = arenaCoreRoot;
    arenaGyroRing.isPickable = false;
    arenaGyroRing.material = ringMat;

    // Re-rasterise labels once web fonts (Inter / IBM Plex Mono / Vazirmatn) are ready
    let disposed = false;
    document.fonts?.ready.then(() => {
      if (!disposed) labels.forEach((l) => l.redraw());
    });

    // =========================================================================
    // POINTER: hover / click picking on FFT bars, interaction tracking
    // =========================================================================
    let hoveredIdx: number | null = null;
    let lastInteraction = -1e9;
    const pickBar = () => {
      if (!fftRoot.isEnabled()) return null;
      const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m === barMesh);
      return pick?.hit && pick.thinInstanceIndex >= 0 ? pick.thinInstanceIndex : null;
    };
    const describeBar = (idx: number): HoveredBarInfo => {
      const st = stateRef.current;
      const specDb = liveSpectrumDbRef?.current;
      if (specDb && specDb.length > 0) {
        const srcIdx = Math.min(specDb.length - 1, Math.floor((idx / (NUM_BARS - 1)) * (specDb.length - 1)));
        return { index: idx, freq: binToFreqLog(idx, NUM_BARS), db: specDb[srcIdx] ?? -80 };
      }
      const mags = st.fallbackSpectrumMag;
      const freqs = st.fallbackSpectrumFreqs;
      if (mags && mags.length > 0) {
        const srcIdx = Math.min(mags.length - 1, Math.floor((idx / (NUM_BARS - 1)) * (mags.length - 1)));
        let maxMag = 1e-12;
        for (let k = 0; k < mags.length; k++) if (mags[k] > maxMag) maxMag = mags[k];
        return {
          index: idx,
          freq: freqs?.[srcIdx] ?? binToFreqLog(idx, NUM_BARS),
          db: 20 * Math.log10(Math.max(1e-6, (mags[srcIdx] ?? 0) / maxMag)),
        };
      }
      return { index: idx, freq: binToFreqLog(idx, NUM_BARS), db: -80 };
    };
    scene.onPointerObservable.add((pointerInfo) => {
      const type = pointerInfo.type;
      if (type === PointerEventTypes.POINTERDOWN || type === PointerEventTypes.POINTERWHEEL) {
        lastInteraction = performance.now();
        if (stateRef.current.interactive) frameReqRef.current.pending = false;
        camAnimActive = false;
      }
      if (type === PointerEventTypes.POINTERMOVE) {
        const idx = pickBar();
        if (idx !== hoveredIdx) {
          hoveredIdx = idx;
          setHoveredBar(idx === null ? null : describeBar(idx));
        }
      } else if (type === PointerEventTypes.POINTERTAP) {
        const idx = pickBar();
        if (idx !== null) {
          const info = describeBar(idx);
          stateRef.current.onPlayFrequencyTone?.(info.freq, 550);
        }
      }
    });

    // =========================================================================
    // RENDER-LOOP UPDATE
    // =========================================================================
    let phaseTime = 0;
    let wfTime = 0;
    let camAnimActive = false;
    const camGoal = { alpha: 0, beta: 0, radius: 0, target: new Vector3() };
    const tmpScale = new Vector3();
    const tmpPos = new Vector3();
    const tmpMat = new Matrix();
    const identityQ = Quaternion.Identity();
    const arenaQuats = Array.from({ length: NUM_BARS }, (_, i) =>
      Quaternion.RotationAxis(Vector3.Up(), -(i / NUM_BARS) * Math.PI * 2)
    );
    const rgb = new Float32Array(3);

    const fitRadius = (boundR: number) => {
      const aspect = engine.getAspectRatio(camera) || 1.6;
      const vHalf = camera.fov / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * aspect);
      // keep content clear of the HUD bars (≈ 64px top, ≈ 76px bottom)
      const cssH = canvas.clientHeight || 480;
      const usable = Math.max(0.55, 1 - 150 / cssH);
      const vHalfUsable = Math.atan(Math.tan(vHalf) * usable);
      return (boundR / Math.sin(Math.min(vHalfUsable, hHalf * 0.96))) * 0.74;
    };

    const sampleArr = (arr: ArrayLike<number>, pos: number) => {
      const i0 = Math.max(0, Math.min(arr.length - 1, Math.floor(pos)));
      const i1 = Math.min(arr.length - 1, i0 + 1);
      const f = pos - Math.floor(pos);
      return (arr[i0] ?? 0) * (1 - f) + (arr[i1] ?? 0) * f;
    };

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
      const st = stateRef.current;
      const now = performance.now();

      phaseTime += dt * (st.isPlaying ? 3.2 : 1.15);
      wfTime += dt * (st.isPlaying ? 2.5 : 0.9);

      // ---- camera framing / preset animation / gentle auto-orbit
      const bounds = MODE_BOUNDS[st.sceneMode];
      const preset = CAMERA_PRESETS[st.cameraPreset];
      const fitR = fitRadius(bounds.radius);
      camera.lowerRadiusLimit = fitR * 0.35;
      camera.upperRadiusLimit = fitR * 2.4;
      if (frameReqRef.current.pending) {
        camGoal.alpha = preset.alpha;
        camGoal.beta = preset.beta;
        camGoal.radius = fitR * preset.zoom;
        camGoal.target.copyFrom(bounds.center);
        // take the shortest way round in alpha
        const twoPi = Math.PI * 2;
        let da = (camGoal.alpha - camera.alpha) % twoPi;
        if (da > Math.PI) da -= twoPi;
        if (da < -Math.PI) da += twoPi;
        camGoal.alpha = camera.alpha + da;
        if (frameReqRef.current.instant) {
          camera.alpha = camGoal.alpha;
          camera.beta = camGoal.beta;
          camera.radius = camGoal.radius;
          camera.target.copyFrom(camGoal.target);
        } else {
          camAnimActive = true;
        }
        frameReqRef.current.pending = false;
      }
      if (camAnimActive) {
        const damp = 1 - Math.exp(-(reducedMotion ? 14 : 5.5) * dt);
        camera.alpha += (camGoal.alpha - camera.alpha) * damp;
        camera.beta += (camGoal.beta - camera.beta) * damp;
        camera.radius += (camGoal.radius - camera.radius) * damp;
        Vector3.LerpToRef(camera.target, camGoal.target, damp, camera.target);
        if (
          Math.abs(camera.alpha - camGoal.alpha) < 0.002 &&
          Math.abs(camera.beta - camGoal.beta) < 0.002 &&
          Math.abs(camera.radius - camGoal.radius) < 0.01
        ) {
          camAnimActive = false;
        }
      } else if (st.autoRotate && st.cameraPreset !== 'top' && now - lastInteraction > 2500) {
        camera.alpha += dt * 0.09;
      }

      // ---- mode layout & visibility
      const showSignal = st.sceneMode === 'all' || st.sceneMode === 'fourier-3d';
      const showHarmonics = st.sceneMode === 'fourier-3d';
      const showWaterfall = st.sceneMode === 'all' || st.sceneMode === 'waterfall-3d';
      const isRadialFFT = st.sceneMode === 'fft-arena';

      signalRoot.setEnabled(showSignal);
      harmonicsRoot.setEnabled(showHarmonics);
      waterfallRoot.setEnabled(showWaterfall);
      arenaCoreRoot.setEnabled(isRadialFFT);
      fftLabelsGroup.setEnabled(!isRadialFFT);
      fftTitle.mesh.setEnabled(!isRadialFFT);
      rail.setEnabled(!isRadialFFT);
      arenaRing.setEnabled(isRadialFFT);

      if (st.sceneMode === 'all') {
        signalRoot.position.set(0, 0.95, 3.1 * st.layerSpread);
        signalRoot.scaling.setAll(0.95);
        fftRoot.position.set(0, 0, 0.2);
        waterfallRoot.position.set(0, FLOOR_Y + 0.02, -3.3 * st.layerSpread);
        waterfallRoot.scaling.set(1, 0.95, 0.9);
      } else if (st.sceneMode === 'fourier-3d') {
        signalRoot.position.set(0, 0.45, 2.2);
        signalRoot.scaling.setAll(1.1);
        fftRoot.position.set(0, 0, 3.9);
      } else if (st.sceneMode === 'waterfall-3d') {
        waterfallRoot.position.set(0, FLOOR_Y + 0.02, -0.3);
        waterfallRoot.scaling.set(1.2, 1.3, 1.3);
        fftRoot.position.set(0, 0, 3.7);
      } else {
        fftRoot.position.set(0, 0, 0);
      }

      if (st.finishMode !== lastFinish) applyFinish(st.finishMode);
      surfLook.x = st.wireframe ? (isDark ? 0.55 : 0.6) : isDark ? 0.07 : 0.1;
      surfMat.setVector4('look', surfLook);
      surfMat.setVector3('camPos', camera.globalPosition);

      const specDb = liveSpectrumDbRef?.current;
      const useLiveSpec = Boolean(specDb && specDb.length > 0);
      if (!isRadialFFT) rebuildTicks(st.fallbackSpectrumFreqs, useLiveSpec);

      // ---- time-domain trace
      if (showSignal) {
        const wave = liveWaveformRef?.current;
        const visualCycles = Math.max(2.8, Math.min(7.0, 2.5 + Math.log10(Math.max(10, st.frequency) / 10) * 1.4));
        let waveVariance = 0;
        if (wave && wave.length > 16) {
          let minV = 1e9;
          let maxV = -1e9;
          for (let i = 0; i < wave.length; i += 4) {
            if (wave[i] < minV) minV = wave[i];
            if (wave[i] > maxV) maxV = wave[i];
          }
          waveVariance = maxV - minV;
        }
        const useLiveWave = Boolean(wave && wave.length > 0 && st.frequency >= 160 && waveVariance > 0.25);

        // Static (LabContext) signal: show a readable window of ~5 periods that scrolls slowly
        const fb = st.fallbackWave;
        const fbLen = fb?.length ?? 0;
        let fbWindow = fbLen;
        let fbOffset = 0;
        if (fb && fbLen > 0) {
          const freqs = st.fallbackSpectrumFreqs;
          const fs = freqs && freqs.length > 1 ? freqs[freqs.length - 1] * 2 : 0;
          if (fs > 0 && st.frequency > 0) {
            const spc = fs / st.frequency;
            fbWindow = Math.max(48, Math.min(fbLen - 1, Math.round(spc * 5)));
            const room = Math.max(1, fbLen - 1 - fbWindow);
            fbOffset = ((phaseTime * 0.25 * spc) % room + room) % room;
          } else {
            fbWindow = Math.min(fbLen - 1, 400);
          }
        }

        for (let i = 0; i < NUM_WAVE_PTS; i++) {
          const u = i / (NUM_WAVE_PTS - 1);
          const x = START_X + u * SPAN_X;
          const synthAngle = u * Math.PI * 2 * visualCycles - phaseTime;
          let synthY = Math.sin(synthAngle);
          let synthZ = Math.cos(synthAngle);
          if (st.waveType === 'square') {
            synthY = Math.tanh(Math.sin(synthAngle) * 3.5);
            synthZ = Math.tanh(Math.cos(synthAngle) * 3.5);
          } else if (st.waveType === 'sawtooth') {
            synthY = 0.65 * Math.sin(synthAngle) - 0.32 * Math.sin(2 * synthAngle) + 0.18 * Math.sin(3 * synthAngle);
            synthZ = 0.65 * Math.cos(synthAngle) - 0.32 * Math.cos(2 * synthAngle) + 0.18 * Math.cos(3 * synthAngle);
          } else if (st.waveType === 'chirp') {
            const chirpAngle = u * u * Math.PI * 10 - phaseTime;
            synthY = Math.sin(chirpAngle);
            synthZ = Math.cos(chirpAngle);
          }

          let yVal = 0;
          let zQuad = 0;
          if (useLiveWave && wave) {
            const pos = u * (wave.length - 1);
            const rawY = sampleArr(wave, pos) * 1.55;
            const rawDy = (sampleArr(wave, Math.min(wave.length - 1, pos + 4)) - sampleArr(wave, pos)) * 2.6;
            yVal = rawY * 0.7 + synthY * 0.45;
            zQuad = Math.max(-1.2, Math.min(1.2, rawDy * 0.6 + synthZ * 0.45));
          } else if (fb && fbLen > 0) {
            const pos = fbOffset + u * fbWindow;
            yVal = sampleArr(fb, pos) * 1.1;
            zQuad = (st.fallbackFilteredWave ? sampleArr(st.fallbackFilteredWave, pos) : 0) * 0.85;
          } else {
            const envMod = wave && wave.length > 0 ? 0.78 + 0.3 * Math.abs(wave[Math.floor(u * (wave.length - 1))]) : 1.0;
            yVal = synthY * 1.12 * envMod;
            zQuad = synthZ * 0.85 * envMod;
          }
          yVal = Math.max(-1.55, Math.min(1.55, yVal));
          const zFinal = zQuad * 0.56;
          wavePath[i].set(x, yVal, zFinal);
          curtainTopPath[i].set(x, yVal, zFinal);
          curtainBotPath[i].set(x, CURTAIN_Y, zFinal);
        }

        signalTube = CreateTube('signalTube', { path: wavePath, radius: TRACE_R, instance: signalTube });
        signalCurtain = CreateRibbon('signalCurtain', { pathArray: [curtainTopPath, curtainBotPath], instance: signalCurtain });

        const y0 = wavePath[0].y;
        const z0 = wavePath[0].z;
        phasorArm = CreateTube('phasorArm', {
          path: [new Vector3(START_X, 0, 0), new Vector3(START_X, y0, z0)],
          radius: 0.022,
          instance: phasorArm,
        });
        phasorTip.position.set(START_X, y0, z0);
        outerRing.rotation.x = -phaseTime * 0.22;
        innerRing.rotation.x = phaseTime * 0.48;

        if (showHarmonics) {
          const harmAmps = [0.65, 0.34, 0.22, 0.15];
          const harmFreqs = [1, 2, 3, 5];
          if (specDb && specDb.length >= 64) {
            for (let h = 0; h < 4; h++) {
              const idx = Math.min(specDb.length - 1, 12 + h * 24);
              const norm = Math.max(0.1, Math.min(1, (specDb[idx] + 92) / 86));
              harmAmps[h] = norm * 0.75;
            }
          }
          for (let h = 0; h < 4; h++) {
            const zOff = -1.8 - (h + 1) * (1.15 * st.layerSpread);
            const hPath = harmPaths[h];
            for (let i = 0; i < NUM_WAVE_PTS; i++) {
              const u = i / (NUM_WAVE_PTS - 1);
              const hy = Math.sin(u * Math.PI * 2 * harmFreqs[h] * 1.5 - phaseTime * (0.65 + h * 0.25)) * harmAmps[h];
              hPath[i].set(START_X + u * SPAN_X, hy, zOff);
            }
            harmTubes[h] = CreateTube(`harmTube_${h}`, { path: hPath, radius: 0.028, instance: harmTubes[h] });
            harmLabelMeshes[h].position.z = zOff;
          }
        }
      }

      // ---- FFT bars
      const dampFactor = 1 - Math.exp(-15 * dt);
      const peakDecay = dt * 0.85;
      let energy = 0;
      let fbMax = 1e-12;
      if (!useLiveSpec && st.fallbackSpectrumMag) {
        for (let k = 0; k < st.fallbackSpectrumMag.length; k++) if (st.fallbackSpectrumMag[k] > fbMax) fbMax = st.fallbackSpectrumMag[k];
      }
      for (let i = 0; i < NUM_BARS; i++) {
        let norm = 0.04;
        if (useLiveSpec && specDb) {
          const srcIdx = Math.min(specDb.length - 1, Math.floor((i / (NUM_BARS - 1)) * (specDb.length - 1)));
          norm = Math.max(0.03, Math.min(1, ((specDb[srcIdx] ?? -90) + 92) / 88));
        } else if (st.fallbackSpectrumMag && st.fallbackSpectrumMag.length > 0) {
          const m = st.fallbackSpectrumMag;
          const srcIdx = Math.min(m.length - 1, Math.floor((i / (NUM_BARS - 1)) * (m.length - 1)));
          norm = Math.max(0.03, Math.min(1, 1 + (20 * Math.log10(Math.max(1e-6, (m[srcIdx] ?? 0) / fbMax))) / 60));
        }
        energy += norm;

        const h = smoothHeights[i] + (0.08 + norm * 3.2 - smoothHeights[i]) * dampFactor;
        smoothHeights[i] = h;
        const prevPeak = peakHolds[i];
        const nextPeak = h >= prevPeak ? h + 0.06 : Math.max(h + 0.04, prevPeak - peakDecay);
        peakHolds[i] = nextPeak;

        const isHovered = hoveredIdx === i;
        if (isRadialFFT) {
          const angle = (i / NUM_BARS) * Math.PI * 2;
          const rad = 3.45;
          const q = arenaQuats[i];
          tmpPos.set(Math.cos(angle) * rad, FLOOR_Y + 0.04 + h * 0.5, Math.sin(angle) * rad);
          tmpScale.set(0.24, h, isHovered ? 0.2 : 0.15);
          Matrix.ComposeToRef(tmpScale, q, tmpPos, tmpMat);
          tmpMat.copyToArray(barMatrices, i * 16);
          tmpPos.y = FLOOR_Y + 0.04 + nextPeak;
          tmpScale.set(0.25, 0.025, 0.155);
          Matrix.ComposeToRef(tmpScale, q, tmpPos, tmpMat);
          tmpMat.copyToArray(peakMatrices, i * 16);
        } else {
          tmpPos.set(barX(i), FLOOR_Y + 0.04 + h * 0.5, 0);
          tmpScale.set(isHovered ? 0.13 : 0.105, h, isHovered ? 0.3 : 0.24);
          Matrix.ComposeToRef(tmpScale, identityQ, tmpPos, tmpMat);
          tmpMat.copyToArray(barMatrices, i * 16);
          tmpPos.y = FLOOR_Y + 0.04 + nextPeak;
          tmpScale.set(0.105, 0.022, 0.24);
          Matrix.ComposeToRef(tmpScale, identityQ, tmpPos, tmpMat);
          tmpMat.copyToArray(peakMatrices, i * 16);
        }

        sampleColormap(stops, 0.12 + norm * 0.88, rgb);
        const boost = isHovered ? 0.25 : 0;
        barColors[i * 4] = Math.min(1, rgb[0] + boost);
        barColors[i * 4 + 1] = Math.min(1, rgb[1] + boost);
        barColors[i * 4 + 2] = Math.min(1, rgb[2] + boost);
        barColors[i * 4 + 3] = 1;
      }
      barMesh.thinInstanceBufferUpdated('matrix');
      barMesh.thinInstanceBufferUpdated('color');
      peakMesh.thinInstanceBufferUpdated('matrix');

      // ---- spectrogram terrain
      if (showWaterfall) {
        const matrix = specMatrixRef?.current;
        if (matrix && matrix.length > 0) {
          const mCols = matrix.length;
          const mRows = matrix[0]?.length || 128;
          const isStaticPreview =
            mCols > 4 &&
            Math.abs((matrix[0]?.[20] ?? -90) - (matrix[mCols >> 1]?.[20] ?? -90)) < 0.01 &&
            Math.abs((matrix[0]?.[50] ?? -90) - (matrix[mCols - 1]?.[50] ?? -90)) < 0.01;
          for (let iz = 0; iz <= SEG_Z; iz++) {
            const zRatio = iz / SEG_Z;
            const rPos = zRatio * (mRows - 1);
            const zCoord = (zRatio - 0.5) * WF_DEPTH;
            const rowPath = wfPathArray[iz];
            for (let ix = 0; ix <= SEG_X; ix++) {
              const xRatio = ix / SEG_X;
              const cIdx = Math.min(mCols - 1, Math.floor(xRatio * (mCols - 1)));
              const col = matrix[cIdx];
              const db = col ? sampleArr(col, rPos) : -92;
              let norm = Math.max(0, Math.min(1, (db + 92) / 88));
              if (isStaticPreview) {
                const timeRipple = 0.84 + 0.16 * Math.sin(xRatio * Math.PI * 5 - wfTime + zRatio * 4);
                const subRidge = 0.08 * Math.exp(-Math.pow((zRatio - 0.38) / 0.08, 2)) * (0.6 + 0.4 * Math.cos(xRatio * Math.PI * 4 - wfTime));
                const highRidge = 0.05 * Math.exp(-Math.pow((zRatio - 0.68) / 0.09, 2)) * (0.6 + 0.4 * Math.sin(xRatio * Math.PI * 6 - wfTime * 1.2));
                norm = Math.min(1, norm * timeRipple + subRidge + highRidge);
              }
              const elev = Math.pow(norm, 1.08) * WF_MAX_ELEV;
              rowPath[ix].set((xRatio - 0.5) * WF_WIDTH, elev, zCoord);
              if (ix === SEG_X) crestPath[iz].set(rowPath[ix].x, elev + 0.025, zCoord);
            }
          }
        } else {
          // Build history locally from the live spectrum row or the static FFT magnitude
          wfAccum += dt;
          const colInterval = 1 / 30;
          const prefill = !wfPrefilled;
          wfPrefilled = true;
          for (let fill = prefill ? SEG_X + 1 : 1; fill > 0; fill--) {
          if (prefill || wfAccum >= colInterval) {
            wfAccum = Math.min(wfAccum - colInterval, colInterval);
            const nextCol = localWfHistory.shift() ?? new Float32Array(SEG_Z + 1);
            const mags = st.fallbackSpectrumMag;
            let maxMag = 1e-12;
            if (!useLiveSpec && mags) for (let k = 0; k < mags.length; k++) if (mags[k] > maxMag) maxMag = mags[k];
            for (let iz = 0; iz <= SEG_Z; iz++) {
              const r = iz / SEG_Z;
              if (useLiveSpec && specDb) {
                nextCol[iz] = sampleArr(specDb, r * (specDb.length - 1));
              } else if (mags && mags.length > 0) {
                const m = sampleArr(mags, r * (mags.length - 1)) / maxMag;
                const n60 = Math.max(0, 1 + (20 * Math.log10(Math.max(1e-6, m))) / 60);
                nextCol[iz] = -92 + 88 * n60;
              } else {
                nextCol[iz] = -85;
              }
            }
            localWfHistory.push(nextCol);
          }
          }
          for (let iz = 0; iz <= SEG_Z; iz++) {
            const zCoord = (iz / SEG_Z - 0.5) * WF_DEPTH;
            const rowPath = wfPathArray[iz];
            for (let ix = 0; ix <= SEG_X; ix++) {
              const norm = Math.max(0, Math.min(1, (localWfHistory[ix][iz] + 92) / 88));
              const elev = norm * WF_MAX_ELEV;
              rowPath[ix].set((ix / SEG_X - 0.5) * WF_WIDTH, elev, zCoord);
              if (ix === SEG_X) crestPath[iz].set(rowPath[ix].x, elev + 0.025, zCoord);
            }
          }
        }
        waterfallRibbon = CreateRibbon('waterfallRibbon', { pathArray: wfPathArray, instance: waterfallRibbon });
        frontCrestTube = CreateTube('frontCrestTube', { path: crestPath, radius: 0.016, instance: frontCrestTube });
      }

      // ---- arena core
      if (isRadialFFT) {
        const e = energy / NUM_BARS;
        const motion = reducedMotion ? 0.3 : 1;
        torusKnot.rotation.y += dt * 0.6 * motion;
        torusKnot.rotation.x += dt * 0.3 * motion;
        const s = 0.92 + e * 0.5;
        torusKnot.scaling.setAll(s);
        arenaGyroRing.rotation.y -= dt * 0.7 * motion;
        arenaGyroRing.rotation.z = 0.35;
      }
    });

    // =========================================================================
    // Render loop gating: only render while on-screen and the tab is visible
    // =========================================================================
    let onScreen = true;
    let running = false;
    const renderFrame = () => scene.render();
    const syncLoop = () => {
      const shouldRun = onScreen && document.visibilityState !== 'hidden';
      if (shouldRun && !running) {
        engine.runRenderLoop(renderFrame);
        running = true;
      } else if (!shouldRun && running) {
        engine.stopRenderLoop(renderFrame);
        running = false;
      }
    };
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              onScreen = entries.some((e) => e.isIntersecting);
              syncLoop();
            },
            { rootMargin: '120px' }
          )
        : null;
    if (containerRef.current && io) io.observe(containerRef.current);
    const onVisibility = () => syncLoop();
    document.addEventListener('visibilitychange', onVisibility);
    syncLoop();

    const resizeObserver = new ResizeObserver(() => engine.resize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      camPoseRef.current = {
        alpha: camera.alpha,
        beta: camera.beta,
        radius: camera.radius,
        target: camera.target.clone(),
      };
      cameraRef.current = null;
      io?.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      engine.stopRenderLoop();
      pipeline.dispose();
      scene.dispose();
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveWaveformRef, liveSpectrumDbRef, specMatrixRef, isDark, lang]);

  // ---------------------------------------------------------------- HUD styling
  const ui = isDark
    ? {
        shell: 'border-sky-500/20 bg-[#070c18]',
        panel: 'bg-slate-950/80 border-slate-700/60 backdrop-blur-md',
        text: 'text-slate-300 hover:text-white',
        chip: 'bg-slate-900/80 border-slate-700/70 text-slate-300',
        divider: 'border-slate-700/70',
        muted: 'text-slate-500',
      }
    : {
        shell: 'border-slate-200 bg-[#f4f8fc]',
        panel: 'bg-white/85 border-slate-200 backdrop-blur-md',
        text: 'text-slate-600 hover:text-slate-900',
        chip: 'bg-white border-slate-200 text-slate-600',
        divider: 'border-slate-200',
        muted: 'text-slate-400',
      };

  const modeDescriptions: Record<Scene3DMode, [string, string]> = {
    all: [
      'time-domain waveform with phasor, a 64-band FFT magnitude spectrum, and a spectrogram terrain whose height and colour encode energy over time and frequency',
      'شکل موج حوزه زمان همراه با فازور، طیف دامنه FFT با ۶۴ باند، و سطح طیف‌نگار که ارتفاع و رنگ آن انرژی را در زمان و فرکانس نشان می‌دهد',
    ],
    'fourier-3d': [
      'time-domain waveform above its Fourier components: the fundamental and the 2nd, 3rd and 5th harmonics',
      'شکل موج حوزه زمان و مؤلفه‌های فوریه آن: فرکانس بنیادی و هارمونیک‌های دوم، سوم و پنجم',
    ],
    'waterfall-3d': [
      'spectrogram terrain: time runs left to right, frequency front to back, and height and colour encode level in dB',
      'سطح طیف‌نگار: زمان از چپ به راست، فرکانس از جلو به عقب، و ارتفاع و رنگ سطح را بر حسب دسی‌بل نشان می‌دهد',
    ],
    'fft-arena': [
      '64 FFT magnitude bands arranged in a ring around an audio-reactive core',
      '۶۴ باند دامنه FFT که به شکل حلقه‌ای دور یک هسته واکنش‌گرا به صدا چیده شده‌اند',
    ],
  };
  const ariaLabel = isFa
    ? `نمایش سه‌بعدی سیگنال: ${modeDescriptions[sceneMode][1]}. فرکانس سیگنال ${Math.round(frequency)} هرتز.`
    : `3D signal visualization: ${modeDescriptions[sceneMode][0]}. Signal frequency ${Math.round(frequency)} Hz.`;

  const heightCls = isFullscreen ? 'h-screen' : isCoarse ? 'h-[60vh] max-h-[420px]' : heightClass;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightCls} rounded-2xl overflow-hidden border shadow-xl select-none ${ui.shell}`}
    >
      {/* Top HUD */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className={`pointer-events-auto flex flex-wrap items-center gap-0.5 border rounded-xl p-1 shadow-sm ${ui.panel}`}>
          {(
            [
              { id: 'all', label: 'All 3D', fa: 'همه سه‌بعدی', icon: Layers },
              { id: 'fourier-3d', label: 'Signal & Harmonics', fa: 'سیگنال و هارمونیک', icon: Activity },
              { id: 'waterfall-3d', label: '3D Terrain', fa: 'توپوگرافی طیف', icon: Box },
              { id: 'fft-arena', label: 'FFT Arena', fa: 'حلقه FFT', icon: BarChart3 },
            ] as { id: Scene3DMode; label: string; fa: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((m) => {
            const Icon = m.icon;
            const active = sceneMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSceneMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'bg-sky-500 text-white shadow-sm' : ui.text
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{isFa ? m.fa : m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          {hoveredBar && (
            <button
              type="button"
              onClick={() => onPlayFrequencyTone?.(hoveredBar.freq, 550)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 shadow-sm cursor-pointer ${ui.panel} ${isDark ? 'text-white' : 'text-slate-800'}`}
            >
              <Volume2 className="w-3 h-3 text-sky-500" />
              <span className="text-sky-500 font-semibold">{formatHz(hoveredBar.freq)}</span>
              <span className={ui.muted}>|</span>
              <span>{hoveredBar.db.toFixed(1)} dB</span>
            </button>
          )}

          <div className={`hidden sm:flex items-center gap-0.5 border rounded-xl p-1 shadow-sm ${ui.panel}`}>
            {(
              [
                { id: 'iso', label: '3D Orbit', fa: 'سه‌بعدی' },
                { id: 'time', label: 'Time X-Y', fa: 'زمان' },
                { id: 'freq', label: 'FFT Z-Y', fa: 'فرکانس' },
                { id: 'top', label: 'Top Map', fa: 'از بالا' },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                aria-pressed={cameraPreset === cam.id}
                onClick={() => {
                  setCameraPreset(cam.id);
                  frameReqRef.current = { pending: true, instant: false };
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === cam.id ? (isDark ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-white') : ui.text
                }`}
              >
                {isFa ? cam.fa : cam.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            aria-pressed={autoRotate}
            aria-label={
              autoRotate
                ? isFa
                  ? 'توقف چرخش خودکار دوربین'
                  : 'Pause camera auto-rotation'
                : isFa
                ? 'شروع چرخش خودکار دوربین'
                : 'Start camera auto-rotation'
            }
            title={autoRotate ? (isFa ? 'توقف چرخش' : 'Pause rotation') : isFa ? 'چرخش خودکار' : 'Auto-rotate'}
            className={`p-2 rounded-xl border cursor-pointer shadow-sm flex items-center gap-1 ${ui.panel} ${ui.text}`}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? (isFa ? 'خروج از تمام‌صفحه' : 'Exit fullscreen') : isFa ? 'تمام‌صفحه' : 'Fullscreen'}
            title={isFa ? 'تمام‌صفحه' : 'Fullscreen 3D'}
            className={`p-2 rounded-xl border cursor-pointer shadow-sm ${ui.panel} ${ui.text}`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className={`w-full h-full block outline-none ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
      />

      {webglFailed && (
        <div className={`absolute inset-0 flex items-center justify-center text-sm ${ui.muted}`}>
          {isFa ? 'WebGL در این مرورگر در دسترس نیست.' : 'WebGL is not available in this browser.'}
        </div>
      )}

      {/* Touch devices: opt-in interaction so the page can still scroll */}
      {isCoarse && !interactive && (
        <button
          type="button"
          onClick={() => setInteractive(true)}
          className="absolute inset-x-0 top-14 bottom-16 z-10 flex items-center justify-center cursor-pointer"
          aria-label={isFa ? 'برای تعامل با صحنه سه‌بعدی ضربه بزنید' : 'Tap to interact with the 3D scene'}
        >
          <span className={`px-3.5 py-2 rounded-full border text-xs font-medium flex items-center gap-1.5 shadow ${ui.panel} ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
            <Hand className="w-3.5 h-3.5 text-sky-500" />
            {isFa ? 'برای تعامل ضربه بزنید' : 'Tap to interact'}
          </span>
        </button>
      )}
      {isCoarse && interactive && (
        <button
          type="button"
          onClick={() => setInteractive(false)}
          className={`absolute top-14 right-3 z-20 px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1 cursor-pointer ${ui.panel} ${ui.text}`}
          aria-label={isFa ? 'پایان تعامل و بازگشت به پیمایش صفحه' : 'Done — release the scene and scroll the page'}
        >
          <X className="w-3 h-3" />
          {isFa ? 'پایان' : 'Done'}
        </button>
      )}

      {/* Axis legend */}
      {!dockCollapsed && (
        <div className={`hidden md:flex absolute bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none items-center gap-3 px-3 py-1 rounded-full border text-[10px] font-mono shadow-sm ${ui.panel} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <span>{isFa ? 'X: زمان / فرکانس FFT' : 'X: time · FFT frequency'}</span>
          <span className={ui.muted}>·</span>
          <span>{isFa ? 'Y: دامنه (dB)' : 'Y: amplitude / dB'}</span>
          <span className={ui.muted}>·</span>
          <span>{isFa ? 'Z: فرکانس طیف‌نگار' : 'Z: spectrogram frequency'}</span>
        </div>
      )}

      {/* Bottom control dock */}
      <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        {dockCollapsed ? (
          <div className="ml-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => setDockCollapsed(false)}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 shadow-sm cursor-pointer ${ui.panel} ${ui.text}`}
            >
              <ChevronUp className="w-3.5 h-3.5 text-sky-500" />
              <span>{isFa ? 'نمایش کنترل‌ها' : 'Show Controls'}</span>
            </button>
          </div>
        ) : (
          <div className={`w-full pointer-events-auto flex flex-wrap items-center justify-between gap-2 border rounded-xl px-3 py-2 shadow-sm ${ui.panel}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              {onTogglePlay && (
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    isPlaying ? 'bg-amber-500 text-slate-950' : 'bg-sky-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? (isFa ? 'توقف' : 'Pause') : isFa ? 'پخش سیگنال' : 'Play Signal'}</span>
                </button>
              )}

              {onToggleMic && (
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors cursor-pointer whitespace-nowrap ${
                    isMicActive ? 'bg-rose-500/15 border-rose-500 text-rose-500' : `${ui.chip} hover:border-sky-400`
                  }`}
                >
                  {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-500" />}
                  <span>{isMicActive ? (isFa ? 'قطع میکروفون' : 'Stop Mic') : isFa ? 'میکروفون' : 'Mic'}</span>
                </button>
              )}

              {onSelectPreset && (
                <div className={`hidden sm:flex items-center gap-1 ps-1.5 border-s ${ui.divider}`}>
                  {[
                    { id: 'pure', label: 'Sine', fa: 'سینوسی' },
                    { id: 'chirp', label: 'Chirp', fa: 'جاروب' },
                    { id: 'chord', label: 'Harmonics', fa: 'هارمونیک' },
                    { id: 'speech', label: 'Speech', fa: 'گفتار' },
                    { id: 'random', label: 'Random', fa: 'تصادفی' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPreset(p.id)}
                      className={`px-2 py-1 rounded-md border text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap hover:border-sky-400 hover:text-sky-500 ${ui.chip}`}
                    >
                      {isFa ? p.fa : p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${ui.chip}`} role="group" aria-label={isFa ? 'نقشه رنگ' : 'Colour map'}>
                <Sparkles className="w-3 h-3 text-sky-500 ms-1.5 me-0.5 shrink-0" />
                {(
                  [
                    { id: 'studio-chrome', en: 'Ice', fa: 'یخی', swatch: 'linear-gradient(90deg,#102a5c,#0e95d8,#ecfbff)' },
                    { id: 'gold-obsidian', en: 'Inferno', fa: 'آتشین', swatch: 'linear-gradient(90deg,#3b0f70,#cc4248,#fcffa4)' },
                    { id: 'bioluminescent', en: 'Viridis', fa: 'ویریدیس', swatch: 'linear-gradient(90deg,#440154,#1fa187,#fde725)' },
                  ] as { id: Finish3DMode; en: string; fa: string; swatch: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={finishMode === f.id}
                    onClick={() => setFinishMode(f.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      finishMode === f.id ? (isDark ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-white') : ui.text
                    }`}
                  >
                    <span className="w-3 h-1.5 rounded-sm inline-block" style={{ background: f.swatch }} aria-hidden="true" />
                    {isFa ? f.fa : f.en}
                  </button>
                ))}
              </div>

              {(sceneMode === 'all' || sceneMode === 'fourier-3d') && (
                <label className={`hidden lg:flex items-center gap-1.5 text-[11px] font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span>{isFa ? 'فاصله:' : 'Spread:'}</span>
                  <input
                    type="range"
                    min={0.6}
                    max={1.5}
                    step={0.05}
                    value={layerSpread}
                    onChange={(e) => setLayerSpread(Number(e.target.value))}
                    className="w-16 accent-sky-500 cursor-pointer"
                  />
                </label>
              )}

              <button
                type="button"
                aria-pressed={wireframe}
                onClick={() => setWireframe((w) => !w)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer whitespace-nowrap ${
                  wireframe ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-300' : ui.chip
                }`}
              >
                {isFa ? 'توری' : 'Mesh grid'}
              </button>

              <button
                type="button"
                onClick={() => setDockCollapsed(true)}
                className={`p-1 rounded-lg border cursor-pointer ${ui.chip}`}
                aria-label={isFa ? 'بستن نوار پایین' : 'Collapse controls'}
                title={isFa ? 'بستن نوار پایین' : 'Collapse Dock'}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
