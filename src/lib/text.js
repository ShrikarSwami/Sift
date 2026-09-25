/**
 * tiny.en is ~0.5s faster than base.en but drops most punctuation and sentence
 * casing. This restores the shape of the text so what lands on screen still
 * reads cleanly.
 *
 * Deliberately conservative: it only fixes casing and terminal punctuation. It
 * never invents commas or reflows clauses, because the transcript is shown as a
 * quote of what someone actually said.
 */

/** Words tiny.en reliably lowercases that should stay capitalised. */
const ALWAYS_CAPITAL = /\b(i|i'm|i'll|i've|i'd)\b/g;

export function polishTranscript(raw) {
  if (!raw) return "";

  let text = raw
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  if (!text) return "";

  // First person pronouns.
  text = text.replace(
    ALWAYS_CAPITAL,
    (m) => m.charAt(0).toUpperCase() + m.slice(1),
  );

  // Capitalise the first letter after each sentence boundary, and the first
  // letter overall.
  text = text.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_, lead, letter) => lead + letter.toUpperCase(),
  );

  // Give the sentence an ending if the model did not.
  if (!/[.!?…]$/.test(text)) text += ".";

  return text;
}
