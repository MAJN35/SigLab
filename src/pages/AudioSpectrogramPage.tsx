import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AudioLines,
  BoxSelect,
  Info,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useLab } from '../store/LabContext';

export type LiveWaveType =
  | 'sine'
  | 'square'
  | 'triangle'
  | 'sawtooth'
  | 'white-noise'
  | 'pink-noise'
  | 'chirp'
  | 'pulse'
  | 'am-fm'
  | 'speech-synth'
  | 'musical'
  | 'mixed';

export type VisualizationTab = 'combined' | 'spectrogram' | 'waveform' | 'spectrum';
export type SpectrogramInteractMode = 'click-tone' | 'box-select';

export interface MixLayer {
  id: string;
  type: 'sine' | 'square' | 'triangle' | 'sawtooth' | 'white-noise' | 'pink-noise';
  frequency: number;
  amplitude: number;
  enabled: boolean;
}

interface SelectedPoint {
  time: number;
  frequency: number;
  magnitudeDb: number;
  normX: number;
  normY: number;
}

interface SelectedRegion {
  t1: number;
  t2: number;
  f1: number;
  f2: number;
  peakDb: number;
  meanDb: number;
}

const WAVE_OPTIONS: { id: LiveWaveType; label: string; faLabel: string }[] = [
  { id: 'sine', label: 'Sine Wave', faLabel: 'موج سینوسی (Sine)' },
  { id: 'square', label: 'Square Wave', faLabel: 'موج مربعی (Square)' },
  { id: 'triangle', label: 'Triangle Wave', faLabel: 'موج مثلثی (Triangle)' },
  { id: 'sawtooth', label: 'Sawtooth Wave', faLabel: 'موج دندان‌اره‌ای (Sawtooth)' },
  { id: 'white-noise', label: 'White Noise', faLabel: 'نویز سفید (White Noise)' },
  { id: 'pink-noise', label: 'Pink Noise (1/f)', faLabel: 'نویز صورتی (Pink Noise)' },
  { id: 'chirp', label: 'Chirp / Sweep', faLabel: 'جاروب فرکانسی (Chirp)' },
  { id: 'pulse', label: 'Pulse Train', faLabel: 'قطار پالس (Pulse)' },
  { id: 'am-fm', label: 'AM / FM Modulated', faLabel: 'سیگنال مدوله‌شده AM/FM' },
  { id: 'speech-synth', label: 'Speech Formants', faLabel: 'فرمانت‌های شبه‌گفتار' },
  { id: 'musical', label: 'Musical Harmonic', faLabel: 'آکورد موسیقی هارمونیک' },
  { id: 'mixed', label: 'Custom Mixed Signal', faLabel: 'سیگنال ترکیبی سفارشی' },
];

// Viridis / Inferno-inspired scientific colormap for dB values in [-100, 0]
function dbToRgb(db: number): [number, number, number] {
  const norm = Math.max(0, Math.min(1, (db + 95) / 95));
  if (norm < 0.2) {
    const t = norm / 0.2;
    return [Math.round(5 + t * 15), Math.round(9 + t * 22), Math.round(18 + t * 65)];
  }
  if (norm < 0.45) {
    const t = (norm - 0.2) / 0.25;
    return [Math.round(20 + t * 10), Math.round(31 + t * 110), Math.round(83 + t * 115)];
  }
  if (norm < 0.7) {
    const t = (norm - 0.45) / 0.25;
    return [Math.round(30 + t * 150), Math.round(141 + t * 80), Math.round(198 - t * 90)];
  }
  if (norm < 0.9) {
    const t = (norm - 0.7) / 0.2;
    return [Math.round(180 + t * 70), Math.round(221 - t * 40), Math.round(108 - t * 75)];
  }
  const t = (norm - 0.9) / 0.1;
  return [255, Math.round(181 + t * 74), Math.round(33 + t * 200)];
}

// Precomputed 256-level RGB Lookup Table for ultra-fast ImageData spectrogram rendering
const COLOR_LUT = new Uint8Array(256 * 3);
for (let i = 0; i < 256; i++) {
  const db = -95 + (i / 255) * 95;
  const [r, g, b] = dbToRgb(db);
  COLOR_LUT[i * 3] = r;
  COLOR_LUT[i * 3 + 1] = g;
  COLOR_LUT[i * 3 + 2] = b;
}

export const AudioSpectrogramPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { lang } = useLab();

  // Generator & Audio state
  const [sourceMode, setSourceMode] = useState<'generator' | 'uploaded'>('generator');
  const [waveType, setWaveType] = useState<LiveWaveType>('sine');
  const [frequency, setFrequency] = useState<number>(20);
  const [sweepEndFreq, setSweepEndFreq] = useState<number>(800);
  const [amplitude, setAmplitude] = useState<number>(0.5);
  const [durationSec, setDurationSec] = useState<number>(8);
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [fftSize, setFftSize] = useState<number>(4096);
  const [maxFreqDisplay, setMaxFreqDisplay] = useState<number>(20000);

  // Custom Mixed Signal layers (default: 20 Hz sine + 100 Hz sine + white noise)
  const [mixLayers, setMixLayers] = useState<MixLayer[]>([
    { id: 'm1', type: 'sine', frequency: 20, amplitude: 0.5, enabled: true },
    { id: 'm2', type: 'sine', frequency: 100, amplitude: 0.35, enabled: true },
    { id: 'm3', type: 'white-noise', frequency: 0, amplitude: 0.08, enabled: true },
  ]);

  // Playback Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(8);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Visualization & Interaction state
  const [vizTab, setVizTab] = useState<VisualizationTab>('combined');
  const [interactMode, setInteractMode] = useState<SpectrogramInteractMode>('click-tone');
  const [scrollingWaterfall, setScrollingWaterfall] = useState<boolean>(true);
  const [autoPlayClick, setAutoPlayClick] = useState<boolean>(true);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    time: number;
    frequency: number;
    magnitudeDb: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>({
    time: 2.4,
    frequency: 20,
    magnitudeDb: -6.2,
    normX: 0.3,
    normY: 20 / 20000,
  });
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [dragBox, setDragBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [isSonifying, setIsSonifying] = useState<boolean>(false);

  // Web Audio & Canvas Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeBufferRef = useRef<AudioBuffer | null>(null);
  const uploadedBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Continuous click-drag tone oscillator ref
  const previewOscRef = useRef<OscillatorNode | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);
  const isPointerDownRef = useRef<boolean>(false);

  // Canvases & Spectrogram Matrix History
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenSpecCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenImageDataRef = useRef<ImageData | null>(null);
  const lastUiTimeUpdateRef = useRef<number>(0);

  // Store 180 time columns x 128 frequency rows of dB values [-95..0] for ultra-fast rendering
  const SPEC_COLS = 180;
  const SPEC_ROWS = 128;
  const specMatrixRef = useRef<Float32Array[]>(
    Array.from({ length: SPEC_COLS }, () => new Float32Array(SPEC_ROWS).fill(-95))
  );
  const specTimesRef = useRef<Float32Array>(
    Float32Array.from({ length: SPEC_COLS }, (_, i) => (i / SPEC_COLS) * 8)
  );
  const liveWaveSliceRef = useRef<Float32Array>(new Float32Array(512));
  const liveSpecRowRef = useRef<Float32Array>(new Float32Array(SPEC_ROWS).fill(-95));

  const getOrCreateAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Fast raw Float32Array synthesizer (can synthesize a tiny 4096-sample preview in <0.05ms or full playback buffer)
  const synthesizeRawSamples = useCallback(
    (
      numSamples: number,
      type: LiveWaveType,
      freq: number,
      endFreq: number,
      amp: number,
      dur: number,
      fs: number,
      layers: MixLayer[]
    ): Float32Array => {
      const safeFs = Math.max(8000, Math.min(48000, fs));
      const data = new Float32Array(numSamples);

      // Pink noise state variables (Paul Kellet's filter)
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;

      for (let i = 0; i < numSamples; i++) {
        const t = i / safeFs;
        let sample = 0;

        if (type === 'sine') {
          sample = amp * Math.sin(2 * Math.PI * freq * t);
        } else if (type === 'square') {
          sample = amp * (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1);
        } else if (type === 'triangle') {
          sample =
            ((2 * amp) / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
        } else if (type === 'sawtooth') {
          sample = 2 * amp * (t * freq - Math.floor(0.5 + t * freq));
        } else if (type === 'white-noise') {
          sample = amp * (Math.random() * 2 - 1);
        } else if (type === 'pink-noise') {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
          b6 = white * 0.115926;
          sample = amp * pink;
        } else if (type === 'chirp') {
          const k = (endFreq - freq) / Math.max(0.1, dur);
          const phase = 2 * Math.PI * (freq * t + 0.5 * k * t * t);
          sample = amp * Math.sin(phase);
        } else if (type === 'pulse') {
          const cyclePos = (t * freq) % 1;
          sample = cyclePos < 0.15 ? amp : -amp * 0.15;
        } else if (type === 'am-fm') {
          const mod = Math.sin(2 * Math.PI * 6 * t);
          const instPhase = 2 * Math.PI * freq * t + 4 * Math.sin(2 * Math.PI * 4 * t);
          sample = amp * (0.65 + 0.35 * mod) * Math.sin(instPhase);
        } else if (type === 'speech-synth') {
          // Fundamental glottal pitch + 3 vowel formants (F1=500Hz, F2=1500Hz, F3=2500Hz)
          const f0 = Math.max(80, Math.min(300, freq));
          const env = 0.6 + 0.4 * Math.sin(2 * Math.PI * 3.2 * t);
          sample =
            amp *
            env *
            (0.45 * Math.sin(2 * Math.PI * f0 * t) +
              0.3 * Math.sin(2 * Math.PI * 520 * t) +
              0.18 * Math.sin(2 * Math.PI * 1480 * t) +
              0.08 * Math.sin(2 * Math.PI * 2460 * t));
        } else if (type === 'musical') {
          // Major triad chord + octave with gentle vibrato
          const fRoot = Math.max(55, freq);
          sample =
            amp *
            0.35 *
            (Math.sin(2 * Math.PI * fRoot * t) +
              0.8 * Math.sin(2 * Math.PI * fRoot * 1.25 * t) +
              0.7 * Math.sin(2 * Math.PI * fRoot * 1.5 * t) +
              0.4 * Math.sin(2 * Math.PI * fRoot * 2.0 * t));
        } else if (type === 'mixed') {
          let sum = 0;
          for (const lyr of layers) {
            if (!lyr.enabled) continue;
            if (lyr.type === 'sine') {
              sum += lyr.amplitude * Math.sin(2 * Math.PI * lyr.frequency * t);
            } else if (lyr.type === 'square') {
              sum +=
                lyr.amplitude *
                (Math.sin(2 * Math.PI * lyr.frequency * t) >= 0 ? 1 : -1);
            } else if (lyr.type === 'triangle') {
              sum +=
                ((2 * lyr.amplitude) / Math.PI) *
                Math.asin(Math.sin(2 * Math.PI * lyr.frequency * t));
            } else if (lyr.type === 'sawtooth') {
              sum +=
                2 *
                lyr.amplitude *
                (t * lyr.frequency - Math.floor(0.5 + t * lyr.frequency));
            } else if (lyr.type === 'white-noise') {
              sum += lyr.amplitude * (Math.random() * 2 - 1);
            } else if (lyr.type === 'pink-noise') {
              const w = Math.random() * 2 - 1;
              b0 = 0.99886 * b0 + w * 0.0555179;
              b1 = 0.99332 * b1 + w * 0.0750759;
              sum += lyr.amplitude * ((b0 + b1 + w * 0.2) * 0.15);
            }
          }
          sample = Math.max(-0.98, Math.min(0.98, sum));
        }

        data[i] = sample;
      }

      return data;
    },
    []
  );

  // Build Web Audio AudioBuffer only when needed for actual speaker playback
  const buildSynthesizedBuffer = useCallback(
    (
      ctx: AudioContext,
      type: LiveWaveType,
      freq: number,
      endFreq: number,
      amp: number,
      dur: number,
      fs: number,
      layers: MixLayer[]
    ): AudioBuffer => {
      const safeFs = Math.max(8000, Math.min(48000, fs));
      const effectiveDur = type === 'chirp' ? Math.min(5, dur) : 2.0;
      const numSamples = Math.max(safeFs, Math.round(safeFs * effectiveDur));
      const raw = synthesizeRawSamples(
        numSamples,
        type,
        freq,
        endFreq,
        amp,
        effectiveDur,
        safeFs,
        layers
      );
      const buffer = ctx.createBuffer(1, numSamples, safeFs);
      buffer.getChannelData(0).set(raw);
      return buffer;
    },
    [synthesizeRawSamples]
  );

  // Compute exact windowed spectral magnitude (in dB) across 0..maxFreq (up to 20 kHz) using radix-2 2048-pt FFT
  const computeSliceSpectrumDb = useCallback(
    (
      channelData: Float32Array,
      fs: number,
      centerSample: number,
      maxFreq: number,
      numRows: number
    ): Float32Array => {
      const out = new Float32Array(numRows).fill(-95);
      const N = 2048;
      const half = N >> 1;
      const start = Math.max(0, Math.min(Math.max(0, channelData.length - N), centerSample - half));

      const re = new Float32Array(N);
      const im = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const sample = channelData[start + i] ?? 0;
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        re[i] = sample * w;
      }

      // Bit-reversal permutation
      let j = 0;
      for (let i = 0; i < N; i++) {
        if (i < j) {
          const tr = re[i];
          re[i] = re[j];
          re[j] = tr;
        }
        let m = N >> 1;
        while (m >= 1 && j >= m) {
          j -= m;
          m >>= 1;
        }
        j += m;
      }

      // Cooley-Tukey radix-2 butterflies
      for (let len = 2; len <= N; len <<= 1) {
        const halfLen = len >> 1;
        const ang = (-2 * Math.PI) / len;
        const wCos = Math.cos(ang);
        const wSin = Math.sin(ang);
        for (let i = 0; i < N; i += len) {
          let uCos = 1;
          let uSin = 0;
          for (let k = 0; k < halfLen; k++) {
            const evenIdx = i + k;
            const oddIdx = i + k + halfLen;
            const tr = uCos * re[oddIdx] - uSin * im[oddIdx];
            const ti = uCos * im[oddIdx] + uSin * re[oddIdx];
            re[oddIdx] = re[evenIdx] - tr;
            im[oddIdx] = im[evenIdx] - ti;
            re[evenIdx] += tr;
            im[evenIdx] += ti;
            const nextCos = uCos * wCos - uSin * wSin;
            uSin = uCos * wSin + uSin * wCos;
            uCos = nextCos;
          }
        }
      }

      const binDb = new Float32Array(half);
      const scale = 4 / N;
      for (let k = 0; k < half; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * scale;
        binDb[k] = Math.max(-95, Math.min(0, 20 * Math.log10(Math.max(1e-5, mag))));
      }

      // Map FFT bins into spectrogram rows (taking peak dB within each row's frequency band)
      for (let r = 0; r < numRows; r++) {
        const fLow = (r / numRows) * maxFreq;
        const fHigh = ((r + 1) / numRows) * maxFreq;
        const k0 = Math.max(1, Math.min(half - 1, Math.floor((fLow * N) / fs)));
        const k1 = Math.max(k0, Math.min(half - 1, Math.ceil((fHigh * N) / fs)));
        let peak = -95;
        for (let k = k0; k <= k1; k++) {
          if (binDb[k] > peak) peak = binDb[k];
        }
        out[r] = peak;
      }

      return out;
    },
    []
  );

  // Precompute spectrogram matrix using fast keyframe evaluation (< 1ms for generator, < 3ms for uploaded)
  const precomputeBufferSpectrogram = useCallback(
    (buf: AudioBuffer, maxFreq: number, isTimeVarying = false) => {
      const ch = buf.getChannelData(0);
      const fs = buf.sampleRate;
      const dur = buf.duration;
      const cols: Float32Array[] = new Array(SPEC_COLS);
      const times = new Float32Array(SPEC_COLS);

      // For stationary generator signals, compute only 4 keyframes; for chirp/uploaded audio, compute 36 keyframes
      const numKeyframes = isTimeVarying ? 36 : 4;
      const keyframes: Float32Array[] = new Array(numKeyframes);
      for (let k = 0; k < numKeyframes; k++) {
        const ratio = k / Math.max(1, numKeyframes - 1);
        const centerIdx = Math.floor(ratio * Math.max(0, ch.length - 1));
        keyframes[k] = computeSliceSpectrumDb(ch, fs, centerIdx, maxFreq, SPEC_ROWS);
      }

      for (let c = 0; c < SPEC_COLS; c++) {
        const ratio = c / Math.max(1, SPEC_COLS - 1);
        times[c] = ratio * dur;
        const kfIdx = isTimeVarying
          ? Math.min(numKeyframes - 1, Math.floor(ratio * numKeyframes))
          : c % numKeyframes;
        cols[c] = keyframes[kfIdx];
      }
      specMatrixRef.current = cols;
      specTimesRef.current = times;

      // Also populate initial waveform & spectrum slice at current pauseOffset
      const sampleCenter = Math.floor(
        (Math.min(pauseOffsetRef.current, dur) / Math.max(0.01, dur)) * (ch.length - 1)
      );
      const waveOut = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const idx = Math.min(ch.length - 1, Math.max(0, sampleCenter + i * 2));
        waveOut[i] = ch[idx];
      }
      liveWaveSliceRef.current = waveOut;
      liveSpecRowRef.current =
        cols[Math.min(SPEC_COLS - 1, Math.floor((pauseOffsetRef.current / Math.max(0.01, dur)) * SPEC_COLS))] ||
        cols[0];
    },
    [computeSliceSpectrumDb]
  );

  // Render all active canvases (Waveform, Spectrum, Spectrogram)
  const renderCanvases = useCallback(
    (playheadSec: number) => {
      const dur = Math.max(0.1, totalDuration);

      // 1. Render Waveform Canvas
      const waveCanvas = waveformCanvasRef.current;
      if (waveCanvas) {
        const w = waveCanvas.parentElement?.clientWidth || 560;
        const h = vizTab === 'waveform' ? 280 : 185;
        if (waveCanvas.width !== w || waveCanvas.height !== h) {
          waveCanvas.width = w;
          waveCanvas.height = h;
        }
        const ctx = waveCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050912';
          ctx.fillRect(0, 0, w, h);

          const padL = 48;
          const padR = 16;
          const padT = 16;
          const padB = 26;
          const pw = w - padL - padR;
          const ph = h - padT - padB;
          const cy = padT + ph / 2;

          // Grid lines
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.13)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padL, cy);
          ctx.lineTo(padL + pw, cy);
          ctx.moveTo(padL, padT);
          ctx.lineTo(padL, padT + ph);
          ctx.stroke();

          // Draw live oscillogram trace
          const slice = liveWaveSliceRef.current;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < slice.length; i++) {
            const x = padL + (i / (slice.length - 1)) * pw;
            const y = cy - Math.max(-1.1, Math.min(1.1, slice[i])) * (ph * 0.44);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Axis labels
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('+1.0', padL - 6, padT + 8);
          ctx.fillText('0.0', padL - 6, cy + 3);
          ctx.fillText('-1.0', padL - 6, padT + ph);
          ctx.textAlign = 'left';
          ctx.fillText(`t = ${playheadSec.toFixed(2)} s`, padL + 6, h - 8);
          ctx.textAlign = 'right';
          ctx.fillText('Time Window (Oscilloscope)', w - padR, h - 8);
        }
      }

      // 2. Render Frequency Spectrum Canvas
      const specCanvas = spectrumCanvasRef.current;
      if (specCanvas) {
        const w = specCanvas.parentElement?.clientWidth || 560;
        const h = vizTab === 'spectrum' ? 280 : 185;
        if (specCanvas.width !== w || specCanvas.height !== h) {
          specCanvas.width = w;
          specCanvas.height = h;
        }
        const ctx = specCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050912';
          ctx.fillRect(0, 0, w, h);

          const padL = 48;
          const padR = 16;
          const padT = 16;
          const padB = 26;
          const pw = w - padL - padR;
          const ph = h - padT - padB;

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.13)';
          ctx.lineWidth = 1;
          for (let g = 0; g <= 3; g++) {
            const y = padT + (g / 3) * ph;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + pw, y);
            ctx.stroke();
          }

          const rowDb = liveSpecRowRef.current;
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(padL, padT + ph);
          for (let r = 0; r < rowDb.length; r++) {
            const x = padL + (r / (rowDb.length - 1)) * pw;
            const norm = Math.max(0, Math.min(1, (rowDb[r] + 95) / 95));
            const y = padT + (1 - norm) * ph;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(padL + pw, padT + ph);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          for (let r = 0; r < rowDb.length; r++) {
            const x = padL + (r / (rowDb.length - 1)) * pw;
            const norm = Math.max(0, Math.min(1, (rowDb[r] + 95) / 95));
            const y = padT + (1 - norm) * ph;
            if (r === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('0 dB', padL - 6, padT + 8);
          ctx.fillText('-45 dB', padL - 6, padT + ph / 2);
          ctx.fillText('-95 dB', padL - 6, padT + ph);

          ctx.textAlign = 'left';
          ctx.fillText('0 Hz', padL, h - 8);
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(maxFreqDisplay / 2)} Hz`, padL + pw / 2, h - 8);
          ctx.textAlign = 'right';
          ctx.fillText(`${maxFreqDisplay} Hz`, padL + pw, h - 8);
        }
      }

      // 3. Render Interactive Spectrogram Canvas
      const sgCanvas = spectrogramCanvasRef.current;
      if (sgCanvas) {
        const w = sgCanvas.parentElement?.clientWidth || 900;
        const h = vizTab === 'spectrogram' ? 380 : 310;
        if (sgCanvas.width !== w || sgCanvas.height !== h) {
          sgCanvas.width = w;
          sgCanvas.height = h;
        }
        const ctx = sgCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050912';
          ctx.fillRect(0, 0, w, h);

          const padL = 58;
          const padR = 54;
          const padT = 16;
          const padB = 32;
          const pw = Math.max(80, w - padL - padR);
          const ph = Math.max(80, h - padT - padB);

          const matrix = specMatrixRef.current;
          const nCols = matrix.length;
          const nRows = matrix[0]?.length || SPEC_ROWS;

          // Ultra-fast ImageData blit via offscreen canvas (replaces 38,400 fillRect calls with 1 GPU drawImage)
          if (!offscreenSpecCanvasRef.current) {
            const oc = document.createElement('canvas');
            oc.width = nCols;
            oc.height = nRows;
            offscreenSpecCanvasRef.current = oc;
            offscreenImageDataRef.current = oc
              .getContext('2d')
              ?.createImageData(nCols, nRows) || null;
          }
          const offCanvas = offscreenSpecCanvasRef.current;
          const imgData = offscreenImageDataRef.current;
          if (offCanvas && imgData) {
            const pixels = imgData.data;
            for (let c = 0; c < nCols; c++) {
              const col = matrix[c];
              for (let r = 0; r < nRows; r++) {
                const lutIdx =
                  Math.max(0, Math.min(255, Math.round(((col[r] + 95) / 95) * 255))) * 3;
                const py = nRows - 1 - r;
                const pIdx = (py * nCols + c) * 4;
                pixels[pIdx] = COLOR_LUT[lutIdx];
                pixels[pIdx + 1] = COLOR_LUT[lutIdx + 1];
                pixels[pIdx + 2] = COLOR_LUT[lutIdx + 2];
                pixels[pIdx + 3] = 255;
              }
            }
            offCanvas.getContext('2d')?.putImageData(imgData, 0, 0);
            ctx.drawImage(offCanvas, padL, padT, pw, ph);
          }

          // Subtle frequency grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10px "IBM Plex Mono", monospace';
          for (let tick = 0; tick <= 4; tick++) {
            const ratio = tick / 4;
            const py = padT + (1 - ratio) * ph;
            const fVal = ratio * maxFreqDisplay;
            ctx.beginPath();
            ctx.moveTo(padL, py);
            ctx.lineTo(padL + pw, py);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              fVal >= 1000 ? `${(fVal / 1000).toFixed(1)}k` : `${Math.round(fVal)} Hz`,
              padL - 6,
              py
            );
          }

          // Time X-axis ticks (supports both rolling waterfall timestamps and full duration)
          const tMin = specTimesRef.current[0] ?? 0;
          const tMax = specTimesRef.current[nCols - 1] ?? dur;
          const tSpan = Math.max(0.1, tMax - tMin);
          for (let tick = 0; tick <= 5; tick++) {
            const ratio = tick / 5;
            const px = padL + ratio * pw;
            const tVal = scrollingWaterfall ? tMin + ratio * tSpan : ratio * dur;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${tVal.toFixed(1)}s`, px, padT + ph + 7);
          }

          // Synchronized Playhead Cursor Line
          const playheadX = scrollingWaterfall
            ? padL + pw - 2
            : padL + Math.max(0, Math.min(1, playheadSec / dur)) * pw;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(playheadX, padT);
          ctx.lineTo(playheadX, padT + ph);
          ctx.stroke();

          // Right-hand dB Colorbar Legend
          const barX = padL + pw + 12;
          const barW = 10;
          for (let i = 0; i < ph; i++) {
            const db = -95 + (1 - i / ph) * 95;
            const [r, g, b] = dbToRgb(db);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(barX, padT + i, barW, 1.5);
          }
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText('0dB', barX + 13, padT + 5);
          ctx.fillText('-95', barX + 13, padT + ph - 2);

          // Draw Selected Point Crosshair Marker
          if (selectedPoint) {
            const sx = padL + Math.max(0, Math.min(1, selectedPoint.normX)) * pw;
            const sy =
              padT +
              (1 - Math.max(0, Math.min(1, selectedPoint.frequency / maxFreqDisplay))) * ph;

            ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sx, padT);
            ctx.lineTo(sx, padT + ph);
            ctx.moveTo(padL, sy);
            ctx.lineTo(padL + pw, sy);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#22d3ee';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, 5.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          }

          // Draw Selected Region Box (if in box-select mode or region exists)
          if (dragBox) {
            const rx = Math.min(dragBox.x1, dragBox.x2);
            const ry = Math.min(dragBox.y1, dragBox.y2);
            const rw = Math.abs(dragBox.x2 - dragBox.x1);
            const rh = Math.abs(dragBox.y2 - dragBox.y1);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.8;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
          } else if (selectedRegion) {
            const x1 = padL + (selectedRegion.t1 / dur) * pw;
            const x2 = padL + (selectedRegion.t2 / dur) * pw;
            const y1 = padT + (1 - selectedRegion.f2 / maxFreqDisplay) * ph;
            const y2 = padT + (1 - selectedRegion.f1 / maxFreqDisplay) * ph;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          }
        }
      }
    },
    [maxFreqDisplay, scrollingWaterfall, selectedPoint, selectedRegion, dragBox, totalDuration, vizTab]
  );

  // Instantaneous (<0.2ms) visual preview update on any frequency/waveform/button change
  useEffect(() => {
    if (sourceMode === 'generator') {
      const safeFs = Math.max(8000, Math.min(48000, sampleRate));
      const isChirp = waveType === 'chirp';
      // Synthesize only 4096 samples (0.09s) for instant preview instead of full multi-second buffer
      const previewLen = isChirp ? 16384 : 4096;
      const previewSamples = synthesizeRawSamples(
        previewLen,
        waveType,
        frequency,
        sweepEndFreq,
        amplitude,
        isChirp ? previewLen / safeFs : durationSec,
        safeFs,
        mixLayers
      );

      // Update live oscilloscope slice (512 samples)
      const waveOut = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        waveOut[i] = previewSamples[i * 2] ?? 0;
      }
      liveWaveSliceRef.current = waveOut;

      // Compute 1 FFT for stationary signals (or 12 slices for chirp) and fill spectrogram immediately
      if (!isChirp) {
        const singleCol = computeSliceSpectrumDb(
          previewSamples,
          safeFs,
          2048,
          maxFreqDisplay,
          SPEC_ROWS
        );
        liveSpecRowRef.current = singleCol;
        const cols: Float32Array[] = new Array(SPEC_COLS);
        for (let c = 0; c < SPEC_COLS; c++) {
          cols[c] = singleCol;
        }
        specMatrixRef.current = cols;
      } else {
        const numKf = 12;
        const kfs: Float32Array[] = new Array(numKf);
        for (let k = 0; k < numKf; k++) {
          const center = Math.floor((k / (numKf - 1)) * (previewLen - 1));
          kfs[k] = computeSliceSpectrumDb(previewSamples, safeFs, center, maxFreqDisplay, SPEC_ROWS);
        }
        const cols: Float32Array[] = new Array(SPEC_COLS);
        for (let c = 0; c < SPEC_COLS; c++) {
          cols[c] = kfs[Math.min(numKf - 1, Math.floor((c / SPEC_COLS) * numKf))];
        }
        specMatrixRef.current = cols;
        liveSpecRowRef.current = kfs[0];
      }

      // Mark audio buffer dirty so it is rebuilt lazily on play or after slider drag settles
      activeBufferRef.current = null;
      renderCanvases(pauseOffsetRef.current);

      if (isPlaying) {
        const timer = window.setTimeout(() => {
          startPlayback(pauseOffsetRef.current);
        }, 75);
        return () => window.clearTimeout(timer);
      }
    } else if (sourceMode === 'uploaded' && uploadedBufferRef.current) {
      activeBufferRef.current = uploadedBufferRef.current;
      setTotalDuration(uploadedBufferRef.current.duration);
      precomputeBufferSpectrogram(uploadedBufferRef.current, maxFreqDisplay, true);
      renderCanvases(pauseOffsetRef.current);
    }
  }, [
    sourceMode,
    waveType,
    frequency,
    sweepEndFreq,
    amplitude,
    durationSec,
    sampleRate,
    mixLayers,
    maxFreqDisplay,
    computeSliceSpectrumDb,
    precomputeBufferSpectrogram,
    synthesizeRawSamples,
  ]);

  // Re-render canvases when selection/hover/tab changes
  useEffect(() => {
    renderCanvases(currentTime);
  }, [currentTime, renderCanvases, selectedPoint, selectedRegion, dragBox, vizTab]);

  // Stop active playback node cleanly
  const stopSourceNode = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore already stopped
      }
      sourceNodeRef.current = null;
    }
  }, []);

  // Start playback from offsetSec
  const startPlayback = useCallback(
    (offsetSec = pauseOffsetRef.current) => {
      const ctx = getOrCreateAudioContext();
      stopSourceNode();

      let buf = activeBufferRef.current;
      if (!buf) {
        buf = buildSynthesizedBuffer(
          ctx,
          waveType,
          frequency,
          sweepEndFreq,
          amplitude,
          durationSec,
          sampleRate,
          mixLayers
        );
        activeBufferRef.current = buf;
      }

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = isLooping;
      source.playbackRate.value = playbackRate;

      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : volume;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.65;

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      sourceNodeRef.current = source;
      gainNodeRef.current = gain;
      analyserRef.current = analyser;

      const safeOffset = Math.max(0, Math.min(buf.duration - 0.01, offsetSec));
      pauseOffsetRef.current = safeOffset;
      startTimeRef.current = ctx.currentTime - safeOffset / playbackRate;

      source.onended = () => {
        if (!source.loop) {
          setIsPlaying(false);
          pauseOffsetRef.current = 0;
          setCurrentTime(0);
        }
      };

      source.start(0, safeOffset);
      setIsPlaying(true);

      const chData = buf.getChannelData(0);
      const fs = buf.sampleRate;
      const dur = buf.duration;

      const tick = () => {
        if (!audioCtxRef.current || !sourceNodeRef.current) return;
        const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
        const playhead = isLooping ? elapsed % dur : Math.min(dur, elapsed);
        pauseOffsetRef.current = playhead;
        const nowMs = performance.now();
        if (nowMs - lastUiTimeUpdateRef.current > 80) {
          lastUiTimeUpdateRef.current = nowMs;
          setCurrentTime(playhead);
        }

        // Update live time-domain slice and live spectrum column at playhead
        const centerSample = Math.floor((playhead / dur) * (chData.length - 1));
        const waveOut = new Float32Array(512);
        for (let i = 0; i < 512; i++) {
          const idx = (centerSample + i * 2) % chData.length;
          waveOut[i] = chData[idx];
        }
        liveWaveSliceRef.current = waveOut;

        const specCol = computeSliceSpectrumDb(
          chData,
          fs,
          centerSample,
          maxFreqDisplay,
          SPEC_ROWS
        );
        liveSpecRowRef.current = specCol;

        // Update spectrogram matrix: either scroll continuously in real-time waterfall mode or update timeline column
        if (scrollingWaterfall) {
          specMatrixRef.current.shift();
          specMatrixRef.current.push(specCol);
          const nextTimes = new Float32Array(SPEC_COLS);
          for (let c = 0; c < SPEC_COLS - 1; c++) {
            nextTimes[c] = specTimesRef.current[c + 1];
          }
          nextTimes[SPEC_COLS - 1] = elapsed;
          specTimesRef.current = nextTimes;
        } else {
          const colIdx = Math.min(
            SPEC_COLS - 1,
            Math.max(0, Math.floor((playhead / dur) * SPEC_COLS))
          );
          specMatrixRef.current[colIdx] = specCol;
        }

        renderCanvases(playhead);

        if (!isLooping && elapsed >= dur) {
          setIsPlaying(false);
          pauseOffsetRef.current = 0;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [
      amplitude,
      buildSynthesizedBuffer,
      computeSliceSpectrumDb,
      durationSec,
      fftSize,
      frequency,
      getOrCreateAudioContext,
      isLooping,
      isMuted,
      maxFreqDisplay,
      mixLayers,
      playbackRate,
      renderCanvases,
      sampleRate,
      scrollingWaterfall,
      stopSourceNode,
      sweepEndFreq,
      volume,
      waveType,
    ]
  );

  // Update live audio volume / playbackRate / loop without stopping
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        isMuted ? 0 : volume,
        audioCtxRef.current.currentTime,
        0.02
      );
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.loop = isLooping;
      sourceNodeRef.current.playbackRate.value = playbackRate;
    }
  }, [isLooping, playbackRate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSourceNode();
      if (previewOscRef.current) {
        try {
          previewOscRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [stopSourceNode]);

  const handlePause = () => {
    stopSourceNode();
    setIsPlaying(false);
  };

  const handleStop = () => {
    stopSourceNode();
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    renderCanvases(0);
  };

  const handleSeek = (newTime: number) => {
    pauseOffsetRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying) {
      startPlayback(newTime);
    } else {
      renderCanvases(newTime);
    }
  };

  // Play a pure tone at a given frequency (for Click-to-Hear on Spectrogram)
  const playFrequencyTone = useCallback(
    (freqHz: number, durationMs = 420) => {
      const ctx = getOrCreateAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(Math.max(16, Math.min(20000, freqHz)), ctx.currentTime);

      const peakGain = (isMuted ? 0.25 : Math.max(0.15, volume)) * 0.45;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    },
    [getOrCreateAudioContext, isMuted, volume]
  );

  // Start/update continuous frequency tone while dragging across spectrogram
  const startOrUpdateDragTone = useCallback(
    (freqHz: number) => {
      const ctx = getOrCreateAudioContext();
      const clampedFreq = Math.max(16, Math.min(20000, freqHz));
      if (!previewOscRef.current || !previewGainRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(clampedFreq, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.15, volume * 0.4),
          ctx.currentTime + 0.02
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        previewOscRef.current = osc;
        previewGainRef.current = gain;
      } else {
        previewOscRef.current.frequency.setTargetAtTime(clampedFreq, ctx.currentTime, 0.015);
      }
    },
    [getOrCreateAudioContext, volume]
  );

  const stopDragTone = useCallback(() => {
    if (previewOscRef.current && previewGainRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      try {
        previewGainRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        previewOscRef.current.stop(ctx.currentTime + 0.05);
      } catch {
        // ignore
      }
      previewOscRef.current = null;
      previewGainRef.current = null;
    }
  }, []);

  // Sonify Selected Region (Time Range x Frequency Range) via Additive Sinusoidal Resynthesis
  const handleSonifyRegion = useCallback(() => {
    if (!selectedRegion) return;
    const ctx = getOrCreateAudioContext();
    setIsSonifying(true);

    const dur = Math.max(0.35, Math.min(6.0, selectedRegion.t2 - selectedRegion.t1));
    const fs = 44100;
    const numSamples = Math.round(dur * fs);
    const outBuf = ctx.createBuffer(1, numSamples, fs);
    const outData = outBuf.getChannelData(0);

    const matrix = specMatrixRef.current;
    const cStart = Math.max(
      0,
      Math.floor((selectedRegion.t1 / Math.max(0.1, totalDuration)) * (SPEC_COLS - 1))
    );
    const cEnd = Math.min(
      SPEC_COLS - 1,
      Math.ceil((selectedRegion.t2 / Math.max(0.1, totalDuration)) * (SPEC_COLS - 1))
    );
    const rStart = Math.max(
      0,
      Math.floor((selectedRegion.f1 / maxFreqDisplay) * (SPEC_ROWS - 1))
    );
    const rEnd = Math.min(
      SPEC_ROWS - 1,
      Math.ceil((selectedRegion.f2 / maxFreqDisplay) * (SPEC_ROWS - 1))
    );

    // Pick up to 10 strongest frequency rows in the selected region and synthesize their time-varying envelopes
    const rowScores: { row: number; freq: number; meanAmp: number }[] = [];
    for (let r = rStart; r <= rEnd; r++) {
      let sumLin = 0;
      for (let c = cStart; c <= cEnd; c++) {
        sumLin += Math.pow(10, matrix[c][r] / 20);
      }
      const meanAmp = sumLin / Math.max(1, cEnd - cStart + 1);
      rowScores.push({
        row: r,
        freq: ((r + 0.5) / SPEC_ROWS) * maxFreqDisplay,
        meanAmp,
      });
    }
    rowScores.sort((a, b) => b.meanAmp - a.meanAmp);
    const topBins = rowScores.slice(0, 10);

    for (let i = 0; i < numSamples; i++) {
      const t = i / fs;
      const framePos = cStart + (t / dur) * Math.max(1, cEnd - cStart);
      const cIdx = Math.min(SPEC_COLS - 1, Math.floor(framePos));
      let s = 0;
      for (const b of topBins) {
        const db = matrix[cIdx][b.row];
        const ampLin = Math.pow(10, db / 20);
        s += ampLin * Math.sin(2 * Math.PI * b.freq * t);
      }
      // Smooth fade-in and fade-out envelope
      const fade =
        Math.min(1, i / (fs * 0.03)) * Math.min(1, (numSamples - i) / (fs * 0.03));
      outData[i] = s * fade;
    }

    // Normalize output buffer to comfortable listening level
    let maxAbs = 1e-4;
    for (let i = 0; i < numSamples; i++) {
      if (Math.abs(outData[i]) > maxAbs) maxAbs = Math.abs(outData[i]);
    }
    const normGain = 0.65 / maxAbs;
    for (let i = 0; i < numSamples; i++) {
      outData[i] *= normGain;
    }

    const src = ctx.createBufferSource();
    src.buffer = outBuf;
    const g = ctx.createGain();
    g.gain.value = isMuted ? 0.35 : Math.max(0.25, volume);
    src.connect(g);
    g.connect(ctx.destination);
    src.onended = () => setIsSonifying(false);
    src.start();
  }, [getOrCreateAudioContext, isMuted, maxFreqDisplay, selectedRegion, totalDuration, volume]);

  // Convert client (x, y) on Spectrogram Canvas to (time, frequency, magnitudeDb)
  const getSpectrogramCoordsFromClient = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) => {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const padL = 58;
    const padR = 54;
    const padT = 16;
    const padB = 32;
    const pw = Math.max(80, canvas.width - padL - padR);
    const ph = Math.max(80, canvas.height - padT - padB);

    const normX = Math.max(0, Math.min(1, (px - padL) / pw));
    const normY = Math.max(0, Math.min(1, 1 - (py - padT) / ph));

    const cIdx = Math.min(SPEC_COLS - 1, Math.max(0, Math.floor(normX * SPEC_COLS)));
    const rIdx = Math.min(SPEC_ROWS - 1, Math.max(0, Math.floor(normY * SPEC_ROWS)));
    const time = scrollingWaterfall
      ? specTimesRef.current[cIdx] ?? normX * totalDuration
      : normX * totalDuration;
    const freq = Math.max(1, normY * maxFreqDisplay);
    const magnitudeDb = specMatrixRef.current[cIdx]?.[rIdx] ?? -80;

    return {
      px: Math.max(padL, Math.min(padL + pw, px)),
      py: Math.max(padT, Math.min(padT + ph, py)),
      normX,
      normY,
      time: Math.max(0, time),
      frequency: freq,
      magnitudeDb,
    };
  };

  const getSpectrogramCoords = (e: React.MouseEvent<HTMLCanvasElement>) =>
    getSpectrogramCoordsFromClient(e.currentTarget, e.clientX, e.clientY);

  const handleSpecMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSpectrogramCoords(e);
    isPointerDownRef.current = true;

    if (interactMode === 'click-tone') {
      setSelectedPoint({
        time: coords.time,
        frequency: coords.frequency,
        magnitudeDb: coords.magnitudeDb,
        normX: coords.normX,
        normY: coords.normY,
      });
      if (autoPlayClick) {
        startOrUpdateDragTone(coords.frequency);
      }
    } else {
      setDragBox({
        x1: coords.px,
        y1: coords.py,
        x2: coords.px,
        y2: coords.py,
      });
    }
  };

  const handleSpecMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSpectrogramCoords(e);
    setHoverInfo({
      x: coords.px,
      y: coords.py,
      time: coords.time,
      frequency: coords.frequency,
      magnitudeDb: coords.magnitudeDb,
    });

    if (!isPointerDownRef.current) return;

    if (interactMode === 'click-tone') {
      setSelectedPoint({
        time: coords.time,
        frequency: coords.frequency,
        magnitudeDb: coords.magnitudeDb,
        normX: coords.normX,
        normY: coords.normY,
      });
      if (autoPlayClick) {
        startOrUpdateDragTone(coords.frequency);
      }
    } else if (dragBox) {
      setDragBox((prev) =>
        prev ? { ...prev, x2: coords.px, y2: coords.py } : null
      );
    }
  };

  const handleSpecMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (interactMode === 'click-tone') {
      stopDragTone();
    } else if (dragBox) {
      const canvas = e.currentTarget;
      const padL = 58;
      const padR = 54;
      const padT = 16;
      const padB = 32;
      const pw = Math.max(80, canvas.width - padL - padR);
      const ph = Math.max(80, canvas.height - padT - padB);

      const xMin = Math.max(padL, Math.min(dragBox.x1, dragBox.x2));
      const xMax = Math.min(padL + pw, Math.max(dragBox.x1, dragBox.x2));
      const yMin = Math.max(padT, Math.min(dragBox.y1, dragBox.y2));
      const yMax = Math.min(padT + ph, Math.max(dragBox.y1, dragBox.y2));

      if (xMax - xMin > 8 && yMax - yMin > 8) {
        const t1 = ((xMin - padL) / pw) * totalDuration;
        const t2 = ((xMax - padL) / pw) * totalDuration;
        const f2 = (1 - (yMin - padT) / ph) * maxFreqDisplay;
        const f1 = (1 - (yMax - padT) / ph) * maxFreqDisplay;

        // Compute peak dB in region
        const c1 = Math.max(0, Math.floor(((xMin - padL) / pw) * (SPEC_COLS - 1)));
        const c2 = Math.min(SPEC_COLS - 1, Math.ceil(((xMax - padL) / pw) * (SPEC_COLS - 1)));
        const r1 = Math.max(0, Math.floor((f1 / maxFreqDisplay) * (SPEC_ROWS - 1)));
        const r2 = Math.min(SPEC_ROWS - 1, Math.ceil((f2 / maxFreqDisplay) * (SPEC_ROWS - 1)));
        let peakDb = -95;
        let sumDb = 0;
        let count = 0;
        for (let c = c1; c <= c2; c++) {
          for (let r = r1; r <= r2; r++) {
            const val = specMatrixRef.current[c][r];
            if (val > peakDb) peakDb = val;
            sumDb += val;
            count++;
          }
        }
        setSelectedRegion({
          t1,
          t2,
          f1: Math.max(1, f1),
          f2: Math.max(5, f2),
          peakDb,
          meanDb: count > 0 ? sumDb / count : -80,
        });
      }
      setDragBox(null);
    }
  };

  // Handle Uploaded Audio File (WAV, MP3, OGG, M4A)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopSourceNode();
    setIsPlaying(false);

    try {
      const ctx = getOrCreateAudioContext();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      uploadedBufferRef.current = decoded;
      activeBufferRef.current = decoded;
      setUploadedFileName(file.name);
      setSourceMode('uploaded');
      setTotalDuration(decoded.duration);
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
      const autoMaxFreq = 20000;
      setMaxFreqDisplay(autoMaxFreq);
      precomputeBufferSpectrogram(decoded, autoMaxFreq, true);
      startPlayback(0);
    } catch {
      // ignore invalid audio format
    }
    e.target.value = '';
  };

  // Convenient Preset Buttons (20 Hz Tone | 100 Hz Tone | 1 kHz Tone | Chirp | White Noise | Pink Noise | Mixed Signal | Random Demo)
  const applyQuickPreset = (
    preset:
      | '20hz'
      | '100hz'
      | '1khz'
      | 'chirp'
      | 'white'
      | 'pink'
      | 'mixed'
      | 'speech'
      | 'random'
  ) => {
    setSourceMode('generator');
    setUploadedFileName(null);
    pauseOffsetRef.current = 0;
    setCurrentTime(0);

    if (preset === '20hz') {
      setWaveType('sine');
      setFrequency(20);
      setAmplitude(0.5);
      setMaxFreqDisplay(20000);
      setSelectedPoint({
        time: 2.0,
        frequency: 20,
        magnitudeDb: -6.0,
        normX: 0.25,
        normY: 20 / 20000,
      });
    } else if (preset === '100hz') {
      setWaveType('sine');
      setFrequency(100);
      setAmplitude(0.5);
      setMaxFreqDisplay(20000);
      setSelectedPoint({
        time: 2.5,
        frequency: 100,
        magnitudeDb: -6.0,
        normX: 0.3,
        normY: 100 / 20000,
      });
    } else if (preset === '1khz') {
      setWaveType('sine');
      setFrequency(1000);
      setAmplitude(0.45);
      setMaxFreqDisplay(20000);
      setSelectedPoint({
        time: 3.0,
        frequency: 1000,
        magnitudeDb: -6.5,
        normX: 0.35,
        normY: 1000 / 20000,
      });
    } else if (preset === 'chirp') {
      setWaveType('chirp');
      setFrequency(100);
      setSweepEndFreq(12000);
      setAmplitude(0.5);
      setMaxFreqDisplay(20000);
    } else if (preset === 'white') {
      setWaveType('white-noise');
      setAmplitude(0.35);
      setMaxFreqDisplay(20000);
    } else if (preset === 'pink') {
      setWaveType('pink-noise');
      setAmplitude(0.45);
      setMaxFreqDisplay(20000);
    } else if (preset === 'mixed') {
      setWaveType('mixed');
      setMixLayers([
        { id: 'm1', type: 'sine', frequency: 20, amplitude: 0.5, enabled: true },
        { id: 'm2', type: 'sine', frequency: 100, amplitude: 0.35, enabled: true },
        { id: 'm3', type: 'white-noise', frequency: 0, amplitude: 0.08, enabled: true },
      ]);
      setMaxFreqDisplay(20000);
    } else if (preset === 'speech') {
      setWaveType('speech-synth');
      setFrequency(130);
      setAmplitude(0.55);
      setMaxFreqDisplay(20000);
    } else if (preset === 'random') {
      const types: LiveWaveType[] = ['am-fm', 'musical', 'speech-synth', 'chirp', 'square'];
      const pick = types[Math.floor(Math.random() * types.length)];
      const randFreq = Math.round(80 + Math.random() * 4000);
      setWaveType(pick);
      setFrequency(randFreq);
      setSweepEndFreq(Math.min(18000, randFreq * 3));
      setMaxFreqDisplay(20000);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Top Control & Preset Card */}
      <div className="neu-card p-6 sm:p-7 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400 flex items-center gap-2">
              <AudioLines className="w-3.5 h-3.5" />
              <span>
                {lang === 'fa'
                  ? 'پخش‌کننده زنده صوتی Web Audio API · طیف‌نگار تعاملی و شنیداری‌سازی (Sonification)'
                  : 'Real-Time Web Audio Synthesizer · Interactive Spectrogram & Click-to-Hear Sonification'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
              {lang === 'fa'
                ? 'آزمایشگاه زنده سیگنال صوتی و طیف‌نگار تعاملی'
                : 'Live Audio Signal Player & Interactive Spectrogram Laboratory'}
            </h1>
          </div>

          {/* Primary Play / Pause / Stop / Upload Audio Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!isPlaying ? (
              <button
                type="button"
                onClick={() => startPlayback(pauseOffsetRef.current)}
                className="btn-primary-pill px-5 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {lang === 'fa' ? 'تولید و پخش زنده صدا' : 'Generate & Play Audio'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="btn-tool-pill px-5 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>{lang === 'fa' ? 'مکث (Pause)' : 'Pause'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStop}
              className="neu-btn px-3.5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'توقف' : 'Stop'}</span>
            </button>

            <label className="neu-btn px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>
                {uploadedFileName
                  ? uploadedFileName.slice(0, 18)
                  : lang === 'fa'
                  ? 'بارگذاری فایل صوتی (WAV/MP3)'
                  : 'Upload Audio (WAV/MP3/OGG)'}
              </span>
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.m4a"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Quick Preset Strip: 20 Hz Tone | 100 Hz Tone | 1 kHz Tone | Chirp | White Noise | Pink Noise | Mixed Signal */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-300/40 dark:border-slate-800/70">
          <span className="text-xs font-mono text-slate-500 mr-1">
            {lang === 'fa' ? 'نمونه‌های صوتی آماده:' : 'Quick Demo Sounds:'}
          </span>
          {[
            { id: '20hz', label: '20 Hz Tone', fa: 'تُن ۲۰ هرتز' },
            { id: '100hz', label: '100 Hz Tone', fa: 'تُن ۱۰۰ هرتز' },
            { id: '1khz', label: '1 kHz Tone', fa: 'تُن ۱ کیلوهرتز' },
            { id: 'chirp', label: 'Chirp Sweep', fa: 'جاروب فرکانسی (Chirp)' },
            { id: 'white', label: 'White Noise', fa: 'نویز سفید' },
            { id: 'pink', label: 'Pink Noise', fa: 'نویز صورتی' },
            {
              id: 'mixed',
              label: 'Mixed (20Hz + 100Hz + Noise)',
              fa: 'ترکیبی (۲۰ + ۱۰۰ هرتز + نویز)',
            },
            { id: 'speech', label: 'Speech Formants', fa: 'فرمانت گفتار' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyQuickPreset(p.id as any)}
              className="neu-btn px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer"
            >
              {lang === 'fa' ? p.fa : p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyQuickPreset('random')}
            className="neu-btn px-3 py-1.5 rounded-full text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1 cursor-pointer"
          >
            <Shuffle className="w-3 h-3" />
            <span>{lang === 'fa' ? 'صدای تصادفی' : 'Random Sound'}</span>
          </button>
        </div>

        {/* Waveform Selector & Live Sliders */}
        {sourceMode === 'generator' && (
          <div className="flex flex-col gap-5 pt-2 border-t border-slate-300/40 dark:border-slate-800/70">
            <div className="flex flex-wrap gap-1.5">
              {WAVE_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWaveType(w.id)}
                  className={`neu-btn px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                    waveType === w.id ? 'btn-tool-pill' : ''
                  }`}
                >
                  {lang === 'fa' ? w.faLabel : w.label}
                </button>
              ))}
            </div>

            {/* Custom Mixed Signal Multi-Layer Builder */}
            {waveType === 'mixed' && (
              <div className="neu-inset p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                    {lang === 'fa'
                      ? 'ترکیب‌کننده زنده چند سیگنال (مثال: ۲۰ هرتز سینوسی + ۱۰۰ هرتز سینوسی + نویز سفید)'
                      : 'Custom Multi-Layer Signal Mixer (e.g., 20 Hz Sine + 100 Hz Sine + White Noise)'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMixLayers((prev) => [
                        ...prev,
                        {
                          id: `m-${Date.now()}`,
                          type: 'sine',
                          frequency: 220,
                          amplitude: 0.25,
                          enabled: true,
                        },
                      ])
                    }
                    className="btn-primary-pill px-3 py-1 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'fa' ? 'افزودن لایه' : 'Add Layer'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {mixLayers.map((lyr, idx) => (
                    <div
                      key={lyr.id}
                      className={`neu-card-sm p-3 flex flex-col gap-2 ${
                        !lyr.enabled ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lyr.enabled}
                            onChange={(e) =>
                              setMixLayers((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, enabled: e.target.checked } : item
                                )
                              )
                            }
                          />
                          <span>
                            {lang === 'fa' ? `لایه #${idx + 1}` : `Layer #${idx + 1}`}
                          </span>
                        </label>
                        <select
                          value={lyr.type}
                          onChange={(e) =>
                            setMixLayers((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, type: e.target.value as MixLayer['type'] }
                                  : item
                              )
                            )
                          }
                          className="neu-inset px-2 py-0.5 rounded text-xs font-mono bg-transparent"
                        >
                          <option value="sine">Sine</option>
                          <option value="square">Square</option>
                          <option value="triangle">Triangle</option>
                          <option value="sawtooth">Sawtooth</option>
                          <option value="white-noise">White Noise</option>
                          <option value="pink-noise">Pink Noise</option>
                        </select>
                        {mixLayers.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setMixLayers((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-rose-500 hover:opacity-80 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {lyr.type !== 'white-noise' && lyr.type !== 'pink-noise' && (
                        <div>
                          <div className="flex justify-between text-[11px] font-mono">
                            <span>{lang === 'fa' ? 'فرکانس' : 'Freq'}</span>
                            <span className="text-sky-500 font-bold">{lyr.frequency} Hz</span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={20000}
                            step={10}
                            value={lyr.frequency}
                            onChange={(e) =>
                              setMixLayers((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, frequency: Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                            className="sci-slider"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span>{lang === 'fa' ? 'دامنه' : 'Amplitude'}</span>
                          <span className="text-emerald-500 font-bold">
                            {lyr.amplitude.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.02}
                          max={0.9}
                          step={0.02}
                          value={lyr.amplitude}
                          onChange={(e) =>
                            setMixLayers((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, amplitude: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="sci-slider"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Signal Generator Parameter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span>{lang === 'fa' ? 'فرکانس (Hz)' : 'Frequency (Hz)'}</span>
                  <input
                    type="number"
                    min={10}
                    max={20000}
                    step={1}
                    value={frequency}
                    onChange={(e) => {
                      const val = Math.max(10, Math.min(20000, Number(e.target.value)));
                      setFrequency(val);
                    }}
                    className="neu-inset w-20 px-2 py-0.5 rounded text-right font-bold text-sky-500 bg-transparent"
                  />
                </div>
                <input
                  type="range"
                  min={10}
                  max={20000}
                  step={1}
                  value={Math.min(20000, frequency)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFrequency(val);
                  }}
                  className="sci-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span>{lang === 'fa' ? 'دامنه (Amplitude)' : 'Amplitude'}</span>
                  <span className="font-bold text-sky-500">{amplitude.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={amplitude}
                  onChange={(e) => setAmplitude(Number(e.target.value))}
                  className="sci-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span>{lang === 'fa' ? 'محدوده محور فرکانس' : 'Spectrogram Max Freq'}</span>
                  <span className="font-bold text-emerald-500">
                    {maxFreqDisplay >= 1000
                      ? `${(maxFreqDisplay / 1000).toFixed(1)} kHz`
                      : `${maxFreqDisplay} Hz`}
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={20000}
                  step={100}
                  value={maxFreqDisplay}
                  onChange={(e) => setMaxFreqDisplay(Number(e.target.value))}
                  className="sci-slider"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">
                  {lang === 'fa' ? 'نرخ نمونه‌برداری (Sample Rate)' : 'Sample Rate (fs)'}
                </label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(Number(e.target.value))}
                  className="neu-inset w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-transparent"
                >
                  <option value={16000}>16,000 Hz</option>
                  <option value={22050}>22,050 Hz</option>
                  <option value={44100}>44,100 Hz (CD Quality)</option>
                  <option value={48000}>48,000 Hz (Studio)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">
                  {lang === 'fa' ? 'اندازه تبدیل فوریه (FFT Size)' : 'FFT Window Size'}
                </label>
                <select
                  value={fftSize}
                  onChange={(e) => setFftSize(Number(e.target.value))}
                  className="neu-inset w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-transparent"
                >
                  <option value={1024}>1024 bins</option>
                  <option value={2048}>2048 bins</option>
                  <option value={4096}>4096 bins (High Res)</option>
                  <option value={8192}>8192 bins (Ultra Low-Freq)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Audio Transport Scrubber, Volume, Mute, Speed & Loop Controls */}
        <div className="neu-inset p-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <span className="text-xs font-mono tabular-nums text-sky-500 font-bold w-28 shrink-0">
              {currentTime.toFixed(2)}s / {totalDuration.toFixed(1)}s
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, totalDuration)}
              step={0.05}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="sci-slider flex-1"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="btn-circle-glass cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-500" />
              )}
            </button>
            <div className="flex items-center gap-1.5 w-28">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setIsMuted(false);
                  setVolume(Number(e.target.value));
                }}
                className="sci-slider"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsLooping((l) => !l)}
              className={`neu-btn px-3 py-1 rounded-full text-xs flex items-center gap-1 cursor-pointer ${
                isLooping ? 'btn-tool-pill' : ''
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'تکرار' : 'Loop'}</span>
            </button>

            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className="neu-inset px-2.5 py-1 rounded-full text-xs font-mono bg-transparent"
              aria-label="Playback Speed"
            >
              <option value={0.5}>0.5x Speed</option>
              <option value={1.0}>1.0x Speed</option>
              <option value={1.5}>1.5x Speed</option>
              <option value={2.0}>2.0x Speed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visualization Mode Tabs + Interactive Spectrogram Sonification Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'combined', label: 'Combined View', fa: 'نمای ترکیبی کامل' },
              { id: 'spectrogram', label: 'Spectrogram Only', fa: 'فقط طیف‌نگار (Spectrogram)' },
              { id: 'waveform', label: 'Waveform Only', fa: 'فقط شکل‌موج (Waveform)' },
              { id: 'spectrum', label: 'Spectrum Only', fa: 'فقط طیف فرکانسی (FFT)' },
            ] as { id: VisualizationTab; label: string; fa: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setVizTab(t.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer ${
                vizTab === t.id ? 'btn-primary-pill' : 'neu-btn'
              }`}
            >
              {lang === 'fa' ? t.fa : t.label}
            </button>
          ))}
        </div>

        {/* Spectrogram Mouse Interaction Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInteractMode('click-tone')}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              interactMode === 'click-tone' ? 'btn-tool-pill' : 'neu-btn'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              {lang === 'fa'
                ? 'کلیک / کشیدن ← شنیدن فرکانس'
                : 'Click / Drag → Hear Frequency'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInteractMode('box-select')}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              interactMode === 'box-select' ? 'btn-tool-pill' : 'neu-btn'
            }`}
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span>
              {lang === 'fa'
                ? 'انتخاب ناحیه (زمان × فرکانس)'
                : 'Select Region (Time × Freq)'}
            </span>
          </button>
        </div>
      </div>

      {/* Top Row: Live Time-Domain Waveform & Live Frequency-Domain Spectrum */}
      {(vizTab === 'combined' || vizTab === 'waveform' || vizTab === 'spectrum') && (
        <div
          className={`grid grid-cols-1 ${
            vizTab === 'combined' ? 'lg:grid-cols-2' : ''
          } gap-6`}
        >
          {(vizTab === 'combined' || vizTab === 'waveform') && (
            <div className="neu-card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {lang === 'fa'
                      ? 'شکل‌موج زنده در حوزه زمان (Time-Domain Waveform)'
                      : 'Real-Time Audio Waveform — Time (s) vs. Amplitude'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'fa'
                      ? 'همگام‌سازی‌شده با پخش صوتی'
                      : `Synchronized time-domain oscillogram · fs = ${sampleRate} Hz`}
                  </p>
                </div>
                <Activity className="w-4 h-4 text-sky-500" />
              </div>
              <div className="oscilloscope-frame p-1 overflow-hidden">
                <canvas ref={waveformCanvasRef} className="block w-full rounded-xl" />
              </div>
            </div>
          )}

          {(vizTab === 'combined' || vizTab === 'spectrum') && (
            <div className="neu-card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {lang === 'fa'
                      ? 'طیف لحظه‌ای فرکانس (FFT Magnitude Spectrum)'
                      : 'Instantaneous FFT Spectrum — Frequency (Hz) vs. Magnitude (dB)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'fa'
                      ? `اندازه پنجره FFT = ${fftSize} · نمایش تا ${maxFreqDisplay} هرتز`
                      : `FFT Size = ${fftSize} · Display Range: 0 – ${maxFreqDisplay} Hz`}
                  </p>
                </div>
              </div>
              <div className="oscilloscope-frame p-1 overflow-hidden">
                <canvas ref={spectrumCanvasRef} className="block w-full rounded-xl" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Interactive Spectrogram Card (Click to Hear & Region Sonification) */}
      {(vizTab === 'combined' || vizTab === 'spectrogram') && (
        <div className="neu-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {lang === 'fa'
                  ? 'طیف‌نگار تعاملی زمان-فرکانس (Interactive Spectrogram — روی هر فرکانس کلیک کنید تا صدای آن را بشنوید)'
                  : 'Interactive Time-Frequency Spectrogram — Click or Drag Any Frequency to Hear It'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'fa'
                  ? 'محور افقی: زمان (ثانیه) · محور عمودی: فرکانس (هرتز) · رنگ: شدت توان طیفی بر حسب دسی‌بل (dB)'
                  : 'X-Axis: Time (s) · Y-Axis: Frequency (Hz) · Color Intensity: Magnitude (dB)'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={scrollingWaterfall}
                  onChange={(e) => setScrollingWaterfall(e.target.checked)}
                />
                <span>
                  {lang === 'fa'
                    ? 'پیمایش زنده طیف‌نگار (Real-Time Scroll)'
                    : 'Real-Time Scrolling Spectrogram'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlayClick}
                  onChange={(e) => setAutoPlayClick(e.target.checked)}
                />
                <span>
                  {lang === 'fa'
                    ? 'پخش فوری فرکانس با کلیک'
                    : 'Auto-play tone on click/drag'}
                </span>
              </label>
            </div>
          </div>

          {/* Interactive Spectrogram Canvas + Floating Hover Tooltip */}
          <div className="relative oscilloscope-frame p-1.5 overflow-hidden select-none">
            <canvas
              ref={spectrogramCanvasRef}
              onMouseDown={handleSpecMouseDown}
              onMouseMove={handleSpecMouseMove}
              onMouseUp={handleSpecMouseUp}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  const t = e.touches[0];
                  const coords = getSpectrogramCoordsFromClient(
                    e.currentTarget,
                    t.clientX,
                    t.clientY
                  );
                  isPointerDownRef.current = true;
                  setSelectedPoint({
                    time: coords.time,
                    frequency: coords.frequency,
                    magnitudeDb: coords.magnitudeDb,
                    normX: coords.normX,
                    normY: coords.normY,
                  });
                  if (autoPlayClick) startOrUpdateDragTone(coords.frequency);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length > 0) {
                  const t = e.touches[0];
                  const coords = getSpectrogramCoordsFromClient(
                    e.currentTarget,
                    t.clientX,
                    t.clientY
                  );
                  setSelectedPoint({
                    time: coords.time,
                    frequency: coords.frequency,
                    magnitudeDb: coords.magnitudeDb,
                    normX: coords.normX,
                    normY: coords.normY,
                  });
                  if (autoPlayClick) startOrUpdateDragTone(coords.frequency);
                }
              }}
              onTouchEnd={() => {
                isPointerDownRef.current = false;
                stopDragTone();
              }}
              onMouseLeave={() => {
                setHoverInfo(null);
                if (isPointerDownRef.current) {
                  isPointerDownRef.current = false;
                  stopDragTone();
                }
              }}
              className="block w-full rounded-xl cursor-crosshair touch-none"
            />

            {hoverInfo && (
              <div
                style={{
                  left: Math.min(hoverInfo.x + 14, 520),
                  top: Math.max(12, hoverInfo.y - 56),
                }}
                className="pointer-events-none absolute z-20 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-sky-400/40 text-[11px] font-mono text-slate-100 shadow-lg"
              >
                <div>Time: {hoverInfo.time.toFixed(2)} s</div>
                <div className="text-sky-400 font-bold">
                  Frequency: {Math.round(hoverInfo.frequency).toLocaleString()} Hz
                </div>
                <div className="text-emerald-400">
                  Magnitude: {hoverInfo.magnitudeDb.toFixed(1)} dB
                </div>
              </div>
            )}
          </div>

          {/* Selected Point / Selected Region Sonification Readout Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
            {selectedPoint && (
              <div className="lg:col-span-7 neu-inset p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500">
                      {lang === 'fa' ? 'زمان انتخاب‌شده: ' : 'Selected Time: '}
                    </span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {selectedPoint.time.toFixed(2)} s
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      {lang === 'fa' ? 'فرکانس: ' : 'Frequency: '}
                    </span>
                    <strong className="text-sky-600 dark:text-sky-400 text-sm">
                      {Math.round(selectedPoint.frequency).toLocaleString()} Hz
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      {lang === 'fa' ? 'شدت: ' : 'Magnitude: '}
                    </span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {selectedPoint.magnitudeDb.toFixed(1)} dB
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => playFrequencyTone(selectedPoint.frequency, 650)}
                  className="btn-primary-pill px-4 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'fa'
                      ? `پخش فرکانس (${Math.round(selectedPoint.frequency)} Hz)`
                      : `Play Frequency (${Math.round(selectedPoint.frequency)} Hz)`}
                  </span>
                </button>
              </div>
            )}

            <div className="lg:col-span-5 neu-inset p-3.5 flex flex-wrap items-center justify-between gap-3">
              {selectedRegion ? (
                <>
                  <div className="text-xs font-mono">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      {lang === 'fa' ? 'ناحیه انتخاب‌شده:' : 'Selected Region:'}{' '}
                      {Math.round(selectedRegion.f1)}–{Math.round(selectedRegion.f2)} Hz
                    </div>
                    <div className="text-[11px] text-slate-500">
                      t = {selectedRegion.t1.toFixed(2)}–{selectedRegion.t2.toFixed(2)} s · Peak{' '}
                      {selectedRegion.peakDb.toFixed(1)} dB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSonifyRegion}
                    disabled={isSonifying}
                    className="btn-tool-pill px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {isSonifying
                        ? lang === 'fa'
                          ? 'در حال پخش...'
                          : 'Sonifying...'
                        : lang === 'fa'
                        ? 'شنیداری‌سازی ناحیه'
                        : 'Sonify Selection'}
                    </span>
                  </button>
                </>
              ) : (
                <div className="text-xs text-slate-500 flex items-center justify-between w-full gap-2">
                  <span>
                    {lang === 'fa'
                      ? 'برای شنیدن یک بازه زمانی×فرکانسی، حالت «انتخاب ناحیه» را فعال و کادر بکشید.'
                      : 'Switch to "Select Region" mode and drag a box to sonify a time × frequency band.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scientific / Educational Explanation Panel */}
      {!embedded && (
        <div className="neu-card p-5 sm:p-6 flex items-start gap-3.5">
          <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-slate-100 block mb-1">
              {lang === 'fa'
                ? 'طیف‌نگار (Spectrogram) چیست و چگونه خوانده می‌شود؟'
                : 'Understanding the Time-Frequency Spectrogram'}
            </strong>
            {lang === 'fa'
              ? 'طیف‌نگار نشان می‌دهد که محتوای فرکانسی یک سیگنال چگونه در طول زمان تغییر می‌کند. ساختارهای افقی روشن (مانند خط افقی در ۲۰ هرتز یا ۱۰۰ هرتز) نشان‌دهنده فرکانس‌های پایدار و پیوسته هستند، خطوط شیب‌دار نشان‌دهنده جاروب فرکانسی (Chirp) بوده و ساختارهای عمودی کوتاه‌مدت نشان‌دهنده رخدادهای گذرا یا ضربه‌ای می‌باشند. با کلیک روی هر نقطه از طیف‌نگار می‌توانید فرکانس دقیق آن نقطه را بشنوید.'
              : 'A spectrogram shows how the frequency content of a signal changes over time. Horizontal bands represent persistent pure tones or harmonics (such as a 20 Hz or 100 Hz sine wave), sloped trajectories indicate frequency-swept chirps, and vertical broadband streaks represent short-lived transient bursts. Click any coordinate on the spectrogram to isolate and hear that exact frequency.'}
          </div>
        </div>
      )}
    </div>
  );
};
