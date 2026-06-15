import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, differenceInDays, differenceInYears } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { ConditionsManager } from "@/components/ConditionsManager";
import { FamilyHistoryManager } from "@/components/FamilyHistoryManager";
import { MedicationsManager } from "@/components/MedicationsManager";
import { AddManagedProfileModal } from "@/components/AddManagedProfileModal";
import { Pencil, Trash2, Users } from "lucide-react";
import type { NewManagedProfile } from "@/contexts/ActiveProfile";

export const Route = createFileRoute("/profilo")({
  head: () => ({ meta: [{ title: "Profilo — Prevì" }] }),
  component: () => <AuthGate><AppShell><Profile /></AppShell></AuthGate>,
});

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [bio, setBio] = useState<any[]>([]);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: prof }, { data: history }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("biometric_history").select("*").eq("user_id", user.id).order("recorded_at"),
    ]);
    setP(prof);
    setBio(history || []);
    const last = history?.[history.length - 1];
    if (last) {
      setWeight(last.weight_kg?.toString() || "");
      setHeight(last.height_cm?.toString() || "");
    }
  };
  useEffect(() => { load(); }, [user]);

  async function saveStable() {
    setSaving(true);
    const tags = (s: string) => s.split(",").map(t => t.trim()).filter(Boolean);
    const update = {
      full_name: p.full_name,
      blood_type: p.blood_type,
      biological_sex: p.biological_sex,
      allergies: Array.isArray(p.allergies) ? p.allergies : tags(p.allergies || ""),
      chronic_conditions: Array.isArray(p.chronic_conditions) ? p.chronic_conditions : tags(p.chronic_conditions || ""),
      medications: Array.isArray(p.medications) ? p.medications : tags(p.medications || ""),
      updated_at: new Date().toISOString(),
    };
    await supabase.from("profiles").update(update).eq("id", user!.id);
    setSaving(false);
    toast.success("Profilo aggiornato");
    load();
  }

  async function saveBio() {
    if (!user) return;
    await supabase.from("biometric_history").insert({
      user_id: user.id,
      weight_kg: weight ? parseFloat(weight) : null,
      height_cm: height ? parseFloat(height) : null,
    });
    toast.success("Dati aggiornati");
    load();
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (!p) return <div className="text-muted-foreground">Caricamento…</div>;

  const lastBio = bio[bio.length - 1];
  const daysSince = lastBio ? differenceInDays(new Date(), new Date(lastBio.recorded_at)) : null;
  const chartData = bio.filter(b => b.weight_kg).map(b => ({ date: format(new Date(b.recorded_at), "d MMM", { locale: it }), peso: parseFloat(b.weight_kg) }));

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Profilo</h1>

      <Section title="Dati stabili">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Nome e cognome</Label><Input value={p.full_name || ""} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
          <div><Label>Data di nascita</Label><Input type="date" value={p.date_of_birth || ""} disabled /></div>
          <div><Label>Sesso biologico</Label><Input value={p.biological_sex || ""} onChange={(e) => setP({ ...p, biological_sex: e.target.value })} /></div>
          <div><Label>Gruppo sanguigno</Label><Input value={p.blood_type || ""} onChange={(e) => setP({ ...p, blood_type: e.target.value })} /></div>
        </div>
        <div><Label>Allergie (separate da virgola)</Label><Textarea value={(p.allergies || []).join(", ")} onChange={(e) => setP({ ...p, allergies: e.target.value.split(",").map((t:string)=>t.trim()) })} /></div>
        <Button onClick={saveStable} disabled={saving}>{saving ? "Salvataggio…" : "Salva modifiche"}</Button>
      </Section>

      <Section title="Farmaci regolari">
        <MedicationsManager />
      </Section>

      <Section title="Condizioni croniche">
        <ConditionsManager />
      </Section>

      <Section title="Anamnesi Familiare">
        <FamilyHistoryManager />
      </Section>

      <Section title="Profili familiari">
        <ManagedProfilesManager />
      </Section>

      <Section title="Aggiornamento mensile">
        {daysSince !== null && daysSince >= 30 && (
          <div className="rounded-lg bg-warning/10 border border-warning/40 p-3 text-sm">
            Ultimo aggiornamento: {format(new Date(lastBio.recorded_at), "d MMMM yyyy", { locale: it })}. Vuoi aggiornare?
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Peso (kg)</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><Label>Altezza (cm)</Label><Input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
        </div>
        <Button onClick={saveBio}>Aggiorna dati</Button>

        {chartData.length > 1 && (
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="peso" stroke="var(--color-primary)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Impostazioni">
        <p className="text-sm text-muted-foreground">I tuoi dati sono protetti e accessibili solo a te. Prevì usa l'AI per aiutarti a comprendere — non sostituisce mai un medico.</p>
        <Button variant="outline" onClick={logout}>Esci</Button>
      </Section>
    </div>
  );
}

function ManagedProfilesManager() {
  const { user } = useAuth();
  const { newManagedProfiles, refreshNewManaged, setActiveMp } = useActiveProfile();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<NewManagedProfile | null>(null);

  async function remove(id: string) {
    if (!confirm("Eliminare questo profilo familiare? Tutti i dati associati verranno eliminati.")) return;
    await (supabase as any).from("managed_profiles").delete().eq("id", id);
    refreshNewManaged();
  }

  function ageLabel(dob: string | null) {
    if (!dob) return null;
    try {
      const a = differenceInYears(new Date(), new Date(dob));
      return `${a} ann${a === 1 ? "o" : "i"}`;
    } catch { return null; }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Profili che gestisci</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Gestisci la salute dei tuoi familiari dal tuo account</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setEditing(null); setAddOpen(true); }}>
          <Users className="w-4 h-4 mr-1" /> Aggiungi profilo
        </Button>
      </div>

      {newManagedProfiles.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
          Nessun profilo familiare. Aggiungine uno per gestire la salute di un familiare (genitore, figlio, coniuge…).
        </div>
      ) : (
        <div className="space-y-2">
          {newManagedProfiles.map((mp) => (
            <div key={mp.id} className="border rounded-xl p-3 bg-card flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full grid place-items-center text-white font-semibold text-sm shrink-0"
                style={{ backgroundColor: mp.avatar_color || "#0F6E56" }}
              >
                {mp.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{mp.name}</div>
                <div className="text-xs text-muted-foreground">
                  {mp.relation}
                  {ageLabel(mp.date_of_birth) && ` · ${ageLabel(mp.date_of_birth)}`}
                  {mp.blood_type && ` · ${mp.blood_type}`}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setActiveMp(mp.id)}>
                  Gestisci
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(mp); setAddOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(mp.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddManagedProfileModal
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setEditing(null); }}
        onDone={() => refreshNewManaged()}
        editing={editing}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-2xl p-5 md:p-6 space-y-4">
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </div>
  );
}
