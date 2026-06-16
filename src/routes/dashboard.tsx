import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { FileText, Bell, Plus, MessageCircle, FileDown, Pill } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { MonthlySummaryCard } from "@/components/MonthlySummaryCard";
import { SpecialistSummaryDialog } from "@/components/SpecialistSummaryDialog";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Home — Prevì" }] }),
  component: () => <AuthGate><AppShell><Dashboard /></AppShell></AuthGate>,
});

function Dashboard() {
  const { user } = useAuth();
  const { activeId, queryFilter, profileType, activeManagedProfile } = useActiveProfile();
  const uid = activeId || user?.id;
  const [name, setName] = useState("");
  const [docCount, setDocCount] = useState(0);
  const [lastBio, setLastBio] = useState<string | null>(null);
  const [reminders, setReminders] = useState<{ id: string; title: string; due_date: string | null }[]>([]);
  const [recent, setRecent] = useState<{ id: string; title: string; doc_type: string; created_at: string }[]>([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [urgentDismissed, setUrgentDismissed] = useState(false);
  const [trashSoonCount, setTrashSoonCount] = useState(0);
  const [specialistOpen, setSpecialistOpen] = useState(false);
  const [meds, setMeds] = useState<{ id: string; name: string; dosage: string | null; frequency: string | null; linked_condition_id: string | null }[]>([]);
  const [medConditions, setMedConditions] = useState<Record<string, string>>({});
  const [expiringMeds, setExpiringMeds] = useState<{ id: string; name: string; prescription_expiry: string }[]>([]);
  const [dismissedExpiry, setDismissedExpiry] = useState<Record<string, boolean>>({});


  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrgentDismissed(sessionStorage.getItem("urgentBannerDismissed") === "1");
      try {
        const raw = sessionStorage.getItem("expiryBannerDismissed");
        if (raw) setDismissedExpiry(JSON.parse(raw));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!uid || !queryFilter) return;
    (async () => {
      const [profileResult, { count }, { data: bio }, { data: rems }, { data: docs }, { count: urgent }] = await Promise.all([
        profileType === "new_managed"
          ? Promise.resolve({ data: null })
          : supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
        supabase.from("documents").select("*", { count: "exact", head: true }).eq(queryFilter.col as any, queryFilter.val).is("deleted_at", null),
        supabase.from("biometric_history").select("recorded_at").eq(queryFilter.col as any, queryFilter.val).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("reminders").select("id,title,due_date").eq(queryFilter.col as any, queryFilter.val).eq("enabled", true).order("due_date", { ascending: true }).limit(3),
        supabase.from("documents").select("id,title,doc_type,created_at").eq(queryFilter.col as any, queryFilter.val).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("reminders").select("*", { count: "exact", head: true }).eq(queryFilter.col as any, queryFilter.val).eq("enabled", true).eq("priority", "urgent"),
      ]);
      const displayName = profileType === "new_managed"
        ? activeManagedProfile?.name?.split(" ")[0]
        : (profileResult as any).data?.full_name?.split(" ")[0];
      setName(displayName || "");
      setDocCount(count || 0);
      setLastBio(bio?.recorded_at || null);
      setReminders(rems || []);
      setRecent(docs || []);
      setUrgentCount(urgent || 0);

      // Count items in trash with ≤ 7 days remaining
      const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: docSoon }, { count: memSoon }] = await Promise.all([
        supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq(queryFilter.col as any, queryFilter.val)
          .not("deleted_at", "is", null)
          .lte("scheduled_permanent_deletion_at", cutoff),
        (supabase as any)
          .from("health_memories")
          .select("*", { count: "exact", head: true })
          .eq(queryFilter.col as any, queryFilter.val)
          .not("deleted_at", "is", null)
          .lte("scheduled_permanent_deletion_at", cutoff),
      ]);
      setTrashSoonCount((docSoon || 0) + (memSoon || 0));

      const { data: medsData } = await supabase
        .from("medications")
        .select("id,name,dosage,frequency,linked_condition_id,prescription_expiry,status")
        .eq(queryFilter.col as any, queryFilter.val)
        .eq("active", true)
        .order("created_at", { ascending: false });
      const medsAll = (medsData || []) as any[];
      setMeds(medsAll.filter((m) => m.status !== "discontinued"));
      const now = new Date();
      const expiring = medsAll
        .filter((m) => m.status !== "discontinued" && m.prescription_expiry)
        .map((m) => ({ id: m.id, name: m.name, prescription_expiry: m.prescription_expiry as string, days: differenceInDays(new Date(m.prescription_expiry), now) }))
        .filter((m) => m.days >= 0 && m.days <= 30)
        .sort((a, b) => a.days - b.days)
        .map(({ id, name, prescription_expiry }) => ({ id, name, prescription_expiry }));
      setExpiringMeds(expiring);
      const condIds = Array.from(new Set(medsAll.map((m: any) => m.linked_condition_id).filter(Boolean)));
      if (condIds.length) {
        const { data: conds } = await supabase.from("health_conditions").select("id,name").in("id", condIds);
        const map: Record<string, string> = {};
        (conds || []).forEach((c: any) => { map[c.id] = c.name; });
        setMedConditions(map);
      } else {
        setMedConditions({});
      }
    })();
  }, [uid, queryFilter?.col, queryFilter?.val]);


  function dismissUrgent() {
    setUrgentDismissed(true);
    if (typeof window !== "undefined") sessionStorage.setItem("urgentBannerDismissed", "1");
  }
  function dismissExpiry(id: string) {
    setDismissedExpiry((prev) => {
      const next = { ...prev, [id]: true };
      if (typeof window !== "undefined") sessionStorage.setItem("expiryBannerDismissed", JSON.stringify(next));
      return next;
    });
  }
  const visibleExpiring = expiringMeds.filter((m) => !dismissedExpiry[m.id]).slice(0, 3);

  const daysSinceBio = lastBio ? differenceInDays(new Date(), new Date(lastBio)) : null;
  const showBioBanner = daysSinceBio === null || daysSinceBio >= 30;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ciao {name || "👋"}</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE d MMMM yyyy", { locale: it })}</p>
      </div>

      {urgentCount > 0 && !urgentDismissed && (
        <div
          className="rounded-xl border p-4 flex items-center justify-between gap-3"
          style={{ borderColor: "#E05A2B", backgroundColor: "rgba(224,90,43,0.08)" }}
        >
          <div className="text-sm" style={{ color: "#E05A2B" }}>
            ⚠️ Hai <strong>{urgentCount}</strong> promemoria urgent{urgentCount === 1 ? "e" : "i"}. Vuoi vederl{urgentCount === 1 ? "o" : "i"}?
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" style={{ backgroundColor: "#E05A2B", color: "white" }}>
              <Link to="/prevenzione">Vedi</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissUrgent}>Ignora</Button>
          </div>
        </div>
      )}

      {showBioBanner && (
        <div className="rounded-xl border bg-warning/10 border-warning/40 p-4 flex items-center justify-between">
          <div className="text-sm">
            <strong>È passato un mese</strong> — vuoi aggiornare peso e altezza?
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/profilo">Aggiorna</Link></Button>
        </div>
      )}

      {visibleExpiring.map((m) => (
        <div key={m.id} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-amber-900 dark:text-amber-200">
            ⚠️ La ricetta per <strong>{m.name}</strong> scade il <strong>{format(new Date(m.prescription_expiry), "d MMM yyyy", { locale: it })}</strong>. Ricordati di rinnovarla.
          </div>
          <Button size="sm" variant="ghost" onClick={() => dismissExpiry(m.id)}>Ignora</Button>
        </div>
      ))}

      {trashSoonCount > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-destructive">
            ⚠️ <strong>{trashSoonCount}</strong> element{trashSoonCount === 1 ? "o" : "i"} nel cestino verrann{trashSoonCount === 1 ? "à" : "o"} eliminat{trashSoonCount === 1 ? "o" : "i"} definitivamente entro 7 giorni.
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/archivio">Vai al cestino</Link></Button>
        </div>
      )}

      <MonthlySummaryCard />

      <div>
        <Button onClick={() => setSpecialistOpen(true)} variant="outline" className="w-full md:w-auto">
          <FileDown className="w-4 h-4 mr-2" />
          Genera riassunto per specialista
        </Button>
      </div>
      <SpecialistSummaryDialog open={specialistOpen} onOpenChange={setSpecialistOpen} />


      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MedicationsStatCard meds={meds} conditionNames={medConditions} />
        <StatCard icon={Bell} label="Promemoria attivi" value={String(reminders.length)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Attività recente">
          {recent.length === 0 ? (
            <Empty text="Nessuna attività ancora." />
          ) : (
            <ul className="space-y-2">
              {recent.map((d) => (
                <li key={d.id}>
                  <Link to="/referto/$id" params={{ id: d.id }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                    <FileText className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.doc_type}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{format(new Date(d.created_at), "d MMM", { locale: it })}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Prossimi promemoria">
          {reminders.length === 0 ? (
            <Empty text="Nessun promemoria attivo." />
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-2 rounded-lg">
                  <Bell className="w-4 h-4 text-primary" />
                  <div className="flex-1 text-sm">{r.title}</div>
                  {r.due_date && <div className="text-xs text-muted-foreground">{format(new Date(r.due_date), "d MMM", { locale: it })}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Link
        to="/archivio"
        className="md:hidden fixed bottom-safe-nav right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg z-30"
      >
        <Plus className="w-6 h-6" />
      </Link>
      <div className="hidden md:flex gap-3">
        <Button asChild><Link to="/archivio"><Plus className="w-4 h-4 mr-1" />Carica documento</Link></Button>
        <Button asChild variant="outline"><Link to="/assistente"><MessageCircle className="w-4 h-4 mr-1" />Chiedi all'AI</Link></Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <Icon className="w-4 h-4 text-primary mb-2" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{text}</div>;
}

function MedicationsStatCard({
  meds,
  conditionNames,
}: {
  meds: { id: string; name: string; dosage: string | null; frequency: string | null; linked_condition_id: string | null }[];
  conditionNames: Record<string, string>;
}) {
  const visible = meds.slice(0, 4);
  const extra = Math.max(0, meds.length - 4);
  return (
    <div className="bg-card border rounded-xl p-5 md:col-span-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          <div className="font-semibold text-sm">I tuoi farmaci</div>
        </div>
        <Link to="/profilo" className="text-xs text-primary hover:underline">Gestisci</Link>
      </div>
      {meds.length === 0 ? (
        <div className="text-sm text-muted-foreground py-3">
          Nessun farmaco registrato.{" "}
          <Link to="/profilo" className="text-primary hover:underline">Aggiungili nel profilo.</Link>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((m) => {
            const cond = m.linked_condition_id ? conditionNames[m.linked_condition_id] : null;
            return (
              <li key={m.id} className="text-sm flex items-center gap-2 flex-wrap">
                <span>
                  <span className="font-medium">{m.name}{m.dosage ? ` ${m.dosage}` : ""}</span>
                  {m.frequency ? <span className="text-muted-foreground"> — {m.frequency}</span> : null}
                </span>
                {cond && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                    {cond}
                  </span>
                )}
              </li>
            );
          })}
          {extra > 0 && (
            <li>
              <Link to="/profilo" className="text-xs text-primary hover:underline">e altri {extra}…</Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
