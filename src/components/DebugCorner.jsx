import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { useClientStore } from "../store/useClientStore";

/**
 * Operator corner.
 *
 * Hardware status matters to whoever is driving the demo and to nobody else,
 * so it sits out of the way rather than in the header. Opens on hover, and
 * clicking pins it open so it can be read without holding the pointer still.
 */
export function DebugCorner() {
  const mic = useClientStore((s) => s.mic);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);

  const open = hovered || pinned;

  // Clicking away unpins, so it never strands itself over the pipeline.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setPinned(false);
    };
    const onKey = (e) => e.key === "Escape" && setPinned(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  const status = mic.ready
    ? `${mic.device || "Default input"} — Active`
    : (mic.error ?? "Not connected");

  return (
    <div
      ref={ref}
      className="fixed bottom-4 left-4 z-50 flex items-end gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-expanded={open}
        aria-label={`Diagnostics — Mic: ${status}`}
        className={[
          "grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border",
          "transition-colors duration-150 ease-out",
          open
            ? "border-line-strong bg-ink-3 text-fg-muted"
            : "border-line bg-ink-1/80 text-fg-faint hover:border-line-strong hover:text-fg-muted",
        ].join(" ")}
      >
        <Terminal size={15} strokeWidth={1.9} />
        {/* A dot only when something is wrong — a healthy rig stays silent. */}
        {!mic.ready && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-metric-hesitance" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="status"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="mb-0.5 rounded-lg border border-line-strong bg-ink-3 px-3.5 py-2.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)]"
          >
            <p className="flex items-center gap-2 text-[13px] whitespace-nowrap text-fg">
              <span
                className={[
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  mic.ready ? "bg-metric-likelihood" : "bg-metric-hesitance",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="text-fg-faint">Mic:</span>
              <span className="font-medium">{status}</span>
            </p>
            <p className="mt-1 text-[11px] whitespace-nowrap text-fg-faint">
              Held open for the session
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
