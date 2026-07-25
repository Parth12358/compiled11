"use client";

import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Attach the returned ref to an element; it gains the class "is-in" once
 * it enters the viewport. Style the transition in the component's module:
 *   .card { opacity: 0; translate: 0 26px; transition: ... }
 *   .card:global(.is-in) { opacity: 1; translate: 0 0 }
 */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

/** rAF count-up from 0 to target. Reduced motion → jumps straight to target. */
export function useCountUp(target: number, duration = 1400, start = true): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion() || duration <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(target * easeOutQuart(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}
