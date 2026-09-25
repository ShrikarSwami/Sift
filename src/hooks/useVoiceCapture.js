import { useCallback, useEffect, useRef } from "react";
import { useClientStore } from "../store/useClientStore";
import { blobToWav16k } from "../lib/wav";
import { polishTranscript } from "../lib/text";
import { SCAN_MS, NODE_TIMEOUT_MS, FALLBACK_SCORES } from "../lib/timing";

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
/** Waits out the remainder of the scan, then reveals whatever we have. */
async function revealAfterScan(store, scanStarted, result) {
  const remaining = SCAN_MS - (Date.now() - scanStarted);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  store.completeAnalysis({ ...result, scanMs: Date.now() - scanStarted });
}

/**
 * The node missed its deadline. Complete the sequence with the stage profile,
 * flagged `fallback: true` so the dashboard says where the numbers came from
 * instead of attributing them to the model.
 */
function finishWithFallback(store, scanStarted) {
  return revealAfterScan(store, scanStarted, {
    likelihood: FALLBACK_SCORES.l,
    hesitance: FALLBACK_SCORES.h,
    convictionEffort: FALLBACK_SCORES.e,
    keyTakeaway: "Ready to sign. Send paper before anything cools.",
    model: "fallback profile",
    fallback: true,
    transcribeMs: 0,
    ms: 0,
    totalMs: Date.now() - scanStarted,
  });
}

/** Reads the NDJSON stream, pushing the transcript through as it arrives. */
async function consumeStream(response, store) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let scored = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line);

      if (event.stage === "error") throw new Error(event.error);
      if (event.stage === "transcript") {
        store.setFinalTranscript(polishTranscript(event.transcript));
        store.beginScoring();
      }
      if (event.stage === "scored") scored = event;
    }
  }
  return scored;
}

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

    // No deviceId constraint: that is what makes the browser follow the macOS
    // default input, so switching to the iPhone in Sound settings just works.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
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
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (!blob?.size) throw new Error("No audio was captured from the mic.");

    store.beginTranscribing();
    // Tick 0 of the scan. Everything below races this clock.
    const scanStarted = Date.now();
    const wav = await blobToWav16k(blob);

    // Watchdog. The abort signal is the polite path, but the deadline is
    // enforced by racing a timer: a request that hangs without honouring the
    // signal must not be able to outlive the scan.
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

    // One request, streamed as NDJSON: the transcript line arrives ~1.4s in,
    // the scores ~3s after that. Two separate fetches cost an extra round-trip
    // on the critical path.
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

    let scored;
    try {
      const outcome = await Promise.race([remote, deadline]);
      if (outcome === "timeout") return finishWithFallback(store, scanStarted);
      scored = outcome;
    } catch (error) {
      clearTimeout(fireTimeout);
      if (!timedOut) throw error;
      return finishWithFallback(store, scanStarted);
    }
    clearTimeout(fireTimeout);
    if (timedOut) return finishWithFallback(store, scanStarted);
    if (!scored) throw new Error("the node closed the stream without a score");
    return revealAfterScan(store, scanStarted, scored);
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
        teardown();
        useClientStore
          .getState()
          .failVoice(error?.message ?? "Voice capture failed.");
      } finally {
        busyRef.current = false;
      }
    },
    [start, stopAndScore, teardown],
  );
}
