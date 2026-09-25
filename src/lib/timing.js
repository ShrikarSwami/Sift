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
 * Used only when the node misses that deadline. The UI labels a result produced
 * this way as a fallback rather than claiming it came from the model.
 */
export const FALLBACK_SCORES = { l: 98, h: 6, e: 10 };
