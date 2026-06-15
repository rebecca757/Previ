import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const nowIso = new Date().toISOString();

    // Find expired documents (including their storage paths)
    const { data: expiredDocs, error: docsErr } = await admin
      .from("documents")
      .select("id, user_id, title, file_path, scheduled_permanent_deletion_at")
      .not("deleted_at", "is", null)
      .lt("scheduled_permanent_deletion_at", nowIso);
    if (docsErr) throw docsErr;

    // Find expired health memories
    const { data: expiredMems, error: memsErr } = await admin
      .from("health_memories")
      .select("id, user_id, description, scheduled_permanent_deletion_at")
      .not("deleted_at", "is", null)
      .lt("scheduled_permanent_deletion_at", nowIso);
    if (memsErr) throw memsErr;

    const docIds = (expiredDocs || []).map((d: any) => d.id);
    const memIds = (expiredMems || []).map((m: any) => m.id);
    const filePaths = (expiredDocs || []).map((d: any) => d.file_path).filter(Boolean) as string[];

    // Audit log to function logs (collected by Supabase logging)
    console.log(JSON.stringify({
      event: "purge_trash",
      at: nowIso,
      documents_to_delete: (expiredDocs || []).map((d: any) => ({ id: d.id, user_id: d.user_id, title: d.title })),
      memories_to_delete: (expiredMems || []).map((m: any) => ({ id: m.id, user_id: m.user_id, description: m.description })),
      file_paths: filePaths,
    }));

    // Delete files from storage (batched)
    if (filePaths.length > 0) {
      const { error: rmErr } = await admin.storage.from("health-documents").remove(filePaths);
      if (rmErr) console.error("storage remove failed:", rmErr.message);
    }

    if (docIds.length > 0) {
      const { error } = await admin.from("documents").delete().in("id", docIds);
      if (error) throw error;
    }
    if (memIds.length > 0) {
      const { error } = await admin.from("health_memories").delete().in("id", memIds);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        deleted_documents: docIds.length,
        deleted_memories: memIds.length,
        deleted_files: filePaths.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("purge-trash error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
