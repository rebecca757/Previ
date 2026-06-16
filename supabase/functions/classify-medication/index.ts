// Classifies a medication name and suggests a typical condition for the user.

import { callClaude } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "cardiovascular",
  "diabetes",
  "thyroid",
  "pain",
  "psychiatric",
  "respiratory",
  "gastro",
  "antibiotic",
  "vitamin",
  "other",
] as const;

const SYSTEM_PROMPT = `Sei un farmacologo. Ricevi il nome di un farmaco in italiano e devi rispondere con un JSON di questa forma esatta (e solo questa, nessun altro testo):

{
  "category": "cardiovascular" | "diabetes" | "thyroid" | "pain" | "psychiatric" | "respiratory" | "gastro" | "antibiotic" | "vitamin" | "other",
  "typical_condition": "la condizione più comune per cui questo farmaco è prescritto, in italiano, linguaggio semplice (es. 'ipertensione', 'diabete tipo 2', 'ipotiroidismo'). Se è un integratore o vitamina, indica l'uso tipico (es. 'carenza di vitamina D'). Se non riconosci il farmaco, metti null.",
  "suggest_condition": true | false
}

Imposta suggest_condition=true solo se conosci il farmaco con buona certezza E la categoria è cardiovascular, diabetes, thyroid, psychiatric, respiratory o gastro (cioè le categorie che tipicamente implicano una condizione cronica nota). Per antibiotic, pain, vitamin, other → suggest_condition=false.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { name } = await req.json().catch(() => ({ name: "" }));
    const text = String(name || "").trim();
    if (!text) return json({ ok: true, category: "other", typical_condition: null, suggest_condition: false });

    const ai = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Farmaco: "${text}"` }],
      max_tokens: 128,
    });
    if (!ai.ok) {
      console.error("[classify-medication] AI error", ai.status, ai.errorText);
      return json({ ok: false, error: "ai_http_error", status: ai.status, detail: ai.errorText });
    }
    const raw: string = ai.text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    let category = "other";
    let typical_condition: string | null = null;
    let suggest_condition = false;
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        const c = String(parsed.category || "").trim();
        if ((CATEGORIES as readonly string[]).includes(c)) category = c;
        if (parsed.typical_condition && typeof parsed.typical_condition === "string") {
          typical_condition = parsed.typical_condition.trim() || null;
        }
        suggest_condition = Boolean(parsed.suggest_condition);
      } catch (_e) { /* ignore */ }
    }
    return json({ ok: true, category, typical_condition, suggest_condition });
  } catch (e) {
    console.error("[classify-medication] error", e);
    return json({ ok: false, error: "exception", detail: e instanceof Error ? e.message : String(e) });
  }
});
