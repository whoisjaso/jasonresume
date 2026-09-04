// One completion call over the free-model chain shared by the guide, the
// partner desk and the hiring desk. Providers are tried in order until one
// answers. Keys live in the Vercel project (see CONFIG.md):
//   OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, optional ANTHROPIC_API_KEY.

export const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3:free",
  "z-ai/glm-5.2:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "openrouter/free"
];

export async function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(t); }
}

async function openaiCompatible({ url, key, model, models, extraHeaders }, system, messages, maxTokens) {
  const body = { messages: [{ role: "system", content: system }, ...messages], max_tokens: maxTokens, temperature: 0.6 };
  if (models) body.models = models; else body.model = model;
  const r = await withTimeout(fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, ...(extraHeaders || {}) },
    body: JSON.stringify(body)
  }), 22_000);
  if (!r.ok) throw new Error("http " + r.status);
  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new Error("empty");
  return { text: String(text), model: j?.model || model || (models && models[0]) };
}

function list(env) { return (process.env[env] || "").split(",").map((s) => s.trim()).filter(Boolean); }

export const PROVIDERS = {
  anthropic: {
    ready: () => !!process.env.ANTHROPIC_API_KEY,
    run: async (system, messages, maxTokens) => {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();
      const response = await withTimeout(client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: maxTokens,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages
      }), 22_000);
      if (response.stop_reason === "refusal") return { text: "", model: "claude-sonnet-5", refused: true };
      let text = "";
      for (const block of response.content) if (block.type === "text") text += block.text;
      return { text, model: "claude-sonnet-5" };
    }
  },
  openrouter: {
    ready: () => !!process.env.OPENROUTER_API_KEY,
    run: (system, messages, maxTokens) => openaiCompatible({
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      models: list("OPENROUTER_MODELS").length ? list("OPENROUTER_MODELS") : OPENROUTER_MODELS,
      extraHeaders: { "HTTP-Referer": "https://jasonobawemimo.com", "X-Title": "jasonobawemimo.com" }
    }, system, messages, maxTokens)
  },
  groq: {
    ready: () => !!process.env.GROQ_API_KEY,
    run: (system, messages, maxTokens) => openaiCompatible({
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b"
    }, system, messages, maxTokens)
  },
  gemini: {
    ready: () => !!process.env.GEMINI_API_KEY,
    run: (system, messages, maxTokens) => openaiCompatible({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
    }, system, messages, maxTokens)
  }
};

export function order() {
  const env = list("LLM_ORDER").filter((s) => PROVIDERS[s]);
  const base = env.length ? env : ["anthropic", "openrouter", "groq", "gemini"];
  return base.filter((p) => PROVIDERS[p].ready());
}

// Returns { text, via } or throws the last provider error. With no key it
// throws "unconfigured" so callers can fall back quietly.
export async function complete(system, messages, { maxTokens = 400 } = {}) {
  const chain = order();
  if (!chain.length) throw new Error("unconfigured");
  let lastErr = null;
  for (const p of chain) {
    try {
      const out = await PROVIDERS[p].run(system, messages, maxTokens);
      let text = String(out.text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (!text && !out.refused) throw new Error("blank");
      return { text, via: p, refused: !!out.refused };
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error("upstream");
}
