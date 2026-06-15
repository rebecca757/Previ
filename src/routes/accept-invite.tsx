import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Invito Famiglia — Prevì" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || "" }),
  component: () => (
    <AuthGate>
      <AppShell>
        <Accept />
      </AppShell>
    </AuthGate>
  ),
});

function Accept() {
  const { token } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [inviter, setInviter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data: inv } = await supabase.from("family_invites").select("*").eq("token", token).maybeSingle();
      setInvite(inv);
      if (inv?.inviter_user_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", inv.inviter_user_id).maybeSingle();
        setInviter(p);
      }
      setLoading(false);
    })();
  }, [token]);

  async function respond(action: "accept" | "decline") {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-family-invite", { body: { token, action } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(action === "accept" ? "Collegamento creato" : "Invito rifiutato");
      navigate({ to: "/profilo" });
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Caricamento…</div>;
  if (!invite) return <div className="text-muted-foreground">Invito non trovato.</div>;
  if (invite.status !== "pending") return <div className="text-muted-foreground">Questo invito è {invite.status}.</div>;
  if (new Date(invite.expires_at) < new Date()) return <div className="text-muted-foreground">Questo invito è scaduto.</div>;

  const inviterName = inviter?.full_name || "Un familiare";
  const myEmail = user?.email?.toLowerCase();
  const matches = myEmail && myEmail === invite.invitee_email.toLowerCase();

  return (
    <div className="max-w-md mx-auto bg-card border rounded-2xl p-6 space-y-4">
      <h1 className="text-xl font-bold">Invito di famiglia</h1>
      <p className="text-sm">
        <strong>{inviterName}</strong> ti ha invitato a collegare i vostri profili su Prevì come <strong>{invite.relation}</strong>. Accettando, condividerete il contesto genetico per la prevenzione personalizzata.
      </p>
      {!matches && (
        <div className="text-xs text-warning-foreground bg-warning/10 p-3 rounded-lg">
          L'invito è stato inviato a <strong>{invite.invitee_email}</strong>. Accedi con quell'account per accettare.
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={() => respond("accept")} disabled={acting || !matches}>Accetta</Button>
        <Button variant="outline" onClick={() => respond("decline")} disabled={acting}>Rifiuta</Button>
      </div>
    </div>
  );
}
