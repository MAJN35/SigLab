import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  FresnelParameters,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  PointLight,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';
import {
  Activity,
  BarChart3,
  Box,
  ChevronDown,
  ChevronUp,
  Layers,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Pause,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react';

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
    return Number.isInteger(k) ? `${k} kHz` : `${k.toFixed(2)} kHz`;
  }
  return `${Math.round(f)} Hz`;
}

/**
 * Computes rich, high-contrast scientific RGB values [0..1] for normalized amplitude [0..1]
 */
function computeScientificRGB(
  norm: number,
  finishMode: Finish3DMode,
  boost = 0
): [number, number, number] {
  const t = Math.max(0, Math.min(1, norm));
  let r = 0;
  let g = 0;
  let b = 0;

  if (finishMode === 'gold-obsidian') {
    if (t < 0.35) {
      const k = t / 0.35;
      r = 0.16 + k * 0.38;
      g = 0.08 + k * 0.2;
      b = 0.02 + k * 0.05;
    } else if (t < 0.75) {
      const k = (t - 0.35) / 0.4;
      r = 0.54 + k * 0.4;
      g = 0.28 + k * 0.38;
      b = 0.07 + k * 0.08;
    } else {
      const k = (t - 0.75) / 0.25;
      r = 0.94 + k * 0.06;
      g = 0.66 + k * 0.28;
      b = 0.15 + k * 0.32;
    }
  } else if (finishMode === 'bioluminescent') {
    if (t < 0.35) {
      const k = t / 0.35;
      r = 0.02 + k * 0.04;
      g = 0.18 + k * 0.46;
      b = 0.38 + k * 0.52;
    } else if (t < 0.75) {
      const k = (t - 0.35) / 0.4;
      r = 0.06 + k * 0.38;
      g = 0.64 + k * 0.32;
      b = 0.9 - k * 0.52;
    } else {
      const k = (t - 0.75) / 0.25;
      r = 0.44 + k * 0.42;
      g = 0.96 + k * 0.04;
      b = 0.38 - k * 0.12;
    }
  } else {
    // Deep sapphire -> electric cyan -> neon lime -> warm amber peak
    if (t < 0.28) {
      const k = t / 0.28;
      r = 0.03 + k * 0.05;
      g = 0.14 + k * 0.44;
      b = 0.46 + k * 0.48;
    } else if (t < 0.62) {
      const k = (t - 0.28) / 0.34;
      r = 0.08 + k * 0.34;
      g = 0.58 + k * 0.32;
      b = 0.94 - k * 0.56;
    } else if (t < 0.86) {
      const k = (t - 0.62) / 0.24;
      r = 0.42 + k * 0.54;
      g = 0.9 - k * 0.18;
      b = 0.38 - k * 0.28;
    } else {
      const k = (t - 0.86) / 0.14;
      r = 0.96 + k * 0.04;
      g = 0.72 + k * 0.18;
      b = 0.1 + k * 0.25;
    }
  }

  if (boost > 0) {
    r = Math.min(1, r + boost * 0.25);
    g = Math.min(1, g + boost * 0.25);
    b = Math.min(1, b + boost * 0.25);
  }
  return [r, g, b];
}

/**
 * Helper to create a crisp 3D Billboard Label Plane using Babylon DynamicTexture
 */
function createBillboardLabel(
  name: string,
  text: string,
  borderColorHex: string,
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  width = 1.25,
  height = 0.32
): Mesh {
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene);
  plane.parent = parent;
  plane.position.copyFrom(position);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const dt = new DynamicTexture(`${name}_dt`, { width: 256, height: 64 }, scene, false);
  dt.hasAlpha = true;
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(5, 10, 22, 0.92)';
  ctx.strokeStyle = borderColorHex;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(6, 8, 244, 48, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  dt.update();

  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseTexture = dt;
  mat.emissiveTexture = dt;
  mat.opacityTexture = dt;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  plane.material = mat;
  return plane;
}

export const Signal3DStage: React.FC<Signal3DStageProps> = ({
  liveWaveformRef,
  liveSpectrumDbRef,
  specMatrixRef,
  fallbackWave,
  fallbackFilteredWave,
  fallbackSpectrumMag,
  frequency = 440,
  waveType = 'sine',
  isPlaying = false,
  isMicActive = false,
  lang = 'en',
  onTogglePlay,
  onToggleMic,
  onSelectPreset,
  onPlayFrequencyTone,
  heightClass = 'h-[480px] sm:h-[540px]',
}) => {
  const [sceneMode, setSceneMode] = useState<Scene3DMode>('all');
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'time' | 'freq' | 'top'>('iso');
  const [finishMode, setFinishMode] = useState<Finish3DMode>('studio-chrome');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [layerSpread, setLayerSpread] = useState(1.0);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<HoveredBarInfo | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest reactive props stored in ref for zero-recreation 60fps Babylon render loop
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
    onPlayFrequencyTone,
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
      onPlayFrequencyTone,
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
    onPlayFrequencyTone,
  ]);

  // Camera target animation ref
  const camAnimRef = useRef({
    active: false,
    alpha: -Math.PI / 3.1,
    beta: Math.PI / 2.85,
    radius: 17.2,
    target: new Vector3(0, 0.1, -0.2),
  });

  useEffect(() => {
    const anim = camAnimRef.current;
    anim.active = true;
    if (cameraPreset === 'iso') {
      anim.alpha = -Math.PI / 3.1;
      anim.beta = Math.PI / 2.85;
      anim.radius = 17.2;
      anim.target.set(0, 0.1, -0.2);
    } else if (cameraPreset === 'time') {
      anim.alpha = -Math.PI / 2;
      anim.beta = Math.PI / 2.15;
      anim.radius = 15.8;
      anim.target.set(0, 0.3, 0);
    } else if (cameraPreset === 'freq') {
      anim.alpha = 0;
      anim.beta = Math.PI / 2.2;
      anim.radius = 16.0;
      anim.target.set(0, 0.3, 0);
    } else if (cameraPreset === 'top') {
      anim.alpha = -Math.PI / 2;
      anim.beta = 0.08;
      anim.radius = 19.5;
      anim.target.set(0, 0, -0.3);
    }
  }, [cameraPreset]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Main Babylon.js Engine, GlowLayer, Shaders & Updatable Geometry Lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
        powerPreference: 'high-performance',
      },
      true
    );

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.016, 0.032, 0.072, 1.0);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.016, 0.032, 0.072);
    scene.fogDensity = 0.016;

    // ACES Tone Mapping & High-Contrast Optical Calibration
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.08;
    scene.imageProcessingConfiguration.contrast = 1.22;

    // Native Babylon.js Multi-Pass Optical GlowLayer (Neon Phosphor & Bioluminescent Bloom)
    const glowLayer = new GlowLayer('signalGlowLayer', scene, {
      mainTextureSamples: 4,
      blurKernelSize: 48,
    });
    glowLayer.intensity = 0.72;

    // ArcRotateCamera with silky-smooth inertial damping
    const camera = new ArcRotateCamera(
      'signalCam',
      -Math.PI / 3.1,
      Math.PI / 2.85,
      17.2,
      new Vector3(0, 0.1, -0.2),
      scene
    );
    camera.attachControl(canvas, true);
    camera.inertia = 0.86;
    camera.wheelPrecision = 24;
    camera.lowerRadiusLimit = 5.5;
    camera.upperRadiusLimit = 32;
    camera.upperBetaLimit = Math.PI * 0.86;

    // Studio Lighting
    const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.75;
    hemiLight.diffuse = new Color3(0.85, 0.95, 1.0);
    hemiLight.groundColor = new Color3(0.05, 0.1, 0.22);

    const keyLight = new PointLight('keyLight', new Vector3(8, 12, 10), scene);
    keyLight.intensity = 1.35;
    keyLight.diffuse = new Color3(0.22, 0.74, 0.97);

    const rimLight = new PointLight('rimLight', new Vector3(-8, 8, -9), scene);
    rimLight.intensity = 1.05;
    rimLight.diffuse = new Color3(0.5, 0.82, 0.25);

    // =========================================================================
    // 0. DARK-FIELD OPTICAL CALIBRATION STAGE FLOOR (DynamicTexture Polar Grid)
    // =========================================================================
    const floorDisc = MeshBuilder.CreateDisc(
      'floorDisc',
      { radius: 13.2, tessellation: 96 },
      scene
    );
    floorDisc.rotation.x = Math.PI / 2;
    floorDisc.position.y = -1.75;
    floorDisc.isPickable = false;

    const floorDT = new DynamicTexture('floorDT', { width: 1024, height: 1024 }, scene, true);
    const fCtx = floorDT.getContext() as unknown as CanvasRenderingContext2D;
    fCtx.fillStyle = '#040814';
    fCtx.fillRect(0, 0, 1024, 1024);

    // Cartesian fine calibration grid
    fCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    fCtx.lineWidth = 1.5;
    for (let i = 0; i <= 1024; i += 64) {
      fCtx.beginPath();
      fCtx.moveTo(i, 0);
      fCtx.lineTo(i, 1024);
      fCtx.stroke();
      fCtx.beginPath();
      fCtx.moveTo(0, i);
      fCtx.lineTo(1024, i);
      fCtx.stroke();
    }

    // Concentric polar measurement rings
    [160, 300, 430, 504].forEach((r, idx) => {
      fCtx.beginPath();
      fCtx.arc(512, 512, r, 0, Math.PI * 2);
      fCtx.strokeStyle =
        idx % 2 === 0 ? 'rgba(56, 189, 248, 0.34)' : 'rgba(127, 209, 65, 0.25)';
      fCtx.lineWidth = idx === 3 ? 3.5 : 2;
      fCtx.stroke();
    });
    floorDT.update();

    const floorMat = new StandardMaterial('floorMat', scene);
    floorMat.diffuseTexture = floorDT;
    floorMat.emissiveTexture = floorDT;
    floorMat.emissiveColor = new Color3(0.32, 0.35, 0.4);
    floorMat.specularColor = new Color3(0.08, 0.12, 0.18);
    floorMat.backFaceCulling = false;
    floorDisc.material = floorMat;

    // =========================================================================
    // 1. CONTINUOUS UPDATABLE 3D ANALYTIC SIGNAL TUBE + RIBBON CURTAIN + GIMBAL
    // =========================================================================
    const signalRoot = new TransformNode('signalRoot', scene);
    const NUM_WAVE_PTS = 140;
    const SPAN_X = 9.2;
    const START_X = -SPAN_X * 0.5;
    const FLOOR_Y = -1.65;

    const wavePath: Vector3[] = [];
    const curtainTopPath: Vector3[] = [];
    const curtainBotPath: Vector3[] = [];
    for (let i = 0; i < NUM_WAVE_PTS; i++) {
      const x = START_X + (i / (NUM_WAVE_PTS - 1)) * SPAN_X;
      wavePath.push(new Vector3(x, 0, 0));
      curtainTopPath.push(new Vector3(x, 0, 0));
      curtainBotPath.push(new Vector3(x, FLOOR_Y, 0));
    }

    // Continuous smooth 3D signal wave tube (zero beaded segments!)
    let signalTube = MeshBuilder.CreateTube(
      'signalTube',
      {
        path: wavePath,
        radius: 0.052,
        tessellation: 18,
        cap: Mesh.CAP_ALL,
        updatable: true,
      },
      scene
    );
    signalTube.parent = signalRoot;
    signalTube.isPickable = false;

    const signalTubeMat = new StandardMaterial('signalTubeMat', scene);
    signalTubeMat.diffuseColor = new Color3(0.15, 0.85, 0.98);
    signalTubeMat.emissiveColor = new Color3(0.08, 0.58, 0.88);
    signalTubeMat.specularColor = new Color3(0.9, 0.95, 1.0);
    signalTubeMat.specularPower = 64;
    // Fresnel Rim-Glow Shader on the 3D Signal Wave
    const waveFresnel = new FresnelParameters();
    waveFresnel.bias = 0.15;
    waveFresnel.power = 2.2;
    waveFresnel.leftColor = new Color3(0.5, 0.95, 0.35);
    waveFresnel.rightColor = new Color3(0.05, 0.45, 0.85);
    signalTubeMat.emissiveFresnelParameters = waveFresnel;
    signalTube.material = signalTubeMat;

    // Continuous translucent Amplitude Curtain Ribbon under the 3D Signal Wave
    let signalCurtain = MeshBuilder.CreateRibbon(
      'signalCurtain',
      {
        pathArray: [curtainTopPath, curtainBotPath],
        updatable: true,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene
    );
    signalCurtain.parent = signalRoot;
    signalCurtain.isPickable = false;

    const curtainMat = new StandardMaterial('curtainMat', scene);
    curtainMat.diffuseColor = new Color3(0.1, 0.68, 0.95);
    curtainMat.emissiveColor = new Color3(0.06, 0.38, 0.65);
    curtainMat.alpha = 0.22;
    curtainMat.backFaceCulling = false;
    const curtainAlphaFresnel = new FresnelParameters();
    curtainAlphaFresnel.bias = 0.1;
    curtainAlphaFresnel.power = 1.8;
    curtainAlphaFresnel.leftColor = new Color3(0.45, 0.85, 1.0);
    curtainAlphaFresnel.rightColor = new Color3(0.08, 0.2, 0.35);
    curtainMat.opacityFresnelParameters = curtainAlphaFresnel;
    signalCurtain.material = curtainMat;

    // Precision Phasor Gimbal Gyroscope at X = START_X (-4.6)
    const gimbalRoot = new TransformNode('gimbalRoot', scene);
    gimbalRoot.parent = signalRoot;
    gimbalRoot.position.set(START_X, 0, 0);

    const outerGimbalTorus = MeshBuilder.CreateTorus(
      'outerGimbalTorus',
      { diameter: 2.36, thickness: 0.055, tessellation: 64 },
      scene
    );
    outerGimbalTorus.parent = gimbalRoot;
    outerGimbalTorus.rotation.z = Math.PI / 2;
    outerGimbalTorus.isPickable = false;

    const gimbalMat = new StandardMaterial('gimbalMat', scene);
    gimbalMat.diffuseColor = new Color3(0.22, 0.74, 0.97);
    gimbalMat.emissiveColor = new Color3(0.12, 0.52, 0.85);
    outerGimbalTorus.material = gimbalMat;

    const innerGimbalTorus = MeshBuilder.CreateTorus(
      'innerGimbalTorus',
      { diameter: 1.38, thickness: 0.04, tessellation: 56 },
      scene
    );
    innerGimbalTorus.parent = gimbalRoot;
    innerGimbalTorus.rotation.z = Math.PI / 2;
    innerGimbalTorus.isPickable = false;

    const innerGimbalMat = new StandardMaterial('innerGimbalMat', scene);
    innerGimbalMat.diffuseColor = new Color3(0.5, 0.82, 0.25);
    innerGimbalMat.emissiveColor = new Color3(0.38, 0.72, 0.18);
    innerGimbalTorus.material = innerGimbalMat;

    let phasorArm = MeshBuilder.CreateTube(
      'phasorArm',
      {
        path: [new Vector3(START_X, 0, 0), new Vector3(START_X, 0.8, 0)],
        radius: 0.038,
        tessellation: 12,
        updatable: true,
      },
      scene
    );
    phasorArm.parent = signalRoot;
    phasorArm.material = innerGimbalMat;
    phasorArm.isPickable = false;

    const phasorTip = MeshBuilder.CreateSphere(
      'phasorTip',
      { diameter: 0.22, segments: 18 },
      scene
    );
    phasorTip.parent = signalRoot;
    phasorTip.isPickable = false;
    const tipMat = new StandardMaterial('tipMat', scene);
    tipMat.diffuseColor = new Color3(1, 1, 1);
    tipMat.emissiveColor = new Color3(0.55, 0.92, 0.3);
    phasorTip.material = tipMat;

    // 4 Decomposed Harmonic Tubes (Shown in 'fourier-3d' mode)
    const harmonicsRoot = new TransformNode('harmonicsRoot', scene);
    harmonicsRoot.parent = signalRoot;
    const harmColorHexes = ['#38bdf8', '#7FD141', '#f59e0b', '#ec4899'];
    const harmColor3s = [
      new Color3(0.22, 0.74, 0.97),
      new Color3(0.5, 0.82, 0.25),
      new Color3(0.96, 0.62, 0.04),
      new Color3(0.93, 0.28, 0.6),
    ];
    const harmLabels = ['f₀ Fund.', '2f₀ Harm.', '3f₀ Harm.', '5f₀ Harm.'];
    const harmPaths: Vector3[][] = [];
    const harmTubes: Mesh[] = [];
    const harmLabelMeshes: Mesh[] = [];

    for (let h = 0; h < 4; h++) {
      const hPath: Vector3[] = [];
      const zOff = -1.8 - (h + 1) * 1.15;
      for (let i = 0; i < NUM_WAVE_PTS; i++) {
        const x = START_X + (i / (NUM_WAVE_PTS - 1)) * SPAN_X;
        hPath.push(new Vector3(x, 0, zOff));
      }
      harmPaths.push(hPath);

      const hTube = MeshBuilder.CreateTube(
        `harmTube_${h}`,
        { path: hPath, radius: 0.032, tessellation: 12, updatable: true },
        scene
      );
      hTube.parent = harmonicsRoot;
      hTube.isPickable = false;
      const hMat = new StandardMaterial(`harmMat_${h}`, scene);
      hMat.diffuseColor = harmColor3s[h];
      hMat.emissiveColor = harmColor3s[h].scale(0.75);
      hTube.material = hMat;
      harmTubes.push(hTube);

      const lbl = createBillboardLabel(
        `harmLbl_${h}`,
        harmLabels[h],
        harmColorHexes[h],
        scene,
        harmonicsRoot,
        new Vector3(5.05, 0.25, zOff),
        1.18,
        0.28
      );
      harmLabelMeshes.push(lbl);
    }

    // =========================================================================
    // 2. 64-BIN 3D FFT SPECTRUM TOWERS WITH FRESNEL SHADERS & PEAK CROWNS
    // =========================================================================
    const fftRoot = new TransformNode('fftRoot', scene);
    const NUM_BARS = 64;
    const fftBars: Mesh[] = [];
    const fftBarMats: StandardMaterial[] = [];
    const fftPeaks: Mesh[] = [];
    const fftPeakMats: StandardMaterial[] = [];
    const fftPedestals: Mesh[] = [];
    const smoothHeights = new Float32Array(NUM_BARS).fill(0.18);
    const peakHolds = new Float32Array(NUM_BARS).fill(0.26);

    const pedestalMat = new StandardMaterial('pedestalMat', scene);
    pedestalMat.diffuseColor = new Color3(0.08, 0.13, 0.24);
    pedestalMat.emissiveColor = new Color3(0.03, 0.06, 0.12);
    pedestalMat.specularColor = new Color3(0.4, 0.6, 0.8);

    for (let i = 0; i < NUM_BARS; i++) {
      const ped = MeshBuilder.CreateBox(
        `fftPed_${i}`,
        { width: 0.13, height: 0.05, depth: 0.26 },
        scene
      );
      ped.parent = fftRoot;
      ped.material = pedestalMat;
      ped.isPickable = false;
      fftPedestals.push(ped);

      const bar = MeshBuilder.CreateBox(
        `fftBar_${i}`,
        { width: 1, height: 1, depth: 1 },
        scene
      );
      bar.parent = fftRoot;
      bar.metadata = { fftBarIndex: i };

      const bMat = new StandardMaterial(`fftBarMat_${i}`, scene);
      bMat.specularColor = new Color3(0.8, 0.9, 1.0);
      bMat.specularPower = 48;
      const barFresnel = new FresnelParameters();
      barFresnel.bias = 0.2;
      barFresnel.power = 2.0;
      barFresnel.leftColor = new Color3(0.65, 0.92, 1.0);
      barFresnel.rightColor = new Color3(0.08, 0.15, 0.28);
      bMat.emissiveFresnelParameters = barFresnel;
      bar.material = bMat;

      fftBars.push(bar);
      fftBarMats.push(bMat);

      const peak = MeshBuilder.CreateBox(
        `fftPeak_${i}`,
        { width: 0.12, height: 0.045, depth: 0.24 },
        scene
      );
      peak.parent = fftRoot;
      peak.isPickable = false;
      const pMat = new StandardMaterial(`fftPeakMat_${i}`, scene);
      peak.material = pMat;
      fftPeaks.push(peak);
      fftPeakMats.push(pMat);
    }

    // Frequency calibration labels along linear FFT row
    const fftLabelsGroup = new TransformNode('fftLabelsGroup', scene);
    fftLabelsGroup.parent = fftRoot;
    [
      { x: -4.4, text: '20 Hz' },
      { x: -2.2, text: '150 Hz' },
      { x: 0.0, text: '1 kHz' },
      { x: 2.2, text: '5 kHz' },
      { x: 4.4, text: '20 kHz' },
    ].forEach((tk, idx) => {
      createBillboardLabel(
        `fftTick_${idx}`,
        tk.text,
        '#0ea5e9',
        scene,
        fftLabelsGroup,
        new Vector3(tk.x, -1.62, 0.58),
        1.02,
        0.25
      );
    });

    // =========================================================================
    // 3. CONTINUOUS RIBBON 3D WATERFALL SPECTROGRAM TERRAIN + LIVE CREST TUBE
    // =========================================================================
    const waterfallRoot = new TransformNode('waterfallRoot', scene);
    const SEG_X = 64; // Time columns
    const SEG_Z = 44; // Log-frequency rows
    const WF_WIDTH = 9.2;
    const WF_DEPTH = 4.6;

    const wfPathArray: Vector3[][] = [];
    for (let iz = 0; iz <= SEG_Z; iz++) {
      const rowPath: Vector3[] = [];
      const z = (iz / SEG_Z - 0.5) * WF_DEPTH;
      for (let ix = 0; ix <= SEG_X; ix++) {
        const x = (ix / SEG_X - 0.5) * WF_WIDTH;
        rowPath.push(new Vector3(x, 0, z));
      }
      wfPathArray.push(rowPath);
    }

    let waterfallRibbon = MeshBuilder.CreateRibbon(
      'waterfallRibbon',
      {
        pathArray: wfPathArray,
        updatable: true,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene
    );
    waterfallRibbon.parent = waterfallRoot;
    waterfallRibbon.isPickable = false;

    const totalWfVerts = (SEG_X + 1) * (SEG_Z + 1);
    const wfColors = new Float32Array(totalWfVerts * 4);
    for (let i = 0; i < totalWfVerts; i++) {
      wfColors[i * 4] = 0.05;
      wfColors[i * 4 + 1] = 0.25;
      wfColors[i * 4 + 2] = 0.65;
      wfColors[i * 4 + 3] = 1.0;
    }
    waterfallRibbon.setVerticesData(VertexBuffer.ColorKind, wfColors, true);

    const wfMat = new StandardMaterial('wfMat', scene);
    wfMat.diffuseColor = new Color3(1, 1, 1);
    wfMat.emissiveColor = new Color3(0.22, 0.28, 0.36);
    wfMat.specularColor = new Color3(0.35, 0.55, 0.75);
    wfMat.specularPower = 32;
    wfMat.backFaceCulling = false;
    waterfallRibbon.material = wfMat;

    // Leading-edge glowing Live Crest Tube on Waterfall
    const crestPath: Vector3[] = [];
    for (let iz = 0; iz <= SEG_Z; iz++) {
      const z = (iz / SEG_Z - 0.5) * WF_DEPTH;
      crestPath.push(new Vector3(WF_WIDTH * 0.5, 0.04, z));
    }
    let frontCrestTube = MeshBuilder.CreateTube(
      'frontCrestTube',
      { path: crestPath, radius: 0.036, tessellation: 12, updatable: true },
      scene
    );
    frontCrestTube.parent = waterfallRoot;
    frontCrestTube.isPickable = false;
    const crestMat = new StandardMaterial('crestMat', scene);
    crestMat.diffuseColor = new Color3(0.5, 0.92, 0.28);
    crestMat.emissiveColor = new Color3(0.45, 0.88, 0.22);
    frontCrestTube.material = crestMat;

    const localWfHistory: Float32Array[] = Array.from(
      { length: SEG_X + 1 },
      () => new Float32Array(SEG_Z + 1).fill(-92)
    );

    // =========================================================================
    // 4. 3D AUDIO-REACTIVE TORUS-KNOT HARMONIC CORE (For 'fft-arena' mode)
    // =========================================================================
    const arenaCoreRoot = new TransformNode('arenaCoreRoot', scene);
    arenaCoreRoot.position.set(0, 0.85, 0);

    const torusKnot = MeshBuilder.CreateTorusKnot(
      'arenaTorusKnot',
      { radius: 0.68, tube: 0.18, radialSegments: 128, tubularSegments: 32, p: 2, q: 3 },
      scene
    );
    torusKnot.parent = arenaCoreRoot;
    torusKnot.isPickable = false;
    const knotMat = new StandardMaterial('knotMat', scene);
    knotMat.diffuseColor = new Color3(0.22, 0.74, 0.97);
    knotMat.emissiveColor = new Color3(0.12, 0.48, 0.82);
    const knotFresnel = new FresnelParameters();
    knotFresnel.bias = 0.1;
    knotFresnel.power = 2.0;
    knotFresnel.leftColor = new Color3(0.5, 0.95, 0.35);
    knotFresnel.rightColor = new Color3(0.08, 0.35, 0.75);
    knotMat.emissiveFresnelParameters = knotFresnel;
    torusKnot.material = knotMat;

    const arenaGyroRing = MeshBuilder.CreateTorus(
      'arenaGyroRing',
      { diameter: 2.75, thickness: 0.045, tessellation: 64 },
      scene
    );
    arenaGyroRing.parent = arenaCoreRoot;
    arenaGyroRing.isPickable = false;
    arenaGyroRing.material = innerGimbalMat;

    // =========================================================================
    // POINTER HOVER & CLICK RAYCASTING FOR 64 FFT SPECTRUM BARS
    // =========================================================================
    let hoveredIdx: number | null = null;
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) =>
          Boolean(m.metadata && typeof m.metadata.fftBarIndex === 'number')
        );
        if (pick?.hit && pick.pickedMesh?.metadata) {
          const idx = pick.pickedMesh.metadata.fftBarIndex as number;
          hoveredIdx = idx;
          const freqHz = binToFreqLog(idx, NUM_BARS);
          const specDb = liveSpectrumDbRef?.current;
          const srcIdx = specDb
            ? Math.min(specDb.length - 1, Math.floor((idx / (NUM_BARS - 1)) * (specDb.length - 1)))
            : 0;
          const db = specDb ? specDb[srcIdx] ?? -80 : -20;
          setHoveredBar({ index: idx, freq: freqHz, db });
        } else if (hoveredIdx !== null) {
          hoveredIdx = null;
          setHoveredBar(null);
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) =>
          Boolean(m.metadata && typeof m.metadata.fftBarIndex === 'number')
        );
        if (pick?.hit && pick.pickedMesh?.metadata) {
          const idx = pick.pickedMesh.metadata.fftBarIndex as number;
          const freqHz = binToFreqLog(idx, NUM_BARS);
          stateRef.current.onPlayFrequencyTone?.(freqHz, 550);
        }
      }
    });

    // =========================================================================
    // 60 FPS REAL-TIME BABYLON RENDER & GEOMETRY UPDATE LOOP
    // =========================================================================
    let phaseTime = 0;
    let wfTime = 0;

    scene.registerBeforeRender(() => {
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
      const st = stateRef.current;

      phaseTime += dt * (st.isPlaying ? 3.2 : 1.15);
      wfTime += dt * (st.isPlaying ? 2.5 : 0.9);

      // 1. Camera Preset Smooth Interpolation & Auto-Orbit
      const camAnim = camAnimRef.current;
      if (camAnim.active) {
        const damp = 1 - Math.exp(-6.5 * dt);
        camera.alpha += (camAnim.alpha - camera.alpha) * damp;
        camera.beta += (camAnim.beta - camera.beta) * damp;
        camera.radius += (camAnim.radius - camera.radius) * damp;
        Vector3.LerpToRef(camera.target, camAnim.target, damp, camera.target);
        if (
          Math.abs(camera.alpha - camAnim.alpha) < 0.01 &&
          Math.abs(camera.beta - camAnim.beta) < 0.01 &&
          Math.abs(camera.radius - camAnim.radius) < 0.05
        ) {
          camAnim.active = false;
        }
      } else if (st.autoRotate) {
        camera.alpha += dt * 0.35;
      }

      // 2. Scene Mode Layout & Visibility Switching
      const showSignal = st.sceneMode === 'all' || st.sceneMode === 'fourier-3d';
      const showHarmonics = st.sceneMode === 'fourier-3d';
      const showWaterfall = st.sceneMode === 'all' || st.sceneMode === 'waterfall-3d';
      const isRadialFFT = st.sceneMode === 'fft-arena';

      signalRoot.setEnabled(showSignal);
      harmonicsRoot.setEnabled(showHarmonics);
      waterfallRoot.setEnabled(showWaterfall);
      arenaCoreRoot.setEnabled(isRadialFFT);
      fftLabelsGroup.setEnabled(!isRadialFFT);

      if (st.sceneMode === 'all') {
        signalRoot.position.set(0, 0.95, 3.1 * st.layerSpread);
        signalRoot.scaling.setAll(0.95);
        fftRoot.position.set(0, 0, 0.2);
        waterfallRoot.position.set(0, -1.62, -3.3 * st.layerSpread);
        waterfallRoot.scaling.set(1, 0.95, 0.9);
      } else if (st.sceneMode === 'fourier-3d') {
        signalRoot.position.set(0, 0.45, 2.2);
        signalRoot.scaling.setAll(1.18);
        fftRoot.position.set(0, 0, 3.8);
      } else if (st.sceneMode === 'waterfall-3d') {
        waterfallRoot.position.set(0, -1.35, -0.3);
        waterfallRoot.scaling.set(1.25, 1.32, 1.32);
        fftRoot.position.set(0, 0.1, 3.6);
      } else if (st.sceneMode === 'fft-arena') {
        fftRoot.position.set(0, 0, 0);
      }

      wfMat.wireframe = st.wireframe;

      // Update Signal Wave Tube theme color
      if (st.finishMode === 'gold-obsidian') {
        signalTubeMat.diffuseColor.set(0.98, 0.72, 0.18);
        signalTubeMat.emissiveColor.set(0.75, 0.45, 0.06);
      } else if (st.finishMode === 'bioluminescent') {
        signalTubeMat.diffuseColor.set(0.25, 0.98, 0.65);
        signalTubeMat.emissiveColor.set(0.12, 0.72, 0.42);
      } else {
        signalTubeMat.diffuseColor.set(0.18, 0.86, 0.98);
        signalTubeMat.emissiveColor.set(0.08, 0.58, 0.88);
      }

      // 3. Update Continuous 3D Signal Tube & Curtain Ribbon
      if (showSignal) {
        const wave = liveWaveformRef?.current;
        const specDb = liveSpectrumDbRef?.current;
        const visualCycles = Math.max(
          2.8,
          Math.min(7.0, 2.5 + Math.log10(Math.max(10, st.frequency) / 10) * 1.4)
        );
        const waveLen = wave && wave.length > 0 ? wave.length : st.fallbackWave?.length || 128;

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

        for (let i = 0; i < NUM_WAVE_PTS; i++) {
          const u = i / (NUM_WAVE_PTS - 1);
          const x = START_X + u * SPAN_X;
          const sampleIdx = Math.min(waveLen - 1, Math.floor(u * (waveLen - 1)));
          const nextIdx = Math.min(waveLen - 1, sampleIdx + 4);

          const synthAngle = u * Math.PI * 2 * visualCycles - phaseTime;
          let synthY = Math.sin(synthAngle);
          let synthZ = Math.cos(synthAngle);

          if (st.waveType === 'square') {
            synthY = Math.tanh(Math.sin(synthAngle) * 3.5);
            synthZ = Math.tanh(Math.cos(synthAngle) * 3.5);
          } else if (st.waveType === 'sawtooth') {
            synthY =
              0.65 * Math.sin(synthAngle) -
              0.32 * Math.sin(2 * synthAngle) +
              0.18 * Math.sin(3 * synthAngle);
            synthZ =
              0.65 * Math.cos(synthAngle) -
              0.32 * Math.cos(2 * synthAngle) +
              0.18 * Math.cos(3 * synthAngle);
          } else if (st.waveType === 'chirp') {
            const chirpAngle = u * u * Math.PI * 10 - phaseTime;
            synthY = Math.sin(chirpAngle);
            synthZ = Math.cos(chirpAngle);
          }

          let yVal = 0;
          let zQuad = 0;
          if (wave && wave.length > 0 && st.frequency >= 160 && waveVariance > 0.25) {
            const rawY = wave[sampleIdx] * 1.55;
            const rawDy = (wave[nextIdx] - wave[sampleIdx]) * 2.6;
            yVal = rawY * 0.7 + synthY * 0.45;
            zQuad = Math.max(-1.2, Math.min(1.2, rawDy * 0.6 + synthZ * 0.45));
          } else if (st.fallbackWave && st.fallbackWave.length > 0) {
            yVal = (st.fallbackWave[sampleIdx] ?? 0) * 1.1;
            const filt = st.fallbackFilteredWave?.[sampleIdx] ?? 0;
            zQuad = filt * 0.85;
          } else {
            const envMod = wave && wave.length > 0 ? 0.78 + 0.3 * Math.abs(wave[sampleIdx]) : 1.0;
            yVal = synthY * 1.12 * envMod;
            zQuad = synthZ * 0.85 * envMod;
          }

          const zFinal = zQuad * 0.56;
          wavePath[i].set(x, yVal, zFinal);
          curtainTopPath[i].set(x, yVal, zFinal);
          curtainBotPath[i].set(x, FLOOR_Y, zFinal);
        }

        signalTube = MeshBuilder.CreateTube('signalTube', {
          path: wavePath,
          radius: 0.052,
          instance: signalTube,
        });

        signalCurtain = MeshBuilder.CreateRibbon('signalCurtain', {
          pathArray: [curtainTopPath, curtainBotPath],
          instance: signalCurtain,
        });

        // Update Phasor Gimbal & Rotating Vector Arm
        const y0 = wavePath[0].y;
        const z0 = wavePath[0].z;
        phasorArm = MeshBuilder.CreateTube('phasorArm', {
          path: [new Vector3(START_X, 0, 0), new Vector3(START_X, y0, z0)],
          radius: 0.038,
          instance: phasorArm,
        });
        phasorTip.position.set(START_X, y0, z0);
        outerGimbalTorus.rotation.x = -phaseTime * 0.22;
        innerGimbalTorus.rotation.x = phaseTime * 0.48;

        // Update 4 Exploded Harmonic Tubes if in 'fourier-3d' mode
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
            const amp = harmAmps[h];
            const fMult = harmFreqs[h];
            for (let i = 0; i < NUM_WAVE_PTS; i++) {
              const u = i / (NUM_WAVE_PTS - 1);
              const x = START_X + u * SPAN_X;
              const hy =
                Math.sin(u * Math.PI * 2 * fMult * 1.5 - phaseTime * (0.65 + h * 0.25)) * amp;
              hPath[i].set(x, hy, zOff);
            }
            harmTubes[h] = MeshBuilder.CreateTube(`harmTube_${h}`, {
              path: hPath,
              radius: 0.032,
              instance: harmTubes[h],
            });
            harmLabelMeshes[h].position.z = zOff;
          }
        }
      }

      // 4. Update 64-Bin 3D FFT Spectrum Towers
      const specDb = liveSpectrumDbRef?.current;
      const dampFactor = 1 - Math.exp(-15 * dt);
      const peakDecay = dt * 0.85;

      for (let i = 0; i < NUM_BARS; i++) {
        let norm = 0.08;
        if (specDb && specDb.length > 0) {
          const srcIdx = Math.min(
            specDb.length - 1,
            Math.floor((i / (NUM_BARS - 1)) * (specDb.length - 1))
          );
          const rawDb = specDb[srcIdx] ?? -90;
          norm = Math.max(0.04, Math.min(1, (rawDb + 92) / 88));
        } else if (st.fallbackSpectrumMag && st.fallbackSpectrumMag.length > 0) {
          const srcIdx = Math.min(
            st.fallbackSpectrumMag.length - 1,
            Math.floor((i / (NUM_BARS - 1)) * (st.fallbackSpectrumMag.length - 1))
          );
          norm = Math.max(0.04, Math.min(1, (st.fallbackSpectrumMag[srcIdx] ?? 0) * 1.6));
        }

        const prevH = smoothHeights[i];
        const targetH = 0.14 + norm * 3.35;
        const h = prevH + (targetH - prevH) * dampFactor;
        smoothHeights[i] = h;

        const prevPeak = peakHolds[i];
        const nextPeak = h >= prevPeak ? h + 0.09 : Math.max(h + 0.05, prevPeak - peakDecay);
        peakHolds[i] = nextPeak;

        const isHovered = hoveredIdx === i;
        const bar = fftBars[i];
        const ped = fftPedestals[i];
        const peak = fftPeaks[i];

        if (isRadialFFT) {
          const angle = (i / NUM_BARS) * Math.PI * 2;
          const rad = 3.45;
          const x = Math.cos(angle) * rad;
          const z = Math.sin(angle) * rad;

          ped.position.set(x, -1.66, z);
          ped.rotation.y = -angle;

          bar.position.set(x, h * 0.5 - 1.63, z);
          bar.rotation.y = -angle;
          bar.scaling.set(isHovered ? 0.22 : 0.18, h, isHovered ? 0.22 : 0.18);

          peak.position.set(x, nextPeak - 1.55, z);
          peak.rotation.y = -angle;
        } else {
          const x = START_X + (i / (NUM_BARS - 1)) * SPAN_X;
          ped.position.set(x, -1.69, 0);
          ped.rotation.y = 0;

          bar.position.set(x, h * 0.5 - 1.66, 0);
          bar.rotation.y = 0;
          bar.scaling.set(isHovered ? 0.14 : 0.112, h, isHovered ? 0.27 : 0.22);

          peak.position.set(x, nextPeak - 1.58, 0);
          peak.rotation.y = 0;
        }

        const [r, g, b] = computeScientificRGB(norm, st.finishMode, isHovered ? 0.35 : 0);
        const bMat = fftBarMats[i];
        bMat.diffuseColor.set(r, g, b);
        bMat.emissiveColor.set(r * 0.55, g * 0.55, b * 0.55);

        const [pr, pg, pb] = computeScientificRGB(
          Math.min(1, norm + 0.22),
          st.finishMode,
          0.25
        );
        const pMat = fftPeakMats[i];
        pMat.diffuseColor.set(pr, pg, pb);
        pMat.emissiveColor.set(pr * 0.85, pg * 0.85, pb * 0.85);
      }

      // 5. Update 3D Waterfall Spectrogram Ribbon & Glowing Front Crest
      if (showWaterfall) {
        const matrix = specMatrixRef?.current;
        const liveRow = liveSpectrumDbRef?.current;

        if (matrix && matrix.length > 0) {
          const mCols = matrix.length;
          const mRows = matrix[0]?.length || 128;

          const isStaticPreview =
            mCols > 4 &&
            Math.abs((matrix[0]?.[20] ?? -90) - (matrix[mCols >> 1]?.[20] ?? -90)) < 0.01 &&
            Math.abs((matrix[0]?.[50] ?? -90) - (matrix[mCols - 1]?.[50] ?? -90)) < 0.01;

          for (let iz = 0; iz <= SEG_Z; iz++) {
            const rIdx = Math.min(mRows - 1, Math.floor((iz / SEG_Z) * (mRows - 1)));
            const zRatio = iz / SEG_Z;
            const zCoord = (zRatio - 0.5) * WF_DEPTH;
            const rowPath = wfPathArray[iz];

            for (let ix = 0; ix <= SEG_X; ix++) {
              const cIdx = Math.min(mCols - 1, Math.floor((ix / SEG_X) * (mCols - 1)));
              const xRatio = ix / SEG_X;
              const xCoord = (xRatio - 0.5) * WF_WIDTH;
              const db = matrix[cIdx]?.[rIdx] ?? -92;
              let norm = Math.max(0, Math.min(1, (db + 92) / 88));

              if (isStaticPreview) {
                const timeRipple =
                  0.84 + 0.16 * Math.sin(xRatio * Math.PI * 5 - wfTime + zRatio * 4);
                const subRidge =
                  0.08 *
                  Math.exp(-Math.pow((zRatio - 0.38) / 0.08, 2)) *
                  (0.6 + 0.4 * Math.cos(xRatio * Math.PI * 4 - wfTime));
                const highRidge =
                  0.05 *
                  Math.exp(-Math.pow((zRatio - 0.68) / 0.09, 2)) *
                  (0.6 + 0.4 * Math.sin(xRatio * Math.PI * 6 - wfTime * 1.2));
                norm = Math.min(1, norm * timeRipple + subRidge + highRidge);
              }

              const elev = Math.pow(norm, 1.08) * 2.15;
              rowPath[ix].set(xCoord, elev, zCoord);

              const vIdx = (iz * (SEG_X + 1) + ix) * 4;
              const [r, g, b] = computeScientificRGB(norm, st.finishMode);
              wfColors[vIdx] = r;
              wfColors[vIdx + 1] = g;
              wfColors[vIdx + 2] = b;
              wfColors[vIdx + 3] = 1.0;

              if (ix === SEG_X) {
                crestPath[iz].set(xCoord, elev + 0.03, zCoord);
              }
            }
          }
        } else {
          localWfHistory.shift();
          const nextCol = new Float32Array(SEG_Z + 1);
          for (let iz = 0; iz <= SEG_Z; iz++) {
            if (liveRow && liveRow.length > 0) {
              const rIdx = Math.min(
                liveRow.length - 1,
                Math.floor((iz / SEG_Z) * (liveRow.length - 1))
              );
              nextCol[iz] = liveRow[rIdx];
            } else {
              nextCol[iz] = -85;
            }
          }
          localWfHistory.push(nextCol);

          for (let iz = 0; iz <= SEG_Z; iz++) {
            const zCoord = (iz / SEG_Z - 0.5) * WF_DEPTH;
            const rowPath = wfPathArray[iz];
            for (let ix = 0; ix <= SEG_X; ix++) {
              const xCoord = (ix / SEG_X - 0.5) * WF_WIDTH;
              const db = localWfHistory[ix][iz];
              const norm = Math.max(0, Math.min(1, (db + 92) / 88));
              const elev = norm * 2.15;
              rowPath[ix].set(xCoord, elev, zCoord);

              const vIdx = (iz * (SEG_X + 1) + ix) * 4;
              const [r, g, b] = computeScientificRGB(norm, st.finishMode);
              wfColors[vIdx] = r;
              wfColors[vIdx + 1] = g;
              wfColors[vIdx + 2] = b;
              wfColors[vIdx + 3] = 1.0;

              if (ix === SEG_X) {
                crestPath[iz].set(xCoord, elev + 0.03, zCoord);
              }
            }
          }
        }

        waterfallRibbon = MeshBuilder.CreateRibbon('waterfallRibbon', {
          pathArray: wfPathArray,
          instance: waterfallRibbon,
        });
        waterfallRibbon.updateVerticesData(VertexBuffer.ColorKind, wfColors);

        frontCrestTube = MeshBuilder.CreateTube('frontCrestTube', {
          path: crestPath,
          radius: 0.036,
          instance: frontCrestTube,
        });
      }

      // 6. Update Arena Core TorusKnot in 'fft-arena' mode
      if (isRadialFFT) {
        torusKnot.rotation.y += dt * 0.95;
        torusKnot.rotation.x += dt * 0.55;
        arenaGyroRing.rotation.y -= dt * 1.15;
        arenaGyroRing.rotation.z += dt * 0.45;
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, [liveWaveformRef, liveSpectrumDbRef, specMatrixRef]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isFullscreen ? 'h-screen' : heightClass
      } rounded-2xl overflow-hidden border border-sky-500/25 shadow-2xl select-none bg-[#040814]`}
    >
      {/* Unified Non-Overlapping Top HUD Header Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Compact 3D Scene Mode Selector */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-slate-950/92 border border-slate-800/90 rounded-xl p-1 shadow-lg">
          {(
            [
              {
                id: 'all',
                label: 'All 3D',
                fa: 'همه سه‌بعدی',
                icon: Layers,
              },
              {
                id: 'fourier-3d',
                label: 'Signal & Harmonics',
                fa: 'مارپیچ و هارمونیک',
                icon: Activity,
              },
              {
                id: 'waterfall-3d',
                label: '3D Terrain',
                fa: 'توپوگرافی طیف',
                icon: Box,
              },
              {
                id: 'fft-arena',
                label: 'FFT Arena',
                fa: 'حلقه FFT',
                icon: BarChart3,
              },
            ] as {
              id: Scene3DMode;
              label: string;
              fa: string;
              icon: React.ComponentType<{ className?: string }>;
            }[]
          ).map((m) => {
            const Icon = m.icon;
            const active = sceneMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSceneMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{lang === 'fa' ? m.fa : m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center/Right Telemetry Readout on Hover + Camera Presets */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          {hoveredBar && (
            <button
              type="button"
              onClick={() => onPlayFrequencyTone?.(hoveredBar.freq, 550)}
              className="px-2.5 py-1 rounded-lg bg-slate-950/92 border border-sky-400/60 text-[11px] font-mono text-white flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Volume2 className="w-3 h-3 text-sky-400" />
              <span className="text-sky-400 font-bold">{formatHz(hoveredBar.freq)}</span>
              <span className="text-slate-500">|</span>
              <span className="text-[#7FD141]">{hoveredBar.db.toFixed(1)} dB</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1 bg-slate-950/92 border border-slate-800/90 rounded-xl p-1 shadow-lg">
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
                onClick={() => setCameraPreset(cam.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === cam.id
                    ? 'bg-[#7FD141] text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {lang === 'fa' ? cam.fa : cam.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-950/92 border border-slate-800/90 text-slate-200 hover:text-sky-400 cursor-pointer"
            title={lang === 'fa' ? 'تمام‌صفحه' : 'Fullscreen 3D'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Babylon.js Hardware-Accelerated WebGL2 Canvas with Native GlowLayer & Fresnel Shaders */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block outline-none cursor-grab active:cursor-grabbing"
      />

      {/* Compact Axis Legend Above Bottom Dock */}
      {!dockCollapsed && (
        <div className="hidden md:flex absolute bottom-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none items-center gap-3 px-3 py-1 rounded-full bg-slate-950/85 border border-slate-800/80 text-[10px] font-mono text-slate-300 shadow">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-sky-400 inline-block" />
            {lang === 'fa' ? 'X: محور زمان' : 'X: Time Axis'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#7FD141] inline-block" />
            {lang === 'fa' ? 'Y: دامنه (dB)' : 'Y: Amplitude / dB'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-amber-400 inline-block" />
            {lang === 'fa' ? 'Z: فرکانس و طیف' : 'Z: Log Frequency / Waterfall'}
          </span>
        </div>
      )}

      {/* Collapsible Single-Row Bottom Control Dock */}
      <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        {dockCollapsed ? (
          <div className="ml-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => setDockCollapsed(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-950/92 border border-slate-800 text-[11px] font-mono text-slate-200 hover:text-sky-400 flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span>{lang === 'fa' ? 'نمایش کنترل‌ها' : 'Show Controls'}</span>
            </button>
          </div>
        ) : (
          <div className="w-full pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-slate-950/92 border border-slate-800/90 rounded-xl px-3 py-2 shadow-xl">
            {/* Left: Audio & Signal Preset Quick Triggers */}
            <div className="flex flex-wrap items-center gap-1.5">
              {onTogglePlay && (
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isPlaying
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#7FD141] text-slate-950 font-bold'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>
                    {isPlaying
                      ? lang === 'fa'
                        ? 'توقف'
                        : 'Pause'
                      : lang === 'fa'
                      ? 'پخش سیگنال'
                      : 'Play Signal'}
                  </span>
                </button>
              )}

              {onToggleMic && (
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition-all cursor-pointer whitespace-nowrap ${
                    isMicActive
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-sky-400'
                  }`}
                >
                  {isMicActive ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>
                    {isMicActive
                      ? lang === 'fa'
                        ? 'قطع میکروفون'
                        : 'Stop Mic'
                      : lang === 'fa'
                      ? 'میکروفون'
                      : 'Mic'}
                  </span>
                </button>
              )}

              {onSelectPreset && (
                <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800">
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
                      className="px-2 py-1 rounded-md bg-slate-900 hover:bg-sky-500/20 text-[11px] font-mono text-slate-300 hover:text-sky-300 border border-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {lang === 'fa' ? p.fa : p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Shader Theme Switcher, Spread Slider, Wireframe, Auto-Orbit & Hide Dock */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                <Sparkles className="w-3 h-3 text-sky-400 ml-1.5 shrink-0" />
                {(
                  [
                    { id: 'studio-chrome', en: 'Cyber Cyan', fa: 'سایبری' },
                    { id: 'gold-obsidian', en: 'Gold', fa: 'طلایی' },
                    { id: 'bioluminescent', en: 'Bio-Neon', fa: 'بیو نئون' },
                  ] as { id: Finish3DMode; en: string; fa: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFinishMode(f.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                      finishMode === f.id
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === 'fa' ? f.fa : f.en}
                  </button>
                ))}
              </div>

              {(sceneMode === 'all' || sceneMode === 'fourier-3d') && (
                <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                  <span>{lang === 'fa' ? 'فاصله:' : 'Spread:'}</span>
                  <input
                    type="range"
                    min={0.6}
                    max={1.5}
                    step={0.05}
                    value={layerSpread}
                    onChange={(e) => setLayerSpread(Number(e.target.value))}
                    className="w-16 accent-sky-400 cursor-pointer"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setWireframe((w) => !w)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer whitespace-nowrap ${
                  wireframe
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {lang === 'fa' ? 'توری' : 'Wireframe'}
              </button>

              <button
                type="button"
                onClick={() => setAutoRotate((r) => !r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer whitespace-nowrap ${
                  autoRotate
                    ? 'bg-[#7FD141]/20 border-[#7FD141] text-[#7FD141]'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {lang === 'fa' ? 'چرخش' : 'Auto-Orbit'}
              </button>

              <button
                type="button"
                onClick={() => setDockCollapsed(true)}
                className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title={lang === 'fa' ? 'بستن نوار پایین' : 'Collapse Dock'}
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
