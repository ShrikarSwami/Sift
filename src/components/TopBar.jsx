import { Mic } from "lucide-react";
import { useClientStore } from "../store/useClientStore";

function SiftMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 22 22"
      fill="none"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* A sieve: signal falls in wide, one thing falls through. */}
      <path
        d="M3 4h16L13.2 11v6.6L8.8 20v-9L3 4Z"
        stroke="var(--color-cherry-bright)"
      />
      <path d="M7.4 7.2h7.2" stroke="var(--color-brown-400)" />
    </svg>
  );
}

function FakeModeToggle() {
  const fakeMode = useClientStore((s) => s.fakeMode);
  const toggleFakeMode = useClientStore((s) => s.toggleFakeMode);

  return (
    <button
      type="button"
      onClick={toggleFakeMode}
      aria-pressed={fakeMode}
      title="Pre-populate the pipeline with baseline clients"
      className={[
        "flex cursor-pointer items-center gap-2.5 rounded-full border py-2 pr-4 pl-3.5 transition-colors duration-150 ease-out",
        fakeMode
          ? "border-cherry bg-cherry-dim/50 text-fg"
          : "border-line-strong bg-ink-2 text-fg-muted hover:border-brown-600 hover:text-fg",
      ].join(" ")}
      style={
        fakeMode
          ? { boxShadow: "0 4px 18px -6px rgba(210, 4, 45, 0.65)" }
          : undefined
      }
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {fakeMode && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cherry-bright opacity-75" />
        )}
        <span
          className={[
            "relative inline-flex h-2 w-2 rounded-full",
            fakeMode ? "bg-cherry-bright" : "bg-line-strong",
          ].join(" ")}
        />
      </span>
      <span className="text-[13px] font-bold tracking-[0.1em] uppercase">
        Demo / Fake Mode
      </span>
    </button>
  );
}

/**
 * Health of the local inference node. Worth its space on stage: it answers "is
 * the node up and is the model resident" before the demo, not during it.
 */
function RemoteStatus() {
  const health = useClientStore((s) => s.remoteHealth);
  const phase = useClientStore((s) => s.voicePhase);

  const busy = phase === "transcribing" || phase === "scoring";
  const node = health?.label ?? "local node";
  const state = !health
    ? { dot: "bg-fg-faint", label: `${node} · checking` }
    : !health.ok
      ? { dot: "bg-metric-hesitance", label: `${node} · unreachable` }
      : busy
        ? { dot: "bg-cherry-bright", ping: true, label: `${node} · running` }
        : health.resident
          ? {
              dot: "bg-metric-likelihood",
              label: `${node} · ${health.model} resident`,
            }
          : { dot: "bg-metric-hesitance", label: `${node} · loading model` };

  return (
    <div
      title={
        health?.error ??
        `${node} · speech-to-text ${health?.whisperReady ? "ready" : "missing"}`
      }
      className="hidden items-center gap-2.5 rounded-full border border-line-strong bg-ink-2 py-2 pr-4 pl-3.5 xl:flex"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {state.ping && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cherry-bright opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${state.dot}`}
        />
      </span>
      <span className="text-[13px] font-medium tracking-[0.04em] whitespace-nowrap text-fg-muted">
        {state.label}
      </span>
    </div>
  );
}

/** The hot mic. Answers "is the iPhone actually connected" before speaking. */
function MicStatus() {
  const mic = useClientStore((s) => s.mic);
  const label = mic.ready ? mic.device || "Mic live" : (mic.error ?? "Mic off");

  return (
    <div
      title={mic.error ?? `${mic.device} held open for the session`}
      className="hidden items-center gap-2.5 rounded-full border border-line-strong bg-ink-2 py-2 pr-4 pl-3.5 xl:flex"
    >
      <Mic
        size={14}
        strokeWidth={2}
        className={mic.ready ? "text-metric-likelihood" : "text-fg-faint"}
      />
      <span className="max-w-[18ch] truncate text-[13px] font-medium text-fg-muted">
        {label}
      </span>
    </div>
  );
}

export function TopBar() {
  const count = useClientStore((s) => s.clients.length);

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-5 border-b border-line bg-ink-1 px-6">
      <div className="flex items-center gap-3">
        <SiftMark />
        <span className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          Sift
        </span>
      </div>

      <span
        className="hidden h-5 w-px bg-line-strong xl:block"
        aria-hidden="true"
      />

      <p className="hidden text-[16px] whitespace-nowrap text-fg-muted xl:block">
        Conviction intelligence for the raise
      </p>

      <div className="ml-auto flex items-center gap-4">
        <p className="tnum hidden text-[15px] whitespace-nowrap text-fg-faint sm:block">
          <span className="font-medium text-fg-muted">{count}</span> active
        </p>
        <MicStatus />
        <FakeModeToggle />
        <RemoteStatus />
      </div>
    </header>
  );
}
