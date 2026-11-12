import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { getGroupedNav, navLabel } from '../../config/navigation';
import type { PageId } from '../../types';
import { prefetchPage } from './lazyPages';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const GROUPED_NAV = getGroupedNav();

interface ModulesDrawerProps {
  id: string;
  lang: 'en' | 'fa';
  activePage: PageId;
  onNavigate: (id: PageId) => void;
  onClose: () => void;
}

/** True when the click should be left to the browser (new tab/window). */
export const isModifiedClick = (e: React.MouseEvent) =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * Modal side drawer listing every module, grouped in learning order.
 * Render it inside <AnimatePresence> only while open: it moves focus in on mount,
 * traps Tab, and closes on Escape. The parent restores focus to the trigger.
 */
export const ModulesDrawer: React.FC<ModulesDrawerProps> = ({
  id,
  lang,
  activePage,
  onNavigate,
  onClose,
}) => {
  const panelRef = useRef<HTMLElement>(null);
  const isFa = lang === 'fa';
  const titleId = `${id}-title`;

  // Move focus into the drawer (active link first, otherwise the first focusable).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const target =
      panel.querySelector<HTMLElement>('[aria-current="page"]') ??
      panel.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
  }, []);

  // Escape closes; Tab / Shift+Tab stay inside the drawer.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (!current || !panel.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const offscreen = isFa ? 320 : -320;

  return (
    <div className="fixed inset-0 z-40 flex">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
        onClick={onClose}
      />
      <motion.aside
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ x: offscreen, opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: offscreen, opacity: 0 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-50 w-72 max-w-[85vw] h-full pt-20 pb-8 px-4 overflow-y-auto mobile-glass-drawer flex flex-col gap-2"
      >
        <div className="px-2 pb-2 text-xs font-mono font-semibold text-slate-500 flex items-center justify-between border-b border-slate-300/30 dark:border-slate-800/60">
          <h2 id={titleId} className="text-xs font-mono font-semibold">
            {isFa ? 'همه بخش‌ها' : 'All Modules'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-circle-glass cursor-pointer"
            aria-label={isFa ? 'بستن فهرست ماژول‌ها' : 'Close modules menu'}
          >
            <X aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        </div>

        <nav aria-label={isFa ? 'همه ماژول‌ها' : 'All modules'} className="flex flex-col gap-3 pt-1">
          {GROUPED_NAV.map(({ group, items }) => {
            const headingId = `${id}-group-${group.id}`;
            return (
              <section key={group.id} aria-labelledby={headingId} className="flex flex-col gap-1">
                <h3
                  id={headingId}
                  className="ps-3.5 pt-1 text-[10px] font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400"
                >
                  {navLabel(group, lang)}
                </h3>
                <ul className="flex flex-col gap-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#/${item.id}`}
                          aria-current={isActive ? 'page' : undefined}
                          onMouseEnter={() => prefetchPage(item.id)}
                          onFocus={() => prefetchPage(item.id)}
                          onClick={(e) => {
                            if (isModifiedClick(e)) return;
                            e.preventDefault();
                            onNavigate(item.id);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500 ${
                            isActive
                              ? 'btn-tool-pill font-bold'
                              : 'hover:bg-white/40 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Icon aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{navLabel(item, lang)}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </nav>
      </motion.aside>
    </div>
  );
};
