import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
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

export interface HoveredBarInfo {
  index: number;
  freq: number;
  db: number;
}

// Pre-allocated scratch objects for zero-GC 60fps render loops
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _vec3 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

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

/** Scientific Viridis-Plasma-Turbo color mapping for normalized amplitude [0..1] */
function setScientificColor(target: THREE.Color, norm: number, boost = 0) {
  const t = Math.max(0, Math.min(1, norm));
  if (t < 0.22) {
    const k = t / 0.22;
    target.setRGB(0.04 + k * 0.06, 0.14 + k * 0.36, 0.42 + k * 0.48);
  } else if (t < 0.52) {
    const k = (t - 0.22) / 0.3;
    target.setRGB(0.1 + k * 0.28, 0.5 + k * 0.38, 0.9 - k * 0.42);
  } else if (t < 0.8) {
    const k = (t - 0.52) / 0.28;
    target.setRGB(0.38 + k * 0.56, 0.88 - k * 0.1, 0.48 - k * 0.34);
  } else {
    const k = (t - 0.8) / 0.2;
    target.setRGB(0.94 + k * 0.06, 0.78 + k * 0.18, 0.14 + k * 0.68);
  }
  if (boost > 0) {
    target.offsetHSL(0, 0.12, boost * 0.24);
  }
}

/** Creates a crisp high-DPI 3D sprite texture for axis & harmonic labels without DOM portals */
function makeTextSpriteTexture(
  text: string,
  accentColor = '#38bdf8',
  bgColor = 'rgba(7, 12, 24, 0.88)'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(6, 8, 244, 48, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const LabelSprite3D: React.FC<{
  text: string;
  position: [number, number, number];
  color?: string;
  scale?: [number, number, number];
}> = ({ text, position, color = '#38bdf8', scale = [1.35, 0.34, 1] }) => {
  const tex = useMemo(() => makeTextSpriteTexture(text, color), [text, color]);
  useEffect(() => {
    return () => tex.dispose();
  }, [tex]);
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
};

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
      _targetCamPos.set(11.2, 7.6, 13.2);
      _targetLookAt.set(0, 0.4, -0.4);
    } else if (cameraPreset === 'time') {
      _targetCamPos.set(0, 1.8, 15.8);
      _targetLookAt.set(0, 0.5, 0);
    } else if (cameraPreset === 'freq') {
      _targetCamPos.set(15.8, 2.4, 0);
      _targetLookAt.set(0, 0.5, 0);
    } else if (cameraPreset === 'top') {
      _targetCamPos.set(0.01, 18.2, 0.01);
      _targetLookAt.set(0, 0, -0.5);
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
 * 1. Realistic 3D Volumetric Analytic Signal Helix + Curtain Ribbon + Decomposed Harmonic Tubes
 * Uses InstancedMesh 3D cylinders for continuous glossy volumetric tubes (zero WebGL 1px line limits or R3F <line> bugs!)
 */
const SignalFourier3DGroup: React.FC<{
  liveWaveformRef?: React.MutableRefObject<Float32Array>;
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  fallbackWave?: number[];
  fallbackFilteredWave?: number[];
  frequency?: number;
  waveType?: string;
  isPlaying?: boolean;
  position: [number, number, number];
  scale?: number;
  layerSpread: number;
  showHarmonicPlanes: boolean;
}> = ({
  liveWaveformRef,
  liveSpectrumDbRef,
  fallbackWave,
  fallbackFilteredWave,
  frequency = 440,
  waveType = 'sine',
  isPlaying = false,
  position,
  scale = 1,
  layerSpread,
  showHarmonicPlanes,
}) => {
  const NUM_POINTS = 140;
  const NUM_SEGMENTS = NUM_POINTS - 1;
  const NUM_HARMONICS = 4;

  const mainTubeInstRef = useRef<THREE.InstancedMesh>(null);
  const mainJointsInstRef = useRef<THREE.InstancedMesh>(null);
  const harm0InstRef = useRef<THREE.InstancedMesh>(null);
  const harm1InstRef = useRef<THREE.InstancedMesh>(null);
  const harm2InstRef = useRef<THREE.InstancedMesh>(null);
  const harm3InstRef = useRef<THREE.InstancedMesh>(null);

  const phasorArmRef = useRef<THREE.Mesh>(null);
  const phasorTipRef = useRef<THREE.Mesh>(null);
  const phasorRingGroupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);

  // Translucent vertical curtain geometry dropping from the 3D signal to the floor plane
  const curtainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(9.2, 2.0, NUM_POINTS - 1, 1);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useEffect(() => {
    [
      mainTubeInstRef,
      mainJointsInstRef,
      harm0InstRef,
      harm1InstRef,
      harm2InstRef,
      harm3InstRef,
    ].forEach((r) => {
      if (r.current) r.current.frustumCulled = false;
    });
    return () => {
      curtainGeo.dispose();
    };
  }, [curtainGeo]);

  // Scratch arrays for current frame 3D curve coordinates
  const ptsX = useMemo(() => new Float32Array(NUM_POINTS), []);
  const ptsY = useMemo(() => new Float32Array(NUM_POINTS), []);
  const ptsZ = useMemo(() => new Float32Array(NUM_POINTS), []);

  useFrame((_, delta) => {
    phaseRef.current += delta * (isPlaying ? 3.4 : 1.15);
    const wave = liveWaveformRef?.current;
    const specDb = liveSpectrumDbRef?.current;

    // Extract top 4 harmonic amplitudes from live spectrum
    const harmAmps = [0.68, 0.34, 0.21, 0.14];
    const harmFreqs = [1, 2, 3, 5];
    if (specDb && specDb.length >= 64) {
      for (let h = 0; h < NUM_HARMONICS; h++) {
        const idx = Math.min(specDb.length - 1, 12 + h * 24);
        const norm = Math.max(0.08, Math.min(1, (specDb[idx] + 92) / 86));
        harmAmps[h] = norm * 0.78;
      }
    }

    const spanX = 9.2;
    const startX = -spanX * 0.5;
    const floorY = -1.65;

    // Determine visual cycles so low frequencies (e.g. 20 Hz) still show 3.5 full 3D helical turns
    const visualCycles = Math.max(
      2.8,
      Math.min(7.5, 2.5 + Math.log10(Math.max(10, frequency) / 10) * 1.45)
    );

    const waveLen = wave && wave.length > 0 ? wave.length : fallbackWave?.length || 128;

    // Measure live waveform RMS so we know if live audio has strong multi-cycle variations
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

    for (let i = 0; i < NUM_POINTS; i++) {
      const u = i / (NUM_POINTS - 1);
      const x = startX + u * spanX;
      const sampleIdx = Math.min(waveLen - 1, Math.floor(u * (waveLen - 1)));
      const nextIdx = Math.min(waveLen - 1, sampleIdx + 4);

      const synthAngle = u * Math.PI * 2 * visualCycles - phaseRef.current;
      let synthY = Math.sin(synthAngle);
      let synthZ = Math.cos(synthAngle);

      if (waveType === 'square') {
        synthY = Math.tanh(Math.sin(synthAngle) * 3.5);
        synthZ = Math.tanh(Math.cos(synthAngle) * 3.5);
      } else if (waveType === 'sawtooth') {
        synthY =
          0.65 * Math.sin(synthAngle) -
          0.32 * Math.sin(2 * synthAngle) +
          0.18 * Math.sin(3 * synthAngle);
        synthZ =
          0.65 * Math.cos(synthAngle) -
          0.32 * Math.cos(2 * synthAngle) +
          0.18 * Math.cos(3 * synthAngle);
      } else if (waveType === 'chirp') {
        const chirpAngle = u * u * Math.PI * 10 - phaseRef.current;
        synthY = Math.sin(chirpAngle);
        synthZ = Math.cos(chirpAngle);
      }

      let yVal = 0;
      let zQuadrature = 0;

      if (wave && wave.length > 0 && frequency >= 160 && waveVariance > 0.25) {
        // Blend live acoustic buffer with smooth quadrature phase
        const rawY = wave[sampleIdx] * 1.65;
        const rawDy = (wave[nextIdx] - wave[sampleIdx]) * 2.8;
        yVal = rawY * 0.72 + synthY * 0.45;
        zQuadrature = Math.max(-1.35, Math.min(1.35, rawDy * 0.65 + synthZ * 0.45));
      } else if (fallbackWave && fallbackWave.length > 0) {
        yVal = (fallbackWave[sampleIdx] ?? 0) * 1.15;
        const filt = fallbackFilteredWave?.[sampleIdx] ?? 0;
        zQuadrature = filt * 0.95;
      } else {
        // Low frequency (e.g., 20Hz-150Hz) or paused preview: show full multi-cycle 3D analytic spiral
        const envMod = wave && wave.length > 0 ? 0.75 + 0.35 * Math.abs(wave[sampleIdx]) : 1.0;
        yVal = synthY * 1.18 * envMod;
        zQuadrature = synthZ * 0.92 * envMod;
      }

      ptsX[i] = x;
      ptsY[i] = yVal;
      ptsZ[i] = zQuadrature * 0.68;

      // Update glossy sphere joints along the main 3D signal conduit
      if (mainJointsInstRef.current) {
        _dummy.position.set(ptsX[i], ptsY[i], ptsZ[i]);
        const r = 0.052 + Math.abs(yVal) * 0.018;
        _dummy.scale.set(r, r, r);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        mainJointsInstRef.current.setMatrixAt(i, _dummy.matrix);

        const normAmp = Math.min(1, Math.abs(yVal) / 1.45 + 0.22);
        setScientificColor(_color, normAmp, 0.1);
        mainJointsInstRef.current.setColorAt(i, _color);
      }
    }

    // Update 3D Tube Segments connecting consecutive points (i -> i+1)
    if (mainTubeInstRef.current) {
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        _pA.set(ptsX[i], ptsY[i], ptsZ[i]);
        _pB.set(ptsX[i + 1], ptsY[i + 1], ptsZ[i + 1]);
        _mid.addVectors(_pA, _pB).multiplyScalar(0.5);
        _dir.subVectors(_pB, _pA);
        const len = _dir.length();
        if (len > 1e-5) {
          _dir.divideScalar(len);
          _quat.setFromUnitVectors(_up, _dir);
        }
        const radius = 0.046 + Math.abs(ptsY[i]) * 0.014;
        _dummy.position.copy(_mid);
        _dummy.quaternion.copy(_quat);
        _dummy.scale.set(radius, len * 1.04, radius);
        _dummy.updateMatrix();
        mainTubeInstRef.current.setMatrixAt(i, _dummy.matrix);

        const normAmp = Math.min(1, Math.abs(ptsY[i]) / 1.45 + 0.22);
        setScientificColor(_color, normAmp);
        mainTubeInstRef.current.setColorAt(i, _color);
      }
      mainTubeInstRef.current.instanceMatrix.needsUpdate = true;
      if (mainTubeInstRef.current.instanceColor) {
        mainTubeInstRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (mainJointsInstRef.current) {
      mainJointsInstRef.current.instanceMatrix.needsUpdate = true;
      if (mainJointsInstRef.current.instanceColor) {
        mainJointsInstRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Update Translucent Vertical Curtain Mesh (Top row = 3D wave, Bottom row = Floor projection)
    const cPos = curtainGeo.getAttribute('position') as THREE.BufferAttribute;
    const cCol = curtainGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < NUM_POINTS; i++) {
      // Top vertex
      cPos.setXYZ(i, ptsX[i], ptsY[i], ptsZ[i]);
      // Bottom vertex projected on floor
      cPos.setXYZ(NUM_POINTS + i, ptsX[i], floorY, ptsZ[i]);

      const normAmp = Math.min(1, Math.abs(ptsY[i]) / 1.45 + 0.2);
      setScientificColor(_color, normAmp);
      cCol.setXYZ(i, _color.r, _color.g, _color.b);
      cCol.setXYZ(NUM_POINTS + i, _color.r * 0.35, _color.g * 0.45, _color.b * 0.65);
    }
    cPos.needsUpdate = true;
    cCol.needsUpdate = true;

    // Update Phasor Gyroscope Vector at startX
    const y0 = ptsY[0];
    const z0 = ptsZ[0];
    if (phasorArmRef.current) {
      _pA.set(startX, 0, 0);
      _pB.set(startX, y0, z0);
      _mid.addVectors(_pA, _pB).multiplyScalar(0.5);
      _dir.subVectors(_pB, _pA);
      const len = Math.max(0.05, _dir.length());
      _dir.normalize();
      _quat.setFromUnitVectors(_up, _dir);
      phasorArmRef.current.position.copy(_mid);
      phasorArmRef.current.quaternion.copy(_quat);
      phasorArmRef.current.scale.set(0.045, len, 0.045);
    }
    if (phasorTipRef.current) {
      phasorTipRef.current.position.set(startX, y0, z0);
    }
    if (phasorRingGroupRef.current) {
      phasorRingGroupRef.current.rotation.x = phaseRef.current * 0.35;
    }

    // Update 4 Decomposed Fourier Harmonic 3D Tubes
    if (showHarmonicPlanes) {
      const harmRefs = [harm0InstRef, harm1InstRef, harm2InstRef, harm3InstRef];
      for (let h = 0; h < NUM_HARMONICS; h++) {
        const inst = harmRefs[h].current;
        if (!inst) continue;
        const zOffset = -1.75 - (h + 1) * (0.95 * layerSpread);
        const amp = harmAmps[h];
        const freqMult = harmFreqs[h];

        let prevX = startX;
        let prevY = Math.sin(-phaseRef.current * (0.65 + h * 0.25)) * amp;

        for (let i = 0; i < NUM_SEGMENTS; i++) {
          const uNext = (i + 1) / (NUM_POINTS - 1);
          const nextX = startX + uNext * spanX;
          const nextY =
            Math.sin(uNext * Math.PI * 2 * freqMult * 1.5 - phaseRef.current * (0.65 + h * 0.25)) *
            amp;

          _pA.set(prevX, prevY, zOffset);
          _pB.set(nextX, nextY, zOffset);
          _mid.addVectors(_pA, _pB).multiplyScalar(0.5);
          _dir.subVectors(_pB, _pA);
          const len = Math.max(0.001, _dir.length());
          _dir.divideScalar(len);
          _quat.setFromUnitVectors(_up, _dir);

          _dummy.position.copy(_mid);
          _dummy.quaternion.copy(_quat);
          _dummy.scale.set(0.028, len * 1.05, 0.028);
          _dummy.updateMatrix();
          inst.setMatrixAt(i, _dummy.matrix);

          prevX = nextX;
          prevY = nextY;
        }
        inst.instanceMatrix.needsUpdate = true;
      }
    }
  });

  const harmonicColors = ['#38bdf8', '#7FD141', '#f59e0b', '#ec4899'];
  const harmonicLabels = ['f₀ Fund.', '2f₀ Harm.', '3f₀ Harm.', '5f₀ Harm.'];

  return (
    <group position={position} scale={scale}>
      {/* 3D Metallic Phasor Epicycle Gyroscope at Origin X = -4.6 */}
      <group position={[-4.6, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <torusGeometry args={[1.22, 0.028, 16, 64]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.45}
            roughness={0.15}
            metalness={0.8}
            clearcoat={1}
          />
        </mesh>
        <group ref={phasorRingGroupRef}>
          <mesh>
            <torusGeometry args={[0.68, 0.018, 12, 48]} />
            <meshStandardMaterial
              color="#7FD141"
              emissive="#7FD141"
              emissiveIntensity={0.5}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
        </group>
        {/* Crosshair Axes inside Phasor Wheel */}
        <mesh>
          <cylinderGeometry args={[0.008, 0.008, 2.4, 8]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 2.4, 8]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Rotating Phasor Vector Arm & Glowing Tip */}
      <mesh ref={phasorArmRef} position={[-4.6, 0, 0]}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color="#7FD141" emissive="#7FD141" emissiveIntensity={0.9} />
      </mesh>
      <mesh ref={phasorTipRef} position={[-4.6, 0, 0]}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial color="#ffffff" emissive="#7FD141" emissiveIntensity={1.4} />
      </mesh>

      {/* Main 3D Volumetric Analytic Wave Conduit (Glossy Physical Tube Segments) */}
      <instancedMesh ref={mainTubeInstRef} args={[undefined, undefined, NUM_SEGMENTS]}>
        <cylinderGeometry args={[1, 1, 1, 12, 1, false]} />
        <meshPhysicalMaterial
          roughness={0.14}
          metalness={0.35}
          clearcoat={0.9}
          clearcoatRoughness={0.12}
        />
      </instancedMesh>

      {/* Smooth Glossy Nodes along the 3D Signal Helix */}
      <instancedMesh ref={mainJointsInstRef} args={[undefined, undefined, NUM_POINTS]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshPhysicalMaterial roughness={0.12} metalness={0.45} clearcoat={1} />
      </instancedMesh>

      {/* Translucent Vertical Signal Amplitude Curtain */}
      <mesh geometry={curtainGeo}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Exploded 3D Fourier Harmonic Tubes + 3D Labels */}
      {showHarmonicPlanes &&
        [harm0InstRef, harm1InstRef, harm2InstRef, harm3InstRef].map((ref, idx) => {
          const zOff = -1.75 - (idx + 1) * (0.95 * layerSpread);
          const col = harmonicColors[idx];
          return (
            <group key={idx}>
              <instancedMesh ref={ref} args={[undefined, undefined, NUM_SEGMENTS]}>
                <cylinderGeometry args={[1, 1, 1, 10]} />
                <meshStandardMaterial
                  color={col}
                  emissive={col}
                  emissiveIntensity={0.45}
                  roughness={0.22}
                  metalness={0.4}
                />
              </instancedMesh>
              <LabelSprite3D
                text={harmonicLabels[idx]}
                position={[4.95, 0.25, zOff]}
                color={col}
                scale={[1.15, 0.28, 1]}
              />
            </group>
          );
        })}
    </group>
  );
};

/**
 * 2. Realistic 3D Interactive FFT Spectrum Pillars with Floating Peak-Hold Caps
 * Clicking or hovering any 3D pillar inspects its exact Hz & dB and triggers Web Audio API tone playback!
 */
const FFTSpectrum3DPillars: React.FC<{
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  fallbackSpectrumMag?: number[];
  radialMode: boolean;
  position: [number, number, number];
  onPlayFrequencyTone?: (freqHz: number, durationMs?: number) => void;
  onHoverBar?: (info: HoveredBarInfo | null) => void;
}> = ({
  liveSpectrumDbRef,
  fallbackSpectrumMag,
  radialMode,
  position,
  onPlayFrequencyTone,
  onHoverBar,
}) => {
  const NUM_BARS = 64;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const peakCapsRef = useRef<THREE.InstancedMesh>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  const smoothHeightsRef = useRef<Float32Array>(new Float32Array(NUM_BARS).fill(0.18));
  const peakHoldRef = useRef<Float32Array>(new Float32Array(NUM_BARS).fill(0.24));

  useEffect(() => {
    if (meshRef.current) meshRef.current.frustumCulled = false;
    if (peakCapsRef.current) peakCapsRef.current.frustumCulled = false;
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const specDb = liveSpectrumDbRef?.current;
    const lerpFactor = Math.min(1, delta * 14);
    const peakDecay = delta * 0.85;

    for (let i = 0; i < NUM_BARS; i++) {
      let norm = 0.08;

      if (specDb && specDb.length > 0) {
        const srcIdx = Math.min(
          specDb.length - 1,
          Math.floor((i / (NUM_BARS - 1)) * (specDb.length - 1))
        );
        const rawDb = specDb[srcIdx] ?? -90;
        norm = Math.max(0.04, Math.min(1, (rawDb + 92) / 88));
      } else if (fallbackSpectrumMag && fallbackSpectrumMag.length > 0) {
        const srcIdx = Math.min(
          fallbackSpectrumMag.length - 1,
          Math.floor((i / (NUM_BARS - 1)) * (fallbackSpectrumMag.length - 1))
        );
        norm = Math.max(0.04, Math.min(1, (fallbackSpectrumMag[srcIdx] ?? 0) * 1.6));
      }

      const prevH = smoothHeightsRef.current[i];
      const targetH = 0.14 + norm * 3.55;
      const h = prevH + (targetH - prevH) * lerpFactor;
      smoothHeightsRef.current[i] = h;

      // Update floating peak-hold cap with realistic gravity decay
      const prevPeak = peakHoldRef.current[i];
      const nextPeak = h >= prevPeak ? h + 0.08 : Math.max(h + 0.05, prevPeak - peakDecay);
      peakHoldRef.current[i] = nextPeak;

      const isHovered = hoveredIndexRef.current === i;

      if (radialMode) {
        const angle = (i / NUM_BARS) * Math.PI * 2;
        const radius = 3.35;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        _dummy.position.set(x, h * 0.5 - 1.6, z);
        _dummy.rotation.set(0, -angle, 0);
        _dummy.scale.set(0.19, h, 0.19);
        _dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, _dummy.matrix);

        if (peakCapsRef.current) {
          _dummy.position.set(x, nextPeak - 1.54, z);
          _dummy.scale.set(0.2, 0.045, 0.2);
          _dummy.updateMatrix();
          peakCapsRef.current.setMatrixAt(i, _dummy.matrix);
        }
      } else {
        const span = 9.2;
        const x = -span * 0.5 + (i / (NUM_BARS - 1)) * span;
        _dummy.position.set(x, h * 0.5 - 1.65, 0);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(0.115, h, 0.24);
        _dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, _dummy.matrix);

        if (peakCapsRef.current) {
          _dummy.position.set(x, nextPeak - 1.58, 0);
          _dummy.scale.set(0.125, 0.045, 0.25);
          _dummy.updateMatrix();
          peakCapsRef.current.setMatrixAt(i, _dummy.matrix);
        }
      }

      setScientificColor(_color, norm, isHovered ? 0.35 : 0);
      meshRef.current.setColorAt(i, _color);
      if (peakCapsRef.current) {
        setScientificColor(_color, Math.min(1, norm + 0.22), 0.25);
        peakCapsRef.current.setColorAt(i, _color);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    if (peakCapsRef.current) {
      peakCapsRef.current.instanceMatrix.needsUpdate = true;
      if (peakCapsRef.current.instanceColor) {
        peakCapsRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId === undefined) return;
      const idx = e.instanceId;
      hoveredIndexRef.current = idx;
      const freq = binToFreqLog(idx, NUM_BARS);
      const specDb = liveSpectrumDbRef?.current;
      const srcIdx = specDb
        ? Math.min(specDb.length - 1, Math.floor((idx / (NUM_BARS - 1)) * (specDb.length - 1)))
        : 0;
      const db = specDb ? specDb[srcIdx] ?? -80 : -20;
      onHoverBar?.({ index: idx, freq, db });
    },
    [liveSpectrumDbRef, onHoverBar]
  );

  const handlePointerOut = useCallback(() => {
    hoveredIndexRef.current = null;
    onHoverBar?.(null);
  }, [onHoverBar]);

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
      {/* Main Glossy Metallic-Glass Spectrum Pillars */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, NUM_BARS]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          roughness={0.18}
          metalness={0.52}
          clearcoat={0.85}
          clearcoatRoughness={0.15}
        />
      </instancedMesh>

      {/* Glowing Peak-Hold Indicator Caps */}
      <instancedMesh ref={peakCapsRef} args={[undefined, undefined, NUM_BARS]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.1} metalness={0.3} emissive="#38bdf8" emissiveIntensity={0.35} />
      </instancedMesh>

      {/* Frequency Calibration Scale Labels on Floor */}
      {!radialMode && (
        <group position={[0, -1.68, 0.55]}>
          {[
            { x: -4.4, text: '20 Hz' },
            { x: -2.2, text: '150 Hz' },
            { x: 0.0, text: '1 kHz' },
            { x: 2.2, text: '5 kHz' },
            { x: 4.4, text: '20 kHz' },
          ].map((tk, i) => (
            <LabelSprite3D
              key={i}
              text={tk.text}
              position={[tk.x, 0, 0]}
              color="#0284c7"
              scale={[1.05, 0.26, 1]}
            />
          ))}
        </group>
      )}
    </group>
  );
};

/**
 * 3. Realistic 3D Spectrogram Waterfall Terrain Mesh with Contour Ridges & Glass Base Plinth
 * Deforms a high-resolution 3D surface where:
 * - X = Time Columns
 * - Z = Logarithmic Frequency Rows (10 Hz .. 20 kHz)
 * - Y = Amplitude (dB) Elevation with physical specular sheen & vertex coloring
 */
const WaterfallSpectrogram3DMesh: React.FC<{
  specMatrixRef?: React.MutableRefObject<Float32Array[]>;
  liveSpectrumDbRef?: React.MutableRefObject<Float32Array>;
  wireframe: boolean;
  isPlaying?: boolean;
  position: [number, number, number];
  scale?: [number, number, number];
}> = ({
  specMatrixRef,
  liveSpectrumDbRef,
  wireframe,
  isPlaying = false,
  position,
  scale = [1, 1, 1],
}) => {
  const SEG_X = 64; // Time columns
  const SEG_Z = 48; // Log Frequency rows

  const meshRef = useRef<THREE.Mesh>(null);
  const animTimeRef = useRef(0);
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

  useEffect(() => {
    return () => {
      terrainGeo.dispose();
    };
  }, [terrainGeo]);

  useFrame((_, delta) => {
    animTimeRef.current += delta * (isPlaying ? 2.6 : 0.9);
    const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = terrainGeo.getAttribute('color') as THREE.BufferAttribute;

    const matrix = specMatrixRef?.current;
    const liveRow = liveSpectrumDbRef?.current;

    if (matrix && matrix.length > 0) {
      const mCols = matrix.length;
      const mRows = matrix[0]?.length || 128;

      // Check if all columns in matrix are identical (static generator preview)
      const isStaticPreview =
        mCols > 4 &&
        Math.abs((matrix[0]?.[20] ?? -90) - (matrix[mCols >> 1]?.[20] ?? -90)) < 0.01 &&
        Math.abs((matrix[0]?.[50] ?? -90) - (matrix[mCols - 1]?.[50] ?? -90)) < 0.01;

      for (let iz = 0; iz <= SEG_Z; iz++) {
        const rIdx = Math.min(mRows - 1, Math.floor((iz / SEG_Z) * (mRows - 1)));
        const zRatio = iz / SEG_Z;

        for (let ix = 0; ix <= SEG_X; ix++) {
          const cIdx = Math.min(mCols - 1, Math.floor((ix / SEG_X) * (mCols - 1)));
          const xRatio = ix / SEG_X;
          const db = matrix[cIdx]?.[rIdx] ?? -92;
          let norm = Math.max(0, Math.min(1, (db + 92) / 88));

          // If static preview, add subtle travelling time-frequency ridge modulation + harmonic overtone ripples
          // so the 3D terrain looks like a living 3D waterfall topography rather than a flat extruded ramp
          if (isStaticPreview) {
            const timeRipple =
              0.84 + 0.16 * Math.sin(xRatio * Math.PI * 5 - animTimeRef.current + zRatio * 4);
            const subHarmonicRidge =
              0.08 *
              Math.exp(-Math.pow((zRatio - 0.38) / 0.08, 2)) *
              (0.6 + 0.4 * Math.cos(xRatio * Math.PI * 4 - animTimeRef.current));
            const highHarmonicRidge =
              0.05 *
              Math.exp(-Math.pow((zRatio - 0.68) / 0.09, 2)) *
              (0.6 + 0.4 * Math.sin(xRatio * Math.PI * 6 - animTimeRef.current * 1.2));
            norm = Math.min(1, norm * timeRipple + subHarmonicRidge + highHarmonicRidge);
          }

          const vertIdx = iz * (SEG_X + 1) + ix;
          const elevation = Math.pow(norm, 1.05) * 2.25;
          posAttr.setY(vertIdx, elevation);

          setScientificColor(_color, norm);
          colAttr.setXYZ(vertIdx, _color.r, _color.g, _color.b);
        }
      }
    } else {
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
          posAttr.setY(vertIdx, norm * 2.25);
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
      {/* Main Glossy Physical 3D Spectrogram Terrain Surface */}
      <mesh ref={meshRef} geometry={terrainGeo}>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.22}
          metalness={0.2}
          clearcoat={0.55}
          clearcoatRoughness={0.18}
          wireframe={wireframe}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Subtle Topographic Wireframe Overlay for Scientific Ridge Depth */}
      {!wireframe && (
        <mesh geometry={terrainGeo} position={[0, 0.008, 0]}>
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.09}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Solid Dark Glass Plinth / Stage Base under the Waterfall */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[9.3, 0.12, 5.3]} />
        <meshPhysicalMaterial
          color="#091326"
          roughness={0.2}
          metalness={0.7}
          clearcoat={0.8}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
};

/**
 * 4. 3D Audio-Reactive Harmonic Core Sculpture (TorusKnot + Morphing Icosahedron)
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
        <torusKnotGeometry args={[0.68, 0.2, 110, 28, 2, 3]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.45}
          roughness={0.14}
          metalness={0.75}
          clearcoat={1}
        />
      </mesh>
      <mesh ref={outerRingRef}>
        <icosahedronGeometry args={[1.08, 1]} />
        <meshBasicMaterial color="#7FD141" wireframe transparent opacity={0.35} />
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
  const [hoveredBar, setHoveredBar] = useState<HoveredBarInfo | null>(null);

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

  const bgColor = darkMode ? '#050a14' : '#081020';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isFullscreen ? 'h-screen' : heightClass
      } rounded-2xl overflow-hidden border border-sky-500/25 shadow-2xl select-none bg-[#050a14]`}
    >
      {/* Unified Non-Overlapping Top HUD Header Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Compact 3D Scene Mode Selector */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-slate-950/88 border border-slate-800/90 rounded-full p-1 shadow-lg">
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
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
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
              className="px-2.5 py-1 rounded-full bg-slate-950/90 border border-sky-400/60 text-[11px] font-mono text-white flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Volume2 className="w-3 h-3 text-sky-400" />
              <span className="text-sky-400 font-bold">{formatHz(hoveredBar.freq)}</span>
              <span className="text-slate-500">|</span>
              <span className="text-[#7FD141]">{hoveredBar.db.toFixed(1)} dB</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1 bg-slate-950/88 border border-slate-800/90 rounded-full p-1 shadow-lg">
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
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
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
            className="p-2 rounded-full bg-slate-950/88 border border-slate-800/90 text-slate-200 hover:text-sky-400 cursor-pointer"
            title={lang === 'fa' ? 'تمام‌صفحه' : 'Fullscreen 3D'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive React Three Fiber 3D WebGL Canvas */}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [11.2, 7.6, 13.2], fov: 43, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 18, 42]} />

        {/* Studio Multi-Point Scientific Lighting */}
        <ambientLight intensity={0.72} />
        <hemisphereLight args={['#38bdf8', '#091326', 0.65]} />
        <directionalLight position={[10, 16, 12]} intensity={1.55} color="#ffffff" />
        <directionalLight position={[-12, 9, -10]} intensity={0.85} color="#38bdf8" />
        <pointLight position={[0, 5.5, 2]} intensity={1.1} color="#7FD141" distance={22} />

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

        {/* Native Three.js Reference Floor Grid + Subtle Reflective Optical Stage */}
        <gridHelper args={[24, 24, '#0284c7', '#17253b']} position={[0, -1.78, 0]} />
        <mesh position={[0, -1.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[24, 24]} />
          <meshPhysicalMaterial
            color="#040812"
            roughness={0.25}
            metalness={0.65}
            clearcoat={0.7}
            transparent
            opacity={0.82}
          />
        </mesh>

        {/* MODE 1: ALL-IN-ONE 3D STAGE (Signal Helix + Harmonics + FFT Pillars + 3D Waterfall) */}
        {sceneMode === 'all' && (
          <group>
            {/* Front-Upper: 3D Volumetric Analytic Signal Helix & Harmonic Decomposition */}
            <SignalFourier3DGroup
              liveWaveformRef={liveWaveformRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackWave={fallbackWave}
              fallbackFilteredWave={fallbackFilteredWave}
              frequency={frequency}
              waveType={waveType}
              isPlaying={isPlaying}
              position={[0, 1.35 * layerSpread, 2.8 * layerSpread]}
              scale={0.95}
              layerSpread={layerSpread}
              showHarmonicPlanes={true}
            />

            {/* Middle: 3D Interactive Logarithmic FFT Pillars + Peak-Hold Caps */}
            <FFTSpectrum3DPillars
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackSpectrumMag={fallbackSpectrumMag}
              radialMode={false}
              position={[0, 0, 0.25]}
              onPlayFrequencyTone={onPlayFrequencyTone}
              onHoverBar={setHoveredBar}
            />

            {/* Back-Floor: 3D Spectrogram Waterfall Landscape */}
            <WaterfallSpectrogram3DMesh
              specMatrixRef={specMatrixRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              wireframe={wireframe}
              isPlaying={isPlaying}
              position={[0, -1.68, -3.5 * layerSpread]}
              scale={[1, 0.95, 0.92]}
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
              frequency={frequency}
              waveType={waveType}
              isPlaying={isPlaying}
              position={[0, 0.45, 2.2]}
              scale={1.22}
              layerSpread={layerSpread * 1.15}
              showHarmonicPlanes={true}
            />
            <FFTSpectrum3DPillars
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackSpectrumMag={fallbackSpectrumMag}
              radialMode={false}
              position={[0, -0.1, -3.5]}
              onPlayFrequencyTone={onPlayFrequencyTone}
              onHoverBar={setHoveredBar}
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
              isPlaying={isPlaying}
              position={[0, -1.5, 0]}
              scale={[1.35, 1.45, 1.55]}
            />
            <SignalFourier3DGroup
              liveWaveformRef={liveWaveformRef}
              liveSpectrumDbRef={liveSpectrumDbRef}
              fallbackWave={fallbackWave}
              fallbackFilteredWave={fallbackFilteredWave}
              frequency={frequency}
              waveType={waveType}
              isPlaying={isPlaying}
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
              onHoverBar={setHoveredBar}
            />
            <ReactiveSignalCore3D
              liveSpectrumDbRef={liveSpectrumDbRef}
              position={[0, 0.85, 0]}
            />
          </group>
        )}
      </Canvas>

      {/* Collapsible Floating Bottom Dock (Includes Axis Legend & Audio/3D Controls with Zero Overlap) */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
        {!dockCollapsed && (
          <div className="hidden md:flex items-center gap-4 px-3.5 py-1 rounded-full bg-slate-950/85 border border-slate-800/80 text-[10px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              X: {lang === 'fa' ? 'زمان (Time)' : 'Time Axis'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7FD141]" />
              Y: {lang === 'fa' ? 'دامنه / dB' : 'Amplitude / dB'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Z: {lang === 'fa' ? 'فرکانس / هارمونیک‌ها' : 'Log Frequency / Harmonics'}
            </span>
          </div>
        )}

        <div className="pointer-events-auto bg-slate-950/92 border border-slate-800 rounded-2xl px-3.5 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-2.5 max-w-4xl w-full">
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
                {isMicActive ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-rose-400" />
                )}
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
              <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
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
                    className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-900 text-slate-300 hover:text-sky-400 hover:bg-slate-800 cursor-pointer"
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
                      : 'bg-slate-900 text-slate-300'
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
                      : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  {lang === 'fa' ? 'چرخش خودکار' : 'Auto-Orbit'}
                </button>

                <div
                  dir="ltr"
                  className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-slate-400"
                >
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
              className="p-1.5 rounded-full bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
              title={dockCollapsed ? 'Expand controls' : 'Minimize controls'}
            >
              {dockCollapsed ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
