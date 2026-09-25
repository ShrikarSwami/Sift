import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, Users, FileText } from "lucide-react";
import { useCountUp } from "../hooks/useCountUp";

const SOURCE_ICON = {
  call: Phone,
  email: Mail,
  meeting: Users,
  docs: FileText,
};

export function PipelineCard({ client, rank, selected, isNew, onSelect }) {
  const SourceIcon = SOURCE_ICON[client.primarySource] ?? Mail;
  const ref = useRef(null);

  // With Fake Mode on, a low-likelihood arrival lands below the fold. Bring the
  // selected card into view so the board never appears not to have reacted.
  useEffect(() => {
    if (!selected) return;
    const id = setTimeout(
      () =>
        ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      450,
    );
    return () => clearTimeout(id);
  }, [selected]);

  const likelihood = useCountUp(client.scores.likelihood, {
    duration: 1100,
    delay: 120,
    resetKey: client.id,
  });

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: -14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: -16, filter: "blur(4px)" }}
      transition={{
        layout: { type: "spring", stiffness: 320, damping: 34, mass: 0.9 },
        default: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(client.id)}
        aria-current={selected ? "true" : undefined}
        className={[
          "group relative w-full cursor-pointer overflow-hidden rounded-xl border p-5 text-left",
          "transition-colors duration-150 ease-out",
          selected
            ? "border-cherry/70 bg-ink-3"
            : "border-line bg-ink-2 hover:border-line-strong hover:bg-ink-3",
        ].join(" ")}
        style={
          selected
            ? {
                boxShadow:
                  "0 8px 26px -10px rgba(210, 4, 45, 0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
              }
            : { boxShadow: "0 3px 10px -5px rgba(0,0,0,0.6)" }
        }
      >
        {/* Selection spine — 3px, deliberate, not a decorative accent border. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-cherry"
          initial={false}
          animate={{ opacity: selected ? 1 : 0, scaleY: selected ? 1 : 0.3 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />

        <div className="flex items-start gap-4">
          <span
            className={[
              "tnum mt-1 w-6 shrink-0 text-right text-[15px] font-semibold tabular-nums",
              rank === 1 ? "text-cherry-bright" : "text-fg-faint",
            ].join(" ")}
            aria-hidden="true"
          >
            {rank}
          </span>

          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-brown-600/60 bg-brown-800 text-[15px] font-semibold text-brown-400"
            aria-hidden="true"
          >
            {client.initials}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2.5">
              <p className="truncate text-[18px] leading-tight font-semibold tracking-[-0.01em] text-fg">
                {client.name}
              </p>
              {isNew && !client.liveBadge && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="shrink-0 rounded bg-cherry-dim px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] text-fg uppercase"
                >
                  New
                </motion.span>
              )}
            </div>
            <p className="mt-1 truncate text-[15px] text-fg-faint">
              {client.role} · {client.company}
            </p>

            {client.liveBadge && (
              <motion.span
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={[
                  "mt-2.5 flex w-fit max-w-full items-center gap-2 rounded px-2.5 py-1 text-[12px] font-bold tracking-[0.06em] uppercase",
                  client.liveBadge.tone === "live"
                    ? "animate-pulse-ring bg-cherry text-white"
                    : "bg-brown-700 text-brown-400",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    client.liveBadge.tone === "live"
                      ? "animate-pulse bg-white"
                      : "animate-ping bg-cherry-bright",
                  ].join(" ")}
                />
                <span className="truncate">{client.liveBadge.label}</span>
              </motion.span>
            )}

            <div className="mt-4 flex items-center gap-3.5">
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-4">
                {client.pending ? (
                  <span className="absolute inset-0 animate-pulse rounded-full bg-brown-600" />
                ) : (
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-cherry-bright"
                    style={{ width: `${likelihood}%` }}
                  />
                )}
              </span>
              <span className="tnum w-9 text-right text-[17px] leading-none font-semibold text-fg">
                {client.pending ? "··" : Math.round(likelihood)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5 text-[14px] text-fg-faint">
          <SourceIcon
            size={15}
            strokeWidth={1.75}
            className="shrink-0 text-brown-400"
          />
          <span className="truncate">
            {client.sources[client.primarySource]?.meta}
          </span>
          <span className="ml-auto shrink-0 rounded border border-line-strong px-2 py-0.5 text-[12px] whitespace-nowrap text-fg-muted">
            {client.stage}
          </span>
        </div>
      </button>
    </motion.li>
  );
}
