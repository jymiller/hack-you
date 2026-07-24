// Parasail — OpenAI-compatible inference. One base host, Bearer key.
//   POST /v1/chat/completions with { model, messages }. Model string comes from PARASAIL_MODEL
//   (confirm the exact id via `GET /v1/models`; serverless ids are prefixed `parasail-`,
//   HuggingFace-hosted ones use the full HF id). No key → throws; callers decide the fallback.

const BASE = "https://api.parasail.io/v1";

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
  model: string;
  usage: unknown;
  latency_ms: number;
}

export interface ChatOpts {
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
}

// Full response: the answer plus GLM-5.2's reasoning trace and token usage.
export async function chatFull(messages: ChatMessage[], opts: ChatOpts = {}): Promise<ChatResult> {
  const key = apiKey();
  if (!key) throw new Error("no PARASAIL_API_KEY");

  const started = Date.now();
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
        model: model(),
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 4096,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`parasail chat → HTTP ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    const msg = data?.choices?.[0]?.message ?? {};
    return {
      content: msg.content ?? "",
      reasoning: msg.reasoning_content ?? null,
      model: data?.model ?? model(),
      usage: data?.usage ?? null,
      latency_ms: Date.now() - started,
    };
  } finally {
    clearTimeout(t);
  }
}

// Convenience: just the answer text (used by the CLI chat script).
export async function chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  return (await chatFull(messages, opts)).content;
}

// Config snapshot for the demo header — reports the model and key presence, never the key itself.
export function parasailStatus(): { model: string; key: boolean } {
  return { model: model(), key: !!apiKey() };
}
