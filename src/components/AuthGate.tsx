import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

export function AuthGate({ children, requireOnboarded = true }: { children: ReactNode; requireOnboarded?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!requireOnboarded) {
      setChecking(false);
      return;
    }
    supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.onboarded) navigate({ to: "/onboarding" });
        else setChecking(false);
      });
  }, [user, loading, navigate, requireOnboarded]);

  if (loading || checking) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Caricamento…</div>;
  }
  return <>{children}</>;
}
