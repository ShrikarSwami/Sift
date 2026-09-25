import { useEffect } from "react";
import { useClientStore } from "../store/useClientStore";
import { DEMO_CLIENTS } from "../data/demoClients";
import { useVoiceCapture } from "./useVoiceCapture";
import { ensureHotMic, onMicChange } from "../lib/micStream";
import { playChime } from "../lib/chime";

/**
 * The demo engine. Invisible by design: nothing in the UI advertises it, so the
 * board looks like it is reacting to live traffic rather than to a keystroke.
 *
 *   h → Heer's email lands (toast first, card 500ms later)
 *   c → toggles the live mic on Carolina: press to record, press again to score
 *   j → the same, pointed at Judge Johns
 *   1-5 → force a score band onto the selected card (stage override)
 *   r → clear the board so the demo can be run again
 *   f → toggle Fake Mode (same as the header badge)
 *
 * Keys are ignored while a text field has focus, so this never fights a real
 * input if one is added later.
 */
/**
 * Manual score bands for the 1-5 keys, lowest to highest. Hesitance and effort
 * move opposite likelihood so a forced card still reads coherently on the
 * dashboard rather than showing three unrelated numbers.
 */
export const SCORE_BANDS = [
  // 1 — Low intent / high effort
  { likelihood: 15, hesitance: 85, effort: 90 },
  // 2 — interpolated between the specified 1 and 3
  { likelihood: 35, hesitance: 65, effort: 70 },
  // 3 — Moderate intent
  { likelihood: 55, hesitance: 45, effort: 50 },
  // 4 — interpolated between the specified 3 and 5
  { likelihood: 77, hesitance: 23, effort: 27 },
  // 5 — Instant priority #1
  { likelihood: 99, hesitance: 2, effort: 5 },
];

/** Simulated webhook processing time between the alert and the card landing. */
export const INBOUND_DELAY_MS = 500;

export function useDemoKeys() {
  const toggleVoice = useVoiceCapture();

  useEffect(() => {
    const isTyping = (el) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(document.activeElement)) return;

      const key = event.key.toLowerCase();
      const { ingest, reset, toggleFakeMode } = useClientStore.getState();

      if (key === "c" || key === "j") {
        event.preventDefault();
        toggleVoice(key === "j" ? "judge" : "carolina");
        return;
      }

      // 1-5 force a score onto whatever card is selected.
      if (key >= "1" && key <= "5") {
        const { selectedId, setScoreOverride } = useClientStore.getState();
        if (!selectedId) return;
        event.preventDefault();
        setScoreOverride(selectedId, SCORE_BANDS[Number(key) - 1]);
        return;
      }

      if (key === "r") {
        event.preventDefault();
        reset();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        toggleFakeMode();
        return;
      }

      const client = DEMO_CLIENTS[key];
      if (!client) return;
      event.preventDefault();

      // Already on the board — just select it, no second notification.
      if (useClientStore.getState().clients.some((c) => c.id === client.id)) {
        useClientStore.getState().select(client.id);
        return;
      }

      // The notification fires immediately and the card lands 500ms later, so
      // the board reads as reacting to an inbound webhook rather than to a key.
      useClientStore.getState().pushToast({
        label: "New email received",
        message: `${client.name} (${client.company})`,
      });
      playChime();
      setTimeout(() => ingest(client), INBOUND_DELAY_MS);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleVoice]);
}

/** Wakes the node and pins the model resident before the demo. */
export function useRemoteWarmup() {
  useEffect(() => {
    let cancelled = false;
    const setRemoteHealth = useClientStore.getState().setRemoteHealth;

    fetch("/api/inference/health")
      .then((r) => r.json())
      .then((health) => {
        if (cancelled) return;
        setRemoteHealth(health);
        if (health.ok && !health.resident) {
          fetch("/api/inference/warm", { method: "POST" })
            .then((r) => r.json())
            .then(
              () =>
                !cancelled && setRemoteHealth({ ...health, resident: true }),
            )
            .catch(() => {});
        }
      })
      .catch(
        (error) =>
          !cancelled && setRemoteHealth({ ok: false, error: error.message }),
      );

    return () => {
      cancelled = true;
    };
  }, []);
}

/**
 * Opens the microphone once, at app load, and holds it for the whole session.
 *
 * Continuity Camera takes seconds to hand the iPhone mic to a new consumer, so
 * paying that handshake at the start of a take would cost the first words of
 * every sentence. Opening it here means a take begins instantly.
 */
export function useHotMic() {
  useEffect(() => {
    const unsubscribe = onMicChange((mic) =>
      useClientStore.getState().setMic(mic),
    );
    ensureHotMic().catch(() => {
      /* state already reported through onMicChange */
    });
    // Intentionally no cleanup that stops tracks: the stream must outlive
    // every take. It is released when the page unloads.
    return unsubscribe;
  }, []);
}
