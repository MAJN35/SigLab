import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AudioLines,
  BoxSelect,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  Mic,
  MicOff,
  MousePointerClick,
  Pause,
  Pin,
  Play,
  Plus,
  Repeat,
  Settings2,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { GuideModal } from '../components/GuideModal';
import type { Signal3DStageProps } from '../components/Signal3DStage';
import { PageHeader, StatusMessage } from '../components/ui';
import { useLab } from '../store/LabContext';

// Babylon.js is heavy: load the 3D stage on demand and only mount it once its
// container scrolls near the viewport.
const Signal3DStage = lazy(() =>
  import('../components/Signal3DStage').then((m) => ({ default: m.Signal3DStage }))
);

const Stage3DPlaceholder: React.FC<{ heightClass: string; label: string }> = ({ heightClass, label }) => (
  <div
    className={`oscilloscope-frame ${heightClass} w-full flex items-center justify-center text-xs font-mono text-slate-400`}
    role="status"
    aria-live="polite"
  >
    {label}
  </div>
);

const LazySignal3DStage: React.FC<Signal3DStageProps & { heightClass: string; loadingLabel: string }> = ({
  loadingLabel,
  ...props
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (nearViewport) return;
    const el = hostRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nearViewport]);

  const placeholder = <Stage3DPlaceholder heightClass={props.heightClass} label={loadingLabel} />;
  return (
    <div ref={hostRef}>
      {nearViewport ? <Suspense fallback={placeholder}>{<Signal3DStage {...props} />}</Suspense> : placeholder}
    </div>
  );
};

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

export type VisualizationTab = '3d' | 'combined' | 'spectrogram' | 'waveform' | 'spectrum';
export type SpectrogramInteractMode = 'click-tone' | 'multi-click' | 'box-select';

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

interface PinnedSignalPoint extends SelectedPoint {
  id: string;
  enabled: boolean;
  waveType: OscillatorType;
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
  { id: 'chirp', label: 'Chirp / Frequency Sweep', faLabel: 'جاروب فرکانسی (Chirp)' },
  { id: 'pulse', label: 'Pulse Train', faLabel: 'قطار پالس (Pulse)' },
  { id: 'am-fm', label: 'AM / FM Modulated', faLabel: 'سیگنال مدوله‌شده AM/FM' },
  { id: 'speech-synth', label: 'Speech Formants', faLabel: 'فرمانت‌های شبه‌گفتار' },
  { id: 'musical', label: 'Musical Harmonic Chord', faLabel: 'آکورد موسیقی هارمونیک' },
  { id: 'mixed', label: 'Custom Mixed Signal', faLabel: 'سیگنال ترکیبی سفارشی' },
];

// Logarithmic frequency axis helpers (10 Hz to maxFreq, default 20 kHz)
const MIN_LOG_FREQ = 10;

function normYToFreqLog(normY: number, maxFreq: number): number {
  const clamped = Math.max(0, Math.min(1, normY));
  const safeMax = Math.max(MIN_LOG_FREQ + 10, maxFreq);
  return MIN_LOG_FREQ * Math.pow(safeMax / MIN_LOG_FREQ, clamped);
}

function freqToNormYLog(freq: number, maxFreq: number): number {
  const safeMax = Math.max(MIN_LOG_FREQ + 10, maxFreq);
  const safeFreq = Math.max(MIN_LOG_FREQ, Math.min(safeMax, freq));
  return Math.log(safeFreq / MIN_LOG_FREQ) / Math.log(safeMax / MIN_LOG_FREQ);
}

function formatFreqLabel(fVal: number): string {
  if (fVal >= 1000) {
    const k = fVal / 1000;
    return Number.isInteger(k) ? `${k} kHz` : `${k.toFixed(1)} kHz`;
  }
  return `${Math.round(fVal)} Hz`;
}

// Viridis / Inferno-inspired scientific colormap for dB values in [-95, 0]
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
  const { lang, darkMode } = useLab();

  // Generator & Audio state
  const [sourceMode, setSourceMode] = useState<'generator' | 'uploaded' | 'microphone'>('generator');
  const [waveType, setWaveType] = useState<LiveWaveType>('sine');
  const [frequency, setFrequency] = useState<number>(20);
  const [sweepEndFreq, setSweepEndFreq] = useState<number>(12000);
  const [amplitude, setAmplitude] = useState<number>(0.5);
  const [durationSec] = useState<number>(8);
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [fftSize, setFftSize] = useState<number>(4096);
  const [maxFreqDisplay, setMaxFreqDisplay] = useState<number>(20000);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Microphone live spectrum state
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micPeakFreq, setMicPeakFreq] = useState<number>(0);
  const [micRmsDb, setMicRmsDb] = useState<number>(-95);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number | null>(null);
  const micStartTimeRef = useRef<number>(0);

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

  // Choosable SNR & Human Voice Clarity Engine (works on Uploaded Music & Generator)
  const [snrEnabled, setSnrEnabled] = useState<boolean>(false);
  const [showSnrDrawer, setShowSnrDrawer] = useState<boolean>(false);
  const [targetSnrDb, setTargetSnrDb] = useState<number>(6);
  const [snrMode, setSnrMode] = useState<'voice-in-music' | 'awgn' | 'pink' | 'babble' | 'hum'>(
    'voice-in-music'
  );
  const [vocalClarityMode, setVocalClarityMode] = useState<
    'off' | 'voice-boost' | 'strict-voice-bandpass' | 'instrumental-focus'
  >('off');
  const [voicePitchHz, setVoicePitchHz] = useState<number>(145);

  // Visualization & Interaction state
  const [vizTab, setVizTab] = useState<VisualizationTab>('3d');
  const [interactMode, setInteractMode] = useState<SpectrogramInteractMode>('click-tone');
  const [scrollingWaterfall, setScrollingWaterfall] = useState<boolean>(true);
  const [autoPlayClick, setAutoPlayClick] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>({
    time: 2.4,
    frequency: 20,
    magnitudeDb: -6.0,
    normX: 0.3,
    normY: freqToNormYLog(20, 20000),
  });

  // Multi-Click Pinned Signals & Frequency Range Synthesizer state
  const [pinnedPoints, setPinnedPoints] = useState<PinnedSignalPoint[]>([
    {
      id: 'pin-1',
      time: 1.8,
      frequency: 220,
      magnitudeDb: -12.0,
      normX: 0.22,
      normY: freqToNormYLog(220, 20000),
      enabled: true,
      waveType: 'sine',
    },
    {
      id: 'pin-2',
      time: 3.4,
      frequency: 440,
      magnitudeDb: -9.5,
      normX: 0.42,
      normY: freqToNormYLog(440, 20000),
      enabled: true,
      waveType: 'sine',
    },
    {
      id: 'pin-3',
      time: 5.1,
      frequency: 880,
      magnitudeDb: -14.2,
      normX: 0.64,
      normY: freqToNormYLog(880, 20000),
      enabled: true,
      waveType: 'sine',
    },
  ]);
  const [isPlayingMulti, setIsPlayingMulti] = useState<boolean>(false);
  const [activeSeqPinId, setActiveSeqPinId] = useState<string | null>(null);
  const [rangeStartFreq, setRangeStartFreq] = useState<number>(200);
  const [rangeEndFreq, setRangeEndFreq] = useState<number>(1600);
  const [rangeToneCount, setRangeToneCount] = useState<number>(8);
  const [isPlayingRange, setIsPlayingRange] = useState<boolean>(false);
  const multiOscsRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);
  const seqTimersRef = useRef<number[]>([]);

  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [dragBox, setDragBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [isSonifying, setIsSonifying] = useState<boolean>(false);
  const [isDecodingUpload, setIsDecodingUpload] = useState<boolean>(false);
  const [freqInvalid, setFreqInvalid] = useState<boolean>(false);

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
  const dragStartFreqRef = useRef<number | null>(null);

  // Direct DOM Tooltip Ref (avoids React re-renders on mouse move)
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Canvases & Spectrogram Matrix History
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenSpecCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenImageDataRef = useRef<ImageData | null>(null);
  const lastUiTimeUpdateRef = useRef<number>(0);

  // Store 180 time columns x 128 logarithmic frequency rows of dB values [-95..0]
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
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
          sample = ((2 * amp) / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
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
          const logStart = Math.log(Math.max(10, freq));
          const logEnd = Math.log(Math.max(20, endFreq));
          const instFreq = Math.exp(logStart + ((logEnd - logStart) * (t % dur)) / Math.max(0.1, dur));
          const phase =
            (2 * Math.PI * Math.max(0.1, dur) * (instFreq - freq)) /
            Math.max(0.01, logEnd - logStart);
          sample = amp * Math.sin(phase);
        } else if (type === 'pulse') {
          const cyclePos = (t * freq) % 1;
          sample = cyclePos < 0.15 ? amp : -amp * 0.15;
        } else if (type === 'am-fm') {
          const mod = Math.sin(2 * Math.PI * 6 * t);
          const instPhase = 2 * Math.PI * freq * t + 4 * Math.sin(2 * Math.PI * 4 * t);
          sample = amp * (0.65 + 0.35 * mod) * Math.sin(instPhase);
        } else if (type === 'speech-synth') {
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
                lyr.amplitude * (Math.sin(2 * Math.PI * lyr.frequency * t) >= 0 ? 1 : -1);
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

  // Apply Vocal Formant Clarity Filter & Exact Calibrated SNR (dB) to any audio sample array (Uploaded Music or Synth)
  const processSamplesWithSnrAndVoice = useCallback(
    (
      inputSamples: Float32Array,
      fs: number,
      enableSnr: boolean,
      snrDb: number,
      mode: 'voice-in-music' | 'awgn' | 'pink' | 'babble' | 'hum',
      clarity: 'off' | 'voice-boost' | 'strict-voice-bandpass' | 'instrumental-focus',
      f0Voice: number
    ): Float32Array => {
      const n = inputSamples.length;
      const out = new Float32Array(n);
      const safeFs = Math.max(8000, fs);

      // Step 1: Apply Real-Time Biquad Vocal Formant Filter (300 Hz - 3400 Hz human voice band)
      // High-pass @ 280 Hz + Low-pass @ 3400 Hz state variables
      const rcHp = 1 / (2 * Math.PI * 280);
      const dt = 1 / safeFs;
      const alphaHp = rcHp / (rcHp + dt);
      const rcLp = 1 / (2 * Math.PI * 3400);
      const alphaLp = dt / (rcLp + dt);

      let hpPrev = 0;
      let xPrev = 0;
      let lpPrev = 0;

      for (let i = 0; i < n; i++) {
        const x = inputSamples[i];
        hpPrev = alphaHp * (hpPrev + x - xPrev);
        xPrev = x;
        lpPrev = lpPrev + alphaLp * (hpPrev - lpPrev);
        const voiceBand = lpPrev;
        const nonVoiceBand = x - voiceBand;

        if (clarity === 'off') {
          out[i] = x;
        } else if (clarity === 'voice-boost') {
          // Boost vocal formants (+7.5 dB ≈ 2.37x) while gently attenuating non-vocal music bed
          out[i] = voiceBand * 2.15 + nonVoiceBand * 0.42;
        } else if (clarity === 'strict-voice-bandpass') {
          // Isolate 300 Hz - 3.4 kHz human voice band
          out[i] = voiceBand * 2.4;
        } else if (clarity === 'instrumental-focus') {
          // Suppress vocal center band to emphasize background music
          out[i] = nonVoiceBand * 1.25 + voiceBand * 0.18;
        }
      }

      // Step 2: If Choosable SNR is enabled, compute RMS power and mix at exact SNR (dB)
      if (enableSnr) {
        let sumSq = 0;
        for (let i = 0; i < n; i++) {
          sumSq += out[i] * out[i];
        }
        const sigRms = Math.max(0.015, Math.sqrt(sumSq / Math.max(1, n)));

        if (mode === 'voice-in-music') {
          // Synthesize articulated multi-formant human speech stream (vowels /a/ -> /e/ -> /i/ -> /o/)
          // and set exact SNR (dB) between the human voice and the music/signal bed
          const voiceBuf = new Float32Array(n);
          let vSumSq = 0;
          let phase0 = 0;
          for (let i = 0; i < n; i++) {
            const t = i / safeFs;
            const vibrato = 1 + 0.012 * Math.sin(2 * Math.PI * 5.4 * t);
            const instF0 = f0Voice * vibrato;
            phase0 += (2 * Math.PI * instF0) / safeFs;

            // Syllable articulation envelope (3.4 syllables/sec)
            const syllEnv =
              0.25 +
              0.75 * Math.pow(Math.max(0, Math.sin(Math.PI * 3.4 * t)), 1.6);

            // Moving vowel formants F1 (500-750Hz), F2 (1100-2200Hz), F3 (2500Hz)
            const f1 = 620 + 140 * Math.sin(2 * Math.PI * 0.85 * t);
            const f2 = 1580 + 480 * Math.cos(2 * Math.PI * 0.65 * t);
            const f3 = 2620 + 180 * Math.sin(2 * Math.PI * 1.1 * t);

            const glottal =
              0.52 * Math.sin(phase0) +
              0.31 * Math.sin(2 * phase0) +
              0.17 * Math.sin(3 * phase0);
            const formants =
              0.48 * Math.sin(2 * Math.PI * f1 * t) +
              0.34 * Math.sin(2 * Math.PI * f2 * t) +
              0.16 * Math.sin(2 * Math.PI * f3 * t);

            const vSample = syllEnv * (0.55 * glottal + 0.45 * formants);
            voiceBuf[i] = vSample;
            vSumSq += vSample * vSample;
          }
          const voiceRms = Math.max(1e-4, Math.sqrt(vSumSq / Math.max(1, n)));
          // Target SNR (dB) = 20 * log10(Voice_RMS / Background_RMS)
          // For positive SNR, voice is louder than background; for negative SNR, background masks voice
          const snrLinear = Math.pow(10, snrDb / 20);
          const targetVoiceRms = sigRms * snrLinear;
          const voiceScale = targetVoiceRms / voiceRms;

          for (let i = 0; i < n; i++) {
            out[i] = out[i] + voiceBuf[i] * voiceScale;
          }
        } else {
          // Noise floor modes: AWGN, Pink 1/f, Cocktail Babble, or 50/60 Hz Hum
          // SNR (dB) = 20 * log10(Signal_RMS / Noise_RMS) => Noise_RMS = Signal_RMS / 10^(SNR/20)
          const targetNoiseRms = sigRms / Math.pow(10, snrDb / 20);
          const noiseBuf = new Float32Array(n);
          let nSumSq = 0;
          let b0 = 0,
            b1 = 0,
            b2 = 0;

          for (let i = 0; i < n; i++) {
            const t = i / safeFs;
            let nVal = 0;
            if (mode === 'awgn') {
              nVal = Math.random() * 2 - 1;
            } else if (mode === 'pink') {
              const w = Math.random() * 2 - 1;
              b0 = 0.99765 * b0 + w * 0.099046;
              b1 = 0.963 * b1 + w * 0.2965164;
              b2 = 0.57 * b2 + w * 1.0526913;
              nVal = (b0 + b1 + b2 + w * 0.1848) * 0.12;
            } else if (mode === 'babble') {
              const env1 = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.7 * t);
              const env2 = 0.5 + 0.5 * Math.cos(2 * Math.PI * 3.9 * t + 1.1);
              nVal =
                env1 *
                  (0.4 * Math.sin(2 * Math.PI * 195 * t) +
                    0.35 * Math.sin(2 * Math.PI * 740 * t)) +
                env2 *
                  (0.4 * Math.sin(2 * Math.PI * 255 * t) +
                    0.3 * Math.sin(2 * Math.PI * 1320 * t)) +
                0.15 * (Math.random() * 2 - 1);
            } else if (mode === 'hum') {
              nVal =
                0.7 * Math.sin(2 * Math.PI * 50 * t) +
                0.25 * Math.sin(2 * Math.PI * 150 * t) +
                0.1 * Math.sin(2 * Math.PI * 250 * t);
            }
            noiseBuf[i] = nVal;
            nSumSq += nVal * nVal;
          }
          const rawNoiseRms = Math.max(1e-5, Math.sqrt(nSumSq / Math.max(1, n)));
          const noiseScale = targetNoiseRms / rawNoiseRms;

          for (let i = 0; i < n; i++) {
            out[i] = out[i] + noiseBuf[i] * noiseScale;
          }
        }
      }

      // Soft peak limiter to prevent digital clipping on speaker output
      let maxPeak = 0;
      for (let i = 0; i < n; i++) {
        const abs = Math.abs(out[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
      if (maxPeak > 0.96) {
        const norm = 0.94 / maxPeak;
        for (let i = 0; i < n; i++) {
          out[i] *= norm;
        }
      }

      return out;
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
      const effectiveDur = type === 'chirp' ? Math.min(8, dur) : Math.max(2.0, dur);
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
      const processed = processSamplesWithSnrAndVoice(
        raw,
        safeFs,
        snrEnabled,
        targetSnrDb,
        snrMode,
        vocalClarityMode,
        voicePitchHz
      );
      const buffer = ctx.createBuffer(1, numSamples, safeFs);
      buffer.getChannelData(0).set(processed);
      return buffer;
    },
    [
      processSamplesWithSnrAndVoice,
      snrEnabled,
      snrMode,
      synthesizeRawSamples,
      targetSnrDb,
      vocalClarityMode,
      voicePitchHz,
    ]
  );


  // Compute exact windowed spectral magnitude (in dB) mapped onto a LOGARITHMIC frequency axis (10 Hz .. maxFreq)
  const computeSliceSpectrumDb = useCallback(
    (
      channelData: Float32Array,
      fs: number,
      centerSample: number,
      maxFreq: number,
      numRows: number
    ): Float32Array => {
      const out = new Float32Array(numRows).fill(-95);
      // 4096-point FFT gives ~10.7 Hz bin spacing at 44.1 kHz, resolving 20 Hz cleanly on a log axis
      const N = 4096;
      const half = N >> 1;
      const start = Math.max(0, Math.min(Math.max(0, channelData.length - N), centerSample - half));

      const re = new Float32Array(N);
      const im = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const sample = channelData[(start + i) % Math.max(1, channelData.length)] ?? 0;
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

      const binMag = new Float32Array(half);
      const scale = 4 / N;
      for (let k = 0; k < half; k++) {
        binMag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * scale;
      }

      // Map FFT bins onto LOGARITHMIC spectrogram rows (MIN_LOG_FREQ = 10 Hz .. maxFreq)
      for (let r = 0; r < numRows; r++) {
        const fLow = normYToFreqLog(r / numRows, maxFreq);
        const fHigh = normYToFreqLog((r + 1) / numRows, maxFreq);
        const fCenter = normYToFreqLog((r + 0.5) / numRows, maxFreq);

        const exactK = (fCenter * N) / fs;
        const k0 = Math.floor((fLow * N) / fs);
        const k1 = Math.ceil((fHigh * N) / fs);

        let magVal = 0;
        if (k1 - k0 <= 2) {
          // Smooth fractional bin interpolation for narrow low-frequency log rows (10 Hz - 150 Hz)
          const idxL = Math.max(1, Math.min(half - 2, Math.floor(exactK)));
          const frac = exactK - idxL;
          magVal = binMag[idxL] * (1 - frac) + binMag[idxL + 1] * frac;
        } else {
          // Peak aggregation across wider high-frequency log bands
          const startK = Math.max(1, Math.min(half - 1, k0));
          const endK = Math.max(startK, Math.min(half - 1, k1));
          for (let k = startK; k <= endK; k++) {
            if (binMag[k] > magVal) magVal = binMag[k];
          }
        }

        const db = 20 * Math.log10(Math.max(1e-5, magVal));
        out[r] = Math.max(-95, Math.min(0, db));
      }

      return out;
    },
    []
  );

  // Precompute spectrogram matrix using fast keyframe evaluation
  const precomputeBufferSpectrogram = useCallback(
    (buf: AudioBuffer, maxFreq: number, isTimeVarying = false) => {
      const ch = buf.getChannelData(0);
      const fs = buf.sampleRate;
      const dur = buf.duration;
      const cols: Float32Array[] = new Array(SPEC_COLS);
      const times = new Float32Array(SPEC_COLS);

      const numKeyframes = isTimeVarying ? 48 : 8;
      const keyframes: Float32Array[] = new Array(numKeyframes);
      for (let k = 0; k < numKeyframes; k++) {
        const ratio = k / Math.max(1, numKeyframes - 1);
        const centerIdx = Math.floor(ratio * Math.max(0, ch.length - 1));
        keyframes[k] = computeSliceSpectrumDb(ch, fs, centerIdx, maxFreq, SPEC_ROWS);
      }

      for (let c = 0; c < SPEC_COLS; c++) {
        const ratio = c / Math.max(1, SPEC_COLS - 1);
        times[c] = ratio * dur;
        if (isTimeVarying) {
          const exactKf = ratio * (numKeyframes - 1);
          const k0 = Math.floor(exactKf);
          const k1 = Math.min(numKeyframes - 1, k0 + 1);
          const frac = exactKf - k0;
          if (frac < 0.01 || k0 === k1) {
            cols[c] = keyframes[k0];
          } else {
            const interp = new Float32Array(SPEC_ROWS);
            const row0 = keyframes[k0];
            const row1 = keyframes[k1];
            for (let r = 0; r < SPEC_ROWS; r++) {
              interp[r] = row0[r] * (1 - frac) + row1[r] * frac;
            }
            cols[c] = interp;
          }
        } else {
          cols[c] = keyframes[c % numKeyframes];
        }
      }
      specMatrixRef.current = cols;
      specTimesRef.current = times;

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
        cols[
          Math.min(
            SPEC_COLS - 1,
            Math.floor((pauseOffsetRef.current / Math.max(0.01, dur)) * SPEC_COLS)
          )
        ] || cols[0];
    },
    [computeSliceSpectrumDb]
  );

  // Render all active canvases (Waveform, Log-Spectrum, Log-Spectrogram)
  const renderCanvases = useCallback(
    (playheadSec: number) => {
      const dur = Math.max(0.1, totalDuration);

      // 1. Render Waveform Canvas
      const waveCanvas = waveformCanvasRef.current;
      if (waveCanvas) {
        const w = waveCanvas.parentElement?.clientWidth || 560;
        const h = vizTab === 'waveform' ? 270 : 175;
        if (waveCanvas.width !== w || waveCanvas.height !== h) {
          waveCanvas.width = w;
          waveCanvas.height = h;
        }
        const ctx = waveCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050912';
          ctx.fillRect(0, 0, w, h);

          const padL = 46;
          const padR = 16;
          const padT = 14;
          const padB = 24;
          const pw = w - padL - padR;
          const ph = h - padT - padB;
          const cy = padT + ph / 2;

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.13)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padL, cy);
          ctx.lineTo(padL + pw, cy);
          ctx.moveTo(padL, padT);
          ctx.lineTo(padL, padT + ph);
          ctx.stroke();

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

          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('+1.0', padL - 6, padT + 8);
          ctx.fillText('0.0', padL - 6, cy + 3);
          ctx.fillText('-1.0', padL - 6, padT + ph);
          ctx.textAlign = 'left';
          ctx.fillText(`t = ${playheadSec.toFixed(2)} s`, padL + 6, h - 7);
          ctx.textAlign = 'right';
          ctx.fillText('Time Domain', w - padR, h - 7);
        }
      }

      // 2. Render Logarithmic Frequency Spectrum Canvas
      const specCanvas = spectrumCanvasRef.current;
      if (specCanvas) {
        const w = specCanvas.parentElement?.clientWidth || 560;
        const h = vizTab === 'spectrum' ? 270 : 175;
        if (specCanvas.width !== w || specCanvas.height !== h) {
          specCanvas.width = w;
          specCanvas.height = h;
        }
        const ctx = specCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050912';
          ctx.fillRect(0, 0, w, h);

          const padL = 46;
          const padR = 16;
          const padT = 14;
          const padB = 24;
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

          // Logarithmic X-axis ticks (20 Hz, 100 Hz, 1 kHz, 10 kHz, 20 kHz)
          const logTicks = [20, 100, 1000, 10000, maxFreqDisplay].filter(
            (v, idx, arr) => v <= maxFreqDisplay && arr.indexOf(v) === idx
          );
          ctx.textAlign = 'center';
          for (const tk of logTicks) {
            const nx = freqToNormYLog(tk, maxFreqDisplay);
            const tx = padL + nx * pw;
            ctx.fillText(formatFreqLabel(tk), tx, h - 7);
          }
        }
      }

      // 3. Render Interactive Logarithmic Spectrogram Canvas
      const sgCanvas = spectrogramCanvasRef.current;
      if (sgCanvas) {
        const w = sgCanvas.parentElement?.clientWidth || 900;
        const h = vizTab === 'spectrogram' ? 390 : 320;
        if (sgCanvas.width !== w || sgCanvas.height !== h) {
          sgCanvas.width = w;
          sgCanvas.height = h;
        }
        const ctx = sgCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050912';
          ctx.fillRect(0, 0, w, h);

          const padL = 62;
          const padR = 54;
          const padT = 16;
          const padB = 30;
          const pw = Math.max(80, w - padL - padR);
          const ph = Math.max(80, h - padT - padB);

          const matrix = specMatrixRef.current;
          const nCols = matrix.length;
          const nRows = matrix[0]?.length || SPEC_ROWS;

          // Ultra-fast ImageData blit via offscreen canvas
          if (!offscreenSpecCanvasRef.current) {
            const oc = document.createElement('canvas');
            oc.width = nCols;
            oc.height = nRows;
            offscreenSpecCanvasRef.current = oc;
            offscreenImageDataRef.current =
              oc.getContext('2d')?.createImageData(nCols, nRows) || null;
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

          // Logarithmic Frequency Y-Axis Grid Lines & Labels (20 Hz, 50 Hz, 100 Hz, 250 Hz, 500 Hz, 1 kHz, 2.5 kHz, 5 kHz, 10 kHz, 20 kHz)
          const logFreqTicks = [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000].filter(
            (f) => f <= maxFreqDisplay
          );
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
          ctx.lineWidth = 1;
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10px "IBM Plex Mono", monospace';
          for (const fVal of logFreqTicks) {
            const normY = freqToNormYLog(fVal, maxFreqDisplay);
            const py = padT + (1 - normY) * ph;
            ctx.beginPath();
            ctx.moveTo(padL, py);
            ctx.lineTo(padL + pw, py);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatFreqLabel(fVal), padL - 6, py);
          }

          // Time X-axis ticks
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

          // Draw Pinned Multi-Click Signals on Logarithmic Y-Axis
          if (pinnedPoints.length > 0) {
            pinnedPoints.forEach((pt, idx) => {
              const px = padL + Math.max(0, Math.min(1, pt.normX)) * pw;
              const py = padT + (1 - freqToNormYLog(pt.frequency, maxFreqDisplay)) * ph;
              const isSeqActive = activeSeqPinId === pt.id;

              ctx.strokeStyle = pt.enabled
                ? isSeqActive
                  ? '#f59e0b'
                  : 'rgba(127, 209, 65, 0.65)'
                : 'rgba(148, 163, 184, 0.3)';
              ctx.setLineDash([3, 3]);
              ctx.lineWidth = isSeqActive ? 2 : 1.1;
              ctx.beginPath();
              ctx.moveTo(padL, py);
              ctx.lineTo(padL + pw, py);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = pt.enabled ? (isSeqActive ? '#f59e0b' : '#7FD141') : '#64748b';
              ctx.strokeStyle = '#050912';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.arc(px, py, isSeqActive ? 7.5 : 6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();

              // Draw badge label (#1, #2, ...)
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 9px "IBM Plex Mono", monospace';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              ctx.fillText(`#${idx + 1} ${Math.round(pt.frequency)}Hz`, Math.min(padL + pw - 58, px + 8), Math.max(padT + 12, py - 4));
            });
          }

          // Draw Selected Point Crosshair Marker on Logarithmic Y-Axis
          if (selectedPoint) {
            const sx = padL + Math.max(0, Math.min(1, selectedPoint.normX)) * pw;
            const sy =
              padT + (1 - freqToNormYLog(selectedPoint.frequency, maxFreqDisplay)) * ph;

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

          // Draw Selected Region Box on Logarithmic Y-Axis
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
            const y1 = padT + (1 - freqToNormYLog(selectedRegion.f2, maxFreqDisplay)) * ph;
            const y2 = padT + (1 - freqToNormYLog(selectedRegion.f1, maxFreqDisplay)) * ph;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          }
        }
      }
    },
    [
      activeSeqPinId,
      dragBox,
      maxFreqDisplay,
      pinnedPoints,
      scrollingWaterfall,
      selectedPoint,
      selectedRegion,
      totalDuration,
      vizTab,
    ]
  );

  // Instantaneous (<0.2ms) visual preview update on any frequency/waveform/button change
  useEffect(() => {
    if (sourceMode === 'generator') {
      const safeFs = Math.max(8000, Math.min(48000, sampleRate));
      const isChirp = waveType === 'chirp';
      const previewLen = isChirp ? 16384 : 8192;
      const rawPreviewSamples = synthesizeRawSamples(
        previewLen,
        waveType,
        frequency,
        sweepEndFreq,
        amplitude,
        isChirp ? previewLen / safeFs : durationSec,
        safeFs,
        mixLayers
      );
      const previewSamples = processSamplesWithSnrAndVoice(
        rawPreviewSamples,
        safeFs,
        snrEnabled,
        targetSnrDb,
        snrMode,
        vocalClarityMode,
        voicePitchHz
      );

      const waveOut = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        waveOut[i] = previewSamples[i * 2] ?? 0;
      }
      liveWaveSliceRef.current = waveOut;

      const isDynamicPreview =
        isChirp ||
        (snrEnabled && (snrMode === 'voice-in-music' || snrMode === 'babble'));

      if (!isDynamicPreview) {
        const singleCol = computeSliceSpectrumDb(
          previewSamples,
          safeFs,
          4096,
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
        const numKf = 18;
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

      activeBufferRef.current = null;
      renderCanvases(pauseOffsetRef.current);

      if (isPlaying) {
        const timer = window.setTimeout(() => {
          startPlayback(pauseOffsetRef.current);
        }, 70);
        return () => window.clearTimeout(timer);
      }
    } else if (sourceMode === 'uploaded' && uploadedBufferRef.current) {
      const timer = window.setTimeout(() => {
        const origBuf = uploadedBufferRef.current;
        if (!origBuf) return;
        const rawCh = origBuf.getChannelData(0);
        const processedCh = processSamplesWithSnrAndVoice(
          rawCh,
          origBuf.sampleRate,
          snrEnabled,
          targetSnrDb,
          snrMode,
          vocalClarityMode,
          voicePitchHz
        );
        const procBuf = new AudioBuffer({
          length: processedCh.length,
          sampleRate: origBuf.sampleRate,
          numberOfChannels: 1,
        });
        procBuf.getChannelData(0).set(processedCh);
        activeBufferRef.current = procBuf;
        setTotalDuration(procBuf.duration);
        precomputeBufferSpectrogram(procBuf, maxFreqDisplay, true);
        renderCanvases(pauseOffsetRef.current);

        if (isPlaying) {
          startPlayback(pauseOffsetRef.current);
        }
      }, 45);
      return () => window.clearTimeout(timer);
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
    snrEnabled,
    targetSnrDb,
    snrMode,
    vocalClarityMode,
    voicePitchHz,
    computeSliceSpectrumDb,
    getOrCreateAudioContext,
    precomputeBufferSpectrogram,
    processSamplesWithSnrAndVoice,
    synthesizeRawSamples,
  ]);

  // Re-render canvases when selection/tab changes
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

  // Stop active microphone stream & analyser loop
  const stopMicrophone = useCallback(() => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    micAnalyserRef.current = null;
    setIsMicActive(false);
  }, []);

  // Start Live Microphone Spectrum, Waveform & Scrolling Spectrogram
  const startMicrophone = useCallback(async () => {
    setMicError(null);
    stopSourceNode();
    setIsPlaying(false);
    stopMicrophone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const ctx = getOrCreateAudioContext();
      const micSource = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.52;
      analyser.minDecibels = -95;
      analyser.maxDecibels = 0;

      // Connect microphone to AnalyserNode only (not ctx.destination) to avoid speaker feedback loop
      micSource.connect(analyser);

      micStreamRef.current = stream;
      micSourceRef.current = micSource;
      micAnalyserRef.current = analyser;
      micStartTimeRef.current = ctx.currentTime;
      setSourceMode('microphone');
      setIsMicActive(true);
      setScrollingWaterfall(true);

      const timeData = new Float32Array(analyser.fftSize);
      const freqData = new Float32Array(analyser.frequencyBinCount);
      const nyquist = ctx.sampleRate / 2;

      const tickMic = () => {
        if (!micAnalyserRef.current || !audioCtxRef.current) return;
        const an = micAnalyserRef.current;
        an.getFloatTimeDomainData(timeData);
        an.getFloatFrequencyData(freqData);

        // 1. Update live time-domain waveform slice & compute RMS dB
        const waveOut = new Float32Array(512);
        let sumSq = 0;
        for (let i = 0; i < 512; i++) {
          const v = timeData[i * 2] ?? 0;
          waveOut[i] = v;
          sumSq += v * v;
        }
        liveWaveSliceRef.current = waveOut;
        const rms = Math.sqrt(sumSq / 512);
        const rmsDb = Math.max(-95, Math.min(0, 20 * Math.log10(rms + 1e-6)));

        // 2. Map linear FFT bins from AnalyserNode onto SPEC_ROWS logarithmic frequency rows (10 Hz .. maxFreqDisplay)
        const specCol = new Float32Array(SPEC_ROWS);
        const binCount = freqData.length;
        for (let r = 0; r < SPEC_ROWS; r++) {
          const fLow = normYToFreqLog(r / SPEC_ROWS, maxFreqDisplay);
          const fHigh = normYToFreqLog((r + 1) / SPEC_ROWS, maxFreqDisplay);
          const fCenter = normYToFreqLog((r + 0.5) / SPEC_ROWS, maxFreqDisplay);
          const b0 = Math.max(0, Math.min(binCount - 1, Math.floor((fLow / nyquist) * binCount)));
          const b1 = Math.max(b0, Math.min(binCount - 1, Math.ceil((fHigh / nyquist) * binCount)));

          if (b1 <= b0 + 1) {
            // Fractional bin interpolation for smooth low-frequency logarithmic rows
            const exactBin = Math.max(0, Math.min(binCount - 1.001, (fCenter / nyquist) * binCount));
            const bi = Math.floor(exactBin);
            const frac = exactBin - bi;
            const v0 = Number.isFinite(freqData[bi]) ? freqData[bi] : -95;
            const v1 = Number.isFinite(freqData[bi + 1]) ? freqData[bi + 1] : -95;
            specCol[r] = Math.max(-95, Math.min(0, v0 * (1 - frac) + v1 * frac));
          } else {
            let maxBinDb = -95;
            for (let b = b0; b <= b1; b++) {
              const val = Number.isFinite(freqData[b]) ? freqData[b] : -95;
              if (val > maxBinDb) maxBinDb = val;
            }
            specCol[r] = Math.max(-95, Math.min(0, maxBinDb));
          }
        }
        liveSpecRowRef.current = specCol;

        // Find dominant peak frequency in audible range
        let maxDbVal = -95;
        let maxBinIdx = 1;
        for (let b = 1; b < binCount; b++) {
          if (freqData[b] > maxDbVal) {
            maxDbVal = freqData[b];
            maxBinIdx = b;
          }
        }
        const dominantHz = (maxBinIdx / binCount) * nyquist;

        const elapsed = audioCtxRef.current.currentTime - micStartTimeRef.current;
        specMatrixRef.current.shift();
        specMatrixRef.current.push(specCol);
        const nextTimes = new Float32Array(SPEC_COLS);
        for (let c = 0; c < SPEC_COLS - 1; c++) {
          nextTimes[c] = specTimesRef.current[c + 1];
        }
        nextTimes[SPEC_COLS - 1] = elapsed;
        specTimesRef.current = nextTimes;

        const nowMs = performance.now();
        if (nowMs - lastUiTimeUpdateRef.current > 90) {
          lastUiTimeUpdateRef.current = nowMs;
          setCurrentTime(elapsed);
          setTotalDuration(Math.max(8, elapsed));
          setMicPeakFreq(Math.round(dominantHz));
          setMicRmsDb(rmsDb);
        }

        renderCanvases(elapsed);
        micRafRef.current = requestAnimationFrame(tickMic);
      };

      micRafRef.current = requestAnimationFrame(tickMic);
    } catch {
      setMicError(
        lang === 'fa'
          ? 'دسترسی به میکروفون امکان‌پذیر نشد. لطفاً مجوز میکروفون مرورگر را فعال کنید.'
          : 'Microphone access denied or unavailable. Please allow microphone permission in your browser.'
      );
      setIsMicActive(false);
    }
  }, [getOrCreateAudioContext, lang, maxFreqDisplay, renderCanvases, stopMicrophone, stopSourceNode]);

  // Stop multi-signal or range oscillators
  const stopMultiSignals = useCallback(() => {
    seqTimersRef.current.forEach((id) => window.clearTimeout(id));
    seqTimersRef.current = [];
    setActiveSeqPinId(null);

    if (multiOscsRef.current.length > 0 && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      multiOscsRef.current.forEach(({ osc, gain }) => {
        try {
          gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
          osc.stop(ctx.currentTime + 0.06);
        } catch {
          // ignore
        }
      });
      multiOscsRef.current = [];
    }
    setIsPlayingMulti(false);
    setIsPlayingRange(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSourceNode();
      stopMicrophone();
      stopMultiSignals();
      if (previewOscRef.current) {
        try {
          previewOscRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [stopMicrophone, stopMultiSignals, stopSourceNode]);

  const handlePause = () => {
    stopSourceNode();
    stopMicrophone();
    setIsPlaying(false);
  };

  const handleStop = () => {
    stopSourceNode();
    stopMicrophone();
    stopMultiSignals();
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    renderCanvases(0);
  };

  const handleSeek = (newTime: number) => {
    if (isMicActive) return;
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

  // Sonify Selected Region (Time Range x Logarithmic Frequency Range) via Additive Sinusoidal Resynthesis
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
      Math.floor(freqToNormYLog(selectedRegion.f1, maxFreqDisplay) * (SPEC_ROWS - 1))
    );
    const rEnd = Math.min(
      SPEC_ROWS - 1,
      Math.ceil(freqToNormYLog(selectedRegion.f2, maxFreqDisplay) * (SPEC_ROWS - 1))
    );

    const rowScores: { row: number; freq: number; meanAmp: number }[] = [];
    for (let r = rStart; r <= rEnd; r++) {
      let sumLin = 0;
      for (let c = cStart; c <= cEnd; c++) {
        sumLin += Math.pow(10, matrix[c][r] / 20);
      }
      const meanAmp = sumLin / Math.max(1, cEnd - cStart + 1);
      rowScores.push({
        row: r,
        freq: normYToFreqLog((r + 0.5) / SPEC_ROWS, maxFreqDisplay),
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
      const fade =
        Math.min(1, i / (fs * 0.03)) * Math.min(1, (numSamples - i) / (fs * 0.03));
      outData[i] = s * fade;
    }

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

  // Convert client (x, y) on Spectrogram Canvas to (time, logarithmic frequency, magnitudeDb)
  const getSpectrogramCoordsFromClient = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) => {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const padL = 62;
    const padR = 54;
    const padT = 16;
    const padB = 30;
    const pw = Math.max(80, canvas.width - padL - padR);
    const ph = Math.max(80, canvas.height - padT - padB);

    const normX = Math.max(0, Math.min(1, (px - padL) / pw));
    const normY = Math.max(0, Math.min(1, 1 - (py - padT) / ph));

    const cIdx = Math.min(SPEC_COLS - 1, Math.max(0, Math.floor(normX * SPEC_COLS)));
    const rIdx = Math.min(SPEC_ROWS - 1, Math.max(0, Math.floor(normY * SPEC_ROWS)));
    const time = scrollingWaterfall
      ? specTimesRef.current[cIdx] ?? normX * totalDuration
      : normX * totalDuration;
    const freq = normYToFreqLog(normY, maxFreqDisplay);
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

  // Play all enabled pinned signals simultaneously (Polyphonic Chord / Harmonic Bank)
  const playPinnedSignalsSimultaneous = useCallback(
    (durationMs = 1400) => {
      const activePins = pinnedPoints.filter((p) => p.enabled);
      if (activePins.length === 0) return;

      if (isPlayingMulti) {
        stopMultiSignals();
        return;
      }

      stopMultiSignals();
      const ctx = getOrCreateAudioContext();
      setIsPlayingMulti(true);

      const masterGain = (isMuted ? 0.28 : Math.max(0.18, volume)) * (0.65 / Math.sqrt(activePins.length));
      const created: { osc: OscillatorNode; gain: GainNode }[] = [];

      activePins.forEach((pt) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = pt.waveType || 'sine';
        osc.frequency.setValueAtTime(Math.max(16, Math.min(20000, pt.frequency)), ctx.currentTime);

        gain.gain.setValueAtTime(0.0005, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(masterGain, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + durationMs / 1000
        );

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000 + 0.04);
        created.push({ osc, gain });
      });

      multiOscsRef.current = created;
      const timerId = window.setTimeout(() => {
        setIsPlayingMulti(false);
        multiOscsRef.current = [];
      }, durationMs + 50);
      seqTimersRef.current.push(timerId);
    },
    [getOrCreateAudioContext, isMuted, isPlayingMulti, pinnedPoints, stopMultiSignals, volume]
  );

  // Play all enabled pinned signals sequentially (Arpeggio / Step Sequence)
  const playPinnedSignalsSequence = useCallback(() => {
    const activePins = pinnedPoints.filter((p) => p.enabled);
    if (activePins.length === 0) return;

    stopMultiSignals();
    setIsPlayingMulti(true);
    const stepMs = 360;

    activePins.forEach((pt, idx) => {
      const tId = window.setTimeout(() => {
        setActiveSeqPinId(pt.id);
        playFrequencyTone(pt.frequency, stepMs - 30);
      }, idx * stepMs);
      seqTimersRef.current.push(tId);
    });

    const endId = window.setTimeout(() => {
      setActiveSeqPinId(null);
      setIsPlayingMulti(false);
    }, activePins.length * stepMs + 40);
    seqTimersRef.current.push(endId);
  }, [pinnedPoints, playFrequencyTone, stopMultiSignals]);

  // Play a continuous or multi-tone Range of Signals [fStart .. fEnd]
  const playFrequencyRangeSignal = useCallback(
    (mode: 'harmonic-bank' | 'sweep', customF1?: number, customF2?: number) => {
      const f1 = Math.max(16, Math.min(20000, Math.min(customF1 ?? rangeStartFreq, customF2 ?? rangeEndFreq)));
      const f2 = Math.max(f1 + 5, Math.min(20000, Math.max(customF1 ?? rangeStartFreq, customF2 ?? rangeEndFreq)));

      stopMultiSignals();
      const ctx = getOrCreateAudioContext();
      setIsPlayingRange(true);
      const durSec = 1.6;

      if (mode === 'sweep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f1, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + durSec);

        const peak = (isMuted ? 0.28 : Math.max(0.18, volume)) * 0.5;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durSec);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durSec + 0.04);
        multiOscsRef.current = [{ osc, gain }];
      } else {
        // Multi-Tone Harmonic Bank across [f1 .. f2]
        const count = Math.max(2, Math.min(16, rangeToneCount));
        const perOscGain = (isMuted ? 0.28 : Math.max(0.18, volume)) * (0.6 / Math.sqrt(count));
        const created: { osc: OscillatorNode; gain: GainNode }[] = [];

        for (let i = 0; i < count; i++) {
          const ratio = count === 1 ? 0.5 : i / (count - 1);
          const freq = f1 * Math.pow(f2 / f1, ratio);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(perOscGain, ctx.currentTime + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durSec);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + durSec + 0.04);
          created.push({ osc, gain });
        }
        multiOscsRef.current = created;
      }

      const endTimer = window.setTimeout(() => {
        setIsPlayingRange(false);
        multiOscsRef.current = [];
      }, durSec * 1000 + 60);
      seqTimersRef.current.push(endTimer);
    },
    [getOrCreateAudioContext, isMuted, rangeEndFreq, rangeStartFreq, rangeToneCount, stopMultiSignals, volume]
  );

  // Pin a point to the Multi-Signal Bank
  const addPinnedPoint = useCallback((pt: SelectedPoint) => {
    setPinnedPoints((prev) => [
      ...prev.slice(-9), // keep up to 10 pinned signals clean
      {
        ...pt,
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        enabled: true,
        waveType: 'sine',
      },
    ]);
  }, []);

  const handleSpecMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSpectrogramCoords(e);
    isPointerDownRef.current = true;
    dragStartFreqRef.current = coords.frequency;

    if (interactMode === 'click-tone' || interactMode === 'multi-click') {
      const newPt: SelectedPoint = {
        time: coords.time,
        frequency: coords.frequency,
        magnitudeDb: coords.magnitudeDb,
        normX: coords.normX,
        normY: coords.normY,
      };
      setSelectedPoint(newPt);
      if (interactMode === 'multi-click') {
        addPinnedPoint(newPt);
      }
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

    // Update floating tooltip via direct DOM ref (zero React re-render overhead!)
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'block';
      tooltipRef.current.style.left = `${Math.min(coords.px + 14, 520)}px`;
      tooltipRef.current.style.top = `${Math.max(12, coords.py - 56)}px`;
      tooltipRef.current.innerHTML = `
        <div>Time: ${coords.time.toFixed(2)} s</div>
        <div class="text-sky-400 font-bold">Frequency: ${Math.round(coords.frequency).toLocaleString()} Hz</div>
        <div class="text-emerald-400">Magnitude: ${coords.magnitudeDb.toFixed(1)} dB</div>
      `;
    }

    if (!isPointerDownRef.current) return;

    if (interactMode === 'click-tone' || interactMode === 'multi-click') {
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
      setDragBox((prev) => (prev ? { ...prev, x2: coords.px, y2: coords.py } : null));
    }
  };

  const handleSpecMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (interactMode === 'click-tone' || interactMode === 'multi-click') {
      stopDragTone();
      const coords = getSpectrogramCoords(e);
      if (
        dragStartFreqRef.current !== null &&
        Math.abs(coords.frequency - dragStartFreqRef.current) > 25
      ) {
        const fMin = Math.round(Math.min(dragStartFreqRef.current, coords.frequency));
        const fMax = Math.round(Math.max(dragStartFreqRef.current, coords.frequency));
        setRangeStartFreq(Math.max(16, fMin));
        setRangeEndFreq(Math.min(20000, fMax));
      }
      dragStartFreqRef.current = null;
    } else if (dragBox) {
      const canvas = e.currentTarget;
      const padL = 62;
      const padR = 54;
      const padT = 16;
      const padB = 30;
      const pw = Math.max(80, canvas.width - padL - padR);
      const ph = Math.max(80, canvas.height - padT - padB);

      const xMin = Math.max(padL, Math.min(dragBox.x1, dragBox.x2));
      const xMax = Math.min(padL + pw, Math.max(dragBox.x1, dragBox.x2));
      const yMin = Math.max(padT, Math.min(dragBox.y1, dragBox.y2));
      const yMax = Math.min(padT + ph, Math.max(dragBox.y1, dragBox.y2));

      if (xMax - xMin > 8 && yMax - yMin > 8) {
        const t1 = ((xMin - padL) / pw) * totalDuration;
        const t2 = ((xMax - padL) / pw) * totalDuration;
        const f2 = normYToFreqLog(1 - (yMin - padT) / ph, maxFreqDisplay);
        const f1 = normYToFreqLog(1 - (yMax - padT) / ph, maxFreqDisplay);

        const c1 = Math.max(0, Math.floor(((xMin - padL) / pw) * (SPEC_COLS - 1)));
        const c2 = Math.min(SPEC_COLS - 1, Math.ceil(((xMax - padL) / pw) * (SPEC_COLS - 1)));
        const r1 = Math.max(0, Math.floor(freqToNormYLog(f1, maxFreqDisplay) * (SPEC_ROWS - 1)));
        const r2 = Math.min(
          SPEC_ROWS - 1,
          Math.ceil(freqToNormYLog(f2, maxFreqDisplay) * (SPEC_ROWS - 1))
        );
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
        const safeF1 = Math.max(MIN_LOG_FREQ, f1);
        const safeF2 = Math.max(MIN_LOG_FREQ + 5, f2);
        setSelectedRegion({
          t1,
          t2,
          f1: safeF1,
          f2: safeF2,
          peakDb,
          meanDb: count > 0 ? sumDb / count : -80,
        });
        setRangeStartFreq(Math.round(safeF1));
        setRangeEndFreq(Math.round(safeF2));
      }
      setDragBox(null);
    }
  };

  // Handle Uploaded Audio File (WAV, MP3, OGG, M4A)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopSourceNode();
    stopMultiSignals();
    setIsPlaying(false);
    setIsDecodingUpload(true);

    try {
      const ctx = getOrCreateAudioContext();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      uploadedBufferRef.current = decoded;

      const processedSamples = processSamplesWithSnrAndVoice(
        decoded.getChannelData(0),
        decoded.sampleRate,
        snrEnabled,
        targetSnrDb,
        snrMode,
        vocalClarityMode,
        voicePitchHz
      );
      const procBuf = ctx.createBuffer(1, processedSamples.length, decoded.sampleRate);
      procBuf.getChannelData(0).set(processedSamples);

      activeBufferRef.current = procBuf;
      setUploadedFileName(file.name);
      setSourceMode('uploaded');
      setTotalDuration(procBuf.duration);
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
      const autoMaxFreq = 20000;
      setMaxFreqDisplay(autoMaxFreq);
      precomputeBufferSpectrogram(procBuf, autoMaxFreq, true);
      startPlayback(0);
    } catch {
      // ignore invalid audio format
    } finally {
      setIsDecodingUpload(false);
    }
    e.target.value = '';
  };

  // Load Built-In Demo Vocal + Music Track so users can test Voice Clarity & Choosable SNR immediately
  const loadDemoVocalMusicTrack = useCallback(() => {
    stopSourceNode();
    stopMultiSignals();
    const ctx = getOrCreateAudioContext();
    const fs = 44100;
    const dur = 6.0;
    const N = Math.round(fs * dur);
    const rawBuf = ctx.createBuffer(1, N, fs);
    const ch = rawBuf.getChannelData(0);

    // Synthesize a realistic polyphonic music backing (sub-bass 73Hz/98Hz + high-hat shimmer 7.5kHz)
    // layered with a singing human vowel formant melody (F0 = 196Hz -> 220Hz -> 261.6Hz -> 293.6Hz with vowel formants F1=730Hz, F2=1290Hz, F3=2440Hz)
    const melodyNotes = [196.0, 220.0, 246.94, 261.63, 293.66, 246.94];
    for (let i = 0; i < N; i++) {
      const t = i / fs;
      const barIdx = Math.min(melodyNotes.length - 1, Math.floor(t));
      const f0 = melodyNotes[barIdx] * (1 + 0.012 * Math.sin(2 * Math.PI * 5.4 * t)); // natural vocal vibrato
      const syllableEnv = Math.sin(Math.PI * (t % 1.0)) * 0.85 + 0.15;

      // Human singing voice (fundamental + F1/F2/F3 vocal tract formants in 300Hz-3.4kHz band)
      const humanVoice =
        syllableEnv *
        (0.28 * Math.sin(2 * Math.PI * f0 * t) +
          0.36 * Math.sin(2 * Math.PI * f0 * 3 * t) +
          0.32 * Math.sin(2 * Math.PI * 730 * t) +
          0.26 * Math.sin(2 * Math.PI * 1290 * t) +
          0.18 * Math.sin(2 * Math.PI * 2440 * t));

      // Sub-bass & warm chord pad (65Hz - 165Hz) + high acoustic percussion shimmer (6.5kHz - 9kHz)
      const bassNote = barIdx % 2 === 0 ? 65.41 : 82.41;
      const subBass =
        0.38 * Math.sin(2 * Math.PI * bassNote * t) +
        0.22 * Math.sin(2 * Math.PI * bassNote * 1.5 * t);
      const beatEnv = Math.exp(-14 * (t % 0.5));
      const highPerc = beatEnv * 0.16 * (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 7200 * t);

      ch[i] = Math.max(-0.95, Math.min(0.95, 0.55 * humanVoice + 0.5 * subBass + highPerc));
    }

    uploadedBufferRef.current = rawBuf;
    const processed = processSamplesWithSnrAndVoice(
      ch,
      fs,
      snrEnabled,
      targetSnrDb,
      snrMode,
      vocalClarityMode,
      voicePitchHz
    );
    const procBuf = ctx.createBuffer(1, N, fs);
    procBuf.getChannelData(0).set(processed);

    activeBufferRef.current = procBuf;
    setUploadedFileName('Vocal_Music_Mix_Demo.wav');
    setSourceMode('uploaded');
    setTotalDuration(dur);
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
    precomputeBufferSpectrogram(procBuf, maxFreqDisplay, true);
    startPlayback(0);
  }, [
    getOrCreateAudioContext,
    maxFreqDisplay,
    precomputeBufferSpectrogram,
    processSamplesWithSnrAndVoice,
    snrEnabled,
    snrMode,
    startPlayback,
    stopMultiSignals,
    stopSourceNode,
    targetSnrDb,
    vocalClarityMode,
    voicePitchHz,
  ]);

  // Convenient Preset Buttons
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
        normY: freqToNormYLog(20, 20000),
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
        normY: freqToNormYLog(100, 20000),
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
        normY: freqToNormYLog(1000, 20000),
      });
    } else if (preset === 'chirp') {
      setWaveType('chirp');
      setFrequency(40);
      setSweepEndFreq(14000);
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
      const randFreq = Math.round(80 + Math.random() * 3500);
      setWaveType(pick);
      setFrequency(randFreq);
      setSweepEndFreq(Math.min(18000, randFreq * 4));
      setMaxFreqDisplay(20000);
    }
  };

  const isFa = lang === 'fa';

  // Keyboard access for the spectrogram probe: arrows move it (Shift = larger
  // steps), Enter / Space plays the tone (and pins it in multi-click mode).
  const handleSpecKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const { key } = e;
    const isArrow =
      key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
    if (!isArrow && key !== 'Enter' && key !== ' ') return;
    e.preventDefault();
    const canvas = e.currentTarget;
    const probeAt = (nx: number, ny: number): SelectedPoint => {
      const rect = canvas.getBoundingClientRect();
      const padL = 62;
      const padR = 54;
      const padT = 16;
      const padB = 30;
      const pw = Math.max(80, canvas.width - padL - padR);
      const ph = Math.max(80, canvas.height - padT - padB);
      const c = getSpectrogramCoordsFromClient(
        canvas,
        rect.left + padL + nx * pw,
        rect.top + padT + (1 - ny) * ph
      );
      return {
        time: c.time,
        frequency: c.frequency,
        magnitudeDb: c.magnitudeDb,
        normX: c.normX,
        normY: c.normY,
      };
    };

    if (isArrow) {
      const step = e.shiftKey ? 0.1 : 0.02;
      let nx = selectedPoint?.normX ?? 0.5;
      let ny = selectedPoint ? freqToNormYLog(selectedPoint.frequency, maxFreqDisplay) : 0.5;
      if (key === 'ArrowLeft') nx -= step;
      if (key === 'ArrowRight') nx += step;
      if (key === 'ArrowUp') ny += step;
      if (key === 'ArrowDown') ny -= step;
      setSelectedPoint(probeAt(Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))));
      return;
    }

    const pt = selectedPoint ?? probeAt(0.5, 0.5);
    if (!selectedPoint) setSelectedPoint(pt);
    playFrequencyTone(pt.frequency, 600);
    if (interactMode === 'multi-click') addPinnedPoint(pt);
  };

  const spectrogramAriaLabel = isFa
    ? `طیف‌نگار لگاریتمی (۱۰ هرتز تا ${Math.round(maxFreqDisplay / 1000)} کیلوهرتز). با کلیدهای جهت پروب را جابه‌جا کنید و با Enter تُن آن را پخش کنید.`
    : `Log-frequency spectrogram (10 Hz to ${Math.round(maxFreqDisplay / 1000)} kHz). Use the arrow keys to move the probe (Shift for larger steps) and Enter to play its tone.`;

  return (
    <div className="neu-card p-4 sm:p-6 flex flex-col gap-5">
      {!embedded && (
        <PageHeader
          icon={<AudioLines className="w-5 h-5" />}
          title={isFa ? 'صوت و طیف‌نگار' : 'Audio & Spectrogram'}
          subtitle={
            isFa
              ? 'پخش یا ضبط صدا، افزودن نویز، اندازه‌گیری SNR و مشاهده طیف‌نگار زنده.'
              : 'Play or record sound, add noise, measure SNR and watch the live spectrogram.'
          }
        />
      )}
      {/* Row 1: Minimal Transport, Mic, Upload, Preset Dropdown & Volume */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isPlaying ? (
            <button
              type="button"
              onClick={() => {
                stopMicrophone();
                if (sourceMode === 'microphone') setSourceMode('generator');
                startPlayback(pauseOffsetRef.current);
              }}
              className="btn-primary-pill px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{lang === 'fa' ? 'پخش' : 'Play'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="btn-tool-pill px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'fa' ? 'مکث' : 'Pause'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStop}
            className="neu-btn px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lang === 'fa' ? 'توقف' : 'Stop'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isMicActive) stopMicrophone();
              else startMicrophone();
            }}
            aria-pressed={isMicActive}
            className={`px-3.5 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              isMicActive
                ? 'bg-rose-500/20 border border-rose-500 text-rose-500'
                : 'neu-btn'
            }`}
          >
            {isMicActive ? (
              <>
                <MicOff className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
                <span>{lang === 'fa' ? 'توقف میکروفون' : 'Stop Mic'}</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                <span>{lang === 'fa' ? 'میکروفون' : 'Live Mic'}</span>
              </>
            )}
          </button>

          <label className="neu-btn px-3.5 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-500">
            <Upload className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
            <span>
              {uploadedFileName
                ? uploadedFileName.slice(0, 16)
                : lang === 'fa'
                ? 'آپلود موزیک/صدا'
                : 'Upload Music/Voice'}
            </span>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.ogg,.m4a"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={loadDemoVocalMusicTrack}
            className={`px-3.5 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              sourceMode === 'uploaded' && uploadedFileName === 'Vocal_Music_Mix_Demo.wav'
                ? 'btn-tool-pill'
                : 'neu-btn'
            }`}
            title={
              lang === 'fa'
                ? 'بارگذاری نمونه صدای خواننده + موزیک برای تست SNR و تفکیک صدا'
                : 'Load synthesized Vocal + Music track to test Choosable SNR & Voice Clarity'
            }
          >
            <AudioLines className="w-3.5 h-3.5 text-[#7FD141]" aria-hidden="true" />
            <span>{lang === 'fa' ? 'دموی خواننده + موزیک' : 'Vocal + Music Demo'}</span>
          </button>
        </div>

        {/* Right: Quick Preset Select + Volume + Settings */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                applyQuickPreset(e.target.value as any);
                e.target.value = '';
              }
            }}
            className="neu-inset px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer"
            aria-label={isFa ? 'پیش‌تنظیم سریع سیگنال' : 'Quick signal presets'}
          >
            <option value="" disabled>
              {lang === 'fa' ? 'پیش‌تنظیم سریع...' : 'Quick Preset...'}
            </option>
            <option value="20hz">{lang === 'fa' ? '۲۰ هرتز' : '20 Hz Tone'}</option>
            <option value="100hz">{lang === 'fa' ? '۱۰۰ هرتز' : '100 Hz Tone'}</option>
            <option value="1khz">{lang === 'fa' ? '۱ کیلوهرتز' : '1 kHz Tone'}</option>
            <option value="chirp">{lang === 'fa' ? 'جاروب فرکانس' : 'Chirp Sweep'}</option>
            <option value="white">{lang === 'fa' ? 'نویز سفید' : 'White Noise'}</option>
            <option value="pink">{lang === 'fa' ? 'نویز صورتی' : 'Pink Noise'}</option>
            <option value="mixed">{lang === 'fa' ? 'سیگنال ترکیبی' : 'Mixed Signal'}</option>
            <option value="random">{lang === 'fa' ? 'تصادفی' : 'Random Signal'}</option>
          </select>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="btn-circle-glass cursor-pointer"
              aria-pressed={isMuted}
              aria-label={isFa ? 'بی‌صدا' : 'Mute'}
              title={isMuted ? (isFa ? 'وصل صدا' : 'Unmute') : isFa ? 'بی‌صدا' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
              )}
            </button>
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
              aria-label={isFa ? 'بلندی صدا' : 'Volume'}
              aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
              className="sci-slider w-24 sm:w-28"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="neu-btn px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:text-sky-500 cursor-pointer"
            title={lang === 'fa' ? 'راهنمای ساده و سریع' : 'Friendly Beginner Guide'}
            aria-label={isFa ? 'راهنما' : 'Guide'}
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{lang === 'fa' ? 'راهنما' : 'Guide'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className={`btn-circle-glass cursor-pointer ${
              showAdvanced ? 'border-sky-500 text-sky-500' : ''
            }`}
            title={lang === 'fa' ? 'تنظیمات' : 'Settings'}
            aria-label={isFa ? 'تنظیمات پیشرفته صدا' : 'Advanced audio settings'}
            aria-expanded={showAdvanced}
          >
            <Settings2
              aria-hidden="true"
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                showAdvanced ? 'rotate-90' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Live Microphone Status Bar */}
      {isMicActive && (
        <div className="neu-inset px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono border border-rose-500/30">
          <div className="flex items-center gap-2 text-rose-500 font-bold">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{lang === 'fa' ? 'طیف زنده میکروفون' : 'Live Microphone Input'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {isFa ? 'قله: ' : 'Peak: '}
              <strong className="text-sky-500">{micPeakFreq} Hz</strong>
            </span>
            <span>
              {isFa ? 'سطح: ' : 'Level: '}
              <strong className="text-emerald-500">{micRmsDb.toFixed(1)} dB</strong>
            </span>
            <button
              type="button"
              onClick={stopMicrophone}
              className="neu-btn px-2.5 py-0.5 rounded-full text-caption cursor-pointer"
            >
              {lang === 'fa' ? 'تثبیت (Freeze)' : 'Freeze'}
            </button>
          </div>
        </div>
      )}

      {micError && (
        <StatusMessage kind="error" title={isFa ? 'خطای میکروفون' : 'Microphone error'}>
          {micError}
        </StatusMessage>
      )}

      {/* Row 2: Minimal 3-Column Generator Strip */}
      {sourceMode === 'generator' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-3 border-t border-slate-300/30 dark:border-slate-800/60">
          <div>
            <label htmlFor="audio-wave-type" className="block text-caption font-mono text-slate-500 mb-1">
              {lang === 'fa' ? 'شکل‌موج' : 'Waveform'}
            </label>
            <select
              id="audio-wave-type"
              value={waveType}
              onChange={(e) => setWaveType(e.target.value as LiveWaveType)}
              className="neu-inset w-full px-3 py-1.5 rounded-control text-xs font-medium cursor-pointer"
            >
              {WAVE_OPTIONS.map((w) => (
                <option key={w.id} value={w.id}>
                  {lang === 'fa' ? w.faLabel : w.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-caption font-mono mb-1">
              <label htmlFor="audio-freq-exact" className="text-slate-500">
                {lang === 'fa' ? 'فرکانس' : 'Frequency'}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="audio-freq-exact"
                  inputMode="numeric"
                  dir="ltr"
                  type="number"
                  min={10}
                  max={20000}
                  step={1}
                  value={Math.round(frequency)}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (raw < 10 || raw > 20000) {
                      setFreqInvalid(true);
                      window.setTimeout(() => setFreqInvalid(false), 320);
                    }
                    setFrequency(Math.max(10, Math.min(20000, raw)));
                  }}
                  aria-invalid={freqInvalid || undefined}
                  className={`neu-inset w-20 px-1.5 py-0.5 rounded-chip text-end font-bold text-sky-500 ${
                    freqInvalid ? 'input-invalid' : ''
                  }`}
                />
                <span className="text-slate-400">Hz</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(freqToNormYLog(frequency, 20000) * 1000)}
              onChange={(e) => {
                const norm = Number(e.target.value) / 1000;
                setFrequency(Math.round(normYToFreqLog(norm, 20000)));
              }}
              aria-label={isFa ? 'فرکانس (مقیاس لگاریتمی)' : 'Frequency (log scale)'}
              aria-valuetext={`${Math.round(frequency)} Hz`}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-caption font-mono mb-1">
              <label htmlFor="audio-amplitude" className="text-slate-500">
                {lang === 'fa' ? 'دامنه' : 'Amplitude'}
              </label>
              <span className="font-bold text-emerald-500">{amplitude.toFixed(2)}</span>
            </div>
            <input
              id="audio-amplitude"
              aria-valuetext={amplitude.toFixed(2)}
              type="range"
              min={0.05}
              max={1.0}
              step={0.05}
              value={amplitude}
              onChange={(e) => setAmplitude(Number(e.target.value))}
              className="sci-slider"
            />
          </div>
        </div>
      )}

      {isDecodingUpload && (
        <div className="w-full h-7 skeleton-shimmer" />
      )}

      {/* Compact SNR & Human Voice Clarity Bar + Collapsible Detail Drawer */}
      <div className="neu-inset px-3.5 py-2.5 rounded-control flex flex-col gap-3 border border-sky-500/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowSnrDrawer((v) => !v)}
            aria-expanded={showSnrDrawer}
            className="flex flex-wrap items-center gap-2 text-start cursor-pointer"
          >
            <AudioLines className="w-4 h-4 text-sky-500 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {lang === 'fa'
                ? 'تنظیم SNR (dB) و شفاف‌سازی صدای انسان در موسیقی'
                : 'SNR (dB) & Voice Clarity Mixer'}
            </span>
            {sourceMode === 'uploaded' && uploadedFileName && (
              <span className="text-caption font-mono text-emerald-500 font-semibold">
                ({uploadedFileName})
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-caption font-mono text-sky-500">
              {showSnrDrawer ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>{lang === 'fa' ? 'بستن' : 'Less'}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>{lang === 'fa' ? 'تنظیمات کامل' : 'Fine-Tune'}</span>
                </>
              )}
            </span>
          </button>

          {/* Quick Choosable SNR Buttons */}
          <div
            role="group"
            aria-label={isFa ? 'انتخاب سریع SNR' : 'Quick SNR choice'}
            className="flex flex-wrap items-center gap-1 font-mono text-caption"
          >
            <button
              type="button"
              aria-pressed={!snrEnabled}
              onClick={() => setSnrEnabled(false)}
              className={`px-2.5 py-1 rounded-chip cursor-pointer transition-colors ${
                !snrEnabled
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'neu-btn text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'fa' ? 'پاک (∞ dB)' : 'Clean (∞ dB)'}
            </button>
            {[-10, -3, 0, 6, 12, 20].map((dbVal) => (
              <button
                key={dbVal}
                type="button"
                aria-pressed={snrEnabled && targetSnrDb === dbVal}
                onClick={() => {
                  setSnrEnabled(true);
                  setTargetSnrDb(dbVal);
                }}
                className={`px-2 py-1 rounded-chip cursor-pointer transition-colors ${
                  snrEnabled && targetSnrDb === dbVal
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                {dbVal > 0 ? `+${dbVal}` : dbVal} dB
              </button>
            ))}
          </div>
        </div>

        {showSnrDrawer && (
          <div className="flex flex-col gap-3 pt-2.5 border-t border-slate-300/30 dark:border-slate-800/60">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              {/* Column 1: Vocal Formant Clarity / Isolation Filter */}
              <div>
                <label htmlFor="audio-vocal-clarity" className="block text-caption font-mono text-slate-500 mb-1">
                  {lang === 'fa'
                    ? 'تقویت و جداسازی صدای انسان (۳۰۰ تا ۳۴۰۰ هرتز)'
                    : 'Voice Isolation & Formant Clarity'}
                </label>
                <select
                  id="audio-vocal-clarity"
                  value={vocalClarityMode}
                  onChange={(e) => setVocalClarityMode(e.target.value as any)}
                  className="neu-inset w-full px-3 py-1.5 rounded-control text-xs font-medium cursor-pointer"
                >
                  <option value="off">
                    {lang === 'fa'
                      ? 'طیف کامل اصلی (بدون فیلتر وکال)'
                      : 'Original Full Spectrum (Off)'}
                  </option>
                  <option value="voice-boost">
                    {lang === 'fa'
                      ? 'تقویت صدای خواننده/گوینده در موسیقی (+7.5 dB Formant Boost)'
                      : 'Boost Voice in Uploaded Music (+7.5 dB Formants)'}
                  </option>
                  <option value="strict-voice-bandpass">
                    {lang === 'fa'
                      ? 'جداسازی باند صدای انسان (فیلتر میان‌گذر 300Hz–3.4kHz)'
                      : 'Isolate Voice Band Only (300 Hz – 3.4 kHz Bandpass)'}
                  </option>
                  <option value="instrumental-focus">
                    {lang === 'fa'
                      ? 'تضعیف صدای خواننده (تمرکز بر سازها و موسیقی متن)'
                      : 'Suppress Center Vocals (Instrumental Focus)'}
                  </option>
                </select>
              </div>

              {/* Column 2: SNR Signal / Noise Mixing Mode */}
              <div>
                <label htmlFor="audio-snr-mode" className="block text-caption font-mono text-slate-500 mb-1">
                  {lang === 'fa'
                    ? 'حالت ترکیب SNR (صدای انسان روی موسیقی یا نویز کالیبره)'
                    : 'SNR Target Channel (Voice-in-Music vs. Noise)'}
                </label>
                <select
                  id="audio-snr-mode"
                  value={snrMode}
                  onChange={(e) => {
                    setSnrMode(e.target.value as any);
                    setSnrEnabled(true);
                  }}
                  className="neu-inset w-full px-3 py-1.5 rounded-control text-xs font-medium cursor-pointer"
                >
                  <option value="voice-in-music">
                    {lang === 'fa'
                      ? 'تزریق/شنیدن صدای گفتار انسان در موسیقی با SNR انتخابی'
                      : 'Hear Human Voice in Music at Chosen SNR (dB)'}
                  </option>
                  <option value="awgn">
                    {lang === 'fa'
                      ? 'نویز سفید گوسی (AWGN) با SNR انتخابی'
                      : 'White Gaussian Noise (AWGN) at Chosen SNR'}
                  </option>
                  <option value="pink">
                    {lang === 'fa'
                      ? 'نویز صورتی (1/f Pink Noise) با SNR انتخابی'
                      : 'Pink 1/f Noise at Chosen SNR'}
                  </option>
                  <option value="babble">
                    {lang === 'fa'
                      ? 'همهمه جمعیت (Cocktail Party Babble) با SNR انتخابی'
                      : 'Cocktail Party Speech Babble at Chosen SNR'}
                  </option>
                  <option value="hum">
                    {lang === 'fa'
                      ? 'نویز برق شهر (50/150 Hz Hum) با SNR انتخابی'
                      : '50/150 Hz Powerline Hum at Chosen SNR'}
                  </option>
                </select>
              </div>

              {/* Column 3: Continuous SNR (dB) Slider (-20 dB to +30 dB) */}
              <div dir="ltr">
                <div className="flex items-center justify-between text-caption font-mono mb-1">
                  <label htmlFor="audio-snr-db" className="text-slate-500">
                    {lang === 'fa' ? 'مقدار دقیق SNR:' : 'Selected SNR Level:'}
                  </label>
                  <span
                    className={`font-bold ${
                      !snrEnabled
                        ? 'text-emerald-500'
                        : targetSnrDb < 0
                        ? 'text-rose-500'
                        : 'text-sky-500'
                    }`}
                  >
                    {snrEnabled
                      ? `${targetSnrDb > 0 ? '+' : ''}${targetSnrDb} dB`
                      : isFa
                        ? 'پاک (∞ dB)'
                        : 'Clean (∞ dB)'}
                  </span>
                </div>
                <input
                  type="range"
                  min={-20}
                  max={30}
                  step={1}
                  id="audio-snr-db"
                  value={targetSnrDb}
                  aria-valuetext={`${targetSnrDb} dB`}
                  onChange={(e) => {
                    setSnrEnabled(true);
                    setTargetSnrDb(Number(e.target.value));
                  }}
                  className="sci-slider w-full"
                />
              </div>
            </div>

            {/* Optional Voice Fundamental Pitch Slider when Voice-in-Music SNR mode is active */}
            {snrEnabled && snrMode === 'voice-in-music' && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-300/30 dark:border-slate-800/60 text-xs font-mono">
                <label htmlFor="audio-voice-f0" className="text-slate-500">
                  {lang === 'fa'
                    ? 'فرکانس پایه حنجره صدای گفتار (F0):'
                    : 'Injected Human Voice Fundamental Pitch (F0):'}
                </label>
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px] justify-end">
                  <button
                    type="button"
                    aria-pressed={voicePitchHz === 120}
                    onClick={() => setVoicePitchHz(120)}
                    className={`px-2.5 py-0.5 rounded-chip cursor-pointer ${
                      voicePitchHz === 120 ? 'bg-sky-500 text-slate-950 font-bold' : 'neu-btn'
                    }`}
                  >
                    {lang === 'fa' ? 'صدای مرد (120 Hz)' : 'Male Voice (120 Hz)'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={voicePitchHz === 215}
                    onClick={() => setVoicePitchHz(215)}
                    className={`px-2.5 py-0.5 rounded-chip cursor-pointer ${
                      voicePitchHz === 215 ? 'bg-sky-500 text-slate-950 font-bold' : 'neu-btn'
                    }`}
                  >
                    {lang === 'fa' ? 'صدای زن (215 Hz)' : 'Female Voice (215 Hz)'}
                  </button>
                  <input
                    type="range"
                    min={85}
                    max={260}
                    step={5}
                    id="audio-voice-f0"
                    value={voicePitchHz}
                    aria-valuetext={`${voicePitchHz} Hz`}
                    onChange={(e) => setVoicePitchHz(Number(e.target.value))}
                    className="sci-slider flex-1 min-w-24 max-w-56"
                  />
                  <span className="text-sky-500 font-bold w-14 text-end">{voicePitchHz} Hz</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Custom Mixed Signal Builder */}
      <AnimatePresence initial={false}>
        {sourceMode === 'generator' && waveType === 'mixed' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="neu-inset p-3.5 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-sky-500 font-bold">
                {lang === 'fa' ? 'لایه‌های سیگنال ترکیبی' : 'Signal Mix Layers'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setMixLayers((prev) => [
                    ...prev,
                    {
                      id: `m-${Date.now()}`,
                      type: 'sine',
                      frequency: 440,
                      amplitude: 0.25,
                      enabled: true,
                    },
                  ])
                }
                className="neu-btn px-2.5 py-1 rounded-full text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
                <span>{lang === 'fa' ? 'افزودن' : 'Add'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {mixLayers.map((lyr, idx) => (
                <div
                  key={lyr.id}
                  className={`neu-card-sm p-2.5 flex flex-col gap-1.5 ${
                    !lyr.enabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <input
                      type="checkbox"
                      aria-label={isFa ? `فعال بودن لایه ${idx + 1}` : `Enable layer ${idx + 1}`}
                      checked={lyr.enabled}
                      onChange={(e) =>
                        setMixLayers((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, enabled: e.target.checked } : item
                          )
                        )
                      }
                    />
                    <select
                      value={lyr.type}
                      onChange={(e) =>
                        setMixLayers((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, type: e.target.value as MixLayer['type'] } : item
                          )
                        )
                      }
                      aria-label={isFa ? `نوع موج لایه ${idx + 1}` : `Layer ${idx + 1} waveform`}
                      className="neu-inset px-2 py-0.5 rounded-chip text-xs font-mono flex-1"
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
                        onClick={() => setMixLayers((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-500 cursor-pointer"
                        aria-label={isFa ? `حذف لایه ${idx + 1}` : `Remove layer ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {lyr.type !== 'white-noise' && lyr.type !== 'pink-noise' && (
                    <div className="flex items-center gap-2 text-caption font-mono">
                      <span className="w-14 text-sky-500 font-bold">{lyr.frequency}Hz</span>
                      <input
                        type="range"
                        min={0}
                        max={1000}
                        value={Math.round(freqToNormYLog(lyr.frequency, 20000) * 1000)}
                        aria-label={isFa ? `فرکانس لایه ${idx + 1}` : `Layer ${idx + 1} frequency`}
                        aria-valuetext={`${lyr.frequency} Hz`}
                        onChange={(e) => {
                          const f = Math.round(
                            normYToFreqLog(Number(e.target.value) / 1000, 20000)
                          );
                          setMixLayers((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, frequency: f } : item))
                          );
                        }}
                        className="sci-slider flex-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Advanced Audio Settings */}
      <AnimatePresence initial={false}>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="neu-inset p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value))}
                aria-label={isFa ? 'نرخ نمونه‌برداری' : 'Sample rate'}
                className="neu-inset px-2.5 py-1 rounded-full"
              >
                <option value={22050}>22.05 kHz</option>
                <option value={44100}>44.1 kHz</option>
                <option value={48000}>48.0 kHz</option>
              </select>
              <select
                value={fftSize}
                onChange={(e) => setFftSize(Number(e.target.value))}
                aria-label={isFa ? 'اندازه FFT' : 'FFT size'}
                className="neu-inset px-2.5 py-1 rounded-full"
              >
                <option value={2048}>FFT 2048</option>
                <option value={4096}>FFT 4096</option>
                <option value={8192}>FFT 8192</option>
              </select>
              <button
                type="button"
                onClick={() => setIsLooping((l) => !l)}
                aria-pressed={isLooping}
                className={`neu-btn px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer ${
                  isLooping ? 'btn-tool-pill' : ''
                }`}
              >
                <Repeat className="w-3 h-3" aria-hidden="true" />
                <span>{isFa ? 'تکرار' : 'Loop'}</span>
              </button>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                aria-label={isFa ? 'سرعت پخش' : 'Playback speed'}
                className="neu-inset px-2.5 py-1 rounded-full"
              >
                <option value={0.5}>0.5x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoPlayClick}
                onChange={(e) => setAutoPlayClick(e.target.checked)}
              />
              <span>{lang === 'fa' ? 'پخش خودکار با کلیک' : 'Auto-play on click'}</span>
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 3: View Mode Tabs + Interaction Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-300/30 dark:border-slate-800/60">
        <div
          role="group"
          aria-label={isFa ? 'نمای نمایش' : 'Visualization view'}
          className="neu-inset p-1 rounded-full flex flex-wrap items-center gap-1"
        >
          {(
            [
              { id: '3d', label: '3D Visualizer', fa: 'نمایش سه‌بعدی (3D)' },
              { id: 'combined', label: '2D Combined', fa: 'ترکیبی دوبعدی' },
              { id: 'spectrogram', label: 'Spectrogram', fa: 'طیف‌نگار' },
              { id: 'waveform', label: 'Waveform', fa: 'شکل‌موج' },
              { id: 'spectrum', label: 'Spectrum', fa: 'طیف فوریه' },
            ] as { id: VisualizationTab; label: string; fa: string }[]
          ).map((t) => {
            const active = vizTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setVizTab(t.id)}
                className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'text-white dark:text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="audio-viz-tab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-sky-500 dark:bg-sky-400"
                  />
                )}
                <span className="relative z-10">{lang === 'fa' ? t.fa : t.label}</span>
              </button>
            );
          })}
        </div>

        {vizTab !== '3d' && (
          <div
            role="group"
            aria-label={isFa ? 'حالت تعامل با طیف‌نگار' : 'Spectrogram interaction mode'}
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              aria-pressed={interactMode === 'click-tone'}
              onClick={() => setInteractMode('click-tone')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 cursor-pointer ${
                interactMode === 'click-tone' ? 'btn-tool-pill' : 'neu-btn'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'fa' ? 'تک‌کلیک' : 'Single Click'}</span>
            </button>

            <button
              type="button"
              aria-pressed={interactMode === 'multi-click'}
              onClick={() => setInteractMode('multi-click')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 cursor-pointer ${
                interactMode === 'multi-click' ? 'btn-tool-pill' : 'neu-btn'
              }`}
            >
              <Pin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {lang === 'fa'
                  ? `چند سیگنال (${pinnedPoints.length})`
                  : `Multi-Click (${pinnedPoints.length})`}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={interactMode === 'box-select'}
              onClick={() => setInteractMode('box-select')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 cursor-pointer ${
                interactMode === 'box-select' ? 'btn-tool-pill' : 'neu-btn'
              }`}
            >
              <BoxSelect className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'fa' ? 'بازه فرکانس' : 'Range Mode'}</span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={scrollingWaterfall}
              onClick={() => setScrollingWaterfall((s) => !s)}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                scrollingWaterfall ? 'btn-tool-pill' : 'neu-btn'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  scrollingWaterfall ? 'bg-[#7FD141]' : 'bg-slate-400'
                }`}
              />
              <span>{lang === 'fa' ? 'پیمایش' : 'Scroll'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive 3D React Three Fiber Stage (Signal Helix, Harmonics, 3D FFT Pillars & 3D Waterfall) */}
      {vizTab === '3d' && (
        <LazySignal3DStage
          loadingLabel={isFa ? 'در حال بارگذاری نمای سه‌بعدی…' : 'Loading 3D view…'}
          liveWaveformRef={liveWaveSliceRef}
          liveSpectrumDbRef={liveSpecRowRef}
          specMatrixRef={specMatrixRef}
          frequency={frequency}
          waveType={waveType}
          amplitude={amplitude}
          isPlaying={isPlaying}
          isMicActive={isMicActive}
          lang={lang}
          darkMode={darkMode}
          onTogglePlay={() => {
            if (isPlaying) {
              handlePause();
            } else {
              stopMicrophone();
              if (sourceMode === 'microphone') setSourceMode('generator');
              startPlayback(pauseOffsetRef.current);
            }
          }}
          onToggleMic={() => {
            if (isMicActive) stopMicrophone();
            else startMicrophone();
          }}
          onSelectPreset={(preset) => applyQuickPreset(preset as any)}
          onPlayFrequencyTone={playFrequencyTone}
          heightClass="h-[500px] sm:h-[580px]"
        />
      )}

      {/* Interactive Logarithmic Spectrogram Canvas */}
      {(vizTab === 'combined' || vizTab === 'spectrogram') && (
        <div className="flex flex-col gap-2">
          {/* Friendly Interaction Tip Banner */}
          <div className="flex items-center justify-between gap-2 text-caption text-slate-500 dark:text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
              {interactMode === 'click-tone' && (
                <span>
                  {lang === 'fa'
                    ? 'روی هر کجای طیف‌نگار کلیک یا درگ کنید تا فرکانس آن پخش شود (پایین = بیس بم، بالا = زیر)'
                    : 'Click or drag anywhere on the spectrogram to hear the exact frequency (Bottom = Bass, Top = Highs)'}
                </span>
              )}
              {interactMode === 'multi-click' && (
                <span>
                  {lang === 'fa'
                    ? 'روی چند نقطه کلیک کنید تا فرکانس‌ها پین شوند، سپس «پخش هم‌زمان» را بزنید'
                    : 'Click points on the spectrogram to pin tones, then hit "Play All" for chords or "Sequence"'}
                </span>
              )}
              {interactMode === 'box-select' && (
                <span>
                  {lang === 'fa'
                    ? 'یک مستطیل روی بازه فرکانس بکشید یا بازه را در نوار زیر وارد کنید'
                    : 'Drag a box around a frequency band or enter frequencies below to synthesize the range'}
                </span>
              )}
            </span>
            <span className="hidden sm:inline font-mono text-2xs text-slate-400">
              Y-Axis: Logarithmic (10 Hz – 20 kHz)
            </span>
          </div>

          <div dir="ltr" className="relative oscilloscope-frame p-1.5 overflow-hidden select-none">
            <canvas
              ref={spectrogramCanvasRef}
              tabIndex={0}
              role="img"
              aria-label={spectrogramAriaLabel}
              aria-describedby="audio-spec-probe"
              onKeyDown={handleSpecKeyDown}
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
                  const pt = {
                    time: coords.time,
                    frequency: coords.frequency,
                    magnitudeDb: coords.magnitudeDb,
                    normX: coords.normX,
                    normY: coords.normY,
                  };
                  setSelectedPoint(pt);
                  if (interactMode === 'multi-click') addPinnedPoint(pt);
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
                if (tooltipRef.current) {
                  tooltipRef.current.style.display = 'none';
                }
                if (isPointerDownRef.current) {
                  isPointerDownRef.current = false;
                  stopDragTone();
                }
              }}
              className="block w-full rounded-xl cursor-crosshair touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            />
            <span id="audio-spec-probe" role="status" aria-live="polite" className="sr-only">
              {selectedPoint
                ? isFa
                  ? `پروب: ${Math.round(selectedPoint.frequency)} هرتز، ${selectedPoint.time.toFixed(2)} ثانیه، ${selectedPoint.magnitudeDb.toFixed(1)} دسی‌بل`
                  : `Probe: ${Math.round(selectedPoint.frequency)} Hz at ${selectedPoint.time.toFixed(2)} s, ${selectedPoint.magnitudeDb.toFixed(1)} dB`
                : ''}
            </span>

            <div
              ref={tooltipRef}
              style={{ display: 'none' }}
              className="pointer-events-none absolute z-20 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-sky-400/40 text-caption font-mono text-slate-100 shadow-lg"
            />
          </div>

          {/* Minimal Contextual Footer Bar — Shows only the controls for the active mode */}
          <div className="neu-inset px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {interactMode === 'click-tone' && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedPoint && (
                    <>
                      <span className="font-bold text-sky-500">
                        {Math.round(selectedPoint.frequency).toLocaleString()} Hz
                      </span>
                      <span className="text-slate-400">·</span>
                      <span>{selectedPoint.time.toFixed(2)}s</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-emerald-500">
                        {selectedPoint.magnitudeDb.toFixed(1)} dB
                      </span>
                      <button
                        type="button"
                        onClick={() => playFrequencyTone(selectedPoint.frequency, 600)}
                        className="btn-primary-pill px-3 py-1 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" aria-hidden="true" />
                        <span>{lang === 'fa' ? 'پخش' : 'Play Tone'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addPinnedPoint(selectedPoint);
                          setInteractMode('multi-click');
                        }}
                        className="neu-btn px-2.5 py-1 rounded-full text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-[#7FD141]" aria-hidden="true" />
                        <span>{lang === 'fa' ? 'افزودن به چندسیگنال' : 'Pin'}</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 min-w-[180px] flex-1 max-w-xs">
                  <span className="text-caption text-slate-400 tabular-nums shrink-0">
                    {currentTime.toFixed(1)}s
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.1, totalDuration)}
                    step={0.02}
                    value={currentTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    aria-label={isFa ? 'جابه‌جایی زمان' : 'Time scrubber'}
                    aria-valuetext={`${currentTime.toFixed(1)} s`}
                    className="sci-slider flex-1"
                  />
                </div>
              </>
            )}

            {interactMode === 'multi-click' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pinnedPoints.length === 0 ? (
                    <span className="text-slate-400 text-caption">
                      {lang === 'fa'
                        ? 'روی طیف‌نگار کلیک کنید تا چند فرکانس اضافه شود'
                        : 'Click points on the spectrogram to pin frequencies'}
                    </span>
                  ) : (
                    pinnedPoints.map((pt, idx) => (
                      <div
                        key={pt.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption border ${
                          activeSeqPinId === pt.id
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : pt.enabled
                            ? 'border-[#7FD141]/50'
                            : 'opacity-40 border-slate-400/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          aria-label={isFa ? `فعال بودن پین ${idx + 1}` : `Enable pin ${idx + 1}`}
                          checked={pt.enabled}
                          onChange={(e) =>
                            setPinnedPoints((prev) =>
                              prev.map((item) =>
                                item.id === pt.id ? { ...item, enabled: e.target.checked } : item
                              )
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => playFrequencyTone(pt.frequency, 450)}
                          className="font-bold text-sky-500 hover:underline cursor-pointer"
                        >
                          #{idx + 1} {Math.round(pt.frequency)}Hz
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPinnedPoints((prev) => prev.filter((item) => item.id !== pt.id))
                          }
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          aria-label={isFa ? `حذف پین ${idx + 1}` : `Remove pin ${idx + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => playPinnedSignalsSimultaneous(1600)}
                    disabled={pinnedPoints.filter((p) => p.enabled).length === 0}
                    className="btn-primary-pill px-3 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                    <span>
                      {isPlayingMulti
                        ? lang === 'fa'
                          ? 'توقف'
                          : 'Stop'
                        : lang === 'fa'
                        ? 'پخش هم‌زمان'
                        : 'Play All'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={playPinnedSignalsSequence}
                    disabled={pinnedPoints.filter((p) => p.enabled).length === 0}
                    className="neu-btn px-2.5 py-1 rounded-full text-xs cursor-pointer disabled:opacity-40"
                  >
                    {lang === 'fa' ? 'پخش متوالی' : 'Sequence'}
                  </button>
                  {pinnedPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        stopMultiSignals();
                        setPinnedPoints([]);
                      }}
                      className="neu-btn p-1 rounded-full text-rose-500 cursor-pointer"
                      title={isFa ? 'پاک کردن همه' : 'Clear all'}
                      aria-label={isFa ? 'پاک کردن همه پین‌ها' : 'Clear all pins'}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </>
            )}

            {interactMode === 'box-select' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500">
                    {lang === 'fa' ? 'بازه:' : 'Range:'}
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={19900}
                    value={rangeStartFreq}
                    aria-label={isFa ? 'فرکانس شروع بازه (Hz)' : 'Range start frequency (Hz)'}
                    onChange={(e) =>
                      setRangeStartFreq(Math.max(10, Math.min(19900, Number(e.target.value))))
                    }
                    className="neu-inset w-20 px-1.5 py-0.5 rounded-chip text-end font-bold text-sky-500"
                  />
                  <span aria-hidden="true" className="text-slate-400 rtl:rotate-180">→</span>
                  <input
                    type="number"
                    min={20}
                    max={20000}
                    value={rangeEndFreq}
                    aria-label={isFa ? 'فرکانس پایان بازه (Hz)' : 'Range end frequency (Hz)'}
                    onChange={(e) =>
                      setRangeEndFreq(Math.max(20, Math.min(20000, Number(e.target.value))))
                    }
                    className="neu-inset w-20 px-1.5 py-0.5 rounded-chip text-end font-bold text-emerald-500"
                  />
                  <span className="text-slate-400">Hz</span>
                  <select
                    value={rangeToneCount}
                    onChange={(e) => setRangeToneCount(Number(e.target.value))}
                    aria-label={isFa ? 'تعداد تُن‌ها' : 'Number of tones'}
                    className="neu-inset px-2 py-0.5 rounded-chip text-caption"
                  >
                    <option value={4}>4 Tones</option>
                    <option value={8}>8 Tones</option>
                    <option value={12}>12 Tones</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => playFrequencyRangeSignal('harmonic-bank')}
                    className="btn-primary-pill px-3 py-1 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    <span>{lang === 'fa' ? 'پخش چندتُنی بازه' : 'Play Range Bank'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playFrequencyRangeSignal('sweep')}
                    className="neu-btn px-2.5 py-1 rounded-full text-xs cursor-pointer"
                  >
                    {lang === 'fa' ? 'جاروب بازه' : 'Sweep Range'}
                  </button>
                  {selectedRegion && (
                    <button
                      type="button"
                      onClick={handleSonifyRegion}
                      disabled={isSonifying}
                      className="btn-tool-pill px-2.5 py-1 rounded-full text-xs cursor-pointer"
                    >
                      {lang === 'fa' ? 'بازسازی ناحیه' : 'Sonify Box'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Synchronized Time-Domain Waveform & Logarithmic FFT Spectrum */}
      {(vizTab === 'combined' || vizTab === 'waveform' || vizTab === 'spectrum') && (
        <div
          className={`grid grid-cols-1 ${
            vizTab === 'combined' ? 'lg:grid-cols-2' : ''
          } gap-4`}
        >
          {(vizTab === 'combined' || vizTab === 'waveform') && (
            <div className="oscilloscope-frame p-1 overflow-hidden">
              <canvas
                ref={waveformCanvasRef}
                role="img"
                aria-label={
                  isFa
                    ? `شکل‌موج زمانی سیگنال صوتی، ${currentTime.toFixed(1)} از ${totalDuration.toFixed(1)} ثانیه`
                    : `Time-domain audio waveform, ${currentTime.toFixed(1)} of ${totalDuration.toFixed(1)} s`
                }
                className="block w-full rounded-xl"
              />
            </div>
          )}

          {(vizTab === 'combined' || vizTab === 'spectrum') && (
            <div className="oscilloscope-frame p-1 overflow-hidden">
              <canvas
                ref={spectrumCanvasRef}
                role="img"
                aria-label={
                  isFa
                    ? `طیف فوریه لگاریتمی سیگنال صوتی تا ${Math.round(maxFreqDisplay)} هرتز`
                    : `Logarithmic FFT magnitude spectrum of the audio, up to ${Math.round(maxFreqDisplay)} Hz`
                }
                className="block w-full rounded-xl"
              />
            </div>
          )}
        </div>
      )}
      {/* Quick Friendly Guide Modal */}
      <GuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onSelectPreset={(presetKey) => applyQuickPreset(presetKey as any)}
      />
    </div>
  );
};

