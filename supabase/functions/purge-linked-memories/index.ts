// Daily purge: permanently delete health_memories that were linked to a document
// 24h ago and whose scheduled_deletion_at has elapsed. Before deletion, copy
// description / notes / body_part / event_date into the linked document so the
// information is preserved as "Ricordo di origine".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const nowIso = new Date().toISOString();
    const { data: due, error: fetchErr } = await admin
      .from("health_memories")
      .select("id,description,notes,body_part,event_date,linked_document_id")
      .not("scheduled_deletion_at", "is", null)
      .lt("scheduled_deletion_at", nowIso)
      .eq("kept_after_link", false)
      .is("deleted_at", null);
    if (fetchErr) throw fetchErr;

    let purged = 0;
    for (const m of due || []) {
      if (m.linked_document_id) {
        const memDescParts = [
          m.description,
          m.body_part ? `(${m.body_part})` : null,
          m.event_date ? `— ${String(m.event_date).slice(0, 10)}` : null,
        ].filter(Boolean);
        await admin
          .from("documents")
          .update({
            linked_memory_description: memDescParts.join(" "),
            linked_memory_notes: m.notes || null,
          })
          .eq("id", m.linked_document_id);
      }
      const { error: delErr } = await admin.from("health_memories").delete().eq("id", m.id);
      if (!delErr) purged++;
      else console.error("purge-linked-memories: delete failed", m.id, delErr.message);
    }

    return new Response(JSON.stringify({ purged }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
