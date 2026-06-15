import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { full_name, date_of_birth, email, password, relation, management_type } = await req.json();
    if (!full_name || !date_of_birth || !email || !password || !relation) {
      return new Response(JSON.stringify({ error: "Campi mancanti" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const mgmt: "indefinite" | "until_18" = management_type === "until_18" ? "until_18" : "indefinite";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");

    const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const dob = new Date(date_of_birth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    // "until_18" requires a minor; "indefinite" works for any age (children, elderly, etc.)
    if (mgmt === "until_18" && age >= 18) {
      return new Response(JSON.stringify({ error: "La gestione fino alla maggiore età è disponibile solo per minori." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (cErr || !created.user) {
      return new Response(JSON.stringify({ error: cErr?.message || "Creazione fallita" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const managedId = created.user.id;

    await admin.from("profiles").upsert({ id: managedId, full_name, date_of_birth, onboarded: true, updated_at: new Date().toISOString() });

    const { error: lErr } = await admin.from("family_links").insert({
      caregiver_user_id: u.user.id,
      managed_user_id: managedId,
      relation,
      link_type: "caregiver",
      status: "active",
      management_type: mgmt,
    });
    if (lErr) {
      return new Response(JSON.stringify({ error: lErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ managed_user_id: managedId }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
