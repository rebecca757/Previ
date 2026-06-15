import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token: inviteToken, action } = await req.json();
    if (!inviteToken || !["accept", "decline"].includes(action)) {
      return new Response(JSON.stringify({ error: "Parametri non validi" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authToken = (req.headers.get("Authorization") || "").replace("Bearer ", "");

    const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: inv } = await admin.from("family_invites").select("*").eq("token", inviteToken).maybeSingle();
    if (!inv) return new Response(JSON.stringify({ error: "Invito non trovato" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    if (inv.status !== "pending") return new Response(JSON.stringify({ error: "Invito non più valido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    if (new Date(inv.expires_at) < new Date()) return new Response(JSON.stringify({ error: "Invito scaduto" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    if ((u.user.email || "").toLowerCase() !== inv.invitee_email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Email non corrispondente" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "decline") {
      await admin.from("family_invites").update({ status: "declined" }).eq("id", inv.id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Accept: create two-way genetic link
    await admin.from("family_links").insert([
      { caregiver_user_id: inv.inviter_user_id, managed_user_id: u.user.id, relation: inv.relation, link_type: "genetic", status: "active" },
      { caregiver_user_id: u.user.id, managed_user_id: inv.inviter_user_id, relation: inv.relation, link_type: "genetic", status: "active" },
    ]);
    await admin.from("family_invites").update({ status: "accepted" }).eq("id", inv.id);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
