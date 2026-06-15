import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";


type Stats = {
  month: string;
  doc_count: number;
  memory_count: number;
  reminders_due_soon: number;
  reminders_urgent: number;
  weight_delta: number | null;
  weight_label: string;
  advice: string;
};

export function MonthlySummaryCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);


  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = format(new Date(), "MMMM", { locale: it });

  async function loadStored() {
    if (!user) return;
    const { data } = await supabase
      .from("monthly_summaries")
      .select("summary_text,generated_at,month")
      .eq("user_id", user.id)
      .eq("month", currentMonth)
      .maybeSingle();
    if (data?.summary_text) {
      try {
        setStats(JSON.parse(data.summary_text));
        setGeneratedAt(data.generated_at);
      } catch {
        // ignore
      }
    }
  }

  async function generate() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monthly-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore");
      setStats(json.stats);
      setGeneratedAt(new Date().toISOString());

    } catch (e: any) {
      setError(e?.message || "Errore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStored();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl border p-5 shadow-sm"
        style={{
          background: "linear-gradient(135deg, rgba(15,110,86,0.08), rgba(80,160,200,0.10))",
          borderColor: "rgba(15,110,86,0.2)",
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold capitalize">
              Il tuo riepilogo di {monthLabel}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">

            <Button size="sm" variant="ghost" onClick={generate} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {stats ? "Aggiorna" : "Genera"}
            </Button>
            {stats && (
              <Button size="sm" variant="ghost" onClick={() => setCollapsed((c) => !c)}>
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>

        {!stats && !loading && (
          <p className="text-sm text-muted-foreground mt-3">
            Genera il tuo primo riepilogo mensile per vedere un'analisi della tua salute negli ultimi 30 giorni.
          </p>
        )}

        {loading && !stats && (
          <p className="text-sm text-muted-foreground mt-3">Sto preparando il tuo riepilogo…</p>
        )}

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        {stats && !collapsed && (
          <div className="mt-4 space-y-3 text-sm">
            <Row icon="📁" label="Documenti" text={`Hai caricato ${stats.doc_count} document${stats.doc_count === 1 ? "o" : "i"} questo mese`} />
            <Row icon="🧠" label="Ricordi" text={`Hai aggiunto ${stats.memory_count} nuov${stats.memory_count === 1 ? "o ricordo" : "i ricordi"} di salute`} />
            <Row
              icon="⚠️"
              label="Promemoria"
              text={`Hai ${stats.reminders_due_soon} promemoria in scadenza, di cui ${stats.reminders_urgent} urgent${stats.reminders_urgent === 1 ? "e" : "i"}`}
            />
            <Row icon="⚖️" label="Biometria" text={`Il tuo peso è ${stats.weight_label} rispetto al mese scorso`} />
            {generatedAt && (
              <div className="text-xs text-muted-foreground pt-1">
                Aggiornato il {format(new Date(generatedAt), "d MMM yyyy, HH:mm", { locale: it })}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground px-1">
        Ricevi questo riepilogo ogni mese. Puoi aggiornare le preferenze nel profilo.
      </p>
    </div>
  );
}

function Row({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-base leading-6">{icon}</span>
      <div>
        <span className="font-medium">{label}: </span>
        <span className="text-foreground/80">{text}</span>
      </div>
    </div>
  );
}
