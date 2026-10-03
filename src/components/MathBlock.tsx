import React, { useMemo, useState } from 'react';
import katex from 'katex';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface MathFormulaProps {
  tex: string;
  block?: boolean;
  className?: string;
}

export const MathFormula: React.FC<MathFormulaProps> = ({
  tex,
  block = true,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return tex;
    }
  }, [tex, block]);

  return (
    <span
      className={`inline-block max-w-full overflow-x-auto align-middle ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
  title = 'How does this work? — Mathematical Formulation & Engineering Theory',
  items,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="neu-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:opacity-90 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-sky-500 shrink-0" />
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
          <span>{open ? 'Hide Derivations' : 'Expand LaTeX Equations'}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, idx) => (
            <div key={idx} className="neu-inset p-4 flex flex-col justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-1">
                  {idx + 1}. {item.title}
                </h4>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.explanation}
                </p>
              </div>
              <div className="py-2 px-3 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 overflow-x-auto">
                <MathFormula tex={item.formula} block={true} className="text-xs" />
              </div>
              {item.variables && (
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {item.variables}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
