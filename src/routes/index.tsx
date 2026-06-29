import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FolderHeart, Sparkles, ShieldCheck } from "lucide-react";
import { useT, LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prevì — Il tuo assistente sanitario personale" },
      { name: "description", content: "Organizza i tuoi documenti sanitari, comprendi i referti e ricevi consigli di prevenzione personalizzati." },
      { property: "og:title", content: "Prevì — Il tuo assistente sanitario personale" },
      { property: "og:description", content: "Organizza, comprendi e previeni con il tuo assistente sanitario AI." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const t = useT();
  useEffect(() => {
    // Show the landing page by default. Only forward visitors who are both
    // logged in AND already onboarded straight to their dashboard; everyone
    // else (logged out, or mid-onboarding) stays on the landing page.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.onboarded) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen gradient-hero">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-10 h-10 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold">P</div>
          <span className="font-semibold text-xl">Prevì</span>
          <LanguageSwitcher className="ml-auto" />
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
          {t("landing.tagline1")} <br />
          <span className="text-primary">{t("landing.tagline2")}</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          {t("landing.subtitle")}
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/auth">{t("landing.ctaStart")}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="rounded-full">
            <Link to="/auth">{t("landing.ctaHaveAccount")}</Link>
          </Button>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-4">
          {[
            { icon: FolderHeart, title: t("landing.f1Title"), text: t("landing.f1Text") },
            { icon: Sparkles, title: t("landing.f2Title"), text: t("landing.f2Text") },
            { icon: ShieldCheck, title: t("landing.f3Title"), text: t("landing.f3Text") },
          ].map((f) => (
            <div key={f.title} className="surface-soft rounded-2xl p-6 border">
              <f.icon className="w-6 h-6 text-primary mb-3" />
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
