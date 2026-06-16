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
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { ConditionsManager } from "@/components/ConditionsManager";
import { FamilyHistoryManager } from "@/components/FamilyHistoryManager";
import { MedicationsManager } from "@/components/MedicationsManager";
import { Trash2, Users, Check, Plus, X } from "lucide-react";

export const Route = createFileRoute("/profilo")({
  head: () => ({ meta: [{ title: "Profilo — Prevì" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <Profile />
      </AppShell>
    </AuthGate>
  ),
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
  useEffect(() => {
    load();
  }, [user]);

  async function saveStable() {
    setSaving(true);
    const tags = (s: string) =>
      s
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    const update = {
      full_name: p.full_name,
      blood_type: p.blood_type,
      biological_sex: p.biological_sex,
      allergies: Array.isArray(p.allergies) ? p.allergies : tags(p.allergies || ""),
      chronic_conditions: Array.isArray(p.chronic_conditions)
        ? p.chronic_conditions
        : tags(p.chronic_conditions || ""),
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
  const chartData = bio
    .filter((b) => b.weight_kg)
    .map((b) => ({
      date: format(new Date(b.recorded_at), "d MMM", { locale: it }),
      peso: parseFloat(b.weight_kg),
    }));

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Profilo</h1>

      <Section title="Dati stabili">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Nome e cognome</Label>
            <Input
              value={p.full_name || ""}
              onChange={(e) => setP({ ...p, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Data di nascita</Label>
            <Input type="date" value={p.date_of_birth || ""} disabled />
          </div>
          <div>
            <Label>Sesso biologico</Label>
            <Input
              value={p.biological_sex || ""}
              onChange={(e) => setP({ ...p, biological_sex: e.target.value })}
            />
          </div>
          <div>
            <Label>Gruppo sanguigno</Label>
            <Input
              value={p.blood_type || ""}
              onChange={(e) => setP({ ...p, blood_type: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Allergie (separate da virgola)</Label>
          <Textarea
            value={(p.allergies || []).join(", ")}
            onChange={(e) =>
              setP({ ...p, allergies: e.target.value.split(",").map((t: string) => t.trim()) })
            }
          />
        </div>
        <Button onClick={saveStable} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva modifiche"}
        </Button>
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

      <Section title="Account collegati">
        <LinkedAccountsManager />
      </Section>

      <Section title="Aggiornamento mensile">
        {daysSince !== null && daysSince >= 30 && (
          <div className="rounded-lg bg-warning/10 border border-warning/40 p-3 text-sm">
            Ultimo aggiornamento:{" "}
            {format(new Date(lastBio.recorded_at), "d MMMM yyyy", { locale: it })}. Vuoi aggiornare?
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div>
            <Label>Altezza (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={saveBio}>Aggiorna dati</Button>

        {chartData.length > 1 && (
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Impostazioni">
        <p className="text-sm text-muted-foreground">
          I tuoi dati sono protetti e accessibili solo a te. Prevì usa l'AI per aiutarti a
          comprendere — non sostituisce mai un medico.
        </p>
        <Button variant="outline" onClick={logout}>
          Esci
        </Button>
      </Section>
    </div>
  );
}

type AccountLink = {
  link_id: string;
  direction: "outgoing" | "incoming";
  counterpart_id: string;
  counterpart_email: string | null;
  counterpart_name: string | null;
  status: "pending" | "accepted";
  created_at: string;
};

function LinkedAccountsManager() {
  const { user } = useAuth();
  const { refresh } = useActiveProfile();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<AccountLink[]>([]);

  async function load() {
    if (!user) return;
    const { data, error } = await (supabase as any).rpc("list_account_links");
    if (error) {
      if (error.code === "42P01" || error.code === "42883") {
        console.error(
          "[LinkedAccounts] account_links non installato. Esegui supabase/migrations/20260616120000_account_links.sql",
        );
      } else {
        console.error("[LinkedAccounts] load error:", error.code, error.message);
      }
      setLinks([]);
      return;
    }
    setLinks((data || []) as AccountLink[]);
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [user?.id]);

  async function sendRequest() {
    const target = email.trim().toLowerCase();
    if (!target || !user) return;
    setBusy(true);
    try {
      const { data: targetId, error: lookupErr } = await (supabase as any).rpc(
        "find_user_by_email",
        { _email: target },
      );
      if (lookupErr) {
        if (lookupErr.code === "42883")
          toast.error("Funzione mancante. Applica lo script SQL su Supabase.");
        else toast.error(`Errore: ${lookupErr.message}`);
        return;
      }
      if (!targetId) {
        toast.error("Nessun utente registrato con questa email.");
        return;
      }
      if (targetId === user.id) {
        toast.error("Non puoi collegare il tuo stesso account.");
        return;
      }

      const { error: insErr } = await (supabase as any)
        .from("account_links")
        .insert({ owner_id: user.id, linked_user_id: targetId, status: "pending" });
      if (insErr) {
        if (insErr.code === "23505")
          toast.error("Hai già una richiesta o un collegamento con questo utente.");
        else if (insErr.code === "42P01")
          toast.error("Tabella account_links non trovata. Applica lo script SQL su Supabase.");
        else toast.error(`Errore: ${insErr.message}`);
        return;
      }
      toast.success("Richiesta inviata. L'altro utente deve accettarla.");
      setEmail("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function accept(link: AccountLink) {
    const { error } = await (supabase as any)
      .from("account_links")
      .update({ status: "accepted" })
      .eq("id", link.link_id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Richiesta accettata.");
    await load();
    refresh();
  }

  async function remove(link: AccountLink, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    const { error } = await (supabase as any).from("account_links").delete().eq("id", link.link_id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    await load();
    refresh();
  }

  const incoming = links.filter((l) => l.direction === "incoming" && l.status === "pending");
  const outgoing = links.filter((l) => l.direction === "outgoing");

  function label(l: AccountLink) {
    return l.counterpart_name || l.counterpart_email || "Utente";
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Inserisci l'email di un altro utente Prevì già registrato per richiedere l'accesso al suo
        account. Quando accetterà, potrai passare al suo profilo dal selettore in alto.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="email@esempio.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendRequest();
          }}
        />
        <Button onClick={sendRequest} disabled={busy || !email.trim()} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Collega
        </Button>
      </div>

      {incoming.length > 0 && (
        <div className="space-y-2">
          <Label className="text-base">Richieste ricevute</Label>
          {incoming.map((l) => (
            <div key={l.link_id} className="border rounded-xl p-3 bg-card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{label(l)}</div>
                <div className="text-xs text-muted-foreground">vuole accedere al tuo account</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" onClick={() => accept(l)}>
                  <Check className="w-4 h-4 mr-1" /> Accetta
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(l, "Rifiutare questa richiesta?")}
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-base">Account a cui hai accesso</Label>
        {outgoing.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
            Nessun account collegato. Inserisci un'email qui sopra per inviare una richiesta.
          </div>
        ) : (
          outgoing.map((l) => (
            <div key={l.link_id} className="border rounded-xl p-3 bg-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center text-white font-semibold text-sm shrink-0 bg-primary">
                {(label(l)[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{label(l)}</div>
                <div className="text-xs text-muted-foreground">
                  {l.status === "accepted" ? "Collegato" : "In attesa di conferma"}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() =>
                  remove(
                    l,
                    l.status === "accepted"
                      ? "Rimuovere questo collegamento?"
                      : "Annullare la richiesta?",
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
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
