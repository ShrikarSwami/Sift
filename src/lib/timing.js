/**
 * Length of the scan sequence that masks the remote round-trip.
 *
 * The pipeline measures just under 4s, so the scan is sized to match.
 * Whichever finishes first waits for the other: the result is buffered until
 * the scan completes, and the scan holds at 94% until the result lands. That is
 * what keeps the re-sort from firing mid-animation.
 */
export const SCAN_MS = 3500;

/**
 * How long the node gets to answer before the stage fallback takes over.
 * Matched to SCAN_MS so a timeout lands exactly on the end of the scan and the
 * re-ranking still animates on schedule.
 */
export const NODE_TIMEOUT_MS = 3500;

/**
 * Used when the node misses its deadline on a take that DID read as high
 * intent. The UI labels a result produced this way as a fallback rather than
 * claiming it came from the model.
 */
export const FALLBACK_SCORES = { l: 98, h: 6, e: 10 };

/**
 * Used when the heuristics found nothing AND the model could not be reached.
 * Claiming 98 there would be inventing a signal out of silence, so the board
 * says plainly that it could not read the room.
 */
export const NEUTRAL_SCORES = { l: 50, h: 50, e: 50 };
export const NEUTRAL_TAKEAWAY =
  "INCONCLUSIVE SIGNAL: Manual review required. Transcript ambiguous.";

/**
 * Budget for the text-only scoring path, which skips transcription entirely.
 *
 * Measured: the node answers a text score in 2.85-2.92s. A flat 3.0s budget
 * loses that race about as often as it wins it, which would mean showing the
 * canned profile instead of a real score. 3.4s still lands inside the 3.5s
 * scan, so the reveal timing on screen is identical either way — the extra
 * 400ms costs nothing visually and buys the real number.
 */
export const TEXT_SCORE_TIMEOUT_MS = 3400;

/**
 * A transcript shorter than this is treated as noise rather than speech.
 *
 * Scoring two stray words produces a confident-looking low number, which is
 * exactly the outcome the stage must never show when someone has just spoken
 * positively. Below this, the fallback is used instead.
 */
export const MIN_TRANSCRIPT_WORDS = 4;
