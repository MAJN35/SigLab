import React, { useRef, useState } from 'react';
import {
  Copy,
  Download,
  Edit2,
  FolderOpen,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { PipelineEditor } from '../components/PipelineEditor';
import { EDUCATIONAL_PRESETS, useLab } from '../store/LabContext';
import { Experiment } from '../types';

const CATEGORY_FA: Record<string, string> = {
  Telecommunications: 'آزمایش‌های مخابرات آنالوگ و دیجیتال',
  'Signal Processing': 'آزمایش‌های پردازش سیگنال و تحلیل طیفی',
  EEG: 'آزمایش‌های سیگنال مغزی (EEG) و حذف آرتیفکت',
  'Machine Learning': 'آزمایش‌های یادگیری ماشین و شبکه عصبی',
};

export const ExperimentsPage: React.FC = () => {
  const {
    experiment,
    setExperiment,
    savedExperiments,
    saveCurrentExperiment,
    loadExperiment,
    deleteExperiment,
    duplicateExperiment,
    renameExperiment,
    applyEducationalPreset,
    lang,
  } = useLab();

  const [newExpName, setNewExpName] = useState(experiment.name);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleSaveNew = async () => {
    await saveCurrentExperiment(newExpName.trim() || experiment.name);
    notify(
      lang === 'fa'
        ? 'آزمایش در پایگاه داده مرورگر (IndexedDB) ذخیره شد.'
        : 'Experiment saved to IndexedDB.'
    );
  };

  const handleExportJSON = (exp: Experiment = experiment) => {
    const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-experiment.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify(
      lang === 'fa'
        ? `خروجی JSON آزمایش «${exp.name}» دانلود شد.`
        : `Exported "${exp.name}" as JSON.`
    );
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as Experiment;
        if (parsed && parsed.signal && parsed.noise) {
          const imported: Experiment = {
            ...experiment,
            ...parsed,
            id: `exp-import-${Date.now()}`,
            createdAt: new Date().toISOString(),
          };
          loadExperiment(imported);
          await saveCurrentExperiment(imported.name);
          notify(
            lang === 'fa'
              ? `آزمایش «${imported.name}» با موفقیت بارگذاری شد.`
              : `Imported & loaded experiment "${imported.name}".`
          );
        }
      } catch {
        notify(
          lang === 'fa' ? 'فایل JSON آزمایش معتبر نیست.' : 'Invalid JSON experiment file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Save / Export / Import & Reproducible Seed Manager */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'fa'
                ? 'مدیریت آزمایش‌های تکرارپذیر و سناریوهای آماده (IndexedDB)'
                : 'Reproducible Experiment & Preset Laboratory (IndexedDB)'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fa'
                ? 'ذخیره کامل تنظیمات آزمایشگاه (سیگنال، نویز، مدولاسیون، خط لوله پردازشی، تحلیل‌ها و بذر تصادفی) در مرورگر یا خروجی/ورودی فایل JSON.'
                : 'Save complete laboratory configurations (signal, noise, modulation, pipeline, analysis & randomSeed) locally in IndexedDB or export/import reproducible JSON files.'}
            </p>
          </div>
          {statusMessage && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 text-xs font-mono font-semibold">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5">
            <label className="block text-xs font-mono text-slate-500 mb-1">
              {lang === 'fa' ? 'نام آزمایش' : 'Experiment Name'}
            </label>
            <input
              type="text"
              value={newExpName}
              onChange={(e) => {
                setNewExpName(e.target.value);
                setExperiment((prev) => ({ ...prev, name: e.target.value }));
              }}
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-semibold bg-transparent outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-mono text-slate-500 mb-1">
              {lang === 'fa' ? 'بذر تصادفی تکرارپذیر (PRNG Seed)' : 'Deterministic PRNG Seed'}
            </label>
            <input
              type="number"
              value={experiment.randomSeed}
              onChange={(e) =>
                setExperiment((prev) => ({ ...prev, randomSeed: Number(e.target.value) }))
              }
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-mono bg-transparent outline-none"
            />
          </div>

          <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveNew}
              className="btn-primary-pill px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'ذخیره در مرورگر' : 'Save to IndexedDB'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportJSON(experiment)}
              className="neu-btn px-3.5 py-2 rounded-full text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'خروجی JSON' : 'Export JSON'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="neu-btn px-3.5 py-2 rounded-full text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'ورودی JSON' : 'Import JSON'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Saved IndexedDB Experiments Manager */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold tracking-tight">
          {lang === 'fa'
            ? `آزمایش‌های ذخیره‌شده محلی (${savedExperiments.length})`
            : `Saved Local Experiments (${savedExperiments.length})`}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {savedExperiments.map((exp) => (
            <div
              key={exp.id}
              className="neu-inset p-4 flex flex-col justify-between gap-3"
            >
              <div>
                {renamingId === exp.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      className="neu-card-sm px-2.5 py-1 text-xs font-semibold flex-1 bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await renameExperiment(exp.id, renameText);
                        setRenamingId(null);
                      }}
                      className="btn-primary-pill px-3 py-1 text-xs font-mono cursor-pointer"
                    >
                      {lang === 'fa' ? 'ذخیره' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm font-bold">{exp.name}</div>
                )}

                <div className="text-xs font-mono text-slate-500 mt-1">
                  Signal: {exp.signal.type.toUpperCase()} ({exp.signal.frequency} Hz, fs=
                  {exp.signal.samplingRate} Hz) · Noise: {exp.noise.type.toUpperCase()} (
                  {exp.noise.snrDb} dB) · Seed #{exp.randomSeed}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    loadExperiment(exp);
                    setNewExpName(exp.name);
                    notify(
                      lang === 'fa'
                        ? `آزمایش «${exp.name}» بارگذاری شد.`
                        : `Loaded "${exp.name}".`
                    );
                  }}
                  className="btn-tool-pill px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{lang === 'fa' ? 'بارگذاری' : 'Load'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(exp.id);
                      setRenameText(exp.name);
                    }}
                    title={lang === 'fa' ? 'تغییر نام آزمایش' : 'Rename Experiment'}
                    className="btn-circle-glass cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateExperiment(exp)}
                    title={lang === 'fa' ? 'تکثیر آزمایش' : 'Duplicate Experiment'}
                    className="btn-circle-glass cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportJSON(exp)}
                    title={lang === 'fa' ? 'خروجی JSON' : 'Export JSON'}
                    className="btn-circle-glass cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {savedExperiments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteExperiment(exp.id)}
                      title={lang === 'fa' ? 'حذف آزمایش' : 'Delete Experiment'}
                      className="btn-circle-glass text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Processing Pipeline */}
      <PipelineEditor />

      {/* Ready-Made Educational Presets Catalog */}
      <div className="neu-card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-500" />
          <h2 className="text-base font-bold tracking-tight">
            {lang === 'fa'
              ? `کاتالوگ سناریوهای آموزشی آماده آزمایشگاه (${EDUCATIONAL_PRESETS.length})`
              : `Ready-Made Educational Laboratory Presets (${EDUCATIONAL_PRESETS.length})`}
          </h2>
        </div>

        {(['Telecommunications', 'Signal Processing', 'EEG', 'Machine Learning'] as const).map(
          (cat) => (
            <div key={cat} className="flex flex-col gap-2.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-500">
                {lang === 'fa' ? CATEGORY_FA[cat] || cat : `${cat} Experiments`}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {EDUCATIONAL_PRESETS.filter((p) => p.category === cat).map((preset) => (
                  <div
                    key={preset.id}
                    className="neu-inset p-3.5 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold">{preset.title}</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyEducationalPreset(preset)}
                      className="neu-btn py-1.5 px-3 rounded-lg text-xs font-semibold text-sky-500 self-start cursor-pointer"
                    >
                      {lang === 'fa' ? 'اجرای سناریو ←' : 'Launch Preset →'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
