import { useLayoutEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Tracks the content-box size of an element with ResizeObserver, plus
 * window resize / orientationchange as a fallback. Values are rounded to
 * whole CSS pixels so sub-pixel jitter does not trigger re-renders.
 */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (w: number, h: number) => {
      const width = Math.round(w);
      const height = Math.round(h);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    const measure = () => update(el.clientWidth, el.clientHeight);
    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const box = entry.contentRect;
        update(box.width, box.height);
      });
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [ref]);

  return size;
}
