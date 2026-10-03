import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Sliders,
  Trash2,
} from 'lucide-react';
import { PipelineBlock, PipelineBlockType } from '../types';
import { useLab } from '../store/LabContext';
import { InteractivePlot } from './InteractivePlot';

const AVAILABLE_BLOCKS: {
  type: PipelineBlockType;
  name: string;
  defaultParams: Record<string, number | string | boolean>;
}[] = [
  { type: 'noise', name: 'AWGN Noise Injector', defaultParams: { snrDb: 10 } },
  {
    type: 'bandpass',
    name: 'Band-Pass Filter',
    defaultParams: { cutoffLow: 4, cutoffHigh: 28, order: 4 },
  },
  { type: 'notch', name: '50 Hz Notch Filter', defaultParams: { freq: 50 } },
  {
    type: 'wavelet-denoise',
    name: 'Wavelet Soft Denoiser',
    defaultParams: { threshold: 0.25 },
  },
  { type: 'ica', name: 'FastICA Artifact Projection', defaultParams: { components: 4 } },
  { type: 'pca', name: 'PCA Subspace Filter', defaultParams: { components: 2 } },
  { type: 'fft', name: 'FFT Spectral Transform', defaultParams: { fftSize: 512 } },
];

export const PipelineEditor: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { experiment, setExperiment, computed } = useLab();
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(
    Math.max(0, experiment.processing.length - 1)
  );
  const [blockToAdd, setBlockToAdd] = useState<PipelineBlockType>('bandpass');

  const updateBlocks = (blocks: PipelineBlock[]) => {
    setExperiment((prev) => ({ ...prev, processing: blocks }));
  };

  const toggleBlock = (idx: number) => {
    const next = [...experiment.processing];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    updateBlocks(next);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= experiment.processing.length) return;
    const next = [...experiment.processing];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    updateBlocks(next);
    setSelectedStageIdx(target);
  };

  const removeBlock = (idx: number) => {
    if (experiment.processing.length <= 1) return;
    const next = experiment.processing.filter((_, i) => i !== idx);
    updateBlocks(next);
    setSelectedStageIdx(Math.max(0, Math.min(selectedStageIdx, next.length - 1)));
  };

  const addBlock = () => {
    const template =
      AVAILABLE_BLOCKS.find((b) => b.type === blockToAdd) || AVAILABLE_BLOCKS[1];
    const newBlk: PipelineBlock = {
      id: `blk-${Date.now()}`,
      type: template.type,
      name: template.name,
      enabled: true,
      params: { ...template.defaultParams },
    };
    const next = [...experiment.processing, newBlk];
    updateBlocks(next);
    setSelectedStageIdx(next.length - 1);
  };

  const updateParam = (idx: number, key: string, val: number) => {
    const next = [...experiment.processing];
    next[idx] = {
      ...next[idx],
      params: { ...next[idx].params, [key]: val },
    };
    updateBlocks(next);
  };

  const inspectedStage =
    computed.pipelineStages[
      Math.min(selectedStageIdx, Math.max(0, computed.pipelineStages.length - 1))
    ];

  return (
    <div className="neu-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-500" />
            <span>Interactive Client-Side Processing Pipeline</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add, reorder, toggle, or tune DSP blocks and click any stage to inspect its intermediate signal output.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={blockToAdd}
            onChange={(e) => setBlockToAdd(e.target.value as PipelineBlockType)}
            className="neu-inset px-3 py-1.5 text-xs font-medium rounded-lg bg-transparent outline-none"
          >
            {AVAILABLE_BLOCKS.map((b) => (
              <option key={b.type} value={b.type} className="bg-slate-900 text-white">
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addBlock}
            className="neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stage</span>
          </button>
        </div>
      </div>

      {/* Horizontal Visual Flow Chain */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-2 pt-1">
        {experiment.processing.map((blk, idx) => {
          const isSelected = idx === selectedStageIdx;
          return (
            <React.Fragment key={blk.id}>
              <div
                onClick={() => setSelectedStageIdx(idx)}
                className={`min-w-[185px] p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'neu-inset border-sky-500/60'
                    : 'neu-card-sm border-transparent hover:border-slate-400/40'
                } ${!blk.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-mono text-slate-500">
                    Stage 0{idx + 1}
                  </span>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => moveBlock(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 hover:text-sky-500 disabled:opacity-30 cursor-pointer"
                      title="Move Left"
                    >
                      <ArrowUp className="w-3 h-3 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(idx, 1)}
                      disabled={idx === experiment.processing.length - 1}
                      className="p-1 hover:text-sky-500 disabled:opacity-30 cursor-pointer"
                      title="Move Right"
                    >
                      <ArrowDown className="w-3 h-3 -rotate-90" />
                    </button>
                    {experiment.processing.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(idx)}
                        className="p-1 hover:text-rose-500 cursor-pointer"
                        title="Delete Block"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold truncate">{blk.name}</div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {blk.enabled ? '● ACTIVE' : '○ BYPASSED'}
                  </div>
                </div>

                {/* Inline quick parameter control */}
                <div
                  className="pt-1 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => toggleBlock(idx)}
                    className="text-[11px] font-mono underline text-sky-600 dark:text-sky-400 cursor-pointer"
                  >
                    {blk.enabled ? 'Disable' : 'Enable'}
                  </button>

                  {blk.type === 'noise' && (
                    <label className="text-[10px] font-mono flex items-center gap-1">
                      SNR:
                      <input
                        type="number"
                        value={Number(blk.params.snrDb ?? 12)}
                        onChange={(e) => updateParam(idx, 'snrDb', Number(e.target.value))}
                        className="w-12 px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-right"
                      />
                    </label>
                  )}
                  {blk.type === 'bandpass' && (
                    <label className="text-[10px] font-mono flex items-center gap-1">
                      fH:
                      <input
                        type="number"
                        value={Number(blk.params.cutoffHigh ?? 25)}
                        onChange={(e) => updateParam(idx, 'cutoffHigh', Number(e.target.value))}
                        className="w-12 px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-right"
                      />
                    </label>
                  )}
                </div>
              </div>

              {idx < experiment.processing.length - 1 && (
                <div className="flex items-center justify-center text-slate-400 font-mono text-xs px-0.5">
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {!compact && inspectedStage && (
        <InteractivePlot
          title={`Intermediate Stage Output — Stage 0${selectedStageIdx + 1}: ${inspectedStage.block.name}`}
          subtitle="Click any block in the pipeline chain above to inspect its live intermediate signal representation"
          xData={
            inspectedStage.block.type === 'fft'
              ? computed.spectrum.frequencies
              : computed.time
          }
          xLabel={inspectedStage.block.type === 'fft' ? 'Frequency (Hz)' : 'Time (s)'}
          yLabel={inspectedStage.block.type === 'fft' ? 'Magnitude' : 'Amplitude'}
          height={200}
          series={[
            {
              id: 'stage-out',
              label: `${inspectedStage.block.name} Output`,
              data: inspectedStage.signal,
              color: '#0ea5e9',
              lineWidth: 2,
            },
          ]}
        />
      )}
    </div>
  );
};
