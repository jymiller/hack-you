// Parasail — OpenAI-compatible inference. One base host, Bearer key.
//   POST /v1/chat/completions with { model, messages }. Model string comes from PARASAIL_MODEL
//   (confirm the exact id via `GET /v1/models`; serverless ids are prefixed `parasail-`,
//   HuggingFace-hosted ones use the full HF id). No key → throws; callers decide the fallback.

const BASE = "https://api.parasail.io/v1";

// Parasail's shared serverless pool can return 429 "engine overloaded" (or a 5xx) under load.
// We retry with backoff, then fall back to alternate routes for the SAME model (GLM-5.2) — the
// serverless `parasail-glm-52` pool and its HF routes saturate independently, so routing around
// a busy one keeps the demo on GLM-5.2 instead of erroring.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const FALLBACK_MODELS = ["zai-org/GLM-5.2", "zai-org/GLM-5.2-FP8"];
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function apiKey(): string | undefined {
  return process.env.PARASAIL_API_KEY?.trim() || undefined;
}

function model(): string {
  return process.env.PARASAIL_MODEL?.trim() || "parasail-deepseek-r1";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  reasoning: string | null; // GLM-5.2 returns its chain-of-thought in reasoning_content
  model: string; // the route that actually served the reply (may be a fallback)
  usage: unknown;
  latency_ms: number;
}

export interface ChatOpts {
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  retries?: number; // per-model retries on 429/5xx (default 2), with exponential backoff
  fallbackModels?: string[]; // alternate routes tried when the primary stays overloaded
}

// Full response: the answer plus GLM-5.2's reasoning trace and token usage.
export async function chatFull(messages: ChatMessage[], opts: ChatOpts = {}): Promise<ChatResult> {
  const key = apiKey();
  if (!key) throw new Error("no PARASAIL_API_KEY");

  const started = Date.now();
  const retries = opts.retries ?? 2;
  const models = [model(), ...(opts.fallbackModels ?? FALLBACK_MODELS)].filter((m, i, a) => m && a.indexOf(m) === i);

  for (let mi = 0; mi < models.length; mi++) {
    const modelId = models[mi];
    const lastModel = mi === models.length - 1;
    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      // Reasoning models (GLM-5.2) can think for a while before answering — keep the ceiling generous.
      const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 120000);
      try {
        const res = await fetch(`${BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          // GLM-5.2 is a reasoning model: it spends tokens on hidden reasoning before the answer,
          // so too small a max_tokens returns empty content. 4096 leaves room for reasoning + reply.
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: opts.temperature ?? 0.2,
            max_tokens: opts.maxTokens ?? 4096,
          }),
          signal: ctrl.signal,
        });

        if (RETRYABLE.has(res.status)) {
          if (attempt < retries) {
            const retryAfter = Number(res.headers.get("retry-after"));
            const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
            await sleep(wait);
            continue; // retry same route
          }
          if (!lastModel) break; // route still overloaded — fall back to the next one
          throw new Error(`Parasail GLM-5.2 is overloaded (${res.status}) across all routes — retried ${retries}× each of ${models.join(", ")}. Try again shortly.`);
        }
        if (!res.ok) throw new Error(`parasail chat → HTTP ${res.status}: ${await res.text()}`);

        const data: any = await res.json();
        const msg = data?.choices?.[0]?.message ?? {};
        return {
          content: msg.content ?? "",
          reasoning: msg.reasoning_content ?? null,
          model: data?.model ?? modelId,
          usage: data?.usage ?? null,
          latency_ms: Date.now() - started,
        };
      } finally {
        clearTimeout(t);
      }
    }
  }
  throw new Error("Parasail GLM-5.2 unavailable."); // unreachable: the loop returns or throws
}

// Convenience: just the answer text (used by the CLI chat script).
export async function chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  return (await chatFull(messages, opts)).content;
}

// Config snapshot for the demo header — reports the model and key presence, never the key itself.
export function parasailStatus(): { model: string; key: boolean } {
  return { model: model(), key: !!apiKey() };
}
