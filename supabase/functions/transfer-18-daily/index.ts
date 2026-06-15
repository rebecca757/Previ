// Daily check: when a managed user turns 18, revoke caregiver link and convert it to genetic.
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

    // Only links explicitly configured for "until_18" auto-transfer should age out.
    const { data: links } = await admin
      .from("family_links")
      .select("id,caregiver_user_id,managed_user_id,relation,management_type")
      .eq("link_type", "caregiver")
      .eq("status", "active")
      .eq("management_type", "until_18");

    if (!links?.length) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const managedIds = links.map((l: any) => l.managed_user_id);
    const { data: profs } = await admin.from("profiles").select("id,date_of_birth,full_name").in("id", managedIds);

    const now = Date.now();
    let processed = 0;
    for (const link of links) {
      const p = profs?.find((x: any) => x.id === link.managed_user_id);
      if (!p?.date_of_birth) continue;
      const ageYears = (now - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (ageYears < 18) continue;

      // Revoke caregiver link
      await admin.from("family_links").update({ status: "revoked" }).eq("id", link.id);

      // Create two-way genetic link if missing
      await admin.from("family_links").upsert([
        { caregiver_user_id: link.caregiver_user_id, managed_user_id: link.managed_user_id, relation: link.relation, link_type: "genetic", status: "active" },
        { caregiver_user_id: link.managed_user_id, managed_user_id: link.caregiver_user_id, relation: link.relation, link_type: "genetic", status: "active" },
      ], { onConflict: "caregiver_user_id,managed_user_id,link_type" });

      processed++;
    }

    return new Response(JSON.stringify({ processed }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
