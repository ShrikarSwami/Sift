# Sift

A tool for businesses to rank their clients by priority using local, secure
models — a two-pane board that reorders itself as calls and emails land.

**Every piece of AI in this project runs locally.** Speech-to-text and the
language model both execute on hardware on the same network as the browser. No
audio, transcript or client data is sent to a third-party AI service.

```bash
npm install
cp .env.example .env.local   # point it at your own inference node
npm run dev                  # http://localhost:5173
```

### Keeping it up

For a demo machine, run it under launchd instead so the site is always at
`http://localhost:5173` — through crashes, logouts and reboots — with Vite's HMR
still live, so edits appear in the browser with nothing to restart.

```bash
npm run serve:install   # install + start the LaunchAgent
npm run serve:status    # is it running?
npm run serve:logs      # tail ~/Library/Logs/sift-dev.log
npm run serve:restart   # after changing .env.local
npm run serve:stop      # unload it
```

`KeepAlive` is on, so killing the process brings it straight back. It binds to
**localhost only, on purpose**: the dev server exposes `/api/inference/*`, which
executes commands on the inference node over SSH, and that must not be reachable
from the wider network. Adding `--host` to view it from a phone would expose
that endpoint to anyone on the same network.

Changes to `.env.local` need `npm run serve:restart` — Vite reads env at
startup, unlike source files.

## The demo engine

The pipeline boots empty. A hidden `window` keydown listener drives the walkthrough:

| Key | What happens |
|-----|--------------|
| `h` | Heer Jariwala's email thread lands — high hesitance, high effort, low likelihood |
| `c` | Toggles the live mic on Carolina — press to record, press again to transcribe and score locally |
| `j` | The same, pointed at Judge Johns |
| `1`–`5` | Force a score band onto the selected card, lowest to highest |
| `r` | Clears the ingested clients (Fake Mode, if on, stays on) |
| `f` | Toggles Fake Mode — same as the header badge |

`1`–`5` set matched likelihood / hesitance / effort triples (`SCORE_BANDS` in
`src/hooks/useDemoKeys.js`) so a forced card still reads coherently instead of
showing three unrelated numbers:

| Key | l / h / e | Meaning |
|---|---|---|
| `1` | 20 / 85 / 90 | Low intent, high effort |
| `2` | 40 / 62 / 70 | — |
| `3` | 60 / 40 / 50 | Moderate intent |
| `4` | 80 / 21 / 27 | — |
| `5` | 99 / 2 / 5 | Instant priority #1 |

The board re-sorts on the new score with the same Framer Motion transition as a
live result, and the dashboard labels it **"Manual score — set from the
keyboard."** A later live scoring run clears the override for that card.

Nothing in the UI advertises the keys. Keystrokes are ignored while a text field
has focus. The selected card scrolls itself into view, so a low-likelihood
arrival landing below the fold still reads as a reaction.

## Live voice → local inference

`c` opens a two-step capture. The bridge reaches the inference node over plain
SSH; nothing is installed on it beyond Ollama and whisper.cpp, and no ports are
exposed.

1. **First `c`** — `getUserMedia` + `MediaRecorder` start. Carolina pins to the
   top of the pipeline with a pulsing `Listening…` badge, her Call tile glows
   and shows a `REC` pill, and `webkitSpeechRecognition` streams rough captions
   into the transcript panel so the audience sees speech-to-text happening.
   Those captions are **visual only** — they never reach the scorer.
2. **Second `c`** — recording stops. The audio is decoded and resampled in the
   browser to 16 kHz mono WAV (`src/lib/wav.js`), which is why the node needs no
   ffmpeg. Then:

   | Stage | Where | Measured |
   |---|---|---|
   | Upload + speech-to-text | local node | ~0.9s |
   | Language model scoring | local node | ~2.9s |
   | **Total** | | **~3.8s** |

   Both stages arrive on one streamed NDJSON response, so the transcript is on
   screen at ~0.9s while the scores are still being generated.

   The fast speech-to-text model drops casing and punctuation, which
   `polishTranscript()` in `src/lib/text.js` restores client-side: sentence
   casing, first-person pronouns, and a terminal stop if none was produced. It
   deliberately does not invent commas or reflow clauses — the transcript is
   shown as a quote of what someone actually said. A larger model is one env var
   away if you want real punctuation at +0.5s.

## The scan sequence

The remote round-trip is masked rather than waited out. On the second `c`:

| Tick | What happens |
|---|---|
| 0.0s | Badge reads `Processing Signal via 70B Node…`; a radar scan starts in the Score Dashboard, occupying the radial's exact footprint so nothing reflows |
| ~0.9s | Whisper transcript streams onto the Call card, punctuation restored |
| 3.5s | Scores apply, the `HIGH INTENT DETECTED` banner fires, and Carolina springs to her ranked position |

`SCAN_MS` in `src/lib/timing.js` is the single source of truth for that window.
Whichever finishes first waits for the other: the scan's progress bar holds at
94% until the node answers, and the scores are **buffered** until the scan
window elapses, so the re-sort can never fire mid-animation.

### Watchdog

The node gets `NODE_TIMEOUT_MS` (3.5s, matched to `SCAN_MS`) to answer. Past
that, the request is aborted and the sequence completes with a fallback profile
so the re-ranking still lands on time. The deadline is enforced by racing a
timer, not by the abort signal alone — a request that hangs without honouring
the signal must not be able to outlive the scan.

A fallback result is **labelled as one**: the dashboard reads "Fallback profile
— node did not answer in time" and the provenance block says the model output
was not used, rather than attributing the numbers to the model.

Verified both directions — with the backend stubbed to answer in 0.5s, the
reveal still fired at 3.50s; against the real node it lands at ~3.76s and the
scan holds the last ~0.26s. With the backend stubbed to hang, the fallback fired
at 3.66s.

Measured over 8 consecutive takes: median **3.76s**, range 3.69–3.94s, none over
5s. If the node ever stalls, the bar holds at 94% until the answer arrives rather
than completing early — the reveal is driven by the data, never the clock.

## Why it is 4.2s and not less

A large local model generates at a roughly fixed milliseconds-per-token rate set
by memory bandwidth. With the model fully resident on the accelerator there is no
CPU spill to eliminate, so latency is essentially `output_tokens x ms_per_token`
and the only real lever is **generating fewer tokens**.

What was measured, on identical transcripts:

| Change | Out tokens | Score latency |
|---|---|---|
| Verbose prompt, `num_predict: 200` | 46 | 8.0s |
| `num_predict: 100` | 46 | **8.0s — no change** |
| Shorter prompt, 10-word takeaway | 28 | 4.8s |
| Numbers only, verbose keys | 19 | 3.2s |
| **Numbers only, single-letter keys** | **14** | **2.3s** |

`num_predict` is not a lever here: the model stopped at 46 tokens on its own, so
a cap of 100 or 200 never binds. What worked was shrinking the schema
(`{"l":..,"h":..,"e":..}`) and dropping generated prose — the one-sentence
takeaway alone cost ~2s, so it is now composed locally from the scores in
`takeawayFor()`. Scores were verified stable across eager / hedging / flat
transcripts and across reruns.

Other savings: one SSH `ControlMaster` connection reused across calls, audio
piped over stdin instead of a separate `scp`, and transcribe+score collapsed
into a single streamed request.

## Keeping the model resident

`/api/inference/warm` evicts every other loaded model and reloads the target with
`keep_alive: -1`, so it never unloads between takes. This goes through the Ollama
API rather than a service unit, so it needs no root on the node. The app calls it
on boot, which removes a cold load from the demo. The header pill shows the
node's real state.

Deleting other model weights does not help: only *loaded* models consume memory.

Scores are withheld (`··` / `awaiting`) until the node responds — the board
never shows a confident `0` for a score it does not have yet. A live-scored call
also drops the canned signal list, since the speaker may not have said those
things; it shows pipeline provenance instead.

## Configuration

All node details live in `.env.local`, which is gitignored — the address, model
tag and paths never enter version control. See `.env.example`:

| Variable | Purpose |
|---|---|
| `SIFT_NODE_HOST` | SSH target for the inference node |
| `SIFT_NODE_MODEL` | Ollama model tag used for scoring |
| `SIFT_NODE_LABEL` / `SIFT_MODEL_LABEL` | How they are described in the UI |
| `SIFT_WHISPER_BIN` / `SIFT_WHISPER_MODEL` | whisper.cpp binary and weights |
| `SIFT_WHISPER_THREADS` | Thread count for transcription |
| `SIFT_KEEP_ALIVE` | `-1` keeps the model resident |

The bridge is a Vite plugin (`server/inference-bridge.mjs`), so there is no
second process to start: `/api/inference/{health,warm,take}`. With no
`SIFT_NODE_HOST` set it returns a clear 503 rather than falling back to anything.

The recorder prefers a specific input (`PREFERRED_INPUT` in
`src/hooks/useVoiceCapture.js`, currently the iPhone continuity mic) and falls
back to the OS default when it is not attached. Device labels are only readable
after permission is granted, so it opens the default stream first, then
re-acquires if a better input turns out to be available; if that second request
fails the default stream stands and recording continues uninterrupted. The live
device name is read off the track and shown on the Call tile.

## Fake Mode

The **DEMO / FAKE MODE** badge in the header pre-populates the pipeline with four
baseline clients — Siya Paliwal (68), Maya Petel (52), Satwika Kota (41) and
Manasvi Miryalli (35) — each with full metrics, data sources and an inspector
view. Heer and Carolina then land *into* a working board rather than an empty
one. The roster lives in `FAKE_CLIENTS` in `src/data/demoClients.js`.

## Gmail hand-off

Heer's **Email** tile carries an external-link button that calls
`window.open('https://mail.google.com', '_blank')`, for switching to the real
inbox mid-pitch. Any source can get one by adding
`action: { label, url }` to it in `src/data/demoClients.js`.

## Structure

```
src/
  store/useClientStore.js   zustand; clients are held sorted by likelihood
  hooks/useDemoKeys.js      the hidden keyboard listener
  hooks/useCountUp.js       score count-up, honors prefers-reduced-motion
  data/demoClients.js       Heer, the Fake Mode roster, the live-Carolina builder
  hooks/useVoiceCapture.js  mic → WAV → local node (speech-to-text → LLM)
  lib/wav.js                16 kHz mono WAV encoder, so the node needs no ffmpeg
  lib/text.js               punctuation and casing restoration
  lib/timing.js             SCAN_MS, shared by the hook and the overlay
  components/ScanOverlay.jsx  the radar scan that masks the round-trip
server/inference-bridge.mjs Vite plugin: the SSH bridge to the local node
  components/
    TopBar.jsx              brand + live status
    Pipeline.jsx            left pane (30%) — the ranked list
    PipelineCard.jsx        motion.li with `layout`; the re-sort animates here
    Inspector.jsx           right pane (70%), split into two halves
    ClientInformation.jsx   top half — profile, source tiles, transcript
    SourceTile.jsx          Call / Email / Meeting / Docs, with a disabled state
    ScoreDashboard.jsx      bottom half — radial chart, metric rows, read-out
    ScoreRadial.jsx         Recharts RadialBarChart
```

## Faking a fuller board

Add entries to `FAKE_CLIENTS` in `src/data/demoClients.js`, or ingest them
directly — nothing in the app knows Heer and Carolina are special:

```js
useClientStore.getState().ingest(someClient)
```

Map them to keys by adding to the `DEMO_CLIENTS` export.

## Notes on the chart

The three metrics are independent 0–100 scores, not parts of a whole, so the
rings are pinned to a fixed `PolarAngleAxis` domain of `[0, 100]` rather than
being normalized against each other. The series colors
(`#E2334F` / `#C98500` / `#3987E5`) were validated for protanopia/deuteranopia
separation and ≥3:1 contrast against the dark surface.

Dark mode only, by intent — there is no light theme.
