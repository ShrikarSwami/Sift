/**
 * Demo roster for the live walkthrough.
 *
 * The pipeline boots empty on purpose — the story is that Sift has nothing to
 * say until a real conversation lands. Each entry here is what Sift produces
 * after ingesting one artifact (an email thread, a recorded call).
 *
 * To fake a populated board for a screenshot or a slide, push more entries into
 * this file and call `useClientStore.getState().ingest(client)` — nothing else
 * in the app knows these two are special.
 */

/**
 * Direct link opened by Heer's Email tile. Swap this for a permalink to the
 * actual thread (open it in Gmail and copy the URL) — any string works, it is
 * passed straight to window.open.
 */
export const HEER_GMAIL_URL =
  "https://mail.google.com/mail/u/0/#inbox/FMfcgzQhWfPmxVrWfJvlPlrTMccmFxvf";

export const METRICS = [
  {
    key: "likelihood",
    label: "Likelihood to Invest",
    short: "Likelihood",
    color: "var(--color-metric-likelihood)",
    hint: "Modeled probability of a committed check this quarter.",
    polarity: "higher-better",
  },
  {
    key: "hesitance",
    label: "Hesitance",
    short: "Hesitance",
    color: "var(--color-metric-hesitance)",
    hint: "Weight of unresolved objections, hedging and deferral language.",
    polarity: "lower-better",
  },
  {
    key: "effort",
    label: "Conviction Effort",
    short: "Effort",
    color: "var(--color-metric-effort)",
    hint: "How much of your team it will take to move them to yes.",
    polarity: "lower-better",
  },
];

export const heer = {
  id: "heer",
  name: "Heer Jariwala",
  shortName: "Heer",
  initials: "HJ",
  role: "Principal",
  company: "Bank of America",
  location: "Boston, MA",
  email: "heer.jariwala812@gmail.com",
  stage: "Diligence",
  ticket: "$250K",
  owner: "You",
  capturedAt: "11:42 AM · today",
  primarySource: "email",
  sources: {
    email: {
      label: "Email",
      meta: "9-message thread · 4 days",
      from: "heer.jariwala812@gmail.com",
      action: { label: "Open in Gmail", url: HEER_GMAIL_URL },
      excerpt:
        "Circling back — the team liked the deck, but we want to see another two quarters of retention before we can size anything. Can we revisit in the new year?",
    },
    call: null,
    meeting: {
      label: "Meeting",
      meta: "Intro call · Sep 3",
      excerpt:
        "Thirty-minute intro. Warm, no commitments, two follow-ups requested.",
    },
    docs: null,
  },
  scores: { likelihood: 24, hesitance: 81, effort: 88 },
  read: "Polite deferral. She is protecting optionality, not evaluating you.",
  signals: [
    {
      tone: "negative",
      label: "Deferral",
      detail: '"revisit in the new year" — pushes past the raise window',
    },
    {
      tone: "negative",
      label: "Proof gate",
      detail: "Wants two more quarters of retention before sizing",
    },
    {
      tone: "neutral",
      label: "Committee language",
      detail: 'Speaks as "the team", never in the first person',
    },
    {
      tone: "positive",
      label: "Still replying",
      detail: "Four-day thread, responds inside a business day",
    },
  ],
  nextMove:
    "Send the retention cohort cut unprompted. Do not ask for a meeting.",
};

export const carolina = {
  id: "carolina",
  name: "Carolina Arasavilli",
  shortName: "Carolina",
  initials: "CA",
  role: "Managing Partner",
  company: "Foxglove Ventures",
  location: "Austin, TX",
  stage: "Verbal commit",
  ticket: "$1.2M",
  owner: "You",
  capturedAt: "just now · live",
  primarySource: "call",
  sources: {
    call: {
      label: "Call",
      meta: "18 min · transcribed live",
      excerpt:
        "I'm not gonna sit here and play it cool — we are highkey rocking wit yo service. Send me the docs today and I'll get it through.",
    },
    email: {
      label: "Email",
      meta: "2 messages · same day",
      excerpt: "Loved the demo. Looping in our ops lead so we can move fast.",
    },
    meeting: null,
    docs: null,
  },
  scores: { likelihood: 96, hesitance: 8, effort: 12 },
  read: "She is closing you. The only risk left is how long you take to send paper.",
  signals: [
    {
      tone: "positive",
      label: "Unprompted enthusiasm",
      detail: '"highkey rocking wit yo service" — volunteered, not fished for',
    },
    {
      tone: "positive",
      label: "Self-imposed deadline",
      detail: '"Send me the docs today"',
    },
    {
      tone: "positive",
      label: "Speaks in first person",
      detail: 'No committee hedge — "I\'ll get it through"',
    },
    {
      tone: "neutral",
      label: "Widening the room",
      detail: "Pulled in an ops lead on her own initiative",
    },
  ],
  nextMove:
    "Send the SAFE within the hour. Every hour of delay is the only real risk.",
};

export const DEMO_CLIENTS = { h: heer };

/** Second live-mic persona, for scoring a judge in the room rather than a client. */
export const judge = {
  id: "judge",
  name: "Judge Johns",
  shortName: "Judge",
  initials: "JJ",
  role: "Panel Judge",
  company: "Pitch Panel",
  location: "In the room",
  stage: "Live evaluation",
  ticket: "Decision",
  owner: "You",
  capturedAt: "just now · live",
  primarySource: "call",
  sources: {
    call: {
      label: "Call",
      meta: "Live mic",
      excerpt: "",
    },
    email: null,
    meeting: null,
    docs: null,
  },
  scores: { likelihood: 0, hesitance: 0, effort: 0 },
  read: "Scored live from the room.",
  signals: [],
  nextMove: null,
};

/** Personas the live mic can be pointed at. */
export const VOICE_TARGETS = { carolina, judge };

/**
 * Carolina is not a fixed record — she is assembled from the live mic session.
 * `phase` walks listening → analyzing → scored, and each phase changes what the
 * board is allowed to claim about her:
 *
 *   listening  pinned to the top, no scores yet, transcript streaming in
 *   analyzing  still pinned, scores withheld while the local model runs
 *   scored     98 likelihood, the transcript kept as the call record
 */
export const VOICE_STATUS = {
  listening: "Listening…",
  // Both remote stages carry one badge so it appears the instant recording
  // stops and never flickers mid-round-trip.
  transcribing: "Processing Signal via 70B Node…",
  scoring: "Processing Signal via 70B Node…",
};

export function buildLiveClient({
  target = "carolina",
  judgeSessionCount = 1,
  scanWindowMs,
  priorTranscript = "",
  phase,
  liveTranscript,
  finalTranscript,
  result,
  error,
  inputDevice,
}) {
  const base = VOICE_TARGETS[target] ?? carolina;
  // Each judge session is its own card, numbered as it is recorded.
  const name =
    target === "judge" ? `Judge Johns ${judgeSessionCount}` : base.name;
  const pending =
    phase === "listening" || phase === "transcribing" || phase === "scoring";
  const current = (finalTranscript || liveTranscript || "").trim();
  // Earlier takes stay on the card; this one is appended beneath them, so a
  // client who speaks twice keeps both rather than overwriting the first.
  const transcript = [priorTranscript, current].filter(Boolean).join("\n\n");
  const scored = phase === "scored" && result;

  return {
    ...base,
    name,
    scanWindowMs,
    /** Pinned rows sort above everything, regardless of score. */
    pinned: pending,
    pending,
    livePhase: phase,
    stage:
      phase === "listening"
        ? "On mic"
        : phase === "transcribing" || phase === "scoring"
          ? "Processing"
          : base.stage,
    liveBadge: VOICE_STATUS[phase]
      ? {
          label: VOICE_STATUS[phase],
          tone: phase === "listening" ? "live" : "work",
        }
      : null,
    capturedAt: pending ? "live · on mic" : "just now · live",
    primarySource: "call",
    sources: {
      ...base.sources,
      call: {
        label: "Call",
        meta:
          phase === "listening"
            ? `${inputDevice || "Live mic"} · recording`
            : phase === "transcribing"
              ? "on-device · transcribing"
              : phase === "scoring"
                ? "local model · scoring"
                : `scored locally · ${result?.model ?? "local model"}`,
        live: phase === "listening",
        excerpt: transcript,
      },
    },
    scores: scored
      ? {
          likelihood: result.likelihood,
          hesitance: result.hesitance,
          effort: result.convictionEffort,
        }
      : { likelihood: 0, hesitance: 0, effort: 0 },
    insight: scored
      ? result.neutral
        ? { headline: result.keyTakeaway, body: null }
        : result.heuristic
          ? // The heuristic takeaway already carries its own band label, so it
            // must not be stacked under a second one saying the same thing.
            result.likelihood >= 85
            ? {
                headline: "HIGH INTENT DETECTED: SHE WANTS IT :D",
                body: result.keyTakeaway.replace(
                  /^HIGH INTENT DETECTED:\s*/i,
                  "",
                ),
              }
            : { headline: result.keyTakeaway, body: null }
          : {
              fallback: Boolean(result.fallback),
              headline:
                result.likelihood >= 85
                  ? "HIGH INTENT DETECTED: SHE WANTS IT :D"
                  : `SCORED ${result.likelihood} BY ${String(result.model).toUpperCase()}`,
              body: result.keyTakeaway,
            }
      : null,
    remote: scored
      ? {
          model: result.model,
          ms: result.ms ?? 0,
          transcribeMs: result.transcribeMs ?? 0,
          totalMs: result.totalMs ?? 0,
          fallback: Boolean(result.fallback),
          fallbackReason: result.fallbackReason ?? null,
          textOnly: Boolean(result.textOnly),
          heuristic: Boolean(result.heuristic),
          neutral: Boolean(result.neutral),
          matched: result.matched ?? null,
          words: transcript.split(/\s+/).filter(Boolean).length,
        }
      : null,
    read:
      phase === "listening"
        ? "Capturing audio. No score until the transcript closes."
        : phase === "transcribing"
          ? "Transcribing the take on the local node."
          : phase === "scoring"
            ? "The local model is scoring the transcript on-device."
            : result?.fallback
              ? `Scored from the on-stage fallback profile — ${result.fallbackReason ?? "the node did not answer in time"}.`
              : result?.heuristic
                ? "Scored on-device by local edge heuristics — no model call was needed."
                : result?.textOnly
                  ? "Scored from the live captions by the local model — the recorded audio was not usable."
                  : "Scored live from the call transcript by the local model. No audio left the network.",
    signals: [],
    nextMove: scored ? base.nextMove : null,
  };
}

/**
 * Fake Mode roster. These four are never ingested by a keystroke — they appear
 * as a block when Fake Mode is on, so the board looks like a real working
 * pipeline that Heer and Carolina then land into.
 */
export const FAKE_CLIENTS = [
  {
    id: "siya",
    name: "Siya Paliwal",
    shortName: "Siya",
    initials: "SP",
    role: "Partner",
    company: "Northgate Partners",
    location: "Chicago, IL",
    stage: "In Discussion",
    ticket: "$600K",
    owner: "You",
    capturedAt: "9:15 AM · today",
    primarySource: "email",
    sources: {
      call: null,
      email: {
        label: "Email",
        meta: "4-message thread · 2 days",
        excerpt:
          "This is tracking well on our end. I'd like to get our data lead on the next one so we can go a level deeper on the funnel numbers.",
      },
      meeting: {
        label: "Meeting",
        meta: "Partner sync · Sep 16",
        excerpt:
          "Forty minutes with two partners. Engaged, no objections raised.",
      },
      docs: null,
    },
    scores: { likelihood: 68, hesitance: 38, effort: 44 },
    read: "Genuinely interested and moving, but still gathering internal consensus.",
    signals: [
      {
        tone: "positive",
        label: "Widening the room",
        detail: "Bringing a data lead into the next call unprompted",
      },
      {
        tone: "positive",
        label: "Fast replies",
        detail: "Four messages in two days, always same-day",
      },
      {
        tone: "neutral",
        label: "Depth request",
        detail: "Wants a level deeper on funnel numbers before sizing",
      },
    ],
    nextMove: "Send the funnel breakdown before the next call, not during it.",
  },
  {
    id: "maya",
    name: "Maya Petel",
    shortName: "Maya",
    initials: "MP",
    role: "Investment Director",
    company: "Calder & Rowe",
    location: "New York, NY",
    stage: "Reviewing Terms",
    ticket: "$450K",
    owner: "You",
    capturedAt: "Yesterday · 4:02 PM",
    primarySource: "call",
    sources: {
      call: {
        label: "Call",
        meta: "Intro call · 32 min",
        excerpt:
          "The thesis makes sense to me. I've passed the terms to our counsel — assume a week before I can come back with anything firm.",
      },
      email: {
        label: "Email",
        meta: "3 messages · 5 days",
        excerpt: "Thanks for the follow-up. Reviewing internally this week.",
      },
      meeting: null,
      docs: {
        label: "Docs",
        meta: "Term sheet · opened 6×",
        excerpt:
          "Term sheet opened six times, longest session on the cap table page.",
      },
    },
    scores: { likelihood: 52, hesitance: 49, effort: 55 },
    read: "Warm on the thesis, cold on the timeline. Legal is the actual gate here.",
    signals: [
      {
        tone: "positive",
        label: "Terms in review",
        detail: "Sent to counsel without being asked to",
      },
      {
        tone: "positive",
        label: "Document engagement",
        detail: "Term sheet reopened six times, mostly on the cap table",
      },
      {
        tone: "negative",
        label: "Timeline hedge",
        detail: '"assume a week before I can come back with anything firm"',
      },
    ],
    nextMove:
      "Offer a call with your counsel directly. Take the week out of it.",
  },
  {
    id: "satwika",
    name: "Satwika Kota",
    shortName: "Satwika",
    initials: "SK",
    role: "Principal",
    company: "Ember Hill Capital",
    location: "Seattle, WA",
    stage: "Pilot Discussion",
    ticket: "$300K",
    owner: "You",
    capturedAt: "Sep 19 · 1:20 PM",
    primarySource: "call",
    sources: {
      call: {
        label: "Call",
        meta: "Platform walkthrough · 26 min",
        excerpt:
          "Thanks for walking me through the platform. The BDO use case is compelling, and the UI looks sharp. I have a few hesitations around the integration timeline and whether it can handle our legacy CRM data. If you can prove the API connects smoothly during a pilot, we'd be willing to move forward with a small contract next quarter.",
      },
      email: {
        label: "Email",
        meta: "Follow-up scheduled · Oct 2",
        excerpt:
          "Recapping the call — sending over our integration requirements so your team can size the pilot.",
      },
      meeting: null,
      docs: null,
    },
    scores: { likelihood: 69, hesitance: 45, effort: 60 },
    read: "Real interest gated on one provable thing: that the API survives her legacy CRM.",
    signals: [
      {
        tone: "positive",
        label: "Named the use case",
        detail:
          '"The BDO use case is compelling" — she is selling it internally',
      },
      {
        tone: "positive",
        label: "Offered a path to yes",
        detail: 'Pilot first, then "a small contract next quarter"',
      },
      {
        tone: "negative",
        label: "Integration risk",
        detail: "Doubts the platform handles her legacy CRM data",
      },
      {
        tone: "neutral",
        label: "Timeline hesitation",
        detail: "Unresolved question on how long integration takes",
      },
    ],
    nextMove:
      "Offer a scoped pilot against her legacy CRM. The API proof is the whole deal.",
  },
  {
    id: "manasvi",
    name: "Manasvi Miryalli",
    shortName: "Manasvi",
    initials: "MM",
    role: "Associate",
    company: "Larkspur Fund",
    location: "San Francisco, CA",
    stage: "Evaluation Phase",
    ticket: "$180K",
    owner: "You",
    capturedAt: "Sep 18 · 10:47 AM",
    primarySource: "docs",
    sources: {
      call: null,
      email: {
        label: "Email",
        meta: "2 messages · 8 days",
        excerpt: "Received, thank you. We'll circulate internally and revert.",
      },
      meeting: null,
      docs: {
        label: "Docs",
        meta: "Deck sent · opened 1×",
        excerpt:
          "Deck delivered Sep 18. One open, 2m 14s, stopped at slide four.",
      },
    },
    scores: { likelihood: 35, hesitance: 58, effort: 72 },
    read: "Early and thin. One shallow read of the deck and a holding-pattern reply.",
    signals: [
      {
        tone: "negative",
        label: "Shallow read",
        detail: "One open, 2m 14s, stopped at slide four",
      },
      {
        tone: "negative",
        label: "Holding-pattern reply",
        detail: '"We\'ll circulate internally and revert"',
      },
      {
        tone: "neutral",
        label: "Junior seat",
        detail: "Associate — no check-writing authority in the thread yet",
      },
    ],
    nextMove:
      "Get to a partner. This thread cannot approve anything on its own.",
  },
];
