import { useEffect, useRef, useState } from "react";

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts from 0 (or the previous value) up to `target`. Used so a score that
 * just arrived reads as a measurement settling rather than a number appearing.
 * Restarts whenever `resetKey` changes — i.e. when the selected client changes.
 */
export function useCountUp(
  target,
  { duration = 900, delay = 0, resetKey } = {},
) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    setValue(0);
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(elapsed / duration, 1);
      setValue(target * easeOutExpo(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, delay, resetKey]);

  return value;
}
