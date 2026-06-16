// Shared Anthropic (Claude) helper for Edge Functions.
// Replaces the previous Lovable AI gateway calls. Uses the ANTHROPIC_API_KEY
// secret and the Anthropic Messages API (same pattern as the `chat` function).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export type ClaudeResult = {
  ok: boolean;
  status: number;
  text: string;
  raw: any;
  errorText?: string;
};

/**
 * Call the Anthropic Messages API.
 * Returns { ok, status, text, raw }. On failure ok=false and errorText is set
 * (status 0 means the ANTHROPIC_API_KEY secret is missing).
 */
export async function callClaude(opts: {
  system?: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
}): Promise<ClaudeResult> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return { ok: false, status: 0, text: "", raw: null, errorText: "missing_anthropic_api_key" };
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opts.max_tokens ?? 2048,
      ...(opts.system ? { system: opts.system } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return { ok: false, status: res.status, text: "", raw: null, errorText };
  }

  const raw = await res.json();
  const text = (raw.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("");
  return { ok: true, status: res.status, text, raw };
}

/**
 * Convert OpenAI-style message content (string, or an array of
 * {type:"text"} / {type:"image_url"} / {type:"file"} parts — the format the
 * old Lovable gateway used) into Anthropic content blocks.
 *
 * - data: URLs become base64 sources (image -> "image", PDF -> "document")
 * - http(s) URLs become url sources
 */
export function toAnthropicContent(content: any): any {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");

  const blocks: any[] = [];
  for (const part of content) {
    if (!part) continue;

    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text ?? "" });
      continue;
    }

    if (part.type === "image_url") {
      const url: string = part.image_url?.url || "";
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        blocks.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      } else if (url) {
        blocks.push({ type: "image", source: { type: "url", url } });
      }
      continue;
    }

    if (part.type === "file") {
      const fd: string = part.file?.file_data || "";
      const m = fd.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        blocks.push({ type: "document", source: { type: "base64", media_type: m[1], data: m[2] } });
      }
      continue;
    }
  }
  return blocks;
}
