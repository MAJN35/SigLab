import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Edit2,
  FolderOpen,
  Link2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { PipelineEditor } from '../components/PipelineEditor';
import { normalizeExperiment } from '../store/experimentState';
import { EDUCATIONAL_PRESETS, useLab } from '../store/LabContext';
import { Experiment } from '../types';

const CATEGORY_FA: Record<string, string> = {
  Telecommunications: 'آزمایش‌های مخابرات آنالوگ و دیجیتال',
  'Signal Processing': 'آزمایش‌های پردازش سیگنال و تحلیل طیفی',
  EEG: 'آزمایش‌های سیگنال مغزی (EEG) و حذف آرتیفکت',
  'Machine Learning': 'آزمایش‌های یادگیری ماشین و شبکه عصبی',
};

type Status = { kind: 'success' | 'error'; text: string } | null;

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

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
    resetExperiment,
    getShareUrl,
    restoreSavedExperiment,
    showToast,
    lang,
  } = useLab();
  const fa = lang === 'fa';

  const nameId = useId();
  const seedId = useId();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  const notify = (text: string, kind: 'success' | 'error' = 'success') => {
    window.clearTimeout(statusTimer.current);
    setStatus({ kind, text });
    statusTimer.current = window.setTimeout(() => setStatus(null), kind === 'error' ? 8000 : 4000);
  };

  const handleSaveNew = async () => {
    try {
      await saveCurrentExperiment(experiment.name.trim() || 'Untitled experiment');
      notify(fa ? 'آزمایش در این مرورگر ذخیره شد.' : 'Experiment saved in this browser.');
    } catch {
      notify(fa ? 'ذخیره آزمایش ممکن نشد.' : 'Could not save the experiment.', 'error');
    }
  };

  const handleExportJSON = (exp: Experiment = experiment) => {
    const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'siglab'}-experiment.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify(fa ? `فایل JSON آزمایش «${exp.name}» دانلود شد.` : `Exported "${exp.name}" as JSON.`);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () =>
      notify(fa ? 'خواندن فایل ممکن نشد.' : 'Could not read the selected file.', 'error');
    reader.onload = async (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(ev.target?.result));
      } catch {
        notify(
          fa
            ? 'این فایل JSON معتبر نیست و قابل بارگذاری نیست.'
            : 'Invalid JSON experiment file — the file could not be parsed.',
          'error'
        );
        return;
      }
      const obj = parsed as Partial<Experiment> | null;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.signal || !obj.noise) {
        notify(
          fa
            ? 'این فایل JSON معتبر است اما آزمایش SigLab نیست (بخش «signal» یا «noise» وجود ندارد).'
            : 'This JSON file is not a SigLab experiment: it is missing the “signal” or “noise” settings.',
          'error'
        );
        return;
      }
      const normalized = normalizeExperiment(obj);
      if (!normalized) {
        notify(fa ? 'ساختار فایل آزمایش نامعتبر است.' : 'The experiment file has an invalid structure.', 'error');
        return;
      }
      const imported: Experiment = {
        ...normalized,
        id: `exp-import-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      try {
        await saveCurrentExperiment(imported.name, imported);
        notify(
          fa
            ? `آزمایش «${imported.name}» با موفقیت بارگذاری شد.`
            : `Imported & loaded experiment "${imported.name}".`
        );
      } catch {
        notify(fa ? 'ذخیره آزمایش واردشده ممکن نشد.' : 'Could not save the imported experiment.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyShareLink = async () => {
    const ok = await copyText(getShareUrl('dashboard'));
    if (ok) {
      notify(
        fa
          ? 'پیوند اشتراک‌گذاری تنظیمات فعلی کپی شد.'
          : 'Share link for the current setup copied to the clipboard.'
      );
    } else {
      notify(fa ? 'کپی پیوند ممکن نشد.' : 'Could not copy the link to the clipboard.', 'error');
    }
  };

  const handleDelete = async (exp: Experiment) => {
    try {
      await deleteExperiment(exp.id);
    } catch {
      notify(fa ? 'حذف آزمایش ممکن نشد.' : 'Could not delete the experiment.', 'error');
      return;
    }
    showToast({
      kind: 'success',
      message: fa ? `آزمایش «${exp.name}» حذف شد.` : `Deleted “${exp.name}”.`,
      action: {
        label: fa ? 'بازگردانی' : 'Undo',
        onAction: () => {
          void restoreSavedExperiment(exp);
        },
      },
    });
  };

  const iconBtn = 'btn-circle-glass cursor-pointer';

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="neu-card p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">
              {fa ? 'آزمایش‌های ذخیره‌شده و سناریوهای آماده' : 'Saved Experiments & Presets'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {fa
                ? 'یک سناریوی آموزشی را اجرا کنید، یا تنظیمات کامل آزمایشگاه (سیگنال، نویز، مدولاسیون، خط لوله و بذر تصادفی) را ذخیره، بارگذاری و به اشتراک بگذارید.'
                : 'Launch a guided preset, or save, reload and share your complete lab setup (signal, noise, modulation, pipeline and random seed).'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="neu-btn px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{fa ? 'کپی پیوند اشتراک‌گذاری' : 'Copy share link'}</span>
            </button>
            <button
              type="button"
              onClick={resetExperiment}
              className="neu-btn px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{fa ? 'بازنشانی به پیش‌فرض' : 'Reset to defaults'}</span>
            </button>
          </div>
        </div>

        {/* Always-mounted live regions so messages are announced reliably */}
        <div role="status" aria-live="polite">
          {status?.kind === 'success' && (
            <p className="inline-block px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              {status.text}
            </p>
          )}
        </div>
        <div role="alert">
          {status?.kind === 'error' && (
            <p className="inline-block px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {status.text}
            </p>
          )}
        </div>
      </div>

      {/* Ready-Made Educational Presets Catalog */}
      <section className="neu-card p-5 flex flex-col gap-4" aria-labelledby="presets-heading">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-500" aria-hidden="true" />
          <h2 id="presets-heading" className="text-base font-bold tracking-tight">
            {fa
              ? `سناریوهای آموزشی آماده (${EDUCATIONAL_PRESETS.length})`
              : `Ready-Made Learning Presets (${EDUCATIONAL_PRESETS.length})`}
          </h2>
        </div>

        {(['Telecommunications', 'Signal Processing', 'EEG', 'Machine Learning'] as const).map((cat) => (
          <div key={cat} className="flex flex-col gap-2.5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              {fa ? CATEGORY_FA[cat] || cat : `${cat} Experiments`}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EDUCATIONAL_PRESETS.filter((p) => p.category === cat).map((preset) => {
                const title = fa && preset.faTitle ? preset.faTitle : preset.title;
                const description = fa && preset.faDescription ? preset.faDescription : preset.description;
                return (
                  <div key={preset.id} className="neu-inset p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold">{title}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyEducationalPreset(preset)}
                      aria-label={fa ? `اجرای سناریو: ${title}` : `Launch preset: ${title}`}
                      className="neu-btn py-1.5 px-3 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 self-start cursor-pointer"
                    >
                      {fa ? 'اجرای سناریو ←' : 'Launch Preset →'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Save / Export / Import tools */}
      <section className="neu-card p-5 flex flex-col gap-4" aria-labelledby="save-heading">
        <h2 id="save-heading" className="text-base font-bold tracking-tight">
          {fa ? 'ذخیره، خروجی و ورود تنظیمات' : 'Save, Export & Import'}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5">
            <label htmlFor={nameId} className="block text-xs font-mono text-slate-500 mb-1">
              {fa ? 'نام آزمایش' : 'Experiment Name'}
            </label>
            <input
              id={nameId}
              type="text"
              value={experiment.name}
              onChange={(e) => {
                const value = e.target.value;
                setExperiment((prev) => ({ ...prev, name: value }));
              }}
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-semibold bg-transparent outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor={seedId} className="block text-xs font-mono text-slate-500 mb-1">
              {fa ? 'بذر تصادفی (برای تکرارپذیری نتایج)' : 'Random seed (for repeatable results)'}
            </label>
            <input
              id={seedId}
              type="number"
              value={experiment.randomSeed}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value)) setExperiment((prev) => ({ ...prev, randomSeed: value }));
              }}
              className="neu-inset w-full px-3 py-2 rounded-lg text-xs font-mono bg-transparent outline-none"
            />
          </div>

          <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveNew}
              className="btn-primary-pill px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{fa ? 'ذخیره در مرورگر' : 'Save in browser'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportJSON(experiment)}
              className="neu-btn px-3.5 py-2 rounded-full text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{fa ? 'خروجی JSON' : 'Export JSON'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="neu-btn px-3.5 py-2 rounded-full text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{fa ? 'ورود از JSON' : 'Import JSON'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJSON}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* Saved Experiments */}
      <section className="neu-card p-5 flex flex-col gap-4" aria-labelledby="saved-heading">
        <h2 id="saved-heading" className="text-base font-bold tracking-tight">
          {fa
            ? `آزمایش‌های ذخیره‌شده (${savedExperiments.length})`
            : `Saved Experiments (${savedExperiments.length})`}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {savedExperiments.map((exp) => (
            <div key={exp.id} className="neu-inset p-4 flex flex-col justify-between gap-3">
              <div>
                {renamingId === exp.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await renameExperiment(exp.id, renameText.trim() || exp.name);
                      setRenamingId(null);
                    }}
                  >
                    <input
                      type="text"
                      value={renameText}
                      autoFocus
                      aria-label={fa ? `نام جدید برای «${exp.name}»` : `New name for “${exp.name}”`}
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="neu-card-sm px-2.5 py-1 text-xs font-semibold flex-1 min-w-0 bg-transparent"
                    />
                    <button type="submit" className="btn-primary-pill px-3 py-1 text-xs font-mono cursor-pointer">
                      {fa ? 'ذخیره' : 'Save'}
                    </button>
                  </form>
                ) : (
                  <h3 className="text-sm font-bold">{exp.name}</h3>
                )}

                <div className="text-xs font-mono text-slate-500 mt-1" dir="ltr">
                  Signal: {exp.signal.type.toUpperCase()} ({exp.signal.frequency} Hz, fs=
                  {exp.signal.samplingRate} Hz) · Noise: {exp.noise.type.toUpperCase()} ({exp.noise.snrDb} dB) ·
                  Seed #{exp.randomSeed}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    loadExperiment(exp);
                    notify(fa ? `آزمایش «${exp.name}» بارگذاری شد.` : `Loaded "${exp.name}".`);
                  }}
                  className="btn-tool-pill px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fa ? 'بارگذاری' : 'Load'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(exp.id);
                      setRenameText(exp.name);
                    }}
                    title={fa ? 'تغییر نام آزمایش' : 'Rename experiment'}
                    aria-label={fa ? `تغییر نام «${exp.name}»` : `Rename “${exp.name}”`}
                    className={iconBtn}
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateExperiment(exp)}
                    title={fa ? 'تکثیر آزمایش' : 'Duplicate experiment'}
                    aria-label={fa ? `تکثیر «${exp.name}»` : `Duplicate “${exp.name}”`}
                    className={iconBtn}
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportJSON(exp)}
                    title={fa ? 'خروجی JSON' : 'Export JSON'}
                    aria-label={fa ? `خروجی JSON از «${exp.name}»` : `Export “${exp.name}” as JSON`}
                    className={iconBtn}
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  {savedExperiments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(exp)}
                      title={fa ? 'حذف آزمایش' : 'Delete experiment'}
                      aria-label={fa ? `حذف «${exp.name}»` : `Delete “${exp.name}”`}
                      className={`${iconBtn} text-rose-500`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Processing Pipeline */}
      <PipelineEditor />
    </div>
  );
};
