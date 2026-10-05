import React, { useEffect, useRef, useState } from 'react';
import { Brain, Play, Square, Zap } from 'lucide-react';
import { LAB_IMAGES } from '../assets/labImages';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import {
  MLTrainingEpochLog,
  MLTrainingResult,
  runBrowserMLTraining,
} from '../simulations/ml';
import { useLab } from '../store/LabContext';
import { MLArchitectureType, MLTaskType } from '../types';
import { calculateSNR } from '../utils/math';

const ARCHITECTURES: {
  id: MLArchitectureType;
  label: string;
  faLabel: string;
  desc: string;
  faDesc: string;
}[] = [
  {
    id: 'dense',
    label: 'Dense MLP',
    faLabel: 'شبکه پرسپترون چندلایه (Dense MLP)',
    desc: 'Multi-Layer Perceptron with ReLU hidden layers',
    faDesc: 'پرسپترون چندلایه تمام‌متصل با لایه‌های پنهان ReLU',
  },
  {
    id: 'cnn1d',
    label: '1D CNN',
    faLabel: 'شبکه کانولوشنی یک‌بعدی (1D-CNN)',
    desc: 'Temporal Conv1D filters + MaxPooling1D + Softmax',
    faDesc: 'فیلترهای کانولوشن زمانی یک‌بعدی + ادغام بیشینه + Softmax',
  },
  {
    id: 'autoencoder',
    label: 'Denoising Autoencoder',
    faLabel: 'خودرمزگذار حذف نویز (Autoencoder)',
    desc: 'Encoder-Latent Bottleneck-Decoder waveform reconstructor',
    faDesc: 'بازساز شکل‌موج با معماری رمزگذار-گلوگاه پنهان-رمزگشا',
  },
  {
    id: 'rnn',
    label: 'Simple RNN / Sequence',
    faLabel: 'شبکه بازگشتی توالی زمانی (Simple RNN)',
    desc: 'Recurrent sequence state cell over temporal windows',
    faDesc: 'سلول حالت بازگشتی روی پنجره‌های زمانی سیگنال',
  },
];

const TASKS: { id: MLTaskType; label: string; faLabel: string }[] = [
  {
    id: 'sine-vs-square',
    label: 'Sine vs. Square Classification',
    faLabel: 'طبقه‌بندی موج سینوسی در برابر مربعی',
  },
  {
    id: 'low-vs-high-freq',
    label: 'Low vs. High Frequency Classification',
    faLabel: 'طبقه‌بندی فرکانس پایین در برابر فرکانس بالا',
  },
  {
    id: 'clean-vs-noisy',
    label: 'Clean vs. Noisy Signal Detection',
    faLabel: 'تشخیص سیگنال تمیز از سیگنال نویزی',
  },
  {
    id: 'eeg-band-class',
    label: 'Synthetic EEG Band Classification (δ / α / β)',
    faLabel: 'طبقه‌بندی باندهای مغزی EEG مصنوعی (دلتا / آلفا / بتا)',
  },
  {
    id: 'modulation-class',
    label: 'Digital Modulation Classification (ASK / BPSK / FSK)',
    faLabel: 'تشخیص نوع مدولاسیون دیجیتال (ASK / BPSK / FSK)',
  },
];

export const DeepLearningPage: React.FC = () => {
  const { mlConfig, setMlConfig, experiment, darkMode, lang } = useLab();
  const [isTraining, setIsTraining] = useState(false);
  const [liveEpochs, setLiveEpochs] = useState<MLTrainingEpochLog[]>([]);
  const [result, setResult] = useState<MLTrainingResult | null>(null);
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0);
  const stopRef = useRef<boolean>(false);
  const netCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const updateML = (patch: Partial<typeof mlConfig>) => {
    setMlConfig((prev) => ({ ...prev, ...patch }));
  };

  const startTraining = async () => {
    if (isTraining) return;
    stopRef.current = false;
    setIsTraining(true);
    setLiveEpochs([]);
    try {
      const res = await runBrowserMLTraining(
        mlConfig,
        experiment.randomSeed,
        (epochLog) => {
          setLiveEpochs((prev) => [...prev, epochLog]);
        },
        stopRef
      );
      setResult(res);
      setSelectedSampleIdx(0);
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    startTraining();
  }, [mlConfig.architecture, mlConfig.task]);

  const epochNumbers = liveEpochs.map((e) => e.epoch);
  const latestLog = liveEpochs[liveEpochs.length - 1];
  const activeSample =
    result?.samplePredictions[selectedSampleIdx] ?? result?.samplePredictions[0];

  // Draw Interactive Neural Network Architecture & Activation Graph Canvas
  useEffect(() => {
    const canvas = netCanvasRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth || 620;
    const height = 250;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#050912';
    ctx.fillRect(0, 0, width, height);

    const numClasses = result?.classNames.length ?? 2;
    const layers =
      mlConfig.architecture === 'autoencoder'
        ? [
            { name: 'Noisy Input', nodes: 6, sub: '64 samples' },
            { name: 'Encoder', nodes: 4, sub: `${mlConfig.hiddenUnits} ReLU` },
            {
              name: 'Bottleneck z',
              nodes: 2,
              sub: `${Math.max(4, Math.floor(mlConfig.hiddenUnits / 2))} Latent`,
            },
            { name: 'Decoder', nodes: 4, sub: `${mlConfig.hiddenUnits} ReLU` },
            { name: 'Clean Output', nodes: 6, sub: '64 samples' },
          ]
        : mlConfig.architecture === 'cnn1d'
        ? [
            { name: 'Input Wave', nodes: 6, sub: '64×1 Window' },
            { name: 'Conv1D Kernels', nodes: 5, sub: 'k=5 ReLU' },
            { name: 'MaxPool1D', nodes: 4, sub: '32×F Pooled' },
            { name: 'Dense FC', nodes: 4, sub: `${mlConfig.hiddenUnits} Units` },
            { name: 'Softmax', nodes: numClasses, sub: `${numClasses} Classes` },
          ]
        : [
            { name: 'Input Wave', nodes: 6, sub: '64 Features' },
            { name: 'Hidden Layer 1', nodes: 5, sub: `${mlConfig.hiddenUnits} Units` },
            {
              name: 'Hidden Layer 2',
              nodes: 4,
              sub: `${Math.max(8, Math.floor(mlConfig.hiddenUnits * 0.75))} Units`,
            },
            { name: 'Softmax Output', nodes: numClasses, sub: `${numClasses} Classes` },
          ];

    const colSpan = (width - 110) / Math.max(1, layers.length - 1);
    const nodePositions: { x: number; y: number }[][] = [];

    layers.forEach((lyr, lIdx) => {
      const x = 55 + lIdx * colSpan;
      const col: { x: number; y: number }[] = [];
      const totalH = Math.min(height - 75, (lyr.nodes - 1) * 32);
      const startY = (height - 18 - totalH) / 2;
      for (let n = 0; n < lyr.nodes; n++) {
        const y = lyr.nodes === 1 ? (height - 18) / 2 : startY + (n / (lyr.nodes - 1)) * totalH;
        col.push({ x, y });
      }
      nodePositions.push(col);
    });

    // Draw synaptic connections
    for (let l = 0; l < nodePositions.length - 1; l++) {
      const curr = nodePositions[l];
      const next = nodePositions[l + 1];
      for (let i = 0; i < curr.length; i++) {
        for (let j = 0; j < next.length; j++) {
          const weightStrength = Math.abs(Math.sin((l + 1) * 3.1 + i * 1.7 + j * 2.3));
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.14 + weightStrength * 0.36})`;
          ctx.lineWidth = 0.8 + weightStrength * 1.4;
          ctx.beginPath();
          ctx.moveTo(curr[i].x, curr[i].y);
          ctx.lineTo(next[j].x, next[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw neurons & labels
    nodePositions.forEach((col, lIdx) => {
      const isLast = lIdx === nodePositions.length - 1;
      col.forEach((pt, nIdx) => {
        const prob = isLast ? activeSample?.probabilities[nIdx] ?? 0.5 : 0.7;
        ctx.fillStyle = isLast
          ? prob > 0.5
            ? '#10b981'
            : '#1e293b'
          : '#22d3ee';
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isLast ? 9 : 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        if (isLast && result?.classNames[nIdx] && mlConfig.architecture !== 'autoencoder') {
          ctx.fillStyle = '#f8fafc';
          ctx.font = '600 10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${(prob * 100).toFixed(0)}%`, pt.x + 13, pt.y);
        }
      });

      const headerX = col[0]?.x ?? 50;
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 11px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(layers[lIdx].name, headerX, height - 24);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(layers[lIdx].sub, headerX, height - 10);
    });
  }, [darkMode, mlConfig.architecture, mlConfig.hiddenUnits, result, activeSample]);

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400 mb-0.5">
                  {lang === 'fa'
                    ? 'موتور TensorFlow.js داخل مرورگر · آزمایشگاه شبکه عصبی سمت کاربر'
                    : 'TensorFlow.js In-Browser Engine · Client-Side Neural Network Laboratory'}
                </div>
                <h1 className="text-xl font-bold tracking-tight">
                  {lang === 'fa'
                    ? 'آزمایشگاه یادگیری عمیق برای طبقه‌بندی و نویززدایی سیگنال'
                    : 'Deep Learning Signal Classification & Denoising Laboratory'}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {lang === 'fa'
                    ? 'آموزش زنده معماری‌های Dense MLP، 1D-CNN، خودرمزگذار حذف نویز (Autoencoder) و RNN مستقیماً در مرورگر همراه با بررسی فعال‌سازی لایه‌ها و کرنل‌های یادگرفته‌شده.'
                    : 'Train Dense MLP, 1D-CNN, Denoising Autoencoder, and Simple RNN architectures directly in your browser and inspect live synaptic activations.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isTraining ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopRef.current = true;
                    }}
                    className="neu-btn px-4 py-2 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>{lang === 'fa' ? 'توقف آموزش' : 'Stop Training'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startTraining}
                    className="btn-primary-pill px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'fa' ? 'آموزش مدل در مرورگر' : 'Train Model in Browser'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Architecture Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ARCHITECTURES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => updateML({ architecture: a.id })}
                  className={`neu-btn p-3 rounded-xl text-start flex flex-col gap-0.5 cursor-pointer ${
                    mlConfig.architecture === a.id
                      ? 'neu-btn-active text-sky-700 dark:text-sky-300'
                      : ''
                  }`}
                >
                  <span className="text-xs font-bold">
                    {lang === 'fa' ? a.faLabel : a.label}
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                    {lang === 'fa' ? a.faDesc : a.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="oscilloscope-frame overflow-hidden">
              <img
                src={LAB_IMAGES.neuralDsp}
                alt={
                  lang === 'fa'
                    ? 'معماری شبکه عصبی کانولوشنی یک‌بعدی پردازش سیگنال'
                    : '1D Convolutional Neural Network DSP Architecture'
                }
                referrerPolicy="no-referrer"
                className="w-full h-36 object-cover opacity-90"
              />
              <div className="p-2 bg-slate-950/85 border-t border-sky-400/20 text-[10px] font-mono text-slate-300 flex justify-between">
                <span>
                  {lang === 'fa'
                    ? 'استخراج ویژگی زمانی با فیلترهای عصبی'
                    : 'Temporal Feature Extraction & Latent Bottleneck'}
                </span>
                <span className="text-sky-400">{mlConfig.architecture.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Task & Hyperparameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
              {lang === 'fa'
                ? 'وظیفه و مجموعه داده سیگنال مصنوعی'
                : 'Synthetic Signal Task / Dataset'}
            </label>
            <select
              value={mlConfig.task}
              onChange={(e) => updateML({ task: e.target.value as MLTaskType })}
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-semibold bg-transparent outline-none"
            >
              {TASKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {lang === 'fa' ? t.faLabel : t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'تعداد دورهای آموزش (Epochs)' : 'Epochs'}</span>
              <span className="text-sky-600 dark:text-sky-400 font-semibold">
                {mlConfig.epochs}
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={40}
              step={2}
              value={mlConfig.epochs}
              onChange={(e) => updateML({ epochs: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'تعداد نورون‌ها / فیلترها' : 'Hidden Units / Filters'}</span>
              <span className="text-sky-600 dark:text-sky-400 font-semibold">
                {mlConfig.hiddenUnits}
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={48}
              step={4}
              value={mlConfig.hiddenUnits}
              onChange={(e) => updateML({ hiddenUnits: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>{lang === 'fa' ? 'سطح نویز مجموعه داده (σ)' : 'Dataset Noise (σ)'}</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {mlConfig.noiseLevel.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={mlConfig.noiseLevel}
              onChange={(e) => updateML({ noiseLevel: Number(e.target.value) })}
              className="sci-slider"
            />
          </div>
        </div>

        {/* Live Training Progress Bar */}
        <div className="neu-inset p-3.5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between text-xs font-mono">
            <span>
              {lang === 'fa' ? 'وضعیت موتور آموزش: ' : 'Engine Status: '}
              <strong
                className={
                  isTraining
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }
              >
                {isTraining
                  ? lang === 'fa'
                    ? `▲ در حال آموزش دور ${liveEpochs.length} از ${mlConfig.epochs}...`
                    : `▲ Training Epoch ${liveEpochs.length}/${mlConfig.epochs}...`
                  : lang === 'fa'
                  ? '● مدل آموزش دید و آماده استنتاج زنده است'
                  : '● Model Trained & Ready for Live Inference'}
              </strong>
            </span>
            {latestLog && (
              <div className="flex items-center gap-4 tabular-nums">
                <span>
                  {lang === 'fa' ? 'خطای آموزش: ' : 'Train Loss: '}
                  <strong>{latestLog.loss.toFixed(4)}</strong>
                </span>
                <span>
                  {lang === 'fa' ? 'خطای اعتبارسنجی: ' : 'Val Loss: '}
                  <strong>{latestLog.valLoss.toFixed(4)}</strong>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {lang === 'fa' ? 'دقت اعتبارسنجی: ' : 'Val Accuracy: '}
                  <strong>{(latestLog.valAccuracy * 100).toFixed(1)}%</strong>
                </span>
              </div>
            )}
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-300/60 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-150"
              style={{
                width: `${Math.min(100, (liveEpochs.length / Math.max(1, mlConfig.epochs)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Neural Network Topology Canvas + Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 neu-card p-5 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Brain className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>
                  {lang === 'fa'
                    ? 'توپولوژی تعاملی شبکه عصبی و فعال‌سازی خروجی‌ها'
                    : 'Interactive Neural Network Topology & Output Activations'}
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {lang === 'fa'
                  ? 'نمایش لایه‌های فعال، اتصالات سیناپسی و احتمالات خروجی Softmax برای نمونه انتخاب‌شده'
                  : 'Visualizes active layers, synaptic connections, and live softmax class probabilities'}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              {lang === 'fa' ? 'تعداد پارامترها: ' : 'Params: '}
              <strong className="text-sky-600 dark:text-sky-400">
                {result?.architectureLayers.reduce((a, b) => a + b.params, 0) ?? 0}
              </strong>
            </span>
          </div>

          <div className="oscilloscope-frame p-1 overflow-hidden">
            <canvas ref={netCanvasRef} className="block w-full rounded-xl" />
          </div>
        </div>

        {/* Confusion Matrix & Class Confidence Breakdown */}
        <div className="lg:col-span-5 neu-card p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              {lang === 'fa'
                ? 'ماتریس درهم‌ریختگی (Confusion Matrix) و احتمال کلاس‌ها'
                : 'Validation Confusion Matrix & Class Probabilities'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {lang === 'fa'
                ? 'سطرها = کلاس واقعی · ستون‌ها = کلاس پیش‌بینی‌شده توسط مدل'
                : 'Rows = Ground-Truth Class · Columns = Predicted Class'}
            </p>
          </div>

          {result && (
            <div className="neu-inset p-3 overflow-x-auto" dir="ltr">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-500">True \ Pred</th>
                    {result.classNames.map((cn) => (
                      <th
                        key={cn}
                        className="p-2 text-center text-sky-700 dark:text-sky-400 font-bold"
                      >
                        {cn.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.confusionMatrix.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-t border-slate-300/60 dark:border-slate-800"
                    >
                      <td className="p-2 font-semibold">{result.classNames[rIdx]}</td>
                      {row.map((cnt, cIdx) => {
                        const isDiag = rIdx === cIdx;
                        return (
                          <td
                            key={cIdx}
                            className={`p-2 text-center font-bold rounded ${
                              isDiag
                                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/15'
                                : cnt > 0
                                ? 'text-rose-700 dark:text-rose-400 bg-rose-500/15'
                                : 'text-slate-400'
                            }`}
                          >
                            {cnt}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Live Test Sample Selector & Softmax Confidence Bars */}
          {result && activeSample && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {lang === 'fa' ? 'بررسی نمونه آزمون:' : 'Inspect Validation Sample:'}
                  </span>
                </span>
                <div className="flex gap-1">
                  {result.samplePredictions.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedSampleIdx(idx)}
                      className={`neu-btn px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
                        selectedSampleIdx === idx
                          ? 'neu-btn-active text-sky-600 dark:text-sky-400 font-bold'
                          : ''
                      }`}
                    >
                      #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {result.classNames.map((clsName, cIdx) => {
                  const prob = (activeSample.probabilities[cIdx] ?? 0) * 100;
                  return (
                    <div key={clsName} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-36 truncate">{clsName}</span>
                      <div className="flex-1 h-2 neu-inset overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.max(2, prob)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-semibold tabular-nums">
                        {prob.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Training Loss & Accuracy Curves */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InteractivePlot
          title={
            lang === 'fa'
              ? 'منحنی خطای آموزش و اعتبارسنجی (Loss) بر حسب دورهای آموزش'
              : 'Training & Validation Loss Curve across Epochs'
          }
          subtitle={
            mlConfig.architecture === 'autoencoder'
              ? lang === 'fa'
                ? 'میانگین مربعات خطای بازسازی شکل‌موج (MSE)'
                : 'Mean Squared Error (MSE) waveform reconstruction loss'
              : lang === 'fa'
              ? 'مسیر بهینه‌سازی آنتروپی متقاطع دسته‌ای (Cross-Entropy)'
              : 'Categorical Cross-Entropy optimization trajectory'
          }
          xData={epochNumbers.length > 0 ? epochNumbers : [1, 2]}
          xLabel={lang === 'fa' ? 'دور آموزش (Epoch)' : 'Epoch'}
          yLabel={lang === 'fa' ? 'مقدار خطا (Loss)' : 'Loss'}
          height={240}
          series={[
            {
              id: 'tr-loss',
              label: lang === 'fa' ? 'خطای آموزش (Train Loss)' : 'Training Loss',
              data: liveEpochs.map((e) => e.loss),
              color: '#0284c7',
              lineWidth: 2.1,
            },
            {
              id: 'val-loss',
              label: lang === 'fa' ? 'خطای اعتبارسنجی (Val Loss)' : 'Validation Loss',
              data: liveEpochs.map((e) => e.valLoss),
              color: '#d97706',
              lineWidth: 2,
              dashed: true,
            },
          ]}
        />

        <InteractivePlot
          title={
            lang === 'fa'
              ? 'منحنی دقت طبقه‌بندی / وفاداری بازسازی در طول دورهای آموزش'
              : 'Classification Accuracy / Reconstruction Fidelity across Epochs'
          }
          subtitle={
            lang === 'fa'
              ? 'دقت اعتبارسنجی زنده روی سیگنال‌های آزمون دیده‌نشده'
              : 'Live validation accuracy evaluated on held-out synthetic signals'
          }
          xData={epochNumbers.length > 0 ? epochNumbers : [1, 2]}
          xLabel={lang === 'fa' ? 'دور آموزش (Epoch)' : 'Epoch'}
          yLabel={lang === 'fa' ? 'دقت (0..1)' : 'Accuracy (0..1)'}
          height={240}
          yDomainOverride={[0, 1.05]}
          series={[
            {
              id: 'tr-acc',
              label: lang === 'fa' ? 'دقت آموزش (Train Accuracy)' : 'Training Accuracy',
              data: liveEpochs.map((e) => e.accuracy),
              color: '#059669',
              lineWidth: 2.1,
            },
            {
              id: 'val-acc',
              label: lang === 'fa' ? 'دقت اعتبارسنجی (Val Accuracy)' : 'Validation Accuracy',
              data: liveEpochs.map((e) => e.valAccuracy),
              color: '#7c3aed',
              lineWidth: 2,
              dashed: true,
            },
          ]}
        />
      </div>

      {/* Sample Prediction / Autoencoder Reconstruction & Learned Feature Kernels */}
      {result && activeSample && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <InteractivePlot
            title={
              lang === 'fa'
                ? `استنتاج نمونه #${selectedSampleIdx + 1} — واقعی: ${activeSample.trueClass} ← پیش‌بینی: ${activeSample.predictedClass}`
                : `Sample #${selectedSampleIdx + 1} Inference — True: ${activeSample.trueClass} → Predicted: ${activeSample.predictedClass}`
            }
            subtitle={
              activeSample.reconstructedSignal
                ? lang === 'fa'
                  ? `بهبود SNR با خودرمزگذار: ${calculateSNR(activeSample.cleanSignal, activeSample.signal).toFixed(1)} dB ← ${calculateSNR(activeSample.cleanSignal, activeSample.reconstructedSignal).toFixed(1)} dB`
                  : `Autoencoder Denoising SNR Improvement: ${calculateSNR(activeSample.cleanSignal, activeSample.signal).toFixed(1)} dB → ${calculateSNR(activeSample.cleanSignal, activeSample.reconstructedSignal).toFixed(1)} dB`
                : lang === 'fa'
                ? 'شکل‌موج آزمون طبقه‌بندی‌شده توسط مدل آموزش‌دیده TensorFlow.js'
                : 'Held-out test waveform classified by the trained TensorFlow.js model'
            }
            xData={Array.from({ length: activeSample.signal.length }, (_, i) => i)}
            xLabel={lang === 'fa' ? 'اندیس نمونه (n)' : 'Sample Index (n)'}
            yLabel={lang === 'fa' ? 'دامنه' : 'Amplitude'}
            height={245}
            series={[
              {
                id: 'ml-samp-noisy',
                label: lang === 'fa' ? 'سیگنال ورودی آزمون x[n]' : 'Observed Test Input x[n]',
                data: activeSample.signal,
                color: '#d97706',
                lineWidth: 1.5,
              },
              {
                id: 'ml-samp-clean',
                label: lang === 'fa' ? 'سیگنال تمیز مرجع' : 'Ground-Truth Clean Signal',
                data: activeSample.cleanSignal,
                color: '#0284c7',
                lineWidth: 1.8,
                dashed: true,
              },
              ...(activeSample.reconstructedSignal
                ? [
                    {
                      id: 'ml-samp-ae',
                      label:
                        lang === 'fa'
                          ? 'سیگنال بازسازی‌شده خودرمزگذار x̂[n]'
                          : 'Autoencoder Reconstructed x̂[n]',
                      data: activeSample.reconstructedSignal,
                      color: '#059669',
                      lineWidth: 2.3,
                    },
                  ]
                : []),
            ]}
          />

          <InteractivePlot
            title={
              lang === 'fa'
                ? 'پروفایل وزن‌ها و فیلترهای ویژگی یادگرفته‌شده در لایه اول'
                : 'Learned First-Layer Feature Representations / Filter Weights'
            }
            subtitle={
              lang === 'fa'
                ? 'بررسی پاسخ ضربه زمانی کرنل‌ها و نورون‌های استخراج‌شده در حین آموزش در مرورگر'
                : 'Inspect the temporal weight profiles learned by the neural network during browser training'
            }
            xData={Array.from(
              { length: result.learnedFeatures[0]?.length ?? 8 },
              (_, i) => i
            )}
            xLabel={lang === 'fa' ? 'اندیس وزن / ضریب فیلتر' : 'Weight / Kernel Tap Index'}
            yLabel={lang === 'fa' ? 'وزن یادگرفته‌شده w_i' : 'Learned Weight w_i'}
            height={245}
            series={result.learnedFeatures.map((feat, idx) => ({
              id: `feat-${idx}`,
              label:
                lang === 'fa'
                  ? `فیلتر/نورون یادگرفته‌شده #${idx + 1}`
                  : `Learned Filter/Neuron #${idx + 1}`,
              data: feat,
              color: ['#0284c7', '#059669', '#d97706', '#db2777'][idx % 4],
              lineWidth: 2,
            }))}
          />
        </div>
      )}

      <TheoryAccordion
        items={[
          {
            title:
              lang === 'fa'
                ? 'کانولوشن زمانی یک‌بعدی (Conv1D) و استخراج خودکار ویژگی'
                : '1D Temporal Convolution (Conv1D) & Feature Extraction',
            formula:
              'z_k[n] = \\sigma\\!\\left(b_k + \\sum_{c=1}^{C} \\sum_{m=0}^{K-1} w_{k,c}[m]\\,x_c[n+m]\\right)',
            explanation:
              lang === 'fa'
                ? 'یک لایه کانولوشنی یک‌بعدی (Conv1D) بانک فیلترهای FIR تغییرناپذیر با شیفت زمانی w_k[m] را مستقیماً از روی شکل‌موج‌های خام با پس‌انتشار خطا یاد می‌گیرد و به صورت خودکار فیلترهای منطبق فرکانسی را کشف می‌کند.'
                : 'A 1D Convolutional layer learns shift-invariant FIR filter banks w_k[m] directly from raw waveforms via backpropagation, discovering frequency-selective matched filters and transient edge detectors automatically.',
          },
          {
            title:
              lang === 'fa'
                ? 'فشرده‌سازی گلوگاه پنهان در خودرمزگذار حذف نویز (Denoising Autoencoder)'
                : 'Denoising Autoencoder Bottleneck Compression',
            formula:
              '\\mathbf{h} = f_\\theta(\\mathbf{\\tilde{x}}) = \\sigma(\\mathbf{W}_e\\mathbf{\\tilde{x}} + \\mathbf{b}_e), \\quad \\mathbf{\\hat{x}} = g_\\phi(\\mathbf{h}), \\quad \\mathcal{L} = \\|\\mathbf{x}_{\\text{clean}} - \\mathbf{\\hat{x}}\\|_2^2',
            explanation:
              lang === 'fa'
                ? 'با نگاشت سیگنال نویزی x̃ به یک زیرفضای گلوگاه کم‌بعد h، خودرمزگذار مجبور می‌شود ساختارهای همدوس سیگنال اصلی را حفظ کرده و نویز تصادفی غیرقابل فشرده‌سازی را حذف نماید.'
                : 'By mapping a noisy signal x̃ through a low-dimensional latent bottleneck h, the Autoencoder is forced to retain coherent low-dimensional signal structure while discarding incompressible broadband noise.',
          },
        ]}
      />
    </div>
  );
};
