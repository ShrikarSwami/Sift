import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Cpu,
} from "lucide-react";
import { METRICS } from "../data/demoClients";
import { useCountUp } from "../hooks/useCountUp";
import { ScoreRadial } from "./ScoreRadial";
import { ScanOverlay } from "./ScanOverlay";

const TONE_ICON = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
};
const TONE_COLOR = {
  positive: "text-metric-likelihood",
  negative: "text-metric-hesitance",
  neutral: "text-fg-faint",
};

function MetricRow({ metric, value, target, pending }) {
  const good =
    metric.polarity === "higher-better" ? target >= 60 : target <= 35;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 py-4">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: metric.color }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="truncate text-[17px] font-medium text-fg">
          {metric.label}
        </p>
        <p
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-4"
          aria-hidden="true"
        >
          {pending ? (
            <span className="block h-full animate-pulse rounded-full bg-brown-600" />
          ) : (
            <span
              className="block h-full rounded-full"
              style={{ width: `${value}%`, backgroundColor: metric.color }}
            />
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="tnum text-[24px] leading-none font-semibold text-fg">
          {pending ? "··" : Math.round(value)}
        </p>
        <p
          className={`mt-1.5 text-[13px] font-medium ${pending ? "text-fg-faint" : good ? "text-fg-muted" : "text-fg-faint"}`}
        >
          {pending ? "awaiting" : good ? "in range" : "off target"}
        </p>
      </div>
    </div>
  );
}

/**
 * What the board is allowed to say about where these numbers came from.
 *
 * The three paths produce visibly different provenance: a live score names the
 * model and its timings, a caption-scored result says transcription was
 * skipped (whisper never ran, so it must not report 0.0s for it), and the
 * fallback says plainly that the model output was not used.
 */
function describeProvenance(client) {
  if (client.overridden)
    return {
      caption: "Manual score — set from the keyboard",
      rows: [
        ["Source", "Manual override"],
        ["Set by", "Keyboard shortcut"],
        ["Model output", "Not used for these scores"],
        ["Host", "—"],
      ],
    };

  const r = client.remote;
  if (!r) return null;
  const secs = (ms) => `${((ms ?? 0) / 1000).toFixed(1)}s`;

  if (r.heuristic)
    return {
      caption: "Scored via Local Edge Heuristics - 1.5s",
      rows: [
        ["Engine", "Local edge heuristics"],
        ["Matched", r.matched ? `"${r.matched}"` : "phrase rule"],
        ["Transcript", `${r.words || 0} words`],
        ["Network", "None — no model call made"],
      ],
    };

  if (r.fallback)
    return {
      caption: `Fallback profile — ${r.fallbackReason ?? "node did not answer in time"}`,
      rows: [
        ["Source", "Stage fallback profile"],
        ["Reason", r.fallbackReason ?? "Node did not answer in time"],
        ["Transcript", `${r.words || 0} words`],
        ["Model output", "Not used for these scores"],
      ],
    };

  if (r.textOnly)
    return {
      caption: `${r.model} · scored from live captions · ${secs(r.ms)}`,
      rows: [
        ["Transcription", "Skipped — live captions used"],
        ["Inference", `${r.model} · ${secs(r.ms)}`],
        ["Transcript", `${r.words || 0} words`],
        ["Host", "Local node — nothing left the network"],
      ],
    };

  return {
    caption: `${r.model} · on-device · ${secs(r.totalMs || r.ms)} end to end`,
    rows: [
      ["Transcription", `on-device · ${secs(r.transcribeMs)}`],
      ["Inference", `${r.model} · ${secs(r.ms)}`],
      ["Transcript", `${r.words || 0} words`],
      ["Host", "Local node — nothing left the network"],
    ],
  };
}

export function ScoreDashboard({ client }) {
  const { scores } = client;

  const likelihood = useCountUp(scores.likelihood, {
    duration: 1000,
    delay: 80,
    resetKey: client.id,
  });
  const hesitance = useCountUp(scores.hesitance, {
    duration: 1000,
    delay: 180,
    resetKey: client.id,
  });
  const effort = useCountUp(scores.effort, {
    duration: 1000,
    delay: 280,
    resetKey: client.id,
  });
  const animated = { likelihood, hesitance, effort };

  const pending = Boolean(client.pending);
  const provenance = describeProvenance(client);

  return (
    <section
      aria-label="Score Dashboard"
      className="scroll-pane flex flex-col px-6 py-6 sm:px-8 lg:min-h-0 lg:overflow-y-auto"
    >
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <h3 className="text-[16px] font-semibold tracking-[0.08em] text-fg uppercase">
          Score Dashboard
        </h3>
        <p className="flex items-center gap-2 text-[14px] text-fg-faint">
          {provenance ? (
            <>
              <Cpu size={14} strokeWidth={1.75} className="text-brown-400" />
              <span>{provenance.caption}</span>
            </>
          ) : (
            "Each metric scored 0–100, independently"
          )}
        </p>
      </div>

      <div className="mt-5 grid items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(240px,300px)_minmax(260px,1fr)_minmax(320px,1.05fr)]">
        <div className="grid w-full place-items-center">
          <AnimatePresence mode="wait" initial={false}>
            {pending ? (
              <motion.div
                key="scan"
                className="grid w-full place-items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <ScanOverlay
                  phase={client.livePhase}
                  windowMs={client.scanWindowMs}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`scored-${client.id}`}
                className="grid w-full place-items-center"
                initial={
                  client.livePhase === "scored"
                    ? { scale: 0.88, opacity: 0 }
                    : false
                }
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 15,
                  mass: 0.7,
                }}
              >
                <ScoreRadial
                  scores={scores}
                  animated={animated}
                  heroValue={likelihood}
                  pending={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="divide-y divide-line">
          {METRICS.map((m) => (
            <MetricRow
              key={m.key}
              metric={m}
              value={animated[m.key]}
              target={scores[m.key]}
              pending={pending}
            />
          ))}
        </div>

        <div className="rounded-lg border border-line bg-ink-2 p-5">
          {client.insight && (
            <motion.p
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 16,
                delay: 0.15,
              }}
              className="mb-4 rounded-md border border-cherry/50 bg-cherry-dim/40 px-4 py-3.5"
            >
              <span className="flex items-center gap-2.5 text-[15px] font-bold tracking-[0.04em] text-fg">
                <Sparkles
                  size={17}
                  strokeWidth={2}
                  className="shrink-0 text-cherry-bright"
                  aria-hidden="true"
                />
                {client.insight.headline}
              </span>
              {client.insight.body && (
                <span className="mt-2 block text-[15px] leading-snug text-fg-muted">
                  {client.insight.body}
                </span>
              )}
            </motion.p>
          )}
          <p className="text-[17px] leading-relaxed text-fg">{client.read}</p>

          {provenance && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4">
              {provenance.rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-[0.1em] text-fg-faint uppercase">
                    {label}
                  </dt>
                  <dd className="tnum mt-1 truncate text-[14px] text-fg-muted">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <ul
            className={
              client.signals.length
                ? "mt-4 space-y-3.5 border-t border-line pt-4"
                : "hidden"
            }
          >
            {client.signals.map((signal) => {
              const Icon = TONE_ICON[signal.tone];
              return (
                <li key={signal.label} className="flex gap-3">
                  <Icon
                    size={16}
                    strokeWidth={2}
                    className={`mt-0.5 shrink-0 ${TONE_COLOR[signal.tone]}`}
                    aria-hidden="true"
                  />
                  <p className="min-w-0 text-[15px] leading-snug text-fg-muted">
                    <span className="font-medium text-fg">{signal.label}</span>
                    <span className="mx-2 text-fg-faint" aria-hidden="true">
                      ·
                    </span>
                    {signal.detail}
                  </p>
                </li>
              );
            })}
          </ul>

          {client.nextMove && (
            <p className="mt-5 flex items-start gap-2.5 rounded-md bg-brown-900 px-4 py-3 text-[15px] leading-snug text-fg">
              <ArrowRight
                size={16}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-cherry-bright"
                aria-hidden="true"
              />
              {client.nextMove}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
