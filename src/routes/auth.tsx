import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Accedi — Prevì" }] }),
  component: AuthPage,
});

async function validateInviteCode(code: string): Promise<{ valid: boolean; exhausted: boolean }> {
  const { data, error } = await (supabase as any)
    .from("invite_codes")
    .select("id, current_uses, max_uses, active")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .single();
  if (error || !data) return { valid: false, exhausted: false };
  if (data.current_uses >= data.max_uses) return { valid: false, exhausted: true };
  return { valid: true, exhausted: false };
}

async function incrementInviteCodeUse(code: string) {
  await (supabase as any).rpc("increment_invite_code", { code_text: code.toUpperCase().trim() });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setInviteCode("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        // Step 1: validate invite code
        if (!inviteCode.trim()) {
          toast.error("Inserisci il codice invito per registrarti.");
          return;
        }
        const { valid, exhausted } = await validateInviteCode(inviteCode);
        if (!valid) {
          toast.error(
            exhausted
              ? "Questo codice invito ha raggiunto il numero massimo di utilizzi. Contatta il team Prevì."
              : "Codice invito non valido. Controlla di averlo inserito correttamente."
          );
          return;
        }

        // Step 2: create auth user
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;

        // Step 3: increment invite code usage
        await incrementInviteCodeUse(inviteCode);

        // Step 4: proceed to onboarding
        toast.success("Account creato! Ora completa il tuo profilo.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-hero grid place-items-center px-4">
      <div className="w-full max-w-md surface-soft rounded-2xl border p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold">P</div>
          <span className="font-semibold">Prevì</span>
        </Link>
        <h1 className="text-2xl font-bold">{mode === "signup" ? "Crea il tuo account" : "Bentornato"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signup" ? "Bastano un'email e una password." : "Accedi al tuo assistente sanitario."}
        </p>

        <form onSubmit={submit} className="space-y-4 mt-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === "signup" && (
            <div>
              <Label htmlFor="invite">Codice invito</Label>
              <Input
                id="invite"
                type="text"
                required
                placeholder="Inserisci il codice che hai ricevuto"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Attendi…" : mode === "signup" ? "Crea account" : "Accedi"}
          </Button>
        </form>

        <button
          onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "signup" ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
        </button>
      </div>
    </div>
  );
}
