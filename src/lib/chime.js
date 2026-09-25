/**
 * A short two-note chime for inbound events.
 *
 * Synthesised rather than shipped as an asset: it is two oscillators and a
 * gain envelope, so there is no file to load and nothing to go missing on a
 * conference network. Kept quiet — this plays over a live pitch.
 */
let ctx = null;

export function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    // Created lazily and reused; a keypress is a user gesture, so the context
    // is allowed to start.
    ctx ??= new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    // A rising major third reads as "arrived" rather than "alert".
    [
      [880, 0],
      [1108.73, 0.09],
    ].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.05, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
  } catch {
    // Audio is a flourish; never let it break the demo.
  }
}
