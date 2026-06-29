import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Bell, Trash2, ShieldCheck, ChevronDown, ChevronUp, Info, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { OFFICIAL_SCREENINGS, getEligibleScreenings, frequencyLabel, normalizeCondition, getRelationDegree, type OfficialScreening } from "@/lib/screenings";

export const Route = createFileRoute("/prevenzione")({
  head: () => ({ meta: [{ title: "Prevenzione — Prevì" }] }),
  component: () => <AuthGate><AppShell><Prevention /></AppShell></AuthGate>,
});

type Rem = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  enabled: boolean;
  priority?: "urgent" | "normal" | null;
  priority_reason?: string | null;
  suggested_timeframe?: string | null;
  suggested_specialty?: string | null;
  source?: string | null;
  guideline_id?: string | null;
};

type FamilyHistoryRow = {
  id: string;
  relation: string;
  condition: string;
  condition_category: string | null;
  onset_age: number | null;
  relation_degree: "first" | "second" | null;
};

type PreventionScreening = OfficialScreening & {
  familyTrigger?: string | null;
};

function FamilyTriggerBadge({ trigger }: { trigger: string }) {
  return (
    <div
      className="mt-1 text-xs rounded-md px-2 py-1 inline-flex items-start gap-1"
      style={{ backgroundColor: "rgba(139,92,246,0.10)", color: "#6D28D9" }}
    >
      <span aria-hidden>💜</span>
      <span>
        Suggerito per la tua storia familiare: {trigger}
      </span>
    </div>
  );
}

function ScreeningCard({ s, hasReminder, adding, onAdd, userAge }: { s: PreventionScreening; hasReminder: boolean; adding: boolean; onAdd: () => void; userAge: number | null }) {
  const [open, setOpen] = useState(false);
  const trigger = s.familyTrigger ?? null;
  const showsStartingAge = trigger != null && userAge != null && userAge < s.age_min;
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderLeft: `4px solid ${trigger ? "#8B5CF6" : "#0F6E56"}` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{s.name}</span>
            {s.ssn_free ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Gratuito SSN</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">Privato</span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s.category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {frequencyLabel(s)}{showsStartingAge ? ` · a partire dai ${s.age_min} anni` : ""}
          </p>
          {trigger && <FamilyTriggerBadge trigger={trigger} />}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={open ? "Chiudi dettagli" : "Mostra dettagli"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Info className="w-4 h-4" />
          </Button>
          {hasReminder ? (
            <span className="text-xs text-primary inline-flex items-center gap-1">
              <Bell className="w-3 h-3" /> Aggiunto
            </span>
          ) : (
            <Button size="sm" variant="outline" disabled={adding} onClick={onAdd}>
              <Plus className="w-3 h-3 mr-1" />{adding ? "…" : "Aggiungi promemoria"}
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 rounded-lg bg-muted/40 border p-3 space-y-2 text-xs">
          <div>
            <div className="font-semibold text-foreground">A cosa serve</div>
            <p className="text-muted-foreground">{s.detail.a_cosa_serve}</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">A chi è utile</div>
            <p className="text-muted-foreground">{s.detail.a_chi_e_utile}</p>
            {trigger && (
              <p className="text-muted-foreground mt-1">
                Nel tuo caso è particolarmente rilevante per la tua storia familiare: {trigger}.
              </p>
            )}
          </div>
          <div>
            <div className="font-semibold text-foreground">Fonte ufficiale</div>
            <p className="text-muted-foreground">{s.detail.fonte}</p>
            {s.detail.fonte_url && (
              <a
                href={s.detail.fonte_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-primary underline underline-offset-2"
              >
                → Vai alla fonte ufficiale
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Prevention() {
  const { user } = useAuth();
  const { activeId, queryFilter, profileType, activeManagedProfile } = useActiveProfile();
  const uid = activeId || user?.id;
  const [rems, setRems] = useState<Rem[]>([]);
  const [profile, setProfile] = useState<{ date_of_birth: string | null; biological_sex: string | null } | null>(null);
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryRow[]>([]);
  const [addingScreening, setAddingScreening] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const reload = async () => {
    if (!uid || !queryFilter) return;

    // For new managed profiles, skip the profiles table query — use context data instead.
    const profilePromise = profileType === "new_managed"
      ? Promise.resolve({ data: null })
      : supabase.from("profiles").select("date_of_birth,biological_sex").eq("id", uid).maybeSingle();

    const [{ data: remsData }, { data: prof }, { data: fam }] = await Promise.all([
      supabase.from("reminders").select("*").eq(queryFilter.col as any, queryFilter.val),
      profilePromise,
      (supabase as any).from("family_history").select("id,relation,condition,condition_category,onset_age,relation_degree").eq(queryFilter.col as any, queryFilter.val),
    ]);
    const sorted = (remsData || []).slice().sort((a: { priority?: string | null; suggested_timeframe?: string | null }, b: { priority?: string | null; suggested_timeframe?: string | null }) => {
      const pa = a.priority === "urgent" ? 0 : 1;
      const pb = b.priority === "urgent" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.suggested_timeframe || "zz").localeCompare(b.suggested_timeframe || "zz");
    });
    setRems(sorted as Rem[]);
    // For new managed profiles, derive profile data from context.
    const profileData = profileType === "new_managed"
      ? { date_of_birth: activeManagedProfile?.date_of_birth ?? null, biological_sex: activeManagedProfile?.sex ?? null }
      : (prof as { date_of_birth: string | null; biological_sex: string | null } | null);
    setProfile(profileData);
    // Normalize family history rows: compute condition_category and relation_degree
    // from the raw text if the DB columns are null (old records or missing migration).
    const normalizedFam = (fam || []).map((row: any) => ({
      ...row,
      condition_category: row.condition_category || normalizeCondition(row.condition || ""),
      relation_degree: row.relation_degree || getRelationDegree(row.relation || ""),
    })) as FamilyHistoryRow[];
    setFamilyHistory(normalizedFam);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
    toast.success("Prevenzione aggiornata in base al tuo profilo");
  };

  useEffect(() => { reload(); }, [uid, queryFilter?.col, queryFilter?.val]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh on changes to family_history (realtime) and window focus.
  useEffect(() => {
    if (!uid || !queryFilter) return;
    const filterStr = `${queryFilter.col}=eq.${queryFilter.val}`;
    const channel = supabase
      .channel(`family_history:${queryFilter.col}:${queryFilter.val}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "family_history", filter: filterStr },
        () => { reload(); },
      )
      .subscribe();
    const onFocus = () => { reload(); };
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, queryFilter?.col, queryFilter?.val]);


  const userAge = useMemo(() => (
    profile?.date_of_birth
      ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null
  ), [profile?.date_of_birth]);
  const userSex = useMemo(() => (
    profile?.biological_sex === "F" || profile?.biological_sex === "M"
      ? (profile?.biological_sex as "F" | "M")
      : null
  ), [profile?.biological_sex]);

  const eligible = useMemo(
    () => getEligibleScreenings(userAge, userSex, familyHistory) as PreventionScreening[],
    [familyHistory, userAge, userSex],
  );
  const eligibleIds = useMemo(() => new Set(eligible.map((s) => s.id)), [eligible]);
  const notEligible = useMemo(() => OFFICIAL_SCREENINGS.filter((s) => !eligibleIds.has(s.id)), [eligibleIds]);

  async function addScreeningReminder(s: OfficialScreening) {
    if (!uid || !queryFilter) return;
    setAddingScreening(s.id);
    const { error } = await (supabase as unknown as { from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } }).from("reminders").insert({
      [queryFilter.col]: queryFilter.val,
      title: s.name,
      description: s.description,
      reason: s.note,
      suggested_specialty: null,
      suggested_timeframe: frequencyLabel(s),
      source: "ministry_guidelines",
      guideline_id: s.id,
      status: "active",
      priority: "normal",
      enabled: true,
    });
    setAddingScreening(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Promemoria aggiunto");
    reload();
  }

  async function toggle(r: Rem) {
    await supabase.from("reminders").update({ enabled: !r.enabled }).eq("id", r.id);
    reload();
  }
  async function del(id: string) {
    await supabase.from("reminders").delete().eq("id", id);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Prevenzione</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Aggiorna prevenzione"
              disabled={refreshing}
              onClick={handleRefresh}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">Basato esclusivamente su linee guida ufficiali italiane (Ministero della Salute, LEA, PNPV, ISS).</p>
        </div>
        <AddReminder onDone={reload} />
      </div>

      <section className="space-y-2">
        <div className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> I tuoi promemoria personali</div>
        {rems.length === 0 ? (
          <div className="bg-card border rounded-2xl p-10 text-center">
            <Bell className="w-10 h-10 text-primary mx-auto mb-3" />
            <div className="font-semibold">Nessun promemoria attivo</div>
            <p className="text-sm text-muted-foreground mt-1">Aggiungi uno degli screening qui sopra o crea un promemoria personalizzato.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rems.map((r) => {
              const urgent = r.priority === "urgent";
              return (
                <div
                  key={r.id}
                  className="bg-card border rounded-xl p-4 flex items-start gap-3 border-l-4"
                  style={{ borderLeftColor: urgent ? "#E05A2B" : "#0F6E56" }}
                >
                  <div
                    className="w-10 h-10 rounded-lg grid place-items-center"
                    style={urgent ? { backgroundColor: "rgba(224,90,43,0.12)", color: "#E05A2B" } : { backgroundColor: "rgba(15,110,86,0.12)", color: "#0F6E56" }}
                  >
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.title}</span>
                      {urgent ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(224,90,43,0.15)", color: "#E05A2B" }}>⚠️ Urgente</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">📅 Ordinario</span>
                      )}
                      {r.source === "ministry_guidelines" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Linea guida ufficiale</span>
                      )}
                    </div>
                    {r.description && <div className="text-sm text-muted-foreground">{r.description}</div>}
                    {urgent && r.priority_reason && (
                      <div className="text-xs mt-1" style={{ color: "#E05A2B" }}>
                        Ho classificato questo promemoria come urgente perché {r.priority_reason}.
                      </div>
                    )}
                    {r.due_date && <div className="text-xs text-muted-foreground mt-1">{format(new Date(r.due_date), "d MMMM yyyy", { locale: it })}</div>}
                  </div>
                  <Switch checked={r.enabled} onCheckedChange={() => toggle(r)} />
                  <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-card border rounded-2xl p-4 space-y-3">
        <div>
          <div className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Screening ufficiali per te</div>
          <div className="text-xs text-muted-foreground">Filtrati in base alla tua età e al tuo sesso biologico.</div>
        </div>
        {eligible.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
            Nessuno screening ufficiale applicabile al tuo profilo al momento. I suggerimenti si aggiornano automaticamente al variare della tua età.
          </div>
        ) : (
          <div className="space-y-2">
            {eligible.map((s) => (
              <ScreeningCard
                key={s.id}
                s={s}
                hasReminder={!!rems.find((r) => r.guideline_id === s.id)}
                adding={addingScreening === s.id}
                onAdd={() => addScreeningReminder(s)}
                userAge={userAge}
              />
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border rounded-2xl p-4 space-y-3">
        <Button variant="outline" className="w-full justify-between" onClick={() => setShowAll((v) => !v)}>
          <span>Vedi tutti gli screening disponibili</span>
          {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        {showAll && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground italic">
              Questi screening non si applicano al tuo profilo attuale ma potrebbero essere rilevanti in futuro o per familiari.
            </p>
            {notEligible.map((s) => (
              <ScreeningCard
                key={s.id}
                s={s}
                hasReminder={!!rems.find((r) => r.guideline_id === s.id)}
                adding={addingScreening === s.id}
                onAdd={() => addScreeningReminder(s)}
                userAge={userAge}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddReminder({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { activeId, queryFilter } = useActiveProfile();
  const uid = activeId || user?.id;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");

  async function save() {
    if (!uid || !queryFilter || !title) return;
    const { error } = await supabase.from("reminders").insert({
      [queryFilter.col]: queryFilter.val, title, description: desc || null, due_date: date || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Promemoria aggiunto");
    setOpen(false); setTitle(""); setDesc(""); setDate("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Aggiungi</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuovo promemoria</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Titolo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Descrizione</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <Button onClick={save} className="w-full">Salva</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
