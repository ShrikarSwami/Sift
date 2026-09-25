import { create } from "zustand";
import { FAKE_CLIENTS, buildLiveClient } from "../data/demoClients";
import { SCAN_MS } from "../lib/timing";

/**
 * Pipeline state.
 *
 * `ingested` holds the clients that arrived by keystroke. `clients` is the
 * rendered board: the ingested set, the Fake Mode roster when it is on, and the
 * live voice session when one is open — always sorted by likelihood, with
 * pinned rows (the in-flight recording) held at the top.
 */
const order = (a, b) =>
  (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
  b.scores.likelihood - a.scores.likelihood;

const applyOverrides = (clients, overrides) =>
  clients.map((c) =>
    overrides[c.id]
      ? {
          ...c,
          scores: overrides[c.id],
          overridden: true,
          // A forced score is known, so drop the "awaiting" presentation even
          // if a capture is still running underneath.
          pending: false,
          liveBadge: null,
        }
      : c,
  );

const build = (state) =>
  applyOverrides(
    [
      ...state.ingested,
      ...(state.fakeMode ? FAKE_CLIENTS : []),
      ...(state.voicePhase === "idle"
        ? []
        : [
            buildLiveClient({
              target: state.voiceTarget,
              judgeSessionCount: state.judgeSessionCount,
              phase: state.voicePhase,
              liveTranscript: state.liveTranscript,
              finalTranscript: state.finalTranscript,
              result: state.result,
              error: state.error,
              inputDevice: state.inputDevice,
              scanWindowMs: state.scanWindowMs,
              priorTranscript: state.transcripts[state.voiceTarget] ?? "",
            }),
          ]),
    ],
    state.overrides,
  ).sort(order);

/** Recomputes `clients` from the current inputs and keeps selection valid. */
const reflow = (set, get, patch = {}) => {
  const next = { ...get(), ...patch };
  const clients = build(next);
  set({
    ...patch,
    clients,
    selectedId: clients.some((c) => c.id === next.selectedId)
      ? next.selectedId
      : (clients[0]?.id ?? null),
  });
};

export const useClientStore = create((set, get) => ({
  ingested: [],
  clients: [],
  fakeMode: false,
  selectedId: null,
  /** Id of the most recently ingested client, so the list can mark it "new". */
  lastIngestedId: null,

  // --- live voice session ------------------------------------------------
  /** idle → listening → transcribing → scoring → scored (or error) */
  voicePhase: "idle",
  /** Which persona the live mic is pointed at. */
  voiceTarget: "carolina",
  /** Manual score overrides, keyed by client id. Set by the 1-5 hotkeys. */
  overrides: {},
  /** Numbers each judge session; the next `j` press opens the one after. */
  judgeSessionCount: 1,
  /** Length of the current scan. Shorter on the heuristic short-circuit. */
  scanWindowMs: SCAN_MS,
  /**
   * Transcript history per card. A client who speaks again appends to their
   * Call block rather than overwriting it, so nothing said on stage is lost.
   */
  transcripts: {},
  /** Streaming browser-side text, shown while the mic is open. */
  liveTranscript: "",
  /** Authoritative text, returned by speech-to-text on the node. */
  finalTranscript: "",
  result: null,
  error: null,
  /** Health of the remote node, polled once on boot. */
  remoteHealth: null,
  /** Label of the microphone actually in use, read off the live track. */
  inputDevice: "",

  ingest: (client) => {
    const { ingested } = get();
    if (ingested.some((c) => c.id === client.id)) {
      set({ selectedId: client.id });
      return;
    }
    reflow(set, get, {
      ingested: [...ingested, client],
      selectedId: client.id,
      lastIngestedId: client.id,
    });
  },

  toggleFakeMode: () => reflow(set, get, { fakeMode: !get().fakeMode }),

  select: (id) => set({ selectedId: id }),

  /** Force a score onto a card from the keyboard. Re-sorts like any other update. */
  setScoreOverride: (id, scores) =>
    reflow(set, get, { overrides: { ...get().overrides, [id]: scores } }),

  clearOverrides: () => reflow(set, get, { overrides: {} }),

  setRemoteHealth: (remoteHealth) => set({ remoteHealth }),

  // --- voice transitions -------------------------------------------------
  startListening: (voiceTarget = "carolina") =>
    reflow(set, get, {
      voiceTarget,
      voicePhase: "listening",
      scanWindowMs: SCAN_MS,
      liveTranscript: "",
      finalTranscript: "",
      result: null,
      error: null,
      selectedId: voiceTarget,
    }),

  setInputDevice: (inputDevice) => reflow(set, get, { inputDevice }),

  setScanWindow: (scanWindowMs) => reflow(set, get, { scanWindowMs }),

  updateLiveTranscript: (liveTranscript) =>
    reflow(set, get, { liveTranscript }),

  beginTranscribing: () => reflow(set, get, { voicePhase: "transcribing" }),

  setFinalTranscript: (finalTranscript) =>
    reflow(set, get, { finalTranscript }),

  beginScoring: () => reflow(set, get, { voicePhase: "scoring" }),

  completeAnalysis: (result) => {
    const state = get();
    const target = state.voiceTarget;

    // Fold this take into the card's running transcript, stamped so repeat
    // takes read as a sequence rather than one run-on block.
    const said = (state.finalTranscript || state.liveTranscript || "").trim();
    const prior = state.transcripts[target] ?? "";
    const stamp = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const combined = said
      ? prior
        ? `${prior}\n\n[${stamp}] ${said}`
        : said
      : prior;
    const transcripts = { ...state.transcripts, [target]: combined };

    // A judge session is archived as its own numbered card and the counter
    // advances, so the next `j` opens a fresh one rather than overwriting it.
    if (target === "judge") {
      const id = `judge-${state.judgeSessionCount}`;
      const card = buildLiveClient({
        target: "judge",
        judgeSessionCount: state.judgeSessionCount,
        phase: "scored",
        liveTranscript: state.liveTranscript,
        finalTranscript: state.finalTranscript,
        result,
        inputDevice: state.inputDevice,
      });
      reflow(set, get, {
        transcripts: { ...transcripts, [target]: "" },
        ingested: [...state.ingested, { ...card, id, pinned: false }],
        judgeSessionCount: state.judgeSessionCount + 1,
        voicePhase: "idle",
        result: null,
        liveTranscript: "",
        finalTranscript: "",
        selectedId: id,
        lastIngestedId: id,
      });
      return;
    }

    // Drop any manual override on this card so the new result is what shows.
    const { [target]: _dropped, ...overrides } = state.overrides;
    reflow(set, get, {
      transcripts,
      // The accumulated transcript is now the record for this card, so the
      // per-take fields are cleared to stop the last take rendering twice.
      liveTranscript: "",
      finalTranscript: "",
      overrides,
      voicePhase: "scored",
      result,
      lastIngestedId: target,
      selectedId: target,
    });
  },

  /**
   * Records that something went wrong opening the mic. Deliberately not a
   * phase change: the board must never present a failure state mid-pitch, so
   * this surfaces only as a quiet note in the dashboard provenance.
   */
  noteCaptureIssue: (error) => reflow(set, get, { error }),

  /** Clears the ingested clients and any voice session. Fake Mode stays on. */
  reset: () =>
    reflow(set, get, {
      ingested: [],
      voicePhase: "idle",
      voiceTarget: "carolina",
      overrides: {},
      judgeSessionCount: 1,
      transcripts: {},
      liveTranscript: "",
      finalTranscript: "",
      result: null,
      error: null,
      selectedId: null,
      lastIngestedId: null,
    }),
}));

export const useSelectedClient = () =>
  useClientStore((s) => s.clients.find((c) => c.id === s.selectedId) ?? null);

// Dev escape hatch: lets you drive phases from the console during a rehearsal,
// e.g. window.__sift.getState().completeAnalysis({likelihood:98,...}).
if (import.meta.env.DEV) window.__sift = useClientStore;
