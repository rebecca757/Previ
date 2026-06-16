// Classifies a free-text family-history condition into one of the standardized
// prevention categories used by the official screenings dataset.

import { callClaude } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "colorectal_cancer",
  "breast_cancer",
  "cardiovascular_disease",
  "diabetes",
  "hypertension",
  "prostate_cancer",
  "osteoporosis",
  "other",
] as const;

const SYSTEM_PROMPT = `Sei un classificatore medico. Ricevi una condizione clinica in italiano (testo libero) e devi associarla a UNA sola categoria tra:

- colorectal_cancer: tumore al colon, cancro al colon, carcinoma colorettale, tumore del retto, poliposi, tumore intestinale
- breast_cancer: tumore al seno, tumore della mammella, carcinoma mammario, cancro al seno
- cardiovascular_disease: infarto, ictus, malattia coronarica, insufficienza cardiaca, cardiopatia, angina, bypass cardiaco
- diabetes: diabete, diabete tipo 1, diabete tipo 2, diabete mellito, diabete gestazionale, glicemia alta, iperglicemia
- hypertension: ipertensione, pressione alta, ipertensione arteriosa
- prostate_cancer: tumore alla prostata, carcinoma prostatico
- osteoporosis: osteoporosi, fragilità ossea
- other: tutto ciò che non rientra nelle categorie precedenti

Rispondi SOLO con un JSON: {"category":"<una delle categorie>"}`;

// Fast deterministic pre-classifier — avoids an AI round-trip for common cases.
const KEYWORDS: Record<string, string[]> = {
  diabetes: ["diabet", "glicemia alta", "iperglic"],
  hypertension: ["ipertension", "pressione alta"],
  breast_cancer: ["seno", "mammar", "ovai"],
  colorectal_cancer: ["colon", "rett", "intestin", "polipos"],
  prostate_cancer: ["prostat"],
  cardiovascular_disease: ["infarto", "cardiac", "cardiovascolar", "ictus", "coronar", "angin", "bypass"],
  osteoporosis: ["osteoporos", "fragilit"],
};
function quickClassify(text: string): string | null {
  const t = text.toLowerCase();
  for (const [cat, kws] of Object.entries(KEYWORDS)) {
    if (kws.some((k) => t.includes(k))) return cat;
  }
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { condition } = await req.json().catch(() => ({ condition: "" }));
    const text = String(condition || "").trim();
    if (!text) return json({ ok: true, category: "other" });

    // Try fast deterministic match first.
    const quick = quickClassify(text);
    if (quick) return json({ ok: true, category: quick });

    const ai = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Condizione: "${text}"` }],
      max_tokens: 64,
    });
    if (!ai.ok) {
      console.error("[classify-family-condition] AI error", ai.status, ai.errorText);
      return json({ ok: false, error: "ai_http_error", status: ai.status, detail: ai.errorText });
    }
    const raw: string = ai.text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    let category = "other";
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        const c = String(parsed.category || "").trim();
        if ((CATEGORIES as readonly string[]).includes(c)) category = c;
      } catch (_e) { /* fall through */ }
    }
    return json({ ok: true, category });
  } catch (e) {
    console.error("[classify-family-condition] error", e);
    return json({ ok: false, error: "exception", detail: e instanceof Error ? e.message : String(e) });
  }
});
