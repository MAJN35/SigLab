import React, { useEffect, useRef, useState } from 'react';
import { Brain, Play, Sparkles, Square, Zap } from 'lucide-react';
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

const ARCHITECTURES: { id: MLArchitectureType; label: string; desc: string }[] = [
  { id: 'dense', label: 'Dense MLP', desc: 'Multi-Layer Perceptron with ReLU hidden layers' },
  { id: 'cnn1d', label: '1D CNN', desc: 'Temporal Conv1D filters + MaxPooling1D + Softmax' },
  { id: 'autoencoder', label: 'Denoising Autoencoder', desc: 'Encoder-Latent Bottleneck-Decoder waveform reconstructor' },
  { id: 'rnn', label: 'Simple RNN / Sequence', desc: 'Recurrent sequence state cell over temporal windows' },
];

const TASKS: { id: MLTaskType; label: string }[] = [
  { id: 'sine-vs-square', label: 'Sine vs. Square Classification' },
  { id: 'low-vs-high-freq', label: 'Low vs. High Frequency Classification' },
  { id: 'clean-vs-noisy', label: 'Clean vs. Noisy Signal Detection' },
  { id: 'eeg-band-class', label: 'Synthetic EEG Band Classification (δ / α / β)' },
  { id: 'modulation-class', label: 'Digital Modulation Classification (ASK / BPSK / FSK)' },
];

export const DeepLearningPage: React.FC = () => {
  const { mlConfig, setMlConfig, experiment, darkMode } = useLab();
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

  // Draw Interactive Neural Network Architecture & Activation Graph Canvas (Light & Dark Mode calibrated)
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

    ctx.fillStyle = darkMode ? '#080d18' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const numClasses = result?.classNames.length ?? 2;
    const layers =
      mlConfig.architecture === 'autoencoder'
        ? [
            { name: 'Noisy Input', nodes: 6, sub: '64 samples' },
            { name: 'Encoder', nodes: 4, sub: `${mlConfig.hiddenUnits} ReLU` },
            { name: 'Bottleneck z', nodes: 2, sub: `${Math.max(4, Math.floor(mlConfig.hiddenUnits / 2))} Latent` },
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
            { name: 'Hidden Layer 2', nodes: 4, sub: `${Math.max(8, Math.floor(mlConfig.hiddenUnits * 0.75))} Units` },
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
          ctx.strokeStyle = darkMode
            ? `rgba(56, 189, 248, ${0.12 + weightStrength * 0.32})`
            : `rgba(2, 132, 199, ${0.16 + weightStrength * 0.36})`;
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
            : darkMode
            ? '#1e293b'
            : '#e2e8f0'
          : darkMode
          ? '#0284c7'
          : '#0ea5e9';
        ctx.strokeStyle = darkMode ? '#f8fafc' : '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isLast ? 9 : 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        if (isLast && result?.classNames[nIdx] && mlConfig.architecture !== 'autoencoder') {
          ctx.fillStyle = darkMode ? '#e2e8f0' : '#0f172a';
          ctx.font = '600 10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            `${(prob * 100).toFixed(0)}%`,
            pt.x + 13,
            pt.y
          );
        }
      });

      const headerX = col[0]?.x ?? 50;
      ctx.fillStyle = darkMode ? '#f8fafc' : '#0f172a';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(layers[lIdx].name, headerX, height - 24);

      ctx.fillStyle = darkMode ? '#94a3b8' : '#475569';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(layers[lIdx].sub, headerX, height - 10);
    });
  }, [darkMode, mlConfig.architecture, mlConfig.hiddenUnits, result, activeSample]);

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400 mb-0.5">
              TensorFlow.js In-Browser Engine · Client-Side Neural Network Laboratory
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Deep Learning Signal Classification & Denoising Laboratory
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Train Dense MLP, 1D-CNN, Denoising Autoencoder, and Simple RNN architectures directly in your browser and inspect live synaptic activations.
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
                <span>Stop Training</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startTraining}
                className="btn-primary-pill px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Train Model in Browser</span>
              </button>
            )}
          </div>
        </div>

        {/* Architecture Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {ARCHITECTURES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => updateML({ architecture: a.id })}
              className={`neu-btn p-3 rounded-xl text-left flex flex-col gap-0.5 cursor-pointer ${
                mlConfig.architecture === a.id
                  ? 'neu-btn-active text-sky-700 dark:text-sky-300'
                  : ''
              }`}
            >
              <span className="text-xs font-bold">{a.label}</span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                {a.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Task & Hyperparameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
              Synthetic Signal Task / Dataset
            </label>
            <select
              value={mlConfig.task}
              onChange={(e) => updateML({ task: e.target.value as MLTaskType })}
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-semibold bg-transparent outline-none"
            >
              {TASKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Epochs</span>
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
              <span>Hidden Units / Filters</span>
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
              <span>Dataset Noise (σ)</span>
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
              Engine Status:{' '}
              <strong
                className={
                  isTraining
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }
              >
                {isTraining
                  ? `▲ Training Epoch ${liveEpochs.length}/${mlConfig.epochs}...`
                  : '● Model Trained & Ready for Live Inference'}
              </strong>
            </span>
            {latestLog && (
              <div className="flex items-center gap-4 tabular-nums">
                <span>
                  Train Loss: <strong>{latestLog.loss.toFixed(4)}</strong>
                </span>
                <span>
                  Val Loss: <strong>{latestLog.valLoss.toFixed(4)}</strong>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Val Accuracy: <strong>{(latestLog.valAccuracy * 100).toFixed(1)}%</strong>
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
                <span>Interactive Neural Network Topology & Output Activations</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Visualizes active layers, synaptic connections, and live softmax class probabilities
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Params:{' '}
              <strong className="text-sky-600 dark:text-sky-400">
                {result?.architectureLayers.reduce((a, b) => a + b.params, 0) ?? 0}
              </strong>
            </span>
          </div>

          <div className="neu-inset p-1 overflow-hidden">
            <canvas ref={netCanvasRef} className="block w-full rounded-lg" />
          </div>
        </div>

        {/* Confusion Matrix & Class Confidence Breakdown */}
        <div className="lg:col-span-5 neu-card p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Validation Confusion Matrix & Class Probabilities
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Rows = Ground-Truth Class · Columns = Predicted Class
            </p>
          </div>

          {result && (
            <div className="neu-inset p-3 overflow-x-auto">
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
                  <span>Inspect Validation Sample:</span>
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
          title="Training & Validation Loss Curve across Epochs"
          subtitle={
            mlConfig.architecture === 'autoencoder'
              ? 'Mean Squared Error (MSE) waveform reconstruction loss'
              : 'Categorical Cross-Entropy optimization trajectory'
          }
          xData={epochNumbers.length > 0 ? epochNumbers : [1, 2]}
          xLabel="Epoch"
          yLabel="Loss"
          height={240}
          series={[
            {
              id: 'tr-loss',
              label: 'Training Loss',
              data: liveEpochs.map((e) => e.loss),
              color: '#0284c7',
              lineWidth: 2.1,
            },
            {
              id: 'val-loss',
              label: 'Validation Loss',
              data: liveEpochs.map((e) => e.valLoss),
              color: '#d97706',
              lineWidth: 2,
              dashed: true,
            },
          ]}
        />

        <InteractivePlot
          title="Classification Accuracy / Reconstruction Fidelity across Epochs"
          subtitle="Live validation accuracy evaluated on held-out synthetic signals"
          xData={epochNumbers.length > 0 ? epochNumbers : [1, 2]}
          xLabel="Epoch"
          yLabel="Accuracy (0..1)"
          height={240}
          yDomainOverride={[0, 1.05]}
          series={[
            {
              id: 'tr-acc',
              label: 'Training Accuracy',
              data: liveEpochs.map((e) => e.accuracy),
              color: '#059669',
              lineWidth: 2.1,
            },
            {
              id: 'val-acc',
              label: 'Validation Accuracy',
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
            title={`Sample #${selectedSampleIdx + 1} Inference — True: ${activeSample.trueClass} → Predicted: ${activeSample.predictedClass}`}
            subtitle={
              activeSample.reconstructedSignal
                ? `Autoencoder Denoising SNR Improvement: ${calculateSNR(activeSample.cleanSignal, activeSample.signal).toFixed(1)} dB → ${calculateSNR(activeSample.cleanSignal, activeSample.reconstructedSignal).toFixed(1)} dB`
                : 'Held-out test waveform classified by the trained TensorFlow.js model'
            }
            xData={Array.from({ length: activeSample.signal.length }, (_, i) => i)}
            xLabel="Sample Index (n)"
            yLabel="Amplitude"
            height={245}
            series={[
              {
                id: 'ml-samp-noisy',
                label: 'Observed Test Input x[n]',
                data: activeSample.signal,
                color: '#d97706',
                lineWidth: 1.5,
              },
              {
                id: 'ml-samp-clean',
                label: 'Ground-Truth Clean Signal',
                data: activeSample.cleanSignal,
                color: '#0284c7',
                lineWidth: 1.8,
                dashed: true,
              },
              ...(activeSample.reconstructedSignal
                ? [
                    {
                      id: 'ml-samp-ae',
                      label: 'Autoencoder Reconstructed x̂[n]',
                      data: activeSample.reconstructedSignal,
                      color: '#059669',
                      lineWidth: 2.3,
                    },
                  ]
                : []),
            ]}
          />

          <InteractivePlot
            title="Learned First-Layer Feature Representations / Filter Weights"
            subtitle="Inspect the temporal weight profiles learned by the neural network during browser training"
            xData={Array.from(
              { length: result.learnedFeatures[0]?.length ?? 8 },
              (_, i) => i
            )}
            xLabel="Weight / Kernel Tap Index"
            yLabel="Learned Weight w_i"
            height={245}
            series={result.learnedFeatures.map((feat, idx) => ({
              id: `feat-${idx}`,
              label: `Learned Filter/Neuron #${idx + 1}`,
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
            title: '1D Temporal Convolution (Conv1D) & Feature Extraction',
            formula: 'z_k[n] = \\sigma\\!\\left(b_k + \\sum_{c=1}^{C} \\sum_{m=0}^{K-1} w_{k,c}[m]\\,x_c[n+m]\\right)',
            explanation:
              'A 1D Convolutional layer learns shift-invariant FIR filter banks w_k[m] directly from raw waveforms via backpropagation, discovering frequency-selective matched filters and transient edge detectors automatically.',
          },
          {
            title: 'Denoising Autoencoder Bottleneck Compression',
            formula: '\\mathbf{h} = f_\\theta(\\mathbf{\\tilde{x}}) = \\sigma(\\mathbf{W}_e\\mathbf{\\tilde{x}} + \\mathbf{b}_e), \\quad \\mathbf{\\hat{x}} = g_\\phi(\\mathbf{h}), \\quad \\mathcal{L} = \\|\\mathbf{x}_{\\text{clean}} - \\mathbf{\\hat{x}}\\|_2^2',
            explanation:
              'By mapping a noisy signal x̃ through a low-dimensional latent bottleneck h, the Autoencoder is forced to retain coherent low-dimensional signal structure while discarding incompressible broadband noise.',
          },
        ]}
      />
    </div>
  );
};
