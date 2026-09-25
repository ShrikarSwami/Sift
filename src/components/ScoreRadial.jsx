import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { METRICS } from "../data/demoClients";

function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="max-w-[26ch] rounded-lg border border-line-strong bg-ink-3 px-4 py-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.85)]">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: datum.fill }}
          aria-hidden="true"
        />
        <span className="text-[15px] font-medium text-fg">{datum.label}</span>
        <span className="tnum ml-auto text-[15px] font-semibold text-fg">
          {Math.round(datum.target)}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-fg-muted">
        {datum.hint}
      </p>
    </div>
  );
}

/**
 * Three independent 0–100 meters in polar form. These are NOT parts of a whole
 * and never sum to 100 — `PolarAngleAxis` pins each ring to a fixed 0–100
 * domain so arc length always means the same thing across clients.
 *
 * Ring order is inner → outer in data order, so Likelihood (the lead metric)
 * is passed last and lands on the outside.
 */
export function ScoreRadial({ scores, animated, heroValue, pending }) {
  const data = [...METRICS].reverse().map((m) => ({
    key: m.key,
    label: m.short,
    hint: m.hint,
    fill: m.color,
    value: animated[m.key],
    target: scores[m.key],
  }));

  return (
    <div className="relative aspect-square w-full max-w-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="44%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          barSize={18}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <Tooltip cursor={false} content={<ScoreTooltip />} />
          <RadialBar
            dataKey="value"
            background={{
              fill: pending ? "var(--color-brown-900)" : "var(--color-ink-4)",
            }}
            cornerRadius={9}
            isAnimationActive={false}
            /* 2px surface gap between adjacent rings */
            stroke="var(--color-ink-1)"
            strokeWidth={2}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <p
          className={[
            "tnum text-[46px] leading-none font-semibold tracking-[-0.03em]",
            pending ? "animate-pulse text-fg-faint" : "text-fg",
          ].join(" ")}
        >
          {pending ? "··" : Math.round(heroValue)}
        </p>
        <p className="mt-2 text-[12px] font-medium tracking-[0.12em] text-fg-faint uppercase">
          Likelihood
        </p>
      </div>
    </div>
  );
}
