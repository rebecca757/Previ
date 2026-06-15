import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { invitee_email, relation, link_type = "genetic" } = await req.json();
    if (!invitee_email || !relation) {
      return new Response(JSON.stringify({ error: "Campi mancanti" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");

    const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: inv, error } = await admin.from("family_invites").insert({
      inviter_user_id: u.user.id,
      invitee_email: invitee_email.toLowerCase(),
      relation,
      link_type,
    }).select().single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Best-effort: send a Supabase auth invite/magic link so the user can reach the app.
    // We don't fail if this errors — the invite URL can still be shared directly.
    try {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      const inviterName = prof?.full_name || "Un familiare";
      const acceptUrl = `${req.headers.get("origin") || ""}/accept-invite?token=${inv.token}`;
      await admin.auth.admin.inviteUserByEmail(invitee_email, {
        redirectTo: acceptUrl,
        data: { inviter_name: inviterName, invite_token: inv.token, relation },
      });
    } catch (_) { /* ignore - user may already exist */ }

    return new Response(JSON.stringify({ invite: inv }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
