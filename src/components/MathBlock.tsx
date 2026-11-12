import React, { useId, useMemo, useState } from 'react';
import katex from 'katex';
import { BookOpen, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLab } from '../store/LabContext';

interface MathFormulaProps {
  tex: string;
  block?: boolean;
  className?: string;
}

/** Render TeX to HTML + MathML (MathML gives screen readers real math). Never throws. */
const renderTex = (tex: string, displayMode: boolean): { html: string; ok: boolean } => {
  try {
    return {
      html: katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: false,
        output: 'htmlAndMathml',
      }),
      ok: true,
    };
  } catch {
    return { html: '', ok: false };
  }
};

export const MathFormula: React.FC<MathFormulaProps> = ({
  tex,
  block = true,
  className = '',
}) => {
  const { html, ok } = useMemo(() => renderTex(tex, block), [tex, block]);

  if (!ok) {
    // Graceful fallback: show the raw TeX source as readable code.
    return (
      <code
        dir="ltr"
        className={`inline-block max-w-full overflow-x-auto align-middle font-mono text-xs ${className}`}
      >
        {tex}
      </code>
    );
  }

  return (
    <span
      dir="ltr"
      className={`inline-block max-w-full overflow-x-auto align-middle ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/* ------------------------------------------------------------------ */
/* LiveEquation — KaTeX formula with live parameter substitution        */
/* ------------------------------------------------------------------ */

export interface LiveEquationProps {
  /** TeX source with `{{name}}` placeholders, e.g. `f_c = {{fc}}\\,\\text{Hz},\\; N = {{N}}`. */
  tex: string;
  /** Values substituted for the placeholders. Numbers are formatted with `precision`. */
  values: Record<string, number | string>;
  /** Optional caption rendered under (or beside, if `inline`) the formula. */
  caption?: React.ReactNode;
  /** Max fraction digits for numeric values (trailing zeros trimmed). Default 2. */
  precision?: number;
  /** Display-mode (block) rendering. Default false (inline, compact). */
  block?: boolean;
  className?: string;
}

const formatTexValue = (v: number | string, precision: number): string => {
  if (typeof v === 'string') return v;
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : v < 0 ? '-\\infty' : '\\text{NaN}';
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e6 || abs < 10 ** -precision)) {
    const [m, e] = v.toExponential(precision).split('e');
    return `${String(Number(m))} \\times 10^{${Number(e)}}`;
  }
  return String(Number(v.toFixed(precision)));
};

/** Substitute `{{name}}` placeholders; unknown names are left visible as `\\text{?name}`. */
export const substituteTex = (
  tex: string,
  values: Record<string, number | string>,
  precision = 2
): string =>
  tex.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_m, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? `{${formatTexValue(values[name], precision)}}`
      : `\\text{?${name}}`
  );

export const LiveEquation: React.FC<LiveEquationProps> = ({
  tex,
  values,
  caption,
  precision = 2,
  block = false,
  className = '',
}) => {
  const resolved = useMemo(() => substituteTex(tex, values, precision), [tex, values, precision]);
  return (
    <figure className={`m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <div className="max-w-full">
        <MathFormula tex={resolved} block={block} />
      </div>
      {caption && (
        <figcaption className="text-caption text-slate-600 dark:text-slate-400">{caption}</figcaption>
      )}
    </figure>
  );
};

export interface TheoryItem {
  title: string;
  formula: string;
  explanation: string;
  variables?: string;
}

interface TheoryAccordionProps {
  title?: string;
  items: TheoryItem[];
  defaultOpen?: boolean;
}

export const TheoryAccordion: React.FC<TheoryAccordionProps> = ({
  title,
  items,
  defaultOpen = false,
}) => {
  const { lang } = useLab();
  const [open, setOpen] = useState(defaultOpen);
  const baseId = useId();
  const panelId = `${baseId}-theory-panel`;
  const headingId = `${baseId}-theory-heading`;

  const effectiveTitle =
    title ||
    (lang === 'fa'
      ? 'این سیستم چگونه کار می‌کند؟ — فرمول‌بندی ریاضی و تئوری مهندسی'
      : 'How does this work? — Mathematical Formulation & Engineering Theory');

  return (
    <div className="neu-card overflow-hidden">
      <h2 className="m-0 text-sm">
        <button
          id={headingId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-start transition-colors hover:opacity-90 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-500"
        >
          <span className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">{effectiveTitle}</span>
          </span>
          <span
            aria-hidden="true"
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap"
          >
            <span>
              {open
                ? lang === 'fa'
                  ? 'بستن روابط ریاضی'
                  : 'Hide Derivations'
                : lang === 'fa'
                ? 'نمایش معادلات LaTeX'
                : 'Expand LaTeX Equations'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ease-out ${
                open ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''
              }`}
            />
          </span>
        </button>
      </h2>

      <div id={panelId} role="region" aria-labelledby={headingId}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.26,
                      delay: idx * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="neu-inset p-4 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <h3 className="text-xs font-semibold text-sky-700 dark:text-sky-400 mb-1">
                        {idx + 1}. {item.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.explanation}
                      </p>
                    </div>
                    <div
                      dir="ltr"
                      className="py-2 px-3 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 overflow-x-auto"
                    >
                      <MathFormula tex={item.formula} block={true} className="text-xs" />
                    </div>
                    {item.variables && (
                      <p className="text-caption font-mono text-slate-500 dark:text-slate-400">
                        {item.variables}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
