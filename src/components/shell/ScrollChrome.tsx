import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const SHOW_TOP_AFTER_PX = 300;

/**
 * Scroll progress bar + floating scroll-to-top button.
 * Owns its own scroll state so scrolling never re-renders the active page:
 * the bar is updated through a ref (transform: scaleX) inside requestAnimationFrame,
 * and React state is only touched when the button's visibility flips.
 */
export const ScrollChrome: React.FC<{ lang: 'en' | 'fa'; resetKey?: string }> = React.memo(
  ({ lang, resetKey }) => {
    const barRef = useRef<HTMLDivElement>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const showRef = useRef(false);

    useEffect(() => {
      let frame = 0;
      const update = () => {
        frame = 0;
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop;
        const docHeight = doc.scrollHeight - doc.clientHeight;
        const ratio = docHeight > 20 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
        if (barRef.current) barRef.current.style.transform = `scaleX(${ratio})`;
        const shouldShow = scrollTop > SHOW_TOP_AFTER_PX;
        if (shouldShow !== showRef.current) {
          showRef.current = shouldShow;
          setShowScrollTop(shouldShow);
        }
      };
      const schedule = () => {
        if (!frame) frame = window.requestAnimationFrame(update);
      };
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      // Page content (incl. lazily loaded pages) changes document height without scrolling.
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
      ro?.observe(document.body);
      schedule();
      return () => {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        ro?.disconnect();
        if (frame) window.cancelAnimationFrame(frame);
      };
    }, [resetKey]);

    const scrollToTop = () => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    };

    const label = lang === 'fa' ? 'بازگشت به بالای صفحه' : 'Scroll to top';

    return (
      <>
        <div
          aria-hidden="true"
          className="fixed top-0 inset-x-0 h-[2px] z-[60] pointer-events-none bg-transparent"
        >
          <div
            ref={barRef}
            className="h-full w-full origin-left rtl:origin-right bg-gradient-to-r rtl:bg-gradient-to-l from-sky-500 via-cyan-400 to-[#7FD141] will-change-transform"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>

        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={scrollToTop}
              className="fixed bottom-5 end-5 z-40 neu-btn p-2.5 rounded-full text-xs shadow-lg cursor-pointer"
              title={label}
              aria-label={label}
            >
              <ArrowUp aria-hidden="true" className="w-4 h-4 text-sky-500" />
            </motion.button>
          )}
        </AnimatePresence>
      </>
    );
  }
);
ScrollChrome.displayName = 'ScrollChrome';
