/**
 * Local edge heuristics.
 *
 * A short-circuit that reads intent straight off the transcript, with no model
 * call at all. When a phrase matches, this is both the fastest path and a
 * deterministic one — the same words always produce the same score, which is
 * what makes it usable live.
 *
 * Matching is word-boundary anchored, not substring: a bare `pass` must not
 * fire on "passionate" or "password", and `maybe` must not fire on "maybes".
 */

export const HEURISTIC_MS = 1500;

const BANDS = [
  {
    key: "positive",
    phrases: [
      "love to invest",
      "move forward",
      "greatest",
      "rocking wit",
      "looks great",
      "amazing",
    ],
    scores: { likelihood: 95, hesitance: 5, effort: 10 },
    takeaway: "HIGH INTENT DETECTED: Ready to sign.",
  },
  {
    key: "mediocre",
    phrases: [
      "think about it",
      "not sure",
      "maybe",
      "need some time",
      "follow up",
    ],
    scores: { likelihood: 50, hesitance: 60, effort: 70 },
    takeaway: "MODERATE INTENT: Requires standard follow-up cycle.",
  },
  {
    key: "negative",
    phrases: ["too expensive", "not a fit", "pass", "no thanks", "bad idea"],
    scores: { likelihood: 10, hesitance: 90, effort: 95 },
    takeaway: "LOW INTENT: Deprioritize and archive.",
  },
];

const escape = (phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pre-compiled so a match costs nothing on the critical path. */
const MATCHERS = BANDS.map((band) => ({
  ...band,
  patterns: band.phrases.map(
    (phrase) => new RegExp(`\\b${escape(phrase)}\\b`, "i"),
  ),
}));

/**
 * Returns the first band whose phrasing appears in the transcript, or null.
 *
 * Bands are tested in declaration order, so an utterance carrying both
 * enthusiasm and a hedge reads as the stronger signal. That is a deliberate
 * bias: on stage, under-reading real intent is the costlier mistake.
 */
export function evaluateHeuristics(transcript) {
  if (!transcript?.trim()) return null;

  for (const band of MATCHERS) {
    const hit = band.patterns.findIndex((re) => re.test(transcript));
    if (hit !== -1) {
      return {
        band: band.key,
        matched: band.phrases[hit],
        likelihood: band.scores.likelihood,
        hesitance: band.scores.hesitance,
        convictionEffort: band.scores.effort,
        keyTakeaway: band.takeaway,
        heuristic: true,
        model: "local edge heuristics",
      };
    }
  }
  return null;
}
