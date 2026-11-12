/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, LayoutGrid, Moon, Sun } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { LAB_IMAGES } from './assets/labImages';
import { ModulesDrawer, isModifiedClick } from './components/shell/ModulesDrawer';
import { PageSkeleton } from './components/shell/PageSkeleton';
import { ScrollChrome } from './components/shell/ScrollChrome';
import { LAZY_PAGES, prefetchPage } from './components/shell/lazyPages';
import { TOP_NAV_ITEMS, navShortLabel } from './config/navigation';
import { LabProvider, useLab } from './store/LabContext';
import { PageId } from './types';

const DRAWER_ID = 'siglab-modules-drawer';

const LabShell: React.FC = () => {
  const {
    activePage,
    setActivePage,
    darkMode,
    setDarkMode,
    lang,
    setLang,
  } = useLab();
  const isFa = lang === 'fa';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Return focus to the control that opened the drawer.
    drawerTriggerRef.current?.focus({ preventScroll: true });
  }, []);

  const navigateFromDrawer = useCallback(
    (id: PageId) => {
      setActivePage(id);
      closeDrawer();
    },
    [setActivePage, closeDrawer]
  );

  // Subtle scroll-reveal for cards. Pages are lazy-loaded, so new cards are picked up
  // with a MutationObserver instead of a one-off timed scan after navigation.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = mainRef.current;
    if (!root || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    let frame = 0;
    const scan = () => {
      frame = 0;
      const elements = root.querySelectorAll<HTMLElement>(
        '.neu-card:not(.scroll-reveal), .neu-card-sm:not(.scroll-reveal)'
      );
      elements.forEach((el, idx) => {
        el.classList.add('scroll-reveal');
        el.style.setProperty('--stagger-delay', `${(idx % 4) * 70}ms`);
        io.observe(el);
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    };

    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });
    schedule();

    return () => {
      mo.disconnect();
      io.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const ActivePageComponent = LAZY_PAGES[activePage] ?? LAZY_PAGES.dashboard;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Scroll progress bar + scroll-to-top (owns its own scroll state) */}
      <ScrollChrome lang={lang} resetKey={activePage} />

      {/* Minimal Floating Header */}
      <header className="floating-pill-navbar anim-load-header px-4 sm:px-5 flex items-center justify-between gap-3">
        {/* Start: Portfolio Link + SigLab Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
            onClick={(e) => {
              const currentTheme = darkMode ? 'dark' : 'light';
              e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
            }}
            className="neu-btn px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 whitespace-nowrap"
            title={isFa ? 'بازگشت به پورتفولیو majn35.ir' : 'Return to majn35.ir Portfolio'}
            aria-label={isFa ? 'بازگشت به پورتفولیو majn35.ir' : 'Return to majn35.ir Portfolio'}
          >
            <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 rtl:-scale-x-100" />
            <span className="hidden md:inline">{isFa ? 'پورتفولیو' : 'Portfolio'}</span>
          </a>

          <a
            href="#/dashboard"
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              e.preventDefault();
              setActivePage('dashboard');
            }}
            className="flex items-center gap-2 ps-1 pe-1.5 py-1 rounded-full"
            aria-label={isFa ? 'سیگ‌لب — نمای کلی' : 'SigLab — Overview'}
          >
            <img
              src={LAB_IMAGES.favicon}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = './favicon.svg';
              }}
              className="w-7 h-7 rounded-full object-cover border border-sky-400/40 shrink-0"
            />
            <span className="font-display text-sm font-bold tracking-tight whitespace-nowrap">
              {isFa ? 'سیگ‌لب' : 'SigLab'}
            </span>
          </a>
        </div>

        {/* Center: Core shortcuts (exact-page highlighting only) */}
        <nav className="nav-center-links" aria-label={isFa ? 'میان‌برهای اصلی' : 'Main shortcuts'}>
          {TOP_NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <a
                key={item.id}
                href={`#/${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                title={isFa ? item.faLabel : item.label}
                onMouseEnter={() => prefetchPage(item.id)}
                onFocus={() => prefetchPage(item.id)}
                onClick={(e) => {
                  if (isModifiedClick(e)) return;
                  e.preventDefault();
                  setActivePage(item.id);
                }}
                className={`nav-section-link cursor-pointer ${isActive ? 'nav-section-link-active' : ''}`}
              >
                {navShortLabel(item, lang)}
              </a>
            );
          })}
        </nav>

        {/* End: Modules Drawer, Language, Theme */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            ref={drawerTriggerRef}
            type="button"
            onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
            aria-expanded={drawerOpen}
            aria-controls={DRAWER_ID}
            aria-haspopup="dialog"
            className="neu-btn px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title={isFa ? 'همه ماژول‌ها' : 'All modules'}
          >
            <LayoutGrid aria-hidden="true" className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">{isFa ? 'ماژول‌ها' : 'Modules'}</span>
            <span className="sm:hidden sr-only">{isFa ? 'همه ماژول‌ها' : 'All modules'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLang((l) => (l === 'en' ? 'fa' : 'en'))}
            aria-label={isFa ? 'Switch to English' : 'تغییر زبان به فارسی'}
            title={isFa ? 'Switch to English' : 'تغییر زبان به فارسی'}
            lang={isFa ? 'en' : 'fa'}
            className="btn-circle-glass text-[11px] font-bold font-mono cursor-pointer"
          >
            <span aria-hidden="true">{lang === 'en' ? 'FA' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={
              darkMode
                ? isFa
                  ? 'تغییر به حالت روشن'
                  : 'Switch to light theme'
                : isFa
                  ? 'تغییر به حالت تاریک'
                  : 'Switch to dark theme'
            }
            aria-pressed={darkMode}
            className="btn-circle-glass cursor-pointer"
          >
            {darkMode ? (
              <Sun aria-hidden="true" className="w-4 h-4 text-sky-400" />
            ) : (
              <Moon aria-hidden="true" className="w-4 h-4 text-sky-700" />
            )}
          </button>
        </div>
      </header>

      {/* Sliding Glass Drawer for All Modules (focus-trapped, Escape to close) */}
      <AnimatePresence>
        {drawerOpen && (
          <ModulesDrawer
            id={DRAWER_ID}
            lang={lang}
            activePage={activePage}
            onNavigate={navigateFromDrawer}
            onClose={closeDrawer}
          />
        )}
      </AnimatePresence>

      {/* Spacious, Minimal Centered Main Stage */}
      <div className="flex-1 flex flex-col relative z-10 max-w-[1120px] w-full mx-auto px-4 sm:px-6 pt-24 pb-12 gap-8">
        <main ref={mainRef} className="flex-1 min-w-0 w-full anim-load-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Suspense fallback={<PageSkeleton lang={lang} />}>
                <ActivePageComponent />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Minimal Single-Line Footer */}
        <footer className="pt-4 border-t border-slate-300/30 dark:border-slate-800/50 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {lang === 'fa'
              ? 'آزمایشگاه پردازش سیگنال (SigLab)'
              : 'SigLab — Audio & Signal Processing Lab'}
          </span>
          <a
            href={`https://majn35.ir/?theme=${darkMode ? 'dark' : 'light'}`}
            onClick={(e) => {
              const currentTheme = darkMode ? 'dark' : 'light';
              e.currentTarget.href = `https://majn35.ir/?theme=${currentTheme}`;
            }}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-600 dark:text-sky-400 hover:underline"
          >
            {lang === 'fa' ? 'محمدعلی جوادی‌نسب' : 'Mohammadali Javadinasab'}
          </a>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <LabProvider>
      <MotionConfig reducedMotion="user">
        <LabShell />
      </MotionConfig>
    </LabProvider>
  );
}
