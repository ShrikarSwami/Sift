/**
 * Persistent "hot mic".
 *
 * macOS Continuity Camera takes seconds to hand the iPhone microphone to a new
 * consumer. Opening the hardware stream per take meant paying that handshake at
 * the worst possible moment — the instant someone starts speaking on stage.
 *
 * So the stream is opened once at app load and never closed. Starting and
 * stopping a take only starts and stops a MediaRecorder over the already-live
 * stream; the OS never sees the connection drop, so there is nothing to
 * re-negotiate.
 *
 * The visible consequence is that the browser shows its recording indicator for
 * the whole session. That is the trade: a permanently warm mic in exchange for
 * an always-on indicator.
 */

/** Device label we prefer when it is attached. */
const PREFERRED_INPUT = /iphone/i;

const BASE_CONSTRAINTS = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

let stream = null;
let acquiring = null;
let listeners = new Set();

const notify = (state) => listeners.forEach((fn) => fn(state));

/** Subscribe to hot-mic state changes. Returns an unsubscribe function. */
export function onMicChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const isLive = (s) =>
  Boolean(s) && s.getAudioTracks().some((t) => t.readyState === "live");

const labelOf = (s) =>
  s?.getAudioTracks()[0]?.label?.replace(/\s*\(.*\)$/, "") || "";

/**
 * Finds the preferred input's deviceId.
 *
 * Device labels are blank until microphone permission has been granted, so on
 * a cold start this has nothing to match against. That is why the default
 * stream is opened first: it unlocks the labels, and only then can the iPhone
 * be asked for by name.
 */
async function findPreferredDeviceId() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return (
      devices.find(
        (d) => d.kind === "audioinput" && PREFERRED_INPUT.test(d.label),
      )?.deviceId ?? null
    );
  } catch {
    return null;
  }
}

async function open() {
  // Pass 1: default input. Also the thing that makes labels readable.
  let next = await navigator.mediaDevices.getUserMedia({
    audio: BASE_CONSTRAINTS,
  });

  // Pass 2: upgrade to the iPhone if it is attached and not already selected.
  const preferredId = await findPreferredDeviceId();
  const activeId = next.getAudioTracks()[0]?.getSettings().deviceId;

  if (preferredId && preferredId !== activeId) {
    try {
      const upgraded = await navigator.mediaDevices.getUserMedia({
        audio: { ...BASE_CONSTRAINTS, deviceId: { exact: preferredId } },
      });
      next.getTracks().forEach((t) => t.stop());
      next = upgraded;
    } catch {
      // The preferred device vanished between enumerate and request. The
      // default stream is already open and perfectly usable.
    }
  }

  // If the device is unplugged mid-session the track ends; reopen on next use.
  next.getAudioTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      if (stream === next) {
        stream = null;
        notify({ ready: false, device: "", error: "Input disconnected" });
      }
    });
  });

  return next;
}

/**
 * Opens the hot mic if it is not already live, and returns it.
 *
 * Concurrent callers share one in-flight request rather than racing to open
 * the device twice.
 */
export function ensureHotMic() {
  if (isLive(stream)) return Promise.resolve(stream);
  if (acquiring) return acquiring;

  acquiring = open()
    .then((s) => {
      stream = s;
      notify({ ready: true, device: labelOf(s), error: null });
      return s;
    })
    .catch((error) => {
      stream = null;
      notify({
        ready: false,
        device: "",
        error: error?.message ?? "Microphone unavailable",
      });
      throw error;
    })
    .finally(() => {
      acquiring = null;
    });

  return acquiring;
}

/** The live stream, or null. Never stopped by recording lifecycle. */
export const getHotMic = () => (isLive(stream) ? stream : null);

export const hotMicDevice = () => labelOf(stream);
