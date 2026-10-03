import React, { useEffect, useRef, useState } from 'react';
import { Brain, Play, Square } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { TheoryAccordion } from '../components/MathBlock';
import {
  MLTrainingEpochLog,
  MLTrainingResult,
  runBrowserMLTraining,
} from '../simulations/ml';
import { useLab } from '../store/LabContext';
import { MLArchitectureType, MLTaskType } from '../types';

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
  const { mlConfig, setMlConfig, experiment } = useLab();
  const [isTraining, setIsTraining] = useState(false);
  const [liveEpochs, setLiveEpochs] = useState<MLTrainingEpochLog[]>([]);
  const [result, setResult] = useState<MLTrainingResult | null>(null);
  const stopRef = useRef<boolean>(false);

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
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    startTraining();
  }, [mlConfig.architecture, mlConfig.task]);

  const epochNumbers = liveEpochs.map((e) => e.epoch);
  const latestLog = liveEpochs[liveEpochs.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-sky-500 mb-0.5">
              TensorFlow.js In-Browser Execution · Client-Side Educational Neural Networks
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Deep Learning Signal Classification & Denoising Laboratory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Train Dense, 1D-CNN, Autoencoder, and RNN architectures directly inside your browser on synthetic signal and EEG datasets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isTraining ? (
              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                }}
                className="neu-btn px-4 py-2 rounded-lg text-xs font-semibold text-rose-500 flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Training</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startTraining}
                className="neu-btn px-4 py-2 rounded-lg text-xs font-semibold text-sky-500 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Train Model in Browser</span>
              </button>
            )}
          </div>
        </div>

        {/* Architecture Selector */}
        <div className="flex flex-wrap gap-2">
          {ARCHITECTURES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => updateML({ architecture: a.id })}
              className={`neu-btn px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                mlConfig.architecture === a.id ? 'neu-btn-active text-sky-500' : ''
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Task & Hyperparameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-500 mb-1">
              Synthetic Signal Task / Dataset
            </label>
            <select
              value={mlConfig.task}
              onChange={(e) => updateML({ task: e.target.value as MLTaskType })}
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-medium bg-transparent"
            >
              {TASKS.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Epochs</span>
              <span className="text-sky-500 font-semibold">{mlConfig.epochs}</span>
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
              <span className="text-sky-500 font-semibold">{mlConfig.hiddenUnits}</span>
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
              <span className="text-amber-500 font-semibold">
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
        <div className="neu-inset p-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between text-xs font-mono">
            <span>
              Status:{' '}
              <strong className={isTraining ? 'text-amber-500' : 'text-emerald-500'}>
                {isTraining
                  ? `Training Epoch ${liveEpochs.length}/${mlConfig.epochs}...`
                  : '● Training Complete'}
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
                <span className="text-emerald-500">
                  Val Accuracy: <strong>{(latestLog.valAccuracy * 100).toFixed(1)}%</strong>
                </span>
              </div>
            )}
          </div>
          <div className="w-full h-2 rounded-full bg-slate-300/50 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-150"
              style={{
                width: `${Math.min(100, (liveEpochs.length / Math.max(1, mlConfig.epochs)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Network Architecture Diagram + Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 neu-card p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Brain className="w-4 h-4 text-sky-500" />
              <span>Compiled TensorFlow.js Layer Topology</span>
            </h3>
            <p className="text-xs text-slate-500">
              Active tensor shapes and trainable parameter counts per layer
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-2">
            <div className="neu-inset px-3 py-2.5 text-center min-w-[115px]">
              <div className="text-[10px] font-mono text-slate-400">Input Tensor</div>
              <div className="text-xs font-bold mt-0.5">[Batch, 64]</div>
              <div className="text-[10px] font-mono text-sky-500 mt-0.5">Time Window</div>
            </div>
            {result?.architectureLayers.map((lyr, i) => (
              <React.Fragment key={i}>
                <span className="text-slate-400 font-mono">→</span>
                <div className="neu-card-sm px-3.5 py-2.5 text-center min-w-[135px]">
                  <div className="text-[10px] font-mono text-sky-500">{lyr.type}</div>
                  <div className="text-xs font-bold truncate mt-0.5">{lyr.name}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    Shape: {lyr.shape} · {lyr.params} params
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-500 flex justify-between border-t border-slate-200/60 dark:border-slate-800 pt-2">
            <span>Optimizer: Adam (lr = {mlConfig.learningRate})</span>
            <span>
              Total Trainable Parameters:{' '}
              <strong className="text-sky-500">
                {result?.architectureLayers.reduce((a, b) => a + b.params, 0) ?? 0}
              </strong>
            </span>
          </div>
        </div>

        {/* Confusion Matrix */}
        <div className="lg:col-span-5 neu-card p-5 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Validation Confusion Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Rows = Ground-Truth Class · Columns = Predicted Class
            </p>
          </div>

          {result && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-400">True \ Pred</th>
                    {result.classNames.map((cn) => (
                      <th key={cn} className="p-2 text-center text-sky-500">
                        {cn.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.confusionMatrix.map((row, rIdx) => (
                    <tr key={rIdx} className="border-t border-slate-200/50 dark:border-slate-800">
                      <td className="p-2 font-semibold">{result.classNames[rIdx]}</td>
                      {row.map((cnt, cIdx) => {
                        const isDiag = rIdx === cIdx;
                        return (
                          <td
                            key={cIdx}
                            className={`p-2 text-center font-bold rounded ${
                              isDiag
                                ? 'text-emerald-500 bg-emerald-500/10'
                                : cnt > 0
                                ? 'text-rose-500 bg-rose-500/10'
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
              color: '#0ea5e9',
              lineWidth: 2,
            },
            {
              id: 'val-loss',
              label: 'Validation Loss',
              data: liveEpochs.map((e) => e.valLoss),
              color: '#f59e0b',
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
              color: '#10b981',
              lineWidth: 2,
            },
            {
              id: 'val-acc',
              label: 'Validation Accuracy',
              data: liveEpochs.map((e) => e.valAccuracy),
              color: '#a855f7',
              lineWidth: 2,
              dashed: true,
            },
          ]}
        />
      </div>

      {/* Sample Prediction / Autoencoder Reconstruction & Learned Feature Kernels */}
      {result && result.samplePredictions[0] && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <InteractivePlot
            title={`Test Sample Inference — True: ${result.samplePredictions[0].trueClass} → Predicted: ${result.samplePredictions[0].predictedClass}`}
            subtitle={
              mlConfig.architecture === 'autoencoder'
                ? 'Comparison of Noisy Input vs. Neural Autoencoder Denoised Output'
                : 'Held-out test waveform classified by the trained TensorFlow.js model'
            }
            xData={Array.from({ length: result.samplePredictions[0].signal.length }, (_, i) => i)}
            xLabel="Sample Index (n)"
            yLabel="Amplitude"
            height={240}
            series={[
              {
                id: 'ml-samp-noisy',
                label: 'Observed Test Input x[n]',
                data: result.samplePredictions[0].signal,
                color: '#f59e0b',
                lineWidth: 1.5,
              },
              {
                id: 'ml-samp-clean',
                label: 'Ground-Truth Clean Signal',
                data: result.samplePredictions[0].cleanSignal,
                color: '#0ea5e9',
                lineWidth: 1.8,
                dashed: true,
              },
              ...(result.samplePredictions[0].reconstructedSignal
                ? [
                    {
                      id: 'ml-samp-ae',
                      label: 'Autoencoder Reconstructed x̂[n]',
                      data: result.samplePredictions[0].reconstructedSignal,
                      color: '#10b981',
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
            height={240}
            series={result.learnedFeatures.map((feat, idx) => ({
              id: `feat-${idx}`,
              label: `Learned Filter/Neuron #${idx + 1}`,
              data: feat,
              color: ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899'][idx % 4],
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
