/**
 * Local edge heuristics.
 *
 * A short-circuit that reads intent straight off the transcript, with no model
 * call at all. When a phrase matches, this is both the fastest path and a
 * deterministic one — the same words always produce the same score, which is
 * what makes it usable live.
 *
 * Matching is case-insensitive substring, by request.
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
      "send the paperwork",
      "where do i sign",
      "love this product",
      "terrific",
      "exactly what we need",
      "huge potential",
      "let's do this",
      "perfect fit",
      "write a check",
      "love it",
      "sign the safe",
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
      "send more info",
      "circle back",
      "next quarter",
      "discuss internally",
      "run it by the team",
      "too early",
      "keep in touch",
      "check back",
      "some concerns",
      "needs work",
    ],
    scores: { likelihood: 50, hesitance: 60, effort: 70 },
    takeaway: "MODERATE INTENT: Requires standard follow-up cycle.",
  },
  {
    key: "negative",
    phrases: [
      "too expensive",
      "not a fit",
      "pass",
      "no thanks",
      "bad idea",
      "terrible",
      "hate",
      "worst",
      "kill you",
      "not interested",
      "waste of time",
      "don't see the value",
      "competitor is better",
      "no budget",
      "stop calling",
      "horrible",
    ],
    scores: { likelihood: 10, hesitance: 90, effort: 95 },
    takeaway: "LOW INTENT: Deprioritize and archive.",
  },
];

/**
 * Case-insensitive substring matching, as specified.
 *
 * This is deliberately loose, and the looseness has teeth: short entries fire
 * inside longer words. Measured collisions on ordinary pitch sentences —
 *
 *   "she is passionate about the product"  -> negative, via "pass"
 *   "let me get you the password"          -> negative, via "pass"
 *   "whatever the team decides is fine"    -> negative, via "hate"
 *   "I passed your deck to my partner"     -> negative, via "pass"
 *
 * Flip STRICT_WORD_BOUNDARIES to true to require whole words instead, which
 * clears every case above and leaves multi-word phrases unaffected.
 */
export const STRICT_WORD_BOUNDARIES = false;

const escape = (phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MATCHERS = BANDS.map((band) => ({
  ...band,
  needles: band.phrases.map((phrase) => phrase.toLowerCase()),
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

  const haystack = transcript.toLowerCase();

  for (const band of MATCHERS) {
    const hit = STRICT_WORD_BOUNDARIES
      ? band.patterns.findIndex((re) => re.test(transcript))
      : band.needles.findIndex((needle) => haystack.includes(needle));
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
