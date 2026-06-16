import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { KNOWLEDGE_BASE, buildKBReference, type KBRule, type Sex } from "../_shared/prevention-kb.ts";
import { callClaude } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function ruleApplies(rule: KBRule, ctx: {
  age: number | null; sex: Sex;
  conditions: string[]; familyConditions: string[]; medications: string[]; memories: string[];
  lifestyle: Set<string>;
}): { applies: boolean; effectiveMinAge: number } {
  let effMin = rule.min_age;
  let familyHit = false;
  if (rule.if_family_conditions && rule.if_family_conditions.length) {
    familyHit = rule.if_family_conditions.some((k) => ctx.familyConditions.some((c) => c.includes(k)));
    if (familyHit && rule.earlier_age_if_family_months) {
      effMin = Math.max(18, rule.min_age - Math.floor(rule.earlier_age_if_family_months / 12));
    }
  }
  if (rule.sex !== "any" && rule.sex !== ctx.sex) return { applies: false, effectiveMinAge: effMin };
  if (ctx.age === null) return { applies: false, effectiveMinAge: effMin };
  if (ctx.age < effMin) return { applies: false, effectiveMinAge: effMin };
  if (rule.max_age && ctx.age > rule.max_age + 5) return { applies: false, effectiveMinAge: effMin };

  // Conditional triggers — if specified, require a hit to apply (other than the base age-based rule)
  // We always allow the base rule by age; conditional fields make it stronger but not required.
  // However for some rules (e.g. spirometria) the trigger is the lifestyle factor.
  if (rule.if_lifestyle && rule.if_lifestyle.length) {
    const hit = rule.if_lifestyle.some((l) => ctx.lifestyle.has(l));
    if (!hit) return { applies: false, effectiveMinAge: effMin };
  }
  return { applies: true, effectiveMinAge: effMin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { active_user_id } = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    let targetId = userData.user.id;
    if (active_user_id && active_user_id !== userData.user.id) {
      const { data: link } = await admin.from("family_links").select("id")
        .eq("caregiver_user_id", userData.user.id).eq("managed_user_id", active_user_id)
        .eq("link_type", "caregiver").eq("status", "active").maybeSingle();
      if (link) targetId = active_user_id;
    }

    const [{ data: profile }, { data: docs }, { data: memories }, { data: bio }, { data: reminders }, { data: conditions }, { data: family }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", targetId).maybeSingle(),
      admin.from("documents").select("id,title,doc_type,document_date,ai_summary").eq("user_id", targetId).is("deleted_at", null).order("created_at", { ascending: false }).limit(30),
      admin.from("health_memories").select("id,description,body_part,event_date,notes,status,linked_document_id").eq("user_id", targetId).is("deleted_at", null).neq("status", "archived"),
      admin.from("biometric_history").select("weight_kg,height_cm,recorded_at").eq("user_id", targetId).order("recorded_at", { ascending: false }).limit(5),
      admin.from("reminders").select("title,status,suggested_specialty,due_date").eq("user_id", targetId),
      admin.from("health_conditions").select("name,start_date,end_date,status,notes").eq("user_id", targetId),
      admin.from("family_history").select("relation,condition,onset_age,notes").eq("user_id", targetId),
    ]);

    const p: any = profile || {};
    const age = ageFromDob(p.date_of_birth);
    const sex: Sex = p.biological_sex === "M" ? "M" : p.biological_sex === "F" ? "F" : "any";

    const conditionsList = (conditions || []).map((c: any) => `${c.name} (${c.status})`).join(", ") || "nessuna";
    const familyList = (family || []).map((f: any) => `${f.relation}: ${f.condition}${f.onset_age ? ` (a ${f.onset_age} anni)` : ""}`).join("; ") || "nessuna";
    const medicationsList = (p.medications || []).join(", ") || "nessuno";
    const memoryList = (memories || []).map((m: any) => `${m.description}${m.body_part ? ` (${m.body_part})` : ""}`).join("; ") || "nessuno";

    // Lifestyle inference
    const lifestyle = new Set<string>();
    const lastBio = (bio || [])[0];
    if (lastBio?.weight_kg && lastBio?.height_cm) {
      const h = Number(lastBio.height_cm) / 100;
      const bmi = Number(lastBio.weight_kg) / (h * h);
      if (bmi >= 30) lifestyle.add("obesity");
    }
    if ((conditions || []).some((c: any) => /ipertension/i.test(c.name))) lifestyle.add("hypertension");
    if ((conditions || []).some((c: any) => /colesterolo/i.test(c.name))) lifestyle.add("high_cholesterol");
    if ((p.medications || []).some((m: string) => /nicotin|smettere|fumo/i.test(m))) lifestyle.add("smoker");

    // Filter applicable rules from KB deterministically
    const ctx = {
      age, sex,
      conditions: (conditions || []).map((c: any) => String(c.name || "").toLowerCase()),
      familyConditions: (family || []).map((f: any) => String(f.condition || "").toLowerCase()),
      medications: (p.medications || []).map((m: string) => m.toLowerCase()),
      memories: (memories || []).map((m: any) => String(m.description || "").toLowerCase()),
      lifestyle,
    };
    const applicable = KNOWLEDGE_BASE
      .map((r) => ({ r, ev: ruleApplies(r, ctx) }))
      .filter((x) => x.ev.applies)
      .map((x) => x.r);

    const applicableSummary = applicable.map((r) => `- [${r.id}] ${r.title} (${r.source_label})`).join("\n") || "Nessuna regola applicabile in base alla sola età/sesso.";

    const existingRemSummary = (reminders || []).map((r: any) => `- ${r.title} [${r.status}]`).join("\n") || "Nessuno";

    const system = `Sei il motore di prevenzione di Prevì, un assistente sanitario italiano. Usi linee guida ufficiali italiane (Ministero della Salute, Piano Nazionale della Prevenzione 2020–2025, LEA, ISS / EpiCentro). NON sei un medico: NON diagnosticare e NON prescrivere.

Il tuo compito: generare un piano di prevenzione personalizzato per l'utente, scegliendo solo dalla KNOWLEDGE BASE qui sotto, ed assegnando a ciascuna voce una priorità:
- "overdue": screening dovuto in passato e non risulta eseguito (es. l'utente ha 55 anni e non c'è documento di colonscopia/SOF recente).
- "upcoming": screening atteso nei prossimi 12 mesi.
- "future": raccomandazione utile da pianificare oltre i 12 mesi.

Considera:
- età ed eventuale anticipo per familiarità di primo grado (vedi knowledge base)
- condizioni croniche attive
- farmaci
- ricordi di salute / documenti rilevanti già presenti (NON duplicare se un controllo è recente)
- promemoria già esistenti (non duplicarli; puoi però marcarli come overdue se la data è passata)
- fattori di stile di vita (BMI elevato, fumo, ipertensione, colesterolo alto)

KNOWLEDGE BASE (regole disponibili):
${buildKBReference()}

REGOLE APPLICABILI PER QUESTO UTENTE (pre-filtrate per età/sesso/familiarità):
${applicableSummary}

PROFILO UTENTE:
- Età: ${age ?? "n/d"}
- Sesso: ${sex}
- Condizioni: ${conditionsList}
- Farmaci: ${medicationsList}
- Anamnesi familiare: ${familyList}
- Ricordi di salute attivi: ${memoryList}
- Stile di vita inferito: ${Array.from(lifestyle).join(", ") || "nessun fattore noto"}
- BMI ultimo rilevato: ${lastBio?.weight_kg && lastBio?.height_cm ? (Number(lastBio.weight_kg) / Math.pow(Number(lastBio.height_cm) / 100, 2)).toFixed(1) : "n/d"}
- Promemoria già presenti: 
${existingRemSummary}

OUTPUT (JSON OBBLIGATORIO):
{
  "plan": [
    {
      "rule_id": "id dalla knowledge base",
      "title": "titolo del controllo",
      "specialty": "specialità medica",
      "priority": "overdue" | "upcoming" | "future",
      "reason": "spiegazione personalizzata (collega esplicitamente a età, condizioni, familiarità, ricordi, BMI o farmaci dell'utente)",
      "suggested_timeframe": "es. 'entro 3 mesi', 'entro 12 mesi', 'tra 2 anni'",
      "source_label": "etichetta della fonte"
    }
  ],
  "summary": "una frase di sintesi in italiano"
}

Ordina l'array "plan" mettendo PRIMA le voci "overdue", poi "upcoming", poi "future". Massimo 10 voci. Non includere mai voci non presenti nella knowledge base sopra. Non duplicare promemoria già esistenti.`;

    const ai = await callClaude({
      system: `${system}\n\nRispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo o markdown attorno.`,
      messages: [{ role: "user", content: "Genera ora il piano di prevenzione personalizzato in JSON." }],
      max_tokens: 4096,
    });
    if (ai.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!ai.ok) {
      return new Response(JSON.stringify({ error: "AI error", detail: ai.errorText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const raw = (ai.text || "{}").replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any = { plan: [], summary: "" };
    try { parsed = JSON.parse(raw); } catch { /* keep default */ }

    // Sort to enforce priority order even if model fails
    const order: Record<string, number> = { overdue: 0, upcoming: 1, future: 2 };
    const plan = Array.isArray(parsed.plan) ? parsed.plan : [];
    plan.sort((a: any, b: any) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));

    return new Response(JSON.stringify({ plan, summary: parsed.summary || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
