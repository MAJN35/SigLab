import React, { useId, useState } from 'react';
import { Copy, Database, Download, Edit3, GitCompare, Plus, Trash2 } from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { PageHeader } from '../components/ui';
import { getSeriesColor, getSeriesDash } from '../theme/palette';
import { useLab } from '../store/LabContext';
import {
  AnalogModType,
  CustomSample,
  DigitalModType,
  NoiseType,
  SignalWaveType,
} from '../types';

export const CustomSamplesPage: React.FC = () => {
  const { customSamples, saveCustomSample, deleteCustomSample, experiment, lang, showToast } = useLab();
  const isFa = lang === 'fa';
  const fid = useId();
  const ids = {
    name: `${fid}-name`,
    type: `${fid}-type`,
    mod: `${fid}-mod`,
    fs: `${fid}-fs`,
    dur: `${fid}-dur`,
    ch: `${fid}-ch`,
    freq: `${fid}-freq`,
    amp: `${fid}-amp`,
    snr: `${fid}-snr`,
    artifacts: `${fid}-artifacts`,
    cmpA: `${fid}-cmp-a`,
    cmpB: `${fid}-cmp-b`,
  };

  const handleDelete = async (s: CustomSample) => {
    await deleteCustomSample(s.id);
    showToast({
      message: isFa ? `«${s.name}» حذف شد` : `Deleted “${s.name}”`,
      kind: 'info',
      action: {
        label: isFa ? 'بازگردانی' : 'Undo',
        onAction: () => {
          void saveCustomSample(s);
        },
      },
    });
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('Synthetic Multi-Channel Telemetry Sample');
  const [signalType, setSignalType] = useState<SignalWaveType>('sine');
  const [samplingRate, setSamplingRate] = useState(256);
  const [duration, setDuration] = useState(2.0);
  const [channels, setChannels] = useState(2);
  const [frequency, setFrequency] = useState(8.0);
  const [amplitude, setAmplitude] = useState(1.5);
  const [phase, setPhase] = useState(0);
  const [noiseType, setNoiseType] = useState<NoiseType>('awgn');
  const [noiseSnrDb, setNoiseSnrDb] = useState(14);
  const [modulation, setModulation] = useState<DigitalModType | AnalogModType | 'None'>('None');
  const [artifacts, setArtifacts] = useState<string[]>(['50Hz Hum']);

  const [compareIds, setCompareIds] = useState<[string, string]>(() => [
    customSamples[0]?.id ?? '',
    customSamples[1]?.id ?? customSamples[0]?.id ?? '',
  ]);

  const buildPreviewWaveform = (
    type: SignalWaveType,
    fs: number,
    f: number,
    amp: number,
    ph: number,
    snr: number
  ): number[] => {
    const N = 128;
    const out = new Array<number>(N);
    const noiseStd = amp / Math.pow(10, snr / 20);
    for (let i = 0; i < N; i++) {
      const t = i / fs;
      const arg = 2 * Math.PI * f * t + (ph * Math.PI) / 180;
      let clean = amp * Math.sin(arg);
      if (type === 'square') clean = amp * (Math.sin(arg) >= 0 ? 1 : -1);
      else if (type === 'cosine') clean = amp * Math.cos(arg);
      else if (type === 'chirp') clean = amp * Math.sin(arg * (1 + t));
      out[i] = clean + noiseStd * Math.sin(i * 12.9898);
    }
    return out;
  };

  const handleSave = async () => {
    const sample: CustomSample = {
      id: editingId || `sample-${Date.now()}`,
      name: name.trim() || 'Untitled Sample',
      createdAt: new Date().toISOString(),
      signalType,
      samplingRate,
      duration,
      channels,
      frequency,
      amplitude,
      phase,
      noiseType,
      noiseSnrDb,
      modulation,
      artifacts,
      pipeline: experiment.processing,
      previewData: buildPreviewWaveform(
        signalType,
        samplingRate,
        frequency,
        amplitude,
        phase,
        noiseSnrDb
      ),
    };
    await saveCustomSample(sample);
    setEditingId(null);
  };

  const handleEdit = (s: CustomSample) => {
    setEditingId(s.id);
    setName(s.name);
    setSignalType(s.signalType);
    setSamplingRate(s.samplingRate);
    setDuration(s.duration);
    setChannels(s.channels);
    setFrequency(s.frequency);
    setAmplitude(s.amplitude);
    setPhase(s.phase);
    setNoiseType(s.noiseType);
    setNoiseSnrDb(s.noiseSnrDb);
    setModulation(s.modulation);
    setArtifacts(s.artifacts);
  };

  const handleDuplicate = async (s: CustomSample) => {
    const copy: CustomSample = {
      ...structuredClone(s),
      id: `sample-${Date.now()}`,
      name: `${s.name} (Copy)`,
      createdAt: new Date().toISOString(),
    };
    await saveCustomSample(copy);
  };

  const handleExportSample = (s: CustomSample) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleArtifactTag = (tag: string) => {
    setArtifacts((prev) =>
      prev.includes(tag) ? prev.filter((a) => a !== tag) : [...prev, tag]
    );
  };

  const sampleA = customSamples.find((s) => s.id === compareIds[0]) || customSamples[0];
  const sampleB = customSamples.find((s) => s.id === compareIds[1]) || customSamples[1] || sampleA;

  return (
    <div className="flex flex-col gap-6">
      <div className="neu-card p-5 flex flex-col gap-4">
        <PageHeader
          icon={<Database className="w-5 h-5" />}
          title={isFa ? 'کتابخانه نمونه‌های سیگنال سفارشی' : 'Custom Signal Sample Library'}
          subtitle={
            isFa
              ? 'ساخت، ویرایش، مقایسه و خروجی گرفتن از نمونه‌های سیگنال مصنوعی؛ ذخیره دائمی و محلی در پایگاه داده IndexedDB مرورگر.'
              : 'Build, edit, compare and export synthetic signal samples; persisted locally in browser IndexedDB.'
          }
          stats={[{ label: isFa ? 'نمونه‌های ذخیره‌شده' : 'Saved samples', value: customSamples.length }]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sample Builder Form */}
        <div className="lg:col-span-5 neu-card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {editingId
                  ? lang === 'fa'
                    ? 'ویرایش نمونه سفارشی'
                    : 'Edit Custom Sample'
                  : lang === 'fa'
                  ? 'سازنده نمونه‌های سیگنال مصنوعی سفارشی'
                  : 'Custom Synthetic Sample Builder'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'fa'
                  ? 'ذخیره دائمی و محلی در پایگاه داده IndexedDB مرورگر'
                  : 'Persisted locally in browser IndexedDB'}
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-xs font-mono text-sky-600 dark:text-sky-400 underline cursor-pointer"
              >
                {lang === 'fa' ? 'لغو ویرایش' : 'Cancel Edit'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <div>
              <label htmlFor={ids.name} className="block font-mono text-slate-500 mb-1">
                {lang === 'fa' ? 'نام نمونه' : 'Sample Name'}
              </label>
              <input
                id={ids.name}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="neu-inset w-full px-3 py-2 rounded-control font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={ids.type} className="block font-mono text-slate-500 mb-1">
                  {lang === 'fa' ? 'نوع شکل‌موج' : 'Waveform Type'}
                </label>
                <select
                  id={ids.type}
                  value={signalType}
                  onChange={(e) => setSignalType(e.target.value as SignalWaveType)}
                  className="neu-inset w-full px-2.5 py-2 rounded-control font-mono"
                >
                  <option value="sine">{lang === 'fa' ? 'سینوسی (Sine)' : 'Sine'}</option>
                  <option value="cosine">{lang === 'fa' ? 'کسینوسی (Cosine)' : 'Cosine'}</option>
                  <option value="square">{lang === 'fa' ? 'مربعی (Square)' : 'Square'}</option>
                  <option value="triangle">{lang === 'fa' ? 'مثلثی (Triangle)' : 'Triangle'}</option>
                  <option value="sawtooth">{lang === 'fa' ? 'دندان‌اره‌ای (Sawtooth)' : 'Sawtooth'}</option>
                  <option value="chirp">{lang === 'fa' ? 'چرپ (Chirp)' : 'Chirp'}</option>
                </select>
              </div>

              <div>
                <label htmlFor={ids.mod} className="block font-mono text-slate-500 mb-1">
                  {lang === 'fa' ? 'مدولاسیون' : 'Modulation'}
                </label>
                <select
                  id={ids.mod}
                  value={modulation}
                  onChange={(e) => setModulation(e.target.value as DigitalModType | AnalogModType | 'None')}
                  className="neu-inset w-full px-2.5 py-2 rounded-control font-mono"
                >
                  <option value="None">
                    {lang === 'fa' ? 'بدون مدولاسیون (باند پایه)' : 'None (Baseband)'}
                  </option>
                  <option value="AM">AM</option>
                  <option value="FM">FM</option>
                  <option value="BPSK">BPSK</option>
                  <option value="QPSK">QPSK</option>
                  <option value="16-QAM">16-QAM</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
              <div>
                <label htmlFor={ids.fs} className="block text-slate-500 mb-1">
                  {lang === 'fa' ? 'نرخ نمونه fs (Hz)' : 'fs (Hz)'}
                </label>
                <input
                  id={ids.fs}
                  type="number"
                  value={samplingRate}
                  onChange={(e) => setSamplingRate(Number(e.target.value))}
                  className="neu-inset w-full px-2.5 py-1.5 rounded-control"
                />
              </div>
              <div>
                <label htmlFor={ids.dur} className="block text-slate-500 mb-1">
                  {lang === 'fa' ? 'مدت (ثانیه)' : 'Duration (s)'}
                </label>
                <input
                  id={ids.dur}
                  type="number"
                  step={0.5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="neu-inset w-full px-2.5 py-1.5 rounded-control"
                />
              </div>
              <div>
                <label htmlFor={ids.ch} className="block text-slate-500 mb-1">
                  {lang === 'fa' ? 'تعداد کانال' : 'Channels'}
                </label>
                <input
                  id={ids.ch}
                  type="number"
                  min={1}
                  max={16}
                  value={channels}
                  onChange={(e) => setChannels(Number(e.target.value))}
                  className="neu-inset w-full px-2.5 py-1.5 rounded-control"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
              <div>
                <label htmlFor={ids.freq} className="block text-slate-500 mb-1">
                  {lang === 'fa' ? 'فرکانس (Hz)' : 'Freq (Hz)'}
                </label>
                <input
                  id={ids.freq}
                  type="number"
                  step={0.5}
                  value={frequency}
                  onChange={(e) => setFrequency(Number(e.target.value))}
                  className="neu-inset w-full px-2.5 py-1.5 rounded-control"
                />
              </div>
              <div>
                <label htmlFor={ids.amp} className="block text-slate-500 mb-1">
                  {lang === 'fa' ? 'دامنه (V)' : 'Amp (V)'}
                </label>
                <input
                  id={ids.amp}
                  type="number"
                  step={0.1}
                  value={amplitude}
                  onChange={(e) => setAmplitude(Number(e.target.value))}
                  className="neu-inset w-full px-2.5 py-1.5 rounded-control"
                />
              </div>
              <div>
                <label htmlFor={ids.snr} className="block text-slate-500 mb-1">SNR (dB)</label>
                <input
                  id={ids.snr}
                  type="number"
                  value={noiseSnrDb}
                  onChange={(e) => setNoiseSnrDb(Number(e.target.value))}
                  className="neu-inset w-full px-2.5 py-1.5 rounded-control"
                />
              </div>
            </div>

            <div>
              <span id={ids.artifacts} className="block font-mono text-slate-500 mb-1.5">
                {lang === 'fa'
                  ? 'آرتیفکت‌ها و تداخل‌های تعبیه‌شده'
                  : 'Embedded Artifacts & Interference'}
              </span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={ids.artifacts}>
                {['Eye Blink', 'EMG Burst', '50Hz Hum', 'Baseline Drift', 'Impulse Noise'].map(
                  (art) => (
                    <button
                      key={art}
                      type="button"
                      aria-pressed={artifacts.includes(art)}
                      onClick={() => toggleArtifactTag(art)}
                      className={`neu-btn px-2.5 py-1 rounded-full text-xs font-mono cursor-pointer ${
                        artifacts.includes(art) ? 'neu-btn-active text-sky-600 dark:text-sky-400 font-semibold' : ''
                      }`}
                    >
                      {art}
                    </button>
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="btn-primary-pill py-2.5 px-5 text-xs flex items-center justify-center gap-1.5 mt-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>
                {editingId
                  ? lang === 'fa'
                    ? 'به‌روزرسانی نمونه در IndexedDB'
                    : 'Update Sample in IndexedDB'
                  : lang === 'fa'
                  ? 'ذخیره نمونه در IndexedDB'
                  : 'Save Sample to IndexedDB'}
              </span>
            </button>
          </div>
        </div>

        {/* Saved Custom Samples List & Side-by-Side Comparison */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="neu-card p-5 flex flex-col gap-3.5">
            <h2 className="text-base font-bold tracking-tight">
              {lang === 'fa'
                ? `نمونه‌های سفارشی ذخیره‌شده در مرورگر (${customSamples.length})`
                : `Saved IndexedDB Custom Samples (${customSamples.length})`}
            </h2>

            <div className="flex flex-col gap-2.5">
              {customSamples.map((s) => (
                <div
                  key={s.id}
                  className="neu-inset p-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold break-words">{s.name}</div>
                    <div className="text-xs font-mono text-slate-500 mt-0.5">
                      {s.signalType.toUpperCase()} · {s.frequency} Hz · {s.amplitude} V · fs=
                      {s.samplingRate} Hz · {s.channels}ch · Mod: {s.modulation} · SNR: {s.noiseSnrDb}{' '}
                      dB
                      {s.artifacts.length > 0 ? ` · ${s.artifacts.join(' · ')}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(s)}
                      title={lang === 'fa' ? 'ویرایش نمونه' : 'Edit Sample'}
                      aria-label={isFa ? `ویرایش نمونه: ${s.name}` : `Edit Sample: ${s.name}`}
                      className="btn-circle-glass cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(s)}
                      title={lang === 'fa' ? 'تکثیر نمونه' : 'Duplicate Sample'}
                      aria-label={isFa ? `تکثیر نمونه: ${s.name}` : `Duplicate Sample: ${s.name}`}
                      className="btn-circle-glass cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSample(s)}
                      title={lang === 'fa' ? 'خروجی JSON نمونه' : 'Export Sample JSON'}
                      aria-label={isFa ? `خروجی JSON نمونه: ${s.name}` : `Export Sample JSON: ${s.name}`}
                      className="btn-circle-glass cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    {customSamples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(s)}
                        title={lang === 'fa' ? 'حذف نمونه' : 'Delete Sample'}
                      aria-label={isFa ? `حذف نمونه: ${s.name}` : `Delete Sample: ${s.name}`}
                        className="btn-circle-glass text-rose-600 dark:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Side-by-Side Sample Comparator */}
          {sampleA && sampleB && (
            <div className="neu-card p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-sky-500" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">
                    {lang === 'fa'
                      ? 'مقایسه هم‌زمان دو نمونه سفارشی ذخیره‌شده'
                      : 'Compare Saved Custom Samples'}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono min-w-0">
                  <label htmlFor={ids.cmpA} className="sr-only">
                    {isFa ? 'نمونه A' : 'Sample A'}
                  </label>
                  <select
                    id={ids.cmpA}
                    value={sampleA.id}
                    onChange={(e) => setCompareIds([e.target.value, compareIds[1]])}
                    className="neu-inset px-3 py-1 rounded-full min-w-0 max-w-full sm:max-w-[14rem]"
                  >
                    {customSamples.map((s) => (
                      <option key={s.id} value={s.id}>
                        A: {s.name}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden="true">{lang === 'fa' ? 'در برابر' : 'vs.'}</span>
                  <label htmlFor={ids.cmpB} className="sr-only">
                    {isFa ? 'نمونه B' : 'Sample B'}
                  </label>
                  <select
                    id={ids.cmpB}
                    value={sampleB.id}
                    onChange={(e) => setCompareIds([compareIds[0], e.target.value])}
                    className="neu-inset px-3 py-1 rounded-full min-w-0 max-w-full sm:max-w-[14rem]"
                  >
                    {customSamples.map((s) => (
                      <option key={s.id} value={s.id}>
                        B: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <InteractivePlot
                title={
                  lang === 'fa'
                    ? `مقایسه شکل‌موج: ${sampleA.name} در برابر ${sampleB.name}`
                    : `Waveform Comparison: ${sampleA.name} vs. ${sampleB.name}`
                }
                xData={Array.from({ length: sampleA.previewData.length }, (_, i) => i)}
                xLabel={lang === 'fa' ? 'اندیس نمونه (n)' : 'Sample Index (n)'}
                yLabel={lang === 'fa' ? 'دامنه (V)' : 'Amplitude (V)'}
                yUnit="V"
                height={220}
                series={[
                  {
                    id: 'cmp-a',
                    label: `A: ${sampleA.name}`,
                    data: sampleA.previewData,
                    color: getSeriesColor(0),
                    lineWidth: 2,
                  },
                  {
                    id: 'cmp-b',
                    label: `B: ${sampleB.name}`,
                    data: sampleB.previewData,
                    color: getSeriesColor(2),
                    dash: getSeriesDash(1),
                    lineWidth: 2,
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
