import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Grid, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Activity,
  BarChart3,
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';

export type Scene3DMode = 'all' | 'fourier-3d' | 'waterfall-3d' | 'fft-arena';

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

// Pre-allocated scratch objects for zero-GC 60fps render loops
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _vec3 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

const MIN_LOG_FREQ = 10;
const MAX_LOG_FREQ = 20000;

function binToFreqLog(binIdx: number, totalBins: number): number {
  const norm = Math.max(0, Math.min(1, binIdx / Math.max(1, totalBins - 1)));
  return MIN_LOG_FREQ * Math.pow(MAX_LOG_FREQ / MIN_LOG_FREQ, norm);
}

function formatHz(f: number): string {
  if (f >= 1000) {
    const k = f / 1000;
    return Number.isInteger(k) ? `${k}kHz` : `${k.toFixed(1)}kHz`;
  }
  return `${Math.round(f)}Hz`;
}

/** Scientific Viridis-Plasma color mapping for normalized amplitude [0..1] */
function setScientificColor(target: THREE.Color, norm: number, boost = 0) {
  const t = Math.max(0, Math.min(1, norm));
  if (t < 0.25) {
    const k = t / 0.25;
    target.setRGB(0.05 + k * 0.05, 0.18 + k * 0.38, 0.45 + k * 0.45);
  } else if (t < 0.55) {
    const k = (t - 0.25) / 0.3;
    target.setRGB(0.1 + k * 0.35, 0.56 + k * 0.32, 0.9 - k * 0.45);
  } else if (t < 0.82) {
    const k = (t - 0.55) / 0.27;
    target.setRGB(0.45 + k * 0.52, 0.88 - k * 0.12, 0.45 - k * 0.32);
  } else {
    const k = (t - 0.82) / 0.18;
    target.setRGB(0.97 + k * 0.03, 0.76 + k * 0.2, 0.13 + k * 0.65);
  }
  if (boost > 0) {
    target.offsetHSL(0, 0.1, boost * 0.22);
  }
}

/** Smooth Camera Preset Animator inside Canvas */
const CameraController: React.FC<{
  cameraPreset: 'iso' | 'time' | 'freq' | 'top';
  autoRotate: boolean;
  controlsRef: React.MutableRefObject<any>;
}> = ({ cameraPreset, autoRotate, controlsRef }) => {
  const { camera } = useThree();
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef(0);

  useEffect(() => {
    isTransitioningRef.current = true;
    transitionTimerRef.current = 0;
    if (cameraPreset === 'iso') {
      _targetCamPos.set(11.5, 8.2, 13.5);
      _targetLookAt.set(0, 0.8, 0);
    } else if (cameraPreset === 'time') {
      // Front orthographic-like view of Time vs Amplitude
      _targetCamPos.set(0, 2.2, 16.5);
      _targetLookAt.set(0, 0.8, 0);
    } else if (cameraPreset === 'freq') {
      // Side view looking straight down the Frequency Spectrum axis
      _targetCamPos.set(16.5, 2.6, 0);
      _targetLookAt.set(0, 0.8, 0);
    } else if (cameraPreset === 'top') {
      // Top-down Spectrogram view
      _targetCamPos.set(0.01, 18.5, 0.01);
      _targetLookAt.set(0, 0, 0);
    }
  }, [cameraPreset]);

  useFrame((_, delta) => {
    if (isTransitioningRef.current) {
      transitionTimerRef.current += delta;
      const alpha = Math.min(1, delta * 5.5);
      camera.position.lerp(_targetCamPos, alpha);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(_targetLookAt, alpha);
        controlsRef.current.update();
      }
      if (camera.position.distanceTo(_targetCamPos) < 0.08 || transitionTimerRef.current > 1.2) {
        isTransitioningRef.current = false;
      }
    } else if (controlsRef.current && autoRotate) {
      controlsRef.current.update();
    }
  });

  return null;
};

/**
 * 1. 3D Analytic Signal Helix + Time-Domain Wave + Harmonic Epicycle Planes
 * Shows:
 * - Main 3D Complex Phasor Spiral (Real = Y, Imaginary/Quadrature = Z, Time = X)
 * - Rotating Phasor Vector & Epicycle Ring at the left origin
 * - Decomposed Harmonic Sine Ribbons stacked in Z so users visually see Fourier decomposition
 */
const SignalFourier3DGroup: React.FC<{
  liveWaveformRef?: React.MutableRefObject<Float32Array>;
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  fallbackWave?: number[];
  fallbackFilteredWave?: number[];
  position: [number, number, number];
  scale?: number;
  layerSpread: number;
  showHarmonicPlanes: boolean;
}> = ({
  liveWaveformRef,
  liveSpectrumDbRef,
  fallbackWave,
  fallbackFilteredWave,
  position,
  scale = 1,
  layerSpread,
  showHarmonicPlanes,
}) => {
  const NUM_POINTS = 160;
  const NUM_HARMONICS = 4;

  // Dynamic Tube / Ribbon geometry for the main 3D waveform
  const mainLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(NUM_POINTS * 3);
    const colors = new Float32Array(NUM_POINTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  // Shadow projection on bottom plane (Time vs Quadrature)
  const shadowLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(NUM_POINTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  // 4 Harmonic component wave geometries stacked along Z
  const harmonicGeos = useMemo(() => {
    return Array.from({ length: NUM_HARMONICS }, () => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(NUM_POINTS * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return geo;
    });
  }, []);

  // Instanced spheres along the 3D analytic helix for tangible 3D depth
  const helixBeadsRef = useRef<THREE.InstancedMesh>(null);
  const phasorArmRef = useRef<THREE.Mesh>(null);
  const phasorTipRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (helixBeadsRef.current) {
      helixBeadsRef.current.frustumCulled = false;
    }
  }, []);

  useFrame((_, delta) => {
    phaseRef.current += delta * 2.8;
    const wave = liveWaveformRef?.current;
    const specDb = liveSpectrumDbRef?.current;

    const posAttr = mainLineGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = mainLineGeo.getAttribute('color') as THREE.BufferAttribute;
    const shadowAttr = shadowLineGeo.getAttribute('position') as THREE.BufferAttribute;

    const waveLen = wave && wave.length > 0 ? wave.length : fallbackWave?.length || 128;

    // Extract top 4 harmonic amplitudes from spectrum or synthesize defaults
    const harmAmps = [0.65, 0.32, 0.18, 0.12];
    const harmFreqs = [1, 2, 3, 5];
    if (specDb && specDb.length >= 64) {
      for (let h = 0; h < NUM_HARMONICS; h++) {
        const idx = Math.min(specDb.length - 1, 14 + h * 22);
        const norm = Math.max(0.08, Math.min(1, (specDb[idx] + 90) / 85));
        harmAmps[h] = norm * 0.75;
      }
    }

    const spanX = 9.0;
    const startX = -spanX * 0.5;

    for (let i = 0; i < NUM_POINTS; i++) {
      const u = i / (NUM_POINTS - 1);
      const x = startX + u * spanX;
      const sampleIdx = Math.min(waveLen - 1, Math.floor(u * (waveLen - 1)));
      const nextIdx = Math.min(waveLen - 1, sampleIdx + 3);

      let yVal = 0;
      let zQuadrature = 0;

      if (wave && wave.length > 0) {
        yVal = wave[sampleIdx] * 1.9;
        // Discrete quadrature approximation (90-degree phase shift derivative)
        const dy = (wave[nextIdx] - wave[sampleIdx]) * 3.2;
        zQuadrature = Math.max(-1.6, Math.min(1.6, dy));
      } else if (fallbackWave && fallbackWave.length > 0) {
        yVal = (fallbackWave[sampleIdx] ?? 0) * 1.1;
        const filt = fallbackFilteredWave?.[sampleIdx] ?? 0;
        zQuadrature = filt * 0.9;
      } else {
        const angle = u * Math.PI * 6 - phaseRef.current;
        yVal = Math.sin(angle) * 1.4;
        zQuadrature = Math.cos(angle) * 1.4;
      }

      posAttr.setXYZ(i, x, yVal, zQuadrature * 0.55);
      shadowAttr.setXYZ(i, x, -1.75, zQuadrature * 0.55);

      const normAmp = Math.min(1, Math.abs(yVal) / 1.8 + 0.25);
      setScientificColor(_color, normAmp);
      colAttr.setXYZ(i, _color.r, _color.g, _color.b);

      // Update 3D instanced beads along the signal curve (every 2nd point = 80 beads)
      if (helixBeadsRef.current && i % 2 === 0) {
        const beadIdx = i >> 1;
        _dummy.position.set(x, yVal, zQuadrature * 0.55);
        const s = 0.055 + Math.abs(yVal) * 0.035;
        _dummy.scale.set(s, s, s);
        _dummy.updateMatrix();
        helixBeadsRef.current.setMatrixAt(beadIdx, _dummy.matrix);
        helixBeadsRef.current.setColorAt(beadIdx, _color);
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    shadowAttr.needsUpdate = true;

    if (helixBeadsRef.current) {
      helixBeadsRef.current.instanceMatrix.needsUpdate = true;
      if (helixBeadsRef.current.instanceColor) {
        helixBeadsRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Update Phasor Wheel Vector at startX
    const y0 = posAttr.getY(0);
    const z0 = posAttr.getZ(0);
    const radius = Math.min(1.5, Math.hypot(y0, z0));
    const angle = Math.atan2(y0, z0);
    if (phasorArmRef.current) {
      phasorArmRef.current.position.set(startX, y0 * 0.5, z0 * 0.5);
      phasorArmRef.current.rotation.set(angle, 0, 0);
      phasorArmRef.current.scale.set(1, 1, Math.max(0.1, radius));
    }
    if (phasorTipRef.current) {
      phasorTipRef.current.position.set(startX, y0, z0);
    }

    // Update Decomposed Fourier Harmonic Planes
    if (showHarmonicPlanes) {
      for (let h = 0; h < NUM_HARMONICS; h++) {
        const hAttr = harmonicGeos[h].getAttribute('position') as THREE.BufferAttribute;
        const zOffset = -1.8 - (h + 1) * (0.95 * layerSpread);
        const amp = harmAmps[h];
        const freqMult = harmFreqs[h];

        for (let i = 0; i < NUM_POINTS; i++) {
          const u = i / (NUM_POINTS - 1);
          const x = startX + u * spanX;
          const y = Math.sin(u * Math.PI * 2 * freqMult - phaseRef.current * (0.6 + h * 0.25)) * amp;
          hAttr.setXYZ(i, x, y, zOffset);
        }
        hAttr.needsUpdate = true;
      }
    }
  });

  const harmonicColors = ['#38bdf8', '#7FD141', '#f59e0b', '#ec4899'];

  return (
    <group position={position} scale={scale}>
      {/* Phasor Epicycle Ring at Origin X = -4.5 */}
      <group position={[-4.5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <ringGeometry args={[1.18, 1.24, 48]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.55} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.58, 0.61, 36]} />
          <meshBasicMaterial color="#7FD141" side={THREE.DoubleSide} transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Rotating Phasor Vector Arm & Glowing Tip */}
      <mesh ref={phasorArmRef} position={[-4.5, 0, 0]}>
        <boxGeometry args={[0.04, 0.04, 1]} />
        <meshStandardMaterial color="#7FD141" emissive="#7FD141" emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={phasorTipRef} position={[-4.5, 0, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#7FD141" emissive="#7FD141" emissiveIntensity={1.2} />
      </mesh>

      {/* Main 3D Analytic Signal Curve */}
      <line geometry={mainLineGeo as any}>
        <lineBasicMaterial vertexColors linewidth={2} />
      </line>

      {/* 3D Instanced Beads along the Signal Helix */}
      <instancedMesh ref={helixBeadsRef} args={[undefined, undefined, NUM_POINTS >> 1]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial roughness={0.2} metalness={0.6} />
      </instancedMesh>

      {/* Bottom Shadow Projection of Signal */}
      <line geometry={shadowLineGeo as any}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.28} />
      </line>

      {/* Exploded Fourier Harmonic Wave Planes */}
      {showHarmonicPlanes &&
        harmonicGeos.map((geo, idx) => (
          <group key={idx}>
            <line geometry={geo as any}>
              <lineBasicMaterial
                color={harmonicColors[idx % harmonicColors.length]}
                transparent
                opacity={0.75}
              />
            </line>
          </group>
        ))}
    </group>
  );
};

/**
 * 2. 3D Interactive FFT Spectrum Pillars (Linear or Radial Cathedral)
 * Uses THREE.InstancedMesh with raycasting so clicking/hovering any 3D bar
 * inspects its exact Hz & dB and triggers Web Audio API tone playback!
 */
const FFTSpectrum3DPillars: React.FC<{
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  fallbackSpectrumMag?: number[];
  radialMode: boolean;
  position: [number, number, number];
  onPlayFrequencyTone?: (freqHz: number, durationMs?: number) => void;
}> = ({
  liveSpectrumDbRef,
  fallbackSpectrumMag,
  radialMode,
  position,
  onPlayFrequencyTone,
}) => {
  const NUM_BARS = 64;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    freq: number;
    db: number;
    pos: [number, number, number];
  } | null>(null);

  const smoothHeightsRef = useRef<Float32Array>(new Float32Array(NUM_BARS).fill(0.15));

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.frustumCulled = false;
    }
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const specDb = liveSpectrumDbRef?.current;
    const lerpFactor = Math.min(1, delta * 14);

    for (let i = 0; i < NUM_BARS; i++) {
      let norm = 0.08;
      let rawDb = -88;

      if (specDb && specDb.length > 0) {
        const srcIdx = Math.min(
          specDb.length - 1,
          Math.floor((i / (NUM_BARS - 1)) * (specDb.length - 1))
        );
        rawDb = specDb[srcIdx] ?? -90;
        norm = Math.max(0.05, Math.min(1, (rawDb + 92) / 88));
      } else if (fallbackSpectrumMag && fallbackSpectrumMag.length > 0) {
        const srcIdx = Math.min(
          fallbackSpectrumMag.length - 1,
          Math.floor((i / (NUM_BARS - 1)) * (fallbackSpectrumMag.length - 1))
        );
        norm = Math.max(0.05, Math.min(1, (fallbackSpectrumMag[srcIdx] ?? 0) * 1.6));
        rawDb = -90 + norm * 88;
      }

      const prevH = smoothHeightsRef.current[i];
      const targetH = 0.14 + norm * 3.6;
      const h = prevH + (targetH - prevH) * lerpFactor;
      smoothHeightsRef.current[i] = h;

      if (radialMode) {
        const angle = (i / NUM_BARS) * Math.PI * 2;
        const radius = 3.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        _dummy.position.set(x, h * 0.5 - 1.5, z);
        _dummy.rotation.set(0, -angle, 0);
        _dummy.scale.set(0.18, h, 0.18);
      } else {
        const span = 9.2;
        const x = -span * 0.5 + (i / (NUM_BARS - 1)) * span;
        _dummy.position.set(x, h * 0.5 - 1.6, 0);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(0.11, h, 0.22);
      }

      _dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, _dummy.matrix);

      const isHovered = hoveredBar?.index === i;
      setScientificColor(_color, norm, isHovered ? 0.35 : 0);
      meshRef.current.setColorAt(i, _color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId === undefined) return;
      const idx = e.instanceId;
      const freq = binToFreqLog(idx, NUM_BARS);
      const specDb = liveSpectrumDbRef?.current;
      const srcIdx = specDb
        ? Math.min(specDb.length - 1, Math.floor((idx / (NUM_BARS - 1)) * (specDb.length - 1)))
        : 0;
      const db = specDb ? specDb[srcIdx] ?? -80 : -20;
      const h = smoothHeightsRef.current[idx] || 1;

      if (radialMode) {
        const angle = (idx / NUM_BARS) * Math.PI * 2;
        setHoveredBar({
          index: idx,
          freq,
          db,
          pos: [Math.cos(angle) * 3.2, h - 1.2, Math.sin(angle) * 3.2],
        });
      } else {
        const span = 9.2;
        const x = -span * 0.5 + (idx / (NUM_BARS - 1)) * span;
        setHoveredBar({
          index: idx,
          freq,
          db,
          pos: [x, h - 1.2, 0],
        });
      }
    },
    [liveSpectrumDbRef, radialMode]
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId === undefined) return;
      const freq = binToFreqLog(e.instanceId, NUM_BARS);
      onPlayFrequencyTone?.(freq, 550);
    },
    [onPlayFrequencyTone]
  );

  return (
    <group position={position}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, NUM_BARS]}
        onPointerMove={handlePointerMove}
        onPointerOut={() => setHoveredBar(null)}
        onClick={handleClick}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.22} metalness={0.55} />
      </instancedMesh>

      {hoveredBar && (
        <Html position={hoveredBar.pos} center distanceFactor={14}>
          <div className="pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/90 border border-sky-400/60 text-[11px] font-mono text-white whitespace-nowrap shadow-xl">
            <span className="text-sky-400 font-bold">{formatHz(hoveredBar.freq)}</span>
            <span className="mx-1.5 text-slate-500">|</span>
            <span className="text-[#7FD141]">{hoveredBar.db.toFixed(1)} dB</span>
            <span className="ml-1.5 text-[10px] text-slate-400">(Click to hear)</span>
          </div>
        </Html>
      )}
    </group>
  );
};

/**
 * 3. 3D Real-Time Spectrogram Waterfall Terrain Mesh
 * Deforms a 3D grid surface where:
 * - X = Time Columns
 * - Z = Logarithmic Frequency Rows (10 Hz .. 20 kHz)
 * - Y = Amplitude (dB) Elevation with scientific vertex coloring
 */
const WaterfallSpectrogram3DMesh: React.FC<{
  specMatrixRef?: React.MutableRefObject<Float32Array[]>;
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  wireframe: boolean;
  position: [number, number, number];
  scale?: [number, number, number];
}> = ({ specMatrixRef, liveSpectrumDbRef, wireframe, position, scale = [1, 1, 1] }) => {
  const SEG_X = 56; // Time steps
  const SEG_Z = 44; // Log Frequency bins

  const meshRef = useRef<THREE.Mesh>(null);
  const localHistoryRef = useRef<Float32Array[]>(
    Array.from({ length: SEG_X + 1 }, () => new Float32Array(SEG_Z + 1).fill(-92))
  );

  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(9.2, 5.2, SEG_X, SEG_Z);
    geo.rotateX(-Math.PI / 2);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame(() => {
    const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = terrainGeo.getAttribute('color') as THREE.BufferAttribute;

    const matrix = specMatrixRef?.current;
    const liveRow = liveSpectrumDbRef?.current;

    // If specMatrixRef is provided from AudioSpectrogramPage, sample directly from it
    if (matrix && matrix.length > 0) {
      const mCols = matrix.length;
      const mRows = matrix[0]?.length || 128;

      for (let iz = 0; iz <= SEG_Z; iz++) {
        const rIdx = Math.min(mRows - 1, Math.floor((iz / SEG_Z) * (mRows - 1)));
        for (let ix = 0; ix <= SEG_X; ix++) {
          const cIdx = Math.min(mCols - 1, Math.floor((ix / SEG_X) * (mCols - 1)));
          const db = matrix[cIdx]?.[rIdx] ?? -92;
          const norm = Math.max(0, Math.min(1, (db + 92) / 88));
          const vertIdx = iz * (SEG_X + 1) + ix;

          const elevation = norm * 2.15;
          posAttr.setY(vertIdx, elevation);

          setScientificColor(_color, norm);
          colAttr.setXYZ(vertIdx, _color.r, _color.g, _color.b);
        }
      }
    } else {
      // Otherwise roll our own local waterfall history from liveSpectrumDbRef
      const hist = localHistoryRef.current;
      hist.shift();
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
      hist.push(nextCol);

      for (let iz = 0; iz <= SEG_Z; iz++) {
        for (let ix = 0; ix <= SEG_X; ix++) {
          const db = hist[ix][iz];
          const norm = Math.max(0, Math.min(1, (db + 92) / 88));
          const vertIdx = iz * (SEG_X + 1) + ix;
          posAttr.setY(vertIdx, norm * 2.15);
          setScientificColor(_color, norm);
          colAttr.setXYZ(vertIdx, _color.r, _color.g, _color.b);
        }
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    terrainGeo.computeVertexNormals();
  });

  return (
    <group position={position} scale={scale}>
      <mesh ref={meshRef} geometry={terrainGeo}>
        <meshStandardMaterial
          vertexColors
          roughness={0.35}
          metalness={0.25}
          wireframe={wireframe}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

/**
 * 4. 3D Audio-Reactive Harmonic Core Sculpture (TorusKnot / Morphing Icosahedron)
 * Placed at the center of the Radial FFT Arena or above the stage, reacting to
 * low/mid/high spectral energy and signal amplitude.
 */
const ReactiveSignalCore3D: React.FC<{
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  position: [number, number, number];
}> = ({ liveSpectrumDbRef, position }) => {
  const coreRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const specDb = liveSpectrumDbRef?.current;
    let bassNorm = 0.25;
    let highNorm = 0.2;

    if (specDb && specDb.length >= 64) {
      let bassSum = 0;
      let highSum = 0;
      for (let i = 2; i < 18; i++) bassSum += (specDb[i] + 92) / 88;
      for (let i = 40; i < 90; i++) highSum += (specDb[Math.min(specDb.length - 1, i)] + 92) / 88;
      bassNorm = Math.max(0.1, Math.min(1.2, bassSum / 16));
      highNorm = Math.max(0.1, Math.min(1.2, highSum / 50));
    }

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * (0.7 + highNorm * 1.8);
      coreRef.current.rotation.x += delta * (0.4 + bassNorm * 0.9);
      const targetScale = 0.65 + bassNorm * 0.55;
      _vec3.set(targetScale, targetScale, targetScale);
      coreRef.current.scale.lerp(_vec3, Math.min(1, delta * 10));
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= delta * 0.9;
      outerRingRef.current.rotation.x += delta * 0.5;
      const ringScale = 1.15 + highNorm * 0.4;
      _vec3.set(ringScale, ringScale, ringScale);
      outerRingRef.current.scale.lerp(_vec3, Math.min(1, delta * 8));
    }
  });

  return (
    <group position={position}>
      <mesh ref={coreRef}>
        <torusKnotGeometry args={[0.68, 0.2, 96, 24, 2, 3]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.45}
          roughness={0.18}
          metalness={0.75}
        />
      </mesh>
      <mesh ref={outerRingRef}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshBasicMaterial color="#7FD141" wireframe transparent opacity={0.32} />
      </mesh>
    </group>
  );
};

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
  darkMode = true,
  onTogglePlay,
  onToggleMic,
  onSelectPreset,
  onPlayFrequencyTone,
  heightClass = 'h-[480px] sm:h-[540px]',
}) => {
  const [sceneMode, setSceneMode] = useState<Scene3DMode>('all');
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'time' | 'freq' | 'top'>('iso');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [layerSpread, setLayerSpread] = useState(1.0);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);

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

  const bgColor = darkMode ? '#060c17' : '#0b1324';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isFullscreen ? 'h-screen' : heightClass
      } rounded-2xl overflow-hidden border border-sky-500/25 shadow-2xl select-none bg-[#060c17]`}
    >
      {/* Top-Left Minimal 3D Mode Pill Selector */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
        {(
          [
            {
              id: 'all',
              label: 'All 3D Objects',
              fa: 'نمایش کامل سه‌بعدی',
              icon: Layers,
            },
            {
              id: 'fourier-3d',
              label: '3D Signal & Harmonics',
              fa: 'مارپیچ سیگنال و هارمونیک‌ها',
              icon: Activity,
            },
            {
              id: 'waterfall-3d',
              label: '3D Spectrogram Terrain',
              fa: 'توپوگرافی سه‌بعدی طیف‌نگار',
              icon: Box,
            },
            {
              id: 'fft-arena',
              label: '3D FFT Spectrum Arena',
              fa: 'حلقه سه‌بعدی طیف FFT',
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                active
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-lg shadow-sky-500/25'
                  : 'bg-slate-900/85 text-slate-200 border border-slate-700/70 hover:border-sky-400/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? m.fa : m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Top-Right Camera Angle Quick Views + Fullscreen */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <div className="hidden sm:flex items-center gap-1 bg-slate-900/85 border border-slate-700/70 rounded-full p-1">
          {(
            [
              { id: 'iso', label: '3D Orbit', fa: 'سه‌بعدی' },
              { id: 'time', label: 'Time (X-Y)', fa: 'زمان' },
              { id: 'freq', label: 'FFT (Z-Y)', fa: 'فرکانس' },
              { id: 'top', label: 'Top Map', fa: 'از بالا' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => setCameraPreset(cam.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors cursor-pointer ${
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
          className="p-2 rounded-full bg-slate-900/85 border border-slate-700/70 text-slate-200 hover:text-sky-400 cursor-pointer"
          title={lang === 'fa' ? 'تمام‌صفحه' : 'Fullscreen 3D'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Interactive React Three Fiber 3D WebGL Canvas */}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [11.5, 8.2, 13.5], fov: 44, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 18, 42]} />

        {/* Studio & Scientific Rim Lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[10, 16, 12]} intensity={1.35} color="#ffffff" />
        <directionalLight position={[-12, 8, -10]} intensity={0.75} color="#38bdf8" />
        <pointLight position={[0, 5, 0]} intensity={0.9} color="#7FD141" distance={20} />

        <CameraController
          cameraPreset={cameraPreset}
          autoRotate={autoRotate}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          autoRotate={autoRotate}
          autoRotateSpeed={1.1}
          maxDistance={32}
          minDistance={3.5}
          maxPolarAngle={Math.PI * 0.85}
        />

        {/* Scientific Reference Floor Grid */}
        <Grid
          position={[0, -1.8, 0]}
          args={[24, 24]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={4}
          sectionThickness={1.1}
          sectionColor="#0284c7"
          fadeDistance={28}
          fadeStrength={1.2}
        />

        {/* MODE 1: ALL-IN-ONE 3D STAGE (Signal Helix + Harmonics + FFT Pillars + 3D Waterfall) */}
        {sceneMode === 'all' && (
          <group>
            {/* Front-Upper: 3D Analytic Signal Helix & Harmonic Decomposition */}
            <SignalFourier3DGroup
              liveWaveformRef={liveWaveformRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackWave={fallbackWave}
              fallbackFilteredWave={fallbackFilteredWave}
              position={[0, 1.35 * layerSpread, 2.8 * layerSpread]}
              scale={0.95}
              layerSpread={layerSpread}
              showHarmonicPlanes={true}
            />

            {/* Middle: 3D Interactive Logarithmic FFT Pillars */}
            <FFTSpectrum3DPillars
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackSpectrumMag={fallbackSpectrumMag}
              radialMode={false}
              position={[0, 0, 0.2]}
              onPlayFrequencyTone={onPlayFrequencyTone}
            />

            {/* Back-Floor: 3D Spectrogram Waterfall Landscape */}
            <WaterfallSpectrogram3DMesh
              specMatrixRef={specMatrixRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              wireframe={wireframe}
              position={[0, -1.75, -3.4 * layerSpread]}
              scale={[1, 0.95, 0.9]}
            />
          </group>
        )}

        {/* MODE 2: 3D SIGNAL & FOURIER HARMONIC DECOMPOSITION */}
        {sceneMode === 'fourier-3d' && (
          <group>
            <SignalFourier3DGroup
              liveWaveformRef={liveWaveformRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackWave={fallbackWave}
              fallbackFilteredWave={fallbackFilteredWave}
              position={[0, 0.4, 2.2]}
              scale={1.25}
              layerSpread={layerSpread * 1.15}
              showHarmonicPlanes={true}
            />
            <FFTSpectrum3DPillars
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackSpectrumMag={fallbackSpectrumMag}
              radialMode={false}
              position={[0, -0.2, -3.5]}
              onPlayFrequencyTone={onPlayFrequencyTone}
            />
          </group>
        )}

        {/* MODE 3: 3D SPECTROGRAM WATERFALL TERRAIN */}
        {sceneMode === 'waterfall-3d' && (
          <group>
            <WaterfallSpectrogram3DMesh
              specMatrixRef={specMatrixRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              wireframe={wireframe}
              position={[0, -1.5, 0]}
              scale={[1.35, 1.45, 1.55]}
            />
            <SignalFourier3DGroup
              liveWaveformRef={liveWaveformRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackWave={fallbackWave}
              fallbackFilteredWave={fallbackFilteredWave}
              position={[0, 2.4, 4.2]}
              scale={0.85}
              layerSpread={0.7}
              showHarmonicPlanes={false}
            />
          </group>
        )}

        {/* MODE 4: 3D RADIAL FFT SPECTRUM ARENA + REACTIVE CORE */}
        {sceneMode === 'fft-arena' && (
          <group>
            <FFTSpectrum3DPillars
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackSpectrumMag={fallbackSpectrumMag}
              radialMode={true}
              position={[0, -0.1, 0]}
              onPlayFrequencyTone={onPlayFrequencyTone}
            />
            <ReactiveSignalCore3D
              liveSpectrumDbRef={liveSpectrumDbRef}
              position={[0, 0.85, 0]}
            />
          </group>
        )}
      </Canvas>

      {/* Subtle 3D Axis Legend Badge (Bottom-Left) */}
      <div className="pointer-events-none absolute bottom-16 left-3 z-10 hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          X: {lang === 'fa' ? 'زمان (Time)' : 'Time'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#7FD141]" />
          Y: {lang === 'fa' ? 'دامنه / dB' : 'Amplitude / dB'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Z: {lang === 'fa' ? 'فرکانس / فاز' : 'Frequency / Phase'}
        </span>
      </div>

      {/* Collapsible Floating Bottom Dock for Instant Visual & Audio Control */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/90 border border-slate-700/80 rounded-2xl px-3.5 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-3 max-w-4xl w-full">
          {/* Left: Play / Mic / Quick Signal Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {onTogglePlay && (
              <button
                type="button"
                onClick={onTogglePlay}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#7FD141] text-slate-950'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>{lang === 'fa' ? 'مکث' : 'Pause'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{lang === 'fa' ? 'پخش زنده' : 'Play Signal'}</span>
                  </>
                )}
              </button>
            )}

            {onToggleMic && (
              <button
                type="button"
                onClick={onToggleMic}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                  isMicActive
                    ? 'bg-rose-500 text-white font-bold'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-400" />}
                <span className="hidden sm:inline">
                  {isMicActive
                    ? lang === 'fa'
                      ? 'توقف میکروفون'
                      : 'Stop Mic'
                    : lang === 'fa'
                    ? 'میکروفون'
                    : 'Mic'}
                </span>
              </button>
            )}

            {onSelectPreset && !dockCollapsed && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
                {[
                  { id: '100hz', label: 'Sine' },
                  { id: 'chirp', label: 'Chirp' },
                  { id: 'mixed', label: 'Harmonics' },
                  { id: 'speech', label: 'Speech' },
                  { id: 'random', label: 'Random' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPreset(p.id)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800/90 text-slate-300 hover:text-sky-400 hover:bg-slate-800 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: 3D Scene Controls (Wireframe, Auto-Rotate, Explode Layers) */}
          <div className="flex items-center gap-2">
            {!dockCollapsed && (
              <>
                <button
                  type="button"
                  onClick={() => setWireframe((w) => !w)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono cursor-pointer ${
                    wireframe
                      ? 'bg-sky-500/20 border border-sky-400 text-sky-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {lang === 'fa' ? 'شبکه (Wire)' : 'Wireframe'}
                </button>

                <button
                  type="button"
                  onClick={() => setAutoRotate((r) => !r)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono cursor-pointer ${
                    autoRotate
                      ? 'bg-[#7FD141]/20 border border-[#7FD141] text-[#7FD141]'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {lang === 'fa' ? 'چرخش خودکار' : 'Auto-Orbit'}
                </button>

                <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span>{lang === 'fa' ? 'فاصله لایه‌ها' : 'Spread'}</span>
                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={layerSpread}
                    onChange={(e) => setLayerSpread(Number(e.target.value))}
                    className="sci-slider w-16"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setDockCollapsed((c) => !c)}
              className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              title={dockCollapsed ? 'Expand controls' : 'Minimize controls'}
            >
              {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
