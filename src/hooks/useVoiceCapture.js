import { useCallback, useEffect, useRef } from "react";
import { useClientStore } from "../store/useClientStore";
import { blobToWav16k } from "../lib/wav";
import { polishTranscript } from "../lib/text";
import { evaluateHeuristics, HEURISTIC_MS } from "../lib/heuristics";
import {
  SCAN_MS,
  NODE_TIMEOUT_MS,
  TEXT_SCORE_TIMEOUT_MS,
  MIN_TRANSCRIPT_WORDS,
  FALLBACK_SCORES,
  NEUTRAL_SCORES,
  NEUTRAL_TAKEAWAY,
} from "../lib/timing";

/**
 * Live voice capture, scored entirely on a local inference node.
 *
 * Two things run while the mic is open, and they have different jobs:
 *
 *   MediaRecorder          captures the audio the node will transcribe.
 *                          This is the authoritative transcript.
 *   webkitSpeechRecognition  streams rough text onto the screen so the audience
 *                          sees speech-to-text happening. Never used for
 *                          scoring — it is a visual only, and is skipped
 *                          silently when the browser does not have it.
 *
 * On stop: WAV → node (whisper.cpp) → node (local LLM) → scores. No audio or
 * transcript ever leaves the network.
 */
/** Waits out the remainder of the scan window, then reveals whatever we have. */
async function revealAfterScan(store, scanStarted, result, windowMs = SCAN_MS) {
  const remaining = windowMs - (Date.now() - scanStarted);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  store.completeAnalysis({ ...result, scanMs: Date.now() - scanStarted });
}

/**
 * Last resort. Completes the sequence with the stage profile, flagged
 * `fallback` with the reason, so the dashboard can say where the numbers came
 * from instead of attributing them to the model.
 */
function fallbackResult(reason, scanStarted) {
  return {
    likelihood: FALLBACK_SCORES.l,
    hesitance: FALLBACK_SCORES.h,
    convictionEffort: FALLBACK_SCORES.e,
    keyTakeaway: "Ready to sign. Send paper before anything cools.",
    model: "fallback profile",
    fallback: true,
    fallbackReason: reason,
    transcribeMs: 0,
    ms: 0,
    totalMs: Date.now() - scanStarted,
  };
}

/**
 * Nothing could be read: no phrase matched and the model never answered.
 * Inventing a 98 here would assert a signal that was never detected, so the
 * board reports the ambiguity instead.
 */
function neutralResult(reason, scanStarted) {
  return {
    likelihood: NEUTRAL_SCORES.l,
    hesitance: NEUTRAL_SCORES.h,
    convictionEffort: NEUTRAL_SCORES.e,
    keyTakeaway: NEUTRAL_TAKEAWAY,
    model: "inconclusive",
    neutral: true,
    fallbackReason: reason,
    transcribeMs: 0,
    ms: 0,
    totalMs: Date.now() - scanStarted,
  };
}

/**
 * Scores an already-transcribed string. Used when the audio path is unusable.
 *
 * The deadline is a race, not just an abort signal: a request that hangs
 * without honouring the signal must still lose to the clock, or the board
 * stalls forever waiting on a dead node.
 */
async function scoreFromText(transcript, timeoutMs) {
  const abort = new AbortController();
  let fire;
  const deadline = new Promise((resolve) => {
    fire = setTimeout(() => {
      abort.abort();
      resolve("timeout");
    }, timeoutMs);
  });

  const request = (async () => {
    const res = await fetch("/api/inference/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
      signal: abort.signal,
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error ?? "score failed");
    return body;
  })();

  try {
    const outcome = await Promise.race([request, deadline]);
    return outcome === "timeout" ? null : outcome;
  } finally {
    clearTimeout(fire);
  }
}

/**
 * A live positive utterance must never surface as a zero. A 0 here means the
 * transcript was junk or the model failed to read it, not that the speaker
 * showed no intent — so it is treated as a failed read, not a score.
 */
const usable = (result) => result && Number(result.likelihood) > 0;

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

export function useVoiceCapture() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const busyRef = useRef(false);

  const teardown = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* already closed */
    }
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async (target) => {
    const store = useClientStore.getState();
    store.startListening(target);

    // Visual-only live captions. Chrome ends recognition on silence even with
    // `continuous`, so restart it for as long as the mic is meant to be open.
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        useClientStore.getState().updateLiveTranscript(text);
      };
      recognition.onend = () => {
        if (useClientStore.getState().voicePhase === "listening") {
          try {
            recognition.start();
          } catch {
            /* restart raced with a real stop */
          }
        }
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        /* non-fatal: captions are cosmetic */
      }
    }

    const stream = await acquireStream();
    streamRef.current = stream;

    const track = stream.getAudioTracks()[0];
    useClientStore
      .getState()
      .setInputDevice(track?.label?.replace(/\s*\(.*\)$/, "") || "Live mic");

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) =>
      e.data.size && chunksRef.current.push(e.data);
    recorderRef.current = recorder;
    recorder.start();
  }, []);

  const stopAndScore = useCallback(async () => {
    const store = useClientStore.getState();

    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null;

    const recorder = recorderRef.current;
    const blob = await new Promise((resolve) => {
      if (!recorder || recorder.state === "inactive") return resolve(null);
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    }).catch(() => null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    store.beginTranscribing();
    // Tick 0 of the scan. Every path below races this clock.
    const scanStarted = Date.now();

    // Captions captured while the mic was open. These are both the heuristic
    // input and the safety net when the recorded audio is undecodable.
    const spoken = (useClientStore.getState().liveTranscript ?? "").trim();

    // --- Path 0: local edge heuristics. Deterministic, no network, no model.
    // A phrase hit short-circuits everything below and settles in 1.5s.
    const heuristic = evaluateHeuristics(spoken);
    if (heuristic) {
      store.setScanWindow(HEURISTIC_MS);
      store.setFinalTranscript(polishTranscript(spoken));
      store.beginScoring();
      return revealAfterScan(
        store,
        scanStarted,
        { ...heuristic, transcribeMs: 0, ms: 0, totalMs: HEURISTIC_MS },
        HEURISTIC_MS,
      );
    }

    // Tracks why the audio path was abandoned. A local failure (no audio, or
    // audio the browser cannot decode) is worth retrying as text. A node that
    // already missed its deadline is not — it would just stall again.
    let nodeUnresponsive = false;

    // --- Path 1: the recorded audio, transcribed and scored on the node.
    if (blob?.size) {
      try {
        const wav = await blobToWav16k(blob);

        const abort = new AbortController();
        let timedOut = false;
        let fireTimeout;
        const deadline = new Promise((resolve) => {
          fireTimeout = setTimeout(() => {
            timedOut = true;
            abort.abort();
            resolve("timeout");
          }, NODE_TIMEOUT_MS);
        });

        const remote = (async () => {
          const response = await fetch("/api/inference/take", {
            method: "POST",
            headers: { "Content-Type": "audio/wav" },
            body: wav,
            signal: abort.signal,
          });
          if (!response.ok || !response.body)
            throw new Error(`inference bridge returned ${response.status}`);
          return consumeStream(response, store);
        })();

        const outcome = await Promise.race([remote, deadline]);
        clearTimeout(fireTimeout);
        if (!timedOut && usable(outcome)) {
          return revealAfterScan(store, scanStarted, outcome);
        }
        if (timedOut) nodeUnresponsive = true;
      } catch {
        // Undecodable audio ("Unable to decode audio data"), an aborted
        // request, or a bridge error. Neither is fatal — fall through to the
        // transcript we already have on screen.
      }
    }

    // --- Path 2: score the live captions as text. No audio involved.
    // Thin captions are noise, not speech; scoring them yields a confident low
    // number, which is the one thing this must never show after a good take.
    if (
      spoken &&
      !nodeUnresponsive &&
      wordCount(spoken) >= MIN_TRANSCRIPT_WORDS
    ) {
      store.setFinalTranscript(polishTranscript(spoken));
      store.beginScoring();
      try {
        const scored = await scoreFromText(spoken, TEXT_SCORE_TIMEOUT_MS);
        if (usable(scored)) {
          return revealAfterScan(store, scanStarted, {
            ...scored,
            textOnly: true,
          });
        }
      } catch {
        /* timed out or refused — fall through */
      }
    }

    // --- Path 3: nothing readable. No phrase matched and the model did not
    // answer, so report the ambiguity rather than asserting a score.
    return revealAfterScan(
      store,
      scanStarted,
      neutralResult(
        nodeUnresponsive
          ? "node unreachable and no phrase matched"
          : spoken
            ? "scoring did not return and no phrase matched"
            : "no usable audio or transcript",
        scanStarted,
      ),
    );
  }, []);

  /**
   * The `c` key. Press once to open the mic, again to close it and score.
   * Presses during the remote round-trip are ignored so the pipeline cannot be
   * re-entered mid-flight.
   */
  return useCallback(
    async (target = "carolina") => {
      if (busyRef.current) return;
      const { voicePhase: phase, voiceTarget } = useClientStore.getState();

      if (phase === "transcribing" || phase === "scoring") return;

      busyRef.current = true;
      try {
        if (phase === "listening") {
          // A different persona's key while recording switches targets rather
          // than scoring the wrong card.
          if (target !== voiceTarget) {
            teardown();
            await start(target);
          } else {
            await stopAndScore();
          }
        } else {
          await start(target);
        }
      } catch (error) {
        // Only reachable if the mic itself could not be opened. Never a
        // failure state on screen: if a capture was in flight the sequence
        // still completes on the fallback, and the reason is surfaced quietly
        // in the dashboard provenance.
        teardown();
        const store = useClientStore.getState();
        store.noteCaptureIssue(error?.message ?? "Microphone unavailable");
        if (store.voicePhase !== "listening" && store.voicePhase !== "idle") {
          await revealAfterScan(
            store,
            Date.now(),
            fallbackResult("capture problem", Date.now()),
          );
        }
      } finally {
        busyRef.current = false;
      }
    },
    [start, stopAndScore, teardown],
  );
}
