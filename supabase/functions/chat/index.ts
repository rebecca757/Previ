import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSystemPrompt } from "../_shared/prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOLS = [
  {
    name: "deactivate_reminder",
    description: "Disattiva un promemoria impostando enabled = false. Usare quando l'utente vuole disattivarlo (es. 'disattiva', 'non mi serve più', 'metti in pausa').",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "UUID del promemoria, estratto dal tag [rem:UUID] nel prompt di sistema" },
        title: { type: "string", description: "Titolo del promemoria, per la conferma all'utente" },
      },
      required: ["reminder_id", "title"],
    },
  },
  {
    name: "delete_reminder",
    description: "Elimina definitivamente un promemoria. Usare quando l'utente vuole eliminarlo, cancellarlo o rimuoverlo.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "UUID del promemoria, estratto dal tag [rem:UUID] nel prompt di sistema" },
        title: { type: "string", description: "Titolo del promemoria, per la conferma all'utente" },
      },
      required: ["reminder_id", "title"],
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages, active_user_id } = await req.json();
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Resolve target user: own profile, or a managed profile if caregiver
    let targetUserId = userData.user.id;
    if (active_user_id && active_user_id !== userData.user.id) {
      const { data: link } = await admin
        .from("family_links")
        .select("id")
        .eq("caregiver_user_id", userData.user.id)
        .eq("managed_user_id", active_user_id)
        .eq("link_type", "caregiver")
        .eq("status", "active")
        .maybeSingle();
      if (link) targetUserId = active_user_id;
    }

    const system = await buildSystemPrompt(targetUserId, SUPABASE_URL, SERVICE);

    // First call — Claude may reply normally or call a reminder tool
    const firstRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system,
        messages,
        tools: TOOLS,
      }),
    });

    if (!firstRes.ok) {
      if (firstRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit, riprova tra poco." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (firstRes.status === 402) return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await firstRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const firstJson = await firstRes.json();
    const toolUseBlock = (firstJson.content || []).find((b: any) => b.type === "tool_use");

    if (toolUseBlock) {
      const { id: toolUseId, name: toolName, input: toolInput } = toolUseBlock;
      const { reminder_id, title } = toolInput;

      // Execute the tool server-side
      let dbError: any = null;
      if (toolName === "deactivate_reminder") {
        ({ error: dbError } = await admin.from("reminders").update({ enabled: false }).eq("id", reminder_id).eq("user_id", targetUserId));
      } else if (toolName === "delete_reminder") {
        ({ error: dbError } = await admin.from("reminders").delete().eq("id", reminder_id).eq("user_id", targetUserId));
      }

      const toolResult = dbError ? `Errore: ${dbError.message}` : "Operazione completata con successo.";

      // Fallback reply if the second call fails
      let reply = dbError
        ? `Non sono riuscito a completare l'operazione: ${dbError.message}`
        : toolName === "deactivate_reminder"
          ? `Ho disattivato il promemoria "${title}".`
          : `Ho eliminato il promemoria "${title}".`;

      // Second call — Claude generates the confirmation reply
      const secondRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 256,
          system,
          messages: [
            ...messages,
            { role: "assistant", content: firstJson.content },
            { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: toolResult }] },
          ],
          tools: TOOLS,
        }),
      });

      if (secondRes.ok) {
        const secondJson = await secondRes.json();
        const textBlock = (secondJson.content || []).find((b: any) => b.type === "text");
        if (textBlock?.text) {
          // Claude might still output JSON — try to extract reply field
          try {
            const parsed = JSON.parse(textBlock.text);
            if (parsed.reply) reply = parsed.reply;
          } catch {
            reply = textBlock.text;
          }
        }
      }

      return new Response(JSON.stringify({
        reply,
        memory_suggestions: null,
        prevention_suggestion: null,
        reminder_action: null,
        memory_delete: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // No tool used — parse the JSON response as before
    const raw = (firstJson.content || []).find((b: any) => b.type === "text")?.text || "{}";
    let parsed: any = { reply: raw };
    try { parsed = JSON.parse(raw); } catch { /* fall back to raw text */ }

    let memorySuggestions: any[] | null = null;
    if (Array.isArray(parsed.memory_suggestions)) {
      memorySuggestions = parsed.memory_suggestions.filter(Boolean);
      if (memorySuggestions.length === 0) memorySuggestions = null;
    } else if (parsed.memory_suggestion) {
      memorySuggestions = [parsed.memory_suggestion];
    }

    return new Response(JSON.stringify({
      reply: parsed.reply || raw,
      memory_suggestions: memorySuggestions,
      prevention_suggestion: parsed.prevention_suggestion || null,
      reminder_action: parsed.reminder_action || null,
      memory_delete: parsed.memory_delete || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
