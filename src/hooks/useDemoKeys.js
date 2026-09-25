import { useEffect } from "react";
import { useClientStore } from "../store/useClientStore";
import { DEMO_CLIENTS } from "../data/demoClients";
import { useVoiceCapture } from "./useVoiceCapture";

/**
 * The demo engine. Invisible by design: nothing in the UI advertises it, so the
 * board looks like it is reacting to live traffic rather than to a keystroke.
 *
 *   h → Heer's email lands
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
      ingest(client);
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
