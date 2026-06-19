import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSystemPrompt } from "../_shared/prompt.ts";
import { callClaude, toAnthropicContent } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BODY_SYSTEMS = [
  "Cuore / Sistema cardiovascolare",
  "Polmoni / Sistema respiratorio",
  "Cervello / Sistema neurologico",
  "Stomaco / Apparato digerente",
  "Intestino",
  "Fegato",
  "Reni / Apparato urinario",
  "Tiroide / Sistema endocrino",
  "Ginocchio",
  "Spalla",
  "Schiena / Colonna vertebrale",
  "Pelle",
  "Occhi",
  "Orecchie",
  "Apparato ginecologico",
  "Apparato urologico",
  "Sangue / Sistema ematologico",
  "Sistema immunitario",
  "Salute generale",
];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function filenameFromPath(path: string) {
  return path.split("/").pop() || "documento.pdf";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { document_id } = await req.json();
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: doc } = await admin
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!doc) return jsonResponse({ error: "Not found" }, 404);

    let fileBlock: any = null;
    if (doc.file_path) {
      try {
        const { data: fileBlob, error: downloadError } = await admin.storage
          .from("health-documents")
          .download(doc.file_path);
        if (downloadError) throw downloadError;

        const path = String(doc.file_path).toLowerCase();
        const contentType = (fileBlob.type || "").toLowerCase();
        const bytes = new Uint8Array(await fileBlob.arrayBuffer());
        const base64 = bytesToBase64(bytes);
        const isPdf = contentType.includes("pdf") || path.endsWith(".pdf");
        const isImage = contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(path);

        if (isPdf) {
          fileBlock = {
            type: "file",
            file: {
              filename: filenameFromPath(doc.file_path),
              file_data: `data:application/pdf;base64,${base64}`,
            },
          };
        } else if (isImage) {
          const mime = contentType || (path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".gif") ? "image/gif" : "image/jpeg");
          fileBlock = { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } };
        }
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    const system = await buildSystemPrompt(userData.user.id, SUPABASE_URL, SERVICE);
    const userPrompt = `Interpreta questo documento sanitario per la persona assistita.

Documento:
- Titolo: ${doc.title || "Documento sanitario"}
- Tipo: ${doc.doc_type || "non specificato"}
- Struttura: ${doc.facility_name || "non specificata"}
- Data documento: ${doc.document_date || doc.created_at || "non specificata"}

Scrivi in italiano chiaro, rassicurante e leggibile. Non fare diagnosi. Evidenzia cosa si capisce dal documento, eventuali valori o risultati importanti, cosa potrebbe essere utile chiedere al medico e quando rivolgersi a un professionista.

Alla fine aggiungi un blocco JSON markdown con questa forma esatta:
\`\`\`json
{"body_systems":["Salute generale"]}
\`\`\`

Il campo body_systems deve contenere da 1 a 4 organi/apparati/aree del corpo PERTINENTI al documento, scelti SOLO da questo elenco esatto: ${JSON.stringify(BODY_SYSTEMS)}.`;

    const userContent: any = fileBlock
      ? [{ type: "text", text: userPrompt }, fileBlock]
      : userPrompt;

    // Strip the chat "OUTPUT FORMAT (OBBLIGATORIO)" section from the shared
    // system prompt: it forces a JSON-only reply, which would suppress the
    // prose interpretation we want here. (Note: original code missed this
    // because it matched "OUTPUT FORMAT:" with a colon, which never occurs.)
    const docSystem = system
      .replace(/OUTPUT FORMAT[\s\S]*$/i, "")
      .replace(/[\s═]+$/, ""); // drop the trailing decorative rule line

    const ai = await callClaude({
      system: docSystem,
      messages: [{ role: "user", content: toAnthropicContent(userContent) }],
      max_tokens: 4096,
    });
    if (!ai.ok) {
      return jsonResponse({ error: "AI error", detail: ai.errorText }, ai.status || 500);
    }
    let interpretation: string = ai.text || "";

    let body_systems: string[] = [];
    const jsonMatch = interpretation.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.body_systems)) {
          body_systems = parsed.body_systems.filter((x: unknown) => typeof x === "string" && BODY_SYSTEMS.includes(x));
        }
        interpretation = interpretation.replace(jsonMatch[0], "").trim();
      } catch { /* ignore malformed trailing metadata */ }
    }

    // Safety net: if the model still returned a bare JSON object (e.g. the
    // chat-style {"reply": "..."}), unwrap the human-readable text so the
    // interpretation isn't a raw JSON blob.
    if (interpretation.startsWith("{")) {
      try {
        const obj = JSON.parse(interpretation);
        if (typeof obj.reply === "string" && obj.reply.trim()) interpretation = obj.reply.trim();
        if (body_systems.length === 0 && Array.isArray(obj.body_systems)) {
          body_systems = obj.body_systems.filter((x: unknown) => typeof x === "string" && BODY_SYSTEMS.includes(x as string));
        }
      } catch { /* not JSON — keep prose as-is */ }
    }

    const summary = interpretation.split("\n").find((line) => line.trim().length > 30)?.slice(0, 160) || interpretation.slice(0, 160);

    await admin.from("documents").update({
      ai_full_interpretation: interpretation,
      ai_summary: summary,
      ...(body_systems.length > 0 ? { body_systems } : {}),
    }).eq("id", document_id);

    return jsonResponse({ ok: true, interpretation, body_systems });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
