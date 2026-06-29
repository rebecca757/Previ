import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useT, LanguageSwitcher } from "@/lib/i18n";

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
  const t = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setInviteCode("");
    setConfirmationSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        // Step 1: validate invite code
        if (!inviteCode.trim()) {
          toast.error(t("auth.inviteRequired"));
          return;
        }
        const { valid, exhausted } = await validateInviteCode(inviteCode);
        if (!valid) {
          toast.error(exhausted ? t("auth.inviteExhausted") : t("auth.inviteInvalid"));
          return;
        }

        // Step 2: create auth user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;

        // Step 3: consume the invite code now that the account exists
        await incrementInviteCodeUse(inviteCode);

        // Step 4: gate onboarding behind email confirmation.
        // With email confirmation enabled, signUp returns no session until the
        // user clicks the link in the confirmation email — so we DON'T send them
        // to onboarding yet. We only forward immediately if a session already
        // exists (i.e. email confirmation is disabled on the project).
        if (data.session) {
          toast.success(t("auth.createdOnboard"));
          navigate({ to: "/onboarding" });
        } else {
          toast.success(t("auth.createdConfirm"));
          setConfirmationSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("auth.genericError");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-hero grid place-items-center px-4">
      <div className="w-full max-w-md surface-soft rounded-2xl border p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold">P</div>
            <span className="font-semibold">Prevì</span>
          </Link>
          <LanguageSwitcher className="ml-auto" />
        </div>
        {confirmationSent ? (
          <div className="mt-2">
            <h1 className="text-2xl font-bold">{t("auth.confirmTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-3">{t("auth.confirmBody", { email })}</p>
            <p className="text-xs text-muted-foreground mt-3">{t("auth.confirmSpam")}</p>
            <Button className="w-full mt-6" onClick={() => switchMode("signin")}>
              {t("auth.confirmGoSignin")}
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{mode === "signup" ? t("auth.titleSignup") : t("auth.titleSignin")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signup" ? t("auth.subtitleSignup") : t("auth.subtitleSignin")}
            </p>

            <form onSubmit={submit} className="space-y-4 mt-6">
              <div>
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw">{t("common.password")}</Label>
                <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {mode === "signup" && (
                <div>
                  <Label htmlFor="invite">{t("auth.inviteLabel")}</Label>
                  <Input
                    id="invite"
                    type="text"
                    required
                    placeholder={t("auth.invitePlaceholder")}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    autoComplete="off"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.wait") : mode === "signup" ? t("auth.createAccount") : t("auth.signIn")}
              </Button>
            </form>

            <button
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              className="mt-6 text-sm text-muted-foreground hover:text-foreground w-full text-center"
            >
              {mode === "signup" ? t("auth.toggleToSignin") : t("auth.toggleToSignup")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
