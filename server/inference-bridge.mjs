import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Bridge to the local inference node.
 *
 * No third-party AI service is involved: speech-to-text and the language model
 * both run on hardware on the same network as the browser. The bridge reaches
 * that machine over plain SSH — nothing is installed on it beyond Ollama and
 * whisper.cpp, and no ports are exposed.
 *
 * Every value below is environment-driven so the node's address, model and
 * paths stay out of version control. Copy `.env.example` to `.env.local` and
 * fill in your own.
 */
const keepAliveOf = (raw) => {
  if (raw === undefined || raw === "") return -1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
};

export function resolveConfig(env = process.env) {
  return {
    host: env.SIFT_NODE_HOST ?? "",
    model: env.SIFT_NODE_MODEL ?? "",
    /** Shown in the UI. Keep it generic if the repo is public. */
    nodeLabel: env.SIFT_NODE_LABEL ?? "local node",
    modelLabel: env.SIFT_MODEL_LABEL ?? "local model",
    whisperBin: env.SIFT_WHISPER_BIN ?? "~/whisper.cpp/build/bin/whisper-cli",
    whisperModel:
      env.SIFT_WHISPER_MODEL ??
      // tiny.en over base.en: faster, and the casing/punctuation it drops is
      // restored client-side in src/lib/text.js.
      "~/whisper.cpp/models/ggml-tiny.en.bin",
    /**
     * -1 pins the weights in memory so a demo never pays a cold load. Env vars
     * arrive as strings and Ollama rejects "-1" as a duration, so numeric
     * values are coerced; named durations like "60m" pass through.
     */
    keepAlive: keepAliveOf(env.SIFT_KEEP_ALIVE),
    whisperThreads: env.SIFT_WHISPER_THREADS ?? "8",
    sshTimeoutMs: Number(env.SIFT_TIMEOUT_MS ?? 180000),
  };
}

export let CONFIG = resolveConfig();

/**
 * ControlMaster keeps one TCP+auth session open across calls. Each take makes
 * two round-trips, and a cold SSH handshake costs ~200ms of the latency budget.
 */
const SSH_OPTS = [
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=10",
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "ControlMaster=auto",
  "-o",
  "ControlPath=/tmp/sift-ssh-%r@%h:%p",
  "-o",
  "ControlPersist=30m",
];

const ssh = (command) =>
  run("ssh", [...SSH_OPTS, CONFIG.host, command], {
    timeout: CONFIG.sshTimeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });

/** Single-quote a string for safe interpolation into a remote sh command. */
const shq = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

/**
 * Latency is output-token count times ~173 ms/token — that constant is the
 * memory-bandwidth roof for a large local model and cannot be tuned away. So the
 * schema is deliberately tiny: single-letter keys and no prose. 14 tokens
 * instead of 46 is the difference between 2.8s and 8.0s.
 *
 * The headline sentence is composed locally from the numbers instead of being
 * generated, which alone saved ~2s.
 */
const scorePrompt = (transcript) =>
  `Rate this sales prospect. Each value is an integer 0-100.
l = likelihood they commit money soon
h = hesitance, hedging or deferral
e = effort our side must still spend (eager buyer = low)
Transcript: "${transcript}"
Reply JSON only, integers 0-100: {"l":<0-100>,"h":<0-100>,"e":<0-100>}`;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Derived locally, so the model never spends tokens writing prose. */
function takeawayFor({ likelihood, hesitance, convictionEffort }) {
  if (likelihood >= 85)
    return "Ready to sign. Send paper before anything cools.";
  if (likelihood >= 60)
    return hesitance >= 50
      ? "Interested but hedging. Close the open objection first."
      : "Moving on its own. Keep the momentum, do not oversell.";
  if (hesitance >= 70)
    return "Deferring, not evaluating. Stop selling and hold the date.";
  if (convictionEffort >= 70)
    return "Expensive to convert. Check this is worth the team's time.";
  return "Early and unresolved. Find the real decision-maker.";
}

async function generate(transcript) {
  const payload = JSON.stringify({
    model: CONFIG.model,
    prompt: scorePrompt(transcript),
    stream: false,
    format: "json",
    keep_alive: CONFIG.keepAlive,
    options: { num_predict: 32, temperature: 0.1, top_p: 0.9 },
  });

  const { stdout } = await ssh(
    `curl -s -m 170 -X POST localhost:11434/api/generate -H 'Content-Type: application/json' -d ${shq(payload)}`,
  );

  const envelope = JSON.parse(stdout);
  if (envelope.error) throw new Error(`ollama: ${envelope.error}`);
  const raw = JSON.parse(envelope.response);

  const scored = {
    likelihood: clamp(raw.l ?? raw.likelihood),
    hesitance: clamp(raw.h ?? raw.hesitance),
    convictionEffort: clamp(raw.e ?? raw.convictionEffort),
  };

  return {
    ...scored,
    keyTakeaway: takeawayFor(scored),
    model: CONFIG.modelLabel,
    evalTokens: envelope.eval_count ?? 0,
    loadMs: Math.round((envelope.load_duration ?? 0) / 1e6),
    genMs: Math.round((envelope.eval_duration ?? 0) / 1e6),
  };
}

/**
 * Streams the WAV to the remote over the SSH session's stdin and runs
 * whisper.cpp on it in the same call. Piping avoids a separate scp connection,
 * which was costing a second handshake per take.
 */
function transcribe(wavBuffer) {
  const remotePath = `/tmp/sift-${randomUUID()}.wav`;
  const command = `cat > ${remotePath} && ${CONFIG.whisperBin} -m ${CONFIG.whisperModel} -f ${remotePath} -nt -np -t ${CONFIG.whisperThreads} 2>/dev/null; rm -f ${remotePath}`;

  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [...SSH_OPTS, CONFIG.host, command]);
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("transcription timed out"));
    }, CONFIG.sshTimeoutMs);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        return reject(new Error(err.slice(0, 300) || `ssh exited ${code}`));
      resolve(out.replace(/\s+/g, " ").trim());
    });

    child.stdin.end(wavBuffer);
  });
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

/**
 * Vite plugin: mounts the bridge on the dev server, so there is no second
 * process to start before a demo.
 */
export function inferenceBridge(env) {
  if (env) CONFIG = resolveConfig({ ...process.env, ...env });
  return {
    name: "sift-inference-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/inference/")) return next();
        const route = req.url.split("?")[0];
        const started = Date.now();

        if (!CONFIG.host) {
          return send(res, 503, {
            ok: false,
            error:
              "No inference node configured. Copy .env.example to .env.local and set SIFT_NODE_HOST.",
          });
        }

        try {
          if (route === "/api/inference/health") {
            const { stdout } = await ssh(
              `echo -n "ollama:"; curl -s -m 5 localhost:11434/api/ps | head -c 2000; echo; echo -n "whisper:"; test -x ${CONFIG.whisperBin} && test -f ${CONFIG.whisperModel} && echo yes || echo no`,
            );
            const resident = stdout.includes(CONFIG.model);
            return send(res, 200, {
              ok: true,
              label: CONFIG.nodeLabel,
              model: CONFIG.modelLabel,
              resident,
              whisperReady: /whisper:yes/.test(stdout),
              ms: Date.now() - started,
            });
          }

          if (route === "/api/inference/warm") {
            // Give the 70B the whole memory pool: evict every other loaded
            // model, then load ours with keep_alive -1 so it never unloads.
            const evict = `for m in $(ollama ps --format 2>/dev/null | tail -n +2 | awk '{print $1}'); do [ "$m" = "${CONFIG.model}" ] || ollama stop "$m"; done 2>/dev/null || true`;
            const load = `curl -s -m 170 -X POST localhost:11434/api/generate -H 'Content-Type: application/json' -d ${shq(
              JSON.stringify({
                model: CONFIG.model,
                keep_alive: CONFIG.keepAlive,
              }),
            )}`;
            const { stdout } = await ssh(`${evict}; ${load}; echo; ollama ps`);
            return send(res, 200, {
              ok: true,
              model: CONFIG.modelLabel,
              pinned: CONFIG.keepAlive === -1,
              ms: Date.now() - started,
            });
          }

          if (route === "/api/inference/transcribe") {
            const audio = await readBody(req);
            if (!audio.length)
              return send(res, 400, { ok: false, error: "empty audio" });
            const transcript = await transcribe(audio);
            return send(res, 200, {
              ok: true,
              transcript,
              bytes: audio.length,
              ms: Date.now() - started,
            });
          }

          /**
           * One take, start to finish, as an NDJSON stream. Collapsing
           * transcribe+score into a single request removes a browser
           * round-trip from the critical path, and streaming the stages keeps
           * the UI able to show "transcript closed" before the scores land.
           */
          if (route === "/api/inference/take") {
            const audio = await readBody(req);
            if (!audio.length)
              return send(res, 400, { ok: false, error: "empty audio" });

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/x-ndjson");
            res.setHeader("Cache-Control", "no-cache");
            const emit = (o) => res.write(JSON.stringify(o) + "\n");

            try {
              const transcript = await transcribe(audio);
              const transcribeMs = Date.now() - started;
              if (!transcript)
                throw new Error(
                  "the inference node returned an empty transcript",
                );
              emit({ stage: "transcript", transcript, transcribeMs });

              const scored = await generate(transcript);
              emit({
                stage: "scored",
                ...scored,
                transcribeMs,
                ms: Date.now() - started - transcribeMs,
                totalMs: Date.now() - started,
              });
            } catch (error) {
              emit({
                stage: "error",
                error: (error.message ?? "failed").slice(0, 300),
              });
            }
            return res.end();
          }

          if (route === "/api/inference/score") {
            const { transcript } = JSON.parse(
              (await readBody(req)).toString() || "{}",
            );
            if (!transcript?.trim())
              return send(res, 400, { ok: false, error: "empty transcript" });
            const scored = await generate(transcript);
            return send(res, 200, {
              ok: true,
              ...scored,
              ms: Date.now() - started,
            });
          }

          return next();
        } catch (error) {
          console.error(`[inference] ${route} failed:`, error.message);
          return send(res, 502, {
            ok: false,
            error: (error.stderr || error.message || "remote call failed")
              .toString()
              .slice(0, 400),
            ms: Date.now() - started,
          });
        }
      });
    },
  };
}
