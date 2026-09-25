import { motion } from "framer-motion";
import { SCAN_MS } from "../lib/timing";

const STAGE_LABEL = {
  transcribing: "Transcribing audio",
  scoring: "Evaluating intent signals",
};

/**
 * Perceptual mask for the remote round-trip. It occupies exactly the footprint
 * the radial will take, so when the scores land nothing reflows — the scan is
 * replaced in place.
 *
 * The bar is honest about what it is: it runs the length of the scan window and
 * holds near the end rather than claiming completion before the node answers.
 */
export function ScanOverlay({ phase, windowMs = SCAN_MS }) {
  return (
    <div className="relative grid aspect-square w-full max-w-[300px] place-items-center">
      {/* Static rings: the shape of the dashboard that is about to appear. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {[46, 36, 26].map((r) => (
          <circle
            key={r}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--color-brown-900)"
            strokeWidth="5.5"
          />
        ))}
      </svg>

      {/* Radar sweep. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, transparent 280deg, rgba(226,51,79,0.05) 310deg, rgba(226,51,79,0.45) 358deg, transparent 360deg)",
          maskImage:
            "radial-gradient(circle, transparent 38%, #000 40%, #000 100%)",
          WebkitMaskImage:
            "radial-gradient(circle, transparent 38%, #000 40%, #000 100%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
      />

      {/* Expanding pulse, one per sweep. */}
      <motion.span
        aria-hidden="true"
        className="absolute rounded-full border border-cherry/40"
        initial={{ width: "30%", height: "30%", opacity: 0.7 }}
        animate={{ width: "88%", height: "88%", opacity: 0 }}
        transition={{ duration: 1.4, ease: "easeOut", repeat: Infinity }}
      />

      <div className="relative z-10 flex w-[62%] flex-col items-center text-center">
        <motion.p
          className="text-[13px] font-semibold tracking-[0.08em] text-cherry-bright uppercase"
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
        >
          Scanning
        </motion.p>

        <p className="mt-2 text-[13px] leading-snug text-fg-muted">
          {STAGE_LABEL[phase] ?? "Working"}
        </p>

        <span className="mt-4 h-1 w-full overflow-hidden rounded-full bg-ink-4">
          <motion.span
            className="block h-full rounded-full bg-cherry-bright"
            initial={{ width: "4%" }}
            /* Holds at 94% until the node actually answers. */
            animate={{ width: "94%" }}
            transition={{ duration: windowMs / 1000, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
      </div>
    </div>
  );
}
