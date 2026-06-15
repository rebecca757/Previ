import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Sei un assistente medico italiano. Analizza il testo o documento fornito e restituisci un JSON con questi campi:

{
  "titolo": "titolo sintetico dell'evento sanitario (se non già fornito dall'utente)",
  "tipo_evento": one of: "Visita specialistica" | "Esame del sangue / Analisi di laboratorio" | "Radiografia / Imaging" | "Intervento chirurgico" | "Ricovero ospedaliero" | "Diagnosi" | "Terapia / Farmaco" | "Vaccinazione" | "Altro",
  "parte_del_corpo": "area anatomica principale coinvolta, in italiano (es. Ginocchio sinistro, Cuore, Polmone destro)",
  "struttura_sanitaria": "nome della struttura se presente, altrimenti null",
  "tipo_struttura": "pubblica" | "privata" | null,
  "medico": "nome del medico/specialista se presente, altrimenti null",
  "data_evento": "data in formato YYYY-MM-DD se presente, altrimenti null",
  "riassunto": "spiegazione in linguaggio semplice e chiaro di cosa è successo, max 2 frasi, senza termini tecnici"
}

Rispondi SOLO con il JSON, senza testo aggiuntivo.`;

// Always respond 200 so the client can read the structured body via supabase.functions.invoke
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log("[extract-health-info] invoked", req.method);
  try {
    const body = await req.json().catch((e) => {
      console.error("[extract-health-info] invalid json body", e);
      return null;
    });
    if (!body) return json({ ok: false, error: "invalid_body", detail: "Body JSON non valido" });

    const { title, notes, extracted_text, image_data_url, file_path } = body;
    console.log("[extract-health-info] payload", {
      hasTitle: !!title,
      hasNotes: !!notes,
      extractedTextLength: extracted_text?.length || 0,
      hasImage: !!image_data_url,
      hasFilePath: !!file_path,
    });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    console.log("[extract-health-info] env check", {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnon: !!ANON,
      hasService: !!SERVICE,
      hasLovableKey: !!LOVABLE_API_KEY,
    });
    if (!LOVABLE_API_KEY) {
      return json({ ok: false, error: "missing_lovable_api_key", detail: "LOVABLE_API_KEY non configurato nelle variabili d'ambiente della funzione." });
    }
    if (!SUPABASE_URL || !ANON) {
      return json({ ok: false, error: "missing_supabase_env", detail: "SUPABASE_URL o SUPABASE_ANON_KEY mancanti." });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.error("[extract-health-info] unauthorized", userErr);
      return json({ ok: false, error: "unauthorized", detail: userErr?.message || "Utente non autenticato" }, 401);
    }

    let legacyFileUrl: string | null = null;
    if (file_path && !image_data_url && !extracted_text && SERVICE) {
      const admin = createClient(SUPABASE_URL, SERVICE);
      const { data: signed } = await admin.storage.from("health-documents").createSignedUrl(file_path, 600);
      legacyFileUrl = signed?.signedUrl || null;
    }

    const textBlocks: string[] = [];
    if (title) textBlocks.push(`Titolo fornito dall'utente: ${title}`);
    if (notes) textBlocks.push(`Note dell'utente:\n${notes}`);
    if (extracted_text) textBlocks.push(`Testo estratto dal documento:\n${extracted_text}`);
    const userText = textBlocks.join("\n\n") || "Analizza il documento allegato.";

    const parts: any[] = [{ type: "text", text: userText }];
    if (image_data_url) parts.push({ type: "image_url", image_url: { url: image_data_url } });
    else if (legacyFileUrl) parts.push({ type: "image_url", image_url: { url: legacyFileUrl } });

    console.log("[extract-health-info] calling AI gateway, text length:", userText.length);
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: parts },
        ],
      }),
    });
    console.log("[extract-health-info] AI status:", aiRes.status);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("[extract-health-info] AI error body:", t);
      return json({ ok: false, error: "ai_http_error", status: aiRes.status, detail: t });
    }
    const aiJson = await aiRes.json();
    const raw: string = aiJson.choices?.[0]?.message?.content || "";
    console.log("[extract-health-info] AI raw content preview:", raw.slice(0, 300));
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return json({ ok: false, error: "parse_failed", detail: "Nessun JSON trovato nella risposta", raw });
    }
    let parsed: any;
    try { parsed = JSON.parse(match[0]); }
    catch (e) {
      return json({ ok: false, error: "parse_failed", detail: e instanceof Error ? e.message : "JSON parse", raw });
    }

    return json({ ok: true, extracted: parsed });
  } catch (e) {
    console.error("[extract-health-info] unexpected error:", e);
    return json({ ok: false, error: "exception", detail: e instanceof Error ? e.message : String(e) });
  }
});
