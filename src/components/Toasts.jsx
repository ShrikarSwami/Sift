import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail } from "lucide-react";
import { useClientStore } from "../store/useClientStore";

const ICONS = { email: Mail };

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.ttl);
    return () => clearTimeout(timer);
  }, [toast.id, toast.ttl, onDismiss]);

  const Icon = ICONS[toast.kind] ?? Mail;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="pointer-events-auto relative overflow-hidden rounded-xl border border-cherry/70 bg-ink-3 pl-1"
      style={{ boxShadow: "0 16px 40px -16px rgba(0,0,0,0.9)" }}
    >
      <div className="flex items-center gap-3.5 rounded-r-[11px] bg-ink-3 py-3.5 pr-5 pl-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cherry/40 bg-brown-900">
          <Icon size={17} strokeWidth={1.9} className="text-cherry-bright" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-cherry-bright uppercase">
            {toast.label}
          </p>
          <p className="mt-1 truncate text-[15px] font-medium text-fg">
            {toast.message}
          </p>
        </div>
      </div>

      {/* A cherry spine that drains over the toast's life, so its remaining
          time is visible rather than guessed at. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 origin-top bg-cherry"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: toast.ttl / 1000, ease: "linear" }}
      />
    </motion.li>
  );
}

/**
 * Inbound event notifications. Anchored below the header on the right so a
 * toast never covers the client name that is about to appear underneath it.
 */
export function Toasts() {
  const toasts = useClientStore((s) => s.toasts);
  const dismissToast = useClientStore((s) => s.dismissToast);

  return (
    <ul
      aria-live="polite"
      className="pointer-events-none fixed top-[88px] right-6 z-50 flex w-[min(360px,calc(100vw-3rem))] flex-col gap-3"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
