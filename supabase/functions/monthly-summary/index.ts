import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE);

    // (body_system filter removed — monthly summary is always global)
    try { await req.json(); } catch { /* no body */ }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString();

    const [{ data: profile }, { data: docs }, { data: memories }, { data: reminders }, { data: bios }, { data: family }] = await Promise.all([
      admin.from("profiles").select("full_name,date_of_birth,biological_sex,chronic_conditions,medications,allergies").eq("id", userId).maybeSingle(),
      admin.from("documents").select("title,doc_type,document_date,ai_summary,created_at,body_systems").eq("user_id", userId).is("deleted_at", null).gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }),
      admin.from("health_memories").select("description,body_part,event_date,notes,created_at,body_systems").eq("user_id", userId).is("deleted_at", null).gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }),
      admin.from("reminders").select("title,due_date,priority,priority_reason,status,enabled,source").eq("user_id", userId).eq("enabled", true),
      admin.from("biometric_history").select("weight_kg,height_cm,recorded_at").eq("user_id", userId).gte("recorded_at", sixtyDaysAgo).order("recorded_at", { ascending: false }).limit(10),
      admin.from("family_history").select("relation,condition,onset_age,condition_category").eq("user_id", userId),
    ]);


    const docCount = (docs || []).length;
    const memoryCount = (memories || []).length;
    const activeReminders = (reminders || []);
    const urgentCount = activeReminders.filter((r: any) => r.priority === "urgent").length;
    const dueSoonCount = activeReminders.filter((r: any) => {
      if (!r.due_date) return false;
      const due = new Date(r.due_date).getTime();
      return due >= now.getTime() && due <= now.getTime() + 30 * 24 * 3600 * 1000;
    }).length;

    const latestBio = (bios || [])[0];
    const previousBio = (bios || []).find((b: any) => latestBio && new Date(b.recorded_at).getTime() < new Date(latestBio.recorded_at).getTime() - 7 * 24 * 3600 * 1000) || (bios || [])[1];

    let weightTrend: { delta: number | null; label: string } = { delta: null, label: "n/d" };
    if (latestBio?.weight_kg && previousBio?.weight_kg) {
      const delta = Number(latestBio.weight_kg) - Number(previousBio.weight_kg);
      const abs = Math.abs(delta);
      if (abs < 0.3) weightTrend = { delta: 0, label: "stabile" };
      else if (delta > 0) weightTrend = { delta, label: `aumentato di ${abs.toFixed(1)} kg` };
      else weightTrend = { delta, label: `diminuito di ${abs.toFixed(1)} kg` };
    } else if (latestBio?.weight_kg) {
      weightTrend = { delta: null, label: `${latestBio.weight_kg} kg (nessun confronto disponibile)` };
    }

    const p: any = profile || {};
    const familyList = (family || []) as any[];
    const context = `
PROFILO:
- Nome: ${p.full_name || "n/d"}
- Sesso: ${p.biological_sex || "n/d"}
- Condizioni croniche: ${(p.chronic_conditions || []).join(", ") || "nessuna"}
- Farmaci: ${(p.medications || []).join(", ") || "nessuno"}
- Allergie: ${(p.allergies || []).join(", ") || "nessuna"}

ANAMNESI FAMILIARE (${familyList.length}):
${familyList.slice(0, 12).map((f) => `  • ${f.relation}: ${f.condition}${f.onset_age ? ` (${f.onset_age} anni)` : ""}${f.condition_category ? ` [${f.condition_category}]` : ""}`).join("\n") || "  (nessuna)"}

ULTIMI 30 GIORNI:
- Documenti: ${docCount}
${(docs || []).slice(0, 8).map((d: any) => `  • ${d.title} (${d.doc_type})${d.ai_summary ? " — " + String(d.ai_summary).slice(0, 120) : ""}`).join("\n")}
- Ricordi di salute: ${memoryCount}
${(memories || []).slice(0, 8).map((m: any) => `  • ${m.description} (${m.body_part || "—"})`).join("\n")}

PROMEMORIA ATTIVI: ${activeReminders.length} (urgenti: ${urgentCount}, in scadenza entro 30 gg: ${dueSoonCount})
${activeReminders.slice(0, 10).map((r: any) => `  • ${r.title} — ${r.priority}${r.due_date ? ` (scadenza ${r.due_date})` : ""}`).join("\n")}

BIOMETRIA:
- Peso attuale: ${latestBio?.weight_kg || "n/d"} kg (${latestBio?.recorded_at?.slice(0, 10) || "n/d"})
- Peso precedente: ${previousBio?.weight_kg || "n/d"} kg (${previousBio?.recorded_at?.slice(0, 10) || "n/d"})
- Trend: ${weightTrend.label}
`.trim();

    const systemPrompt = `Sei Prevì, assistente sanitario personale in italiano. Genera un consiglio di salute breve e SPECIFICO (2-3 frasi, max 80 parole) basato ESCLUSIVAMENTE sui dati reali dell'utente forniti qui sotto.

REGOLE TASSATIVE:
- NON inventare condizioni, screening, esami o promemoria non presenti nei dati.
- NON menzionare patologie generiche se non sono nel profilo, nelle condizioni croniche, nei documenti recenti o nell'anamnesi familiare.
- Fai riferimento a un dato concreto già presente (es. familiarità per ipertensione → suggerisci misurazione pressione; documento recente di esame X → suggerisci follow-up).
- Se mancano dati significativi, suggerisci un'azione concreta basata sul profilo (es. aggiungere peso/altezza, caricare referti).
- Tono empatico, chiaro, non clinico. Non diagnosticare.
- Rispondi SOLO con il testo del consiglio, senza preamboli.`;


    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit, riprova tra poco." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const advice = (aiJson.choices?.[0]?.message?.content || "").trim();

    const stats = {
      month,
      doc_count: docCount,
      memory_count: memoryCount,
      reminders_due_soon: dueSoonCount,
      reminders_urgent: urgentCount,
      weight_delta: weightTrend.delta,
      weight_label: weightTrend.label,
      advice,
    };

    const summary_text = JSON.stringify(stats);

    await admin.from("monthly_summaries").upsert({
      user_id: userId,
      month,
      summary_text,
      generated_at: new Date().toISOString(),
    }, { onConflict: "user_id,month" });


    return new Response(JSON.stringify({ ok: true, month, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
