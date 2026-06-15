import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Pill, Link2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Condition = { id: string; name: string };
type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  linked_condition_id: string | null;
  reason: string | null;
  start_date: string | null;
  active: boolean;
  requires_prescription: boolean | null;
  prescription_type: string | null;
  prescription_expiry: string | null;
  status: string | null;
};

const FREQS = [
  "1 volta al giorno",
  "2 volte al giorno",
  "3 volte al giorno",
  "A settimane alterne",
  "Al bisogno",
  "Altro",
];

const CATEGORY_TO_CONDITION_HINT: Record<string, string> = {
  cardiovascular: "una condizione cardiovascolare",
  diabetes: "il diabete",
  thyroid: "una condizione della tiroide",
};

const schema = z.object({
  name: z.string().trim().min(2, "Nome del farmaco richiesto (min 2 caratteri)").max(120),
  dosage: z.string().max(60).optional().or(z.literal("")),
  frequency: z.string().max(60).optional().or(z.literal("")),
  linked_condition_id: z.string().nullable().optional(),
  reason: z.string().max(500).optional().or(z.literal("")),
  start_date: z.string().max(10).optional().or(z.literal("")),
});

function fmtDate(d: string | null) {
  if (!d) return null;
  try { return format(new Date(d), "d MMM yyyy", { locale: it }); } catch { return d; }
}

export function MedicationsManager({ onRequestAddCondition }: { onRequestAddCondition?: (prefillName?: string) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Medication[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState({
    name: "",
    dosage: "",
    frequency: "",
    linked_condition_id: null as string | null,
    reason: "",
    start_date: "",
    requires_prescription: false,
    prescription_type: "standard" as "standard" | "permanent",
    prescription_expiry: "",
    status: "active" as "active" | "suspended" | "discontinued",
  });
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; typical_condition: string | null; suggest_condition: boolean } | null>(null);

  async function load() {
    if (!user) return;
    const [{ data: meds }, { data: conds }] = await Promise.all([
      supabase.from("medications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("health_conditions").select("id,name").eq("user_id", user.id).order("start_date", { ascending: false }),
    ]);
    setItems((meds || []) as Medication[]);
    setConditions((conds || []) as Condition[]);
  }

  useEffect(() => { load(); }, [user]);

  function openNew() {
    setEditing(null);
    setForm({
      name: "", dosage: "", frequency: "", linked_condition_id: null, reason: "", start_date: "",
      requires_prescription: false, prescription_type: "standard", prescription_expiry: "", status: "active",
    });
    setAiSuggestion(null);
    setOpen(true);
  }

  function openEdit(m: Medication) {
    setEditing(m);
    setForm({
      name: m.name,
      dosage: m.dosage || "",
      frequency: m.frequency || "",
      linked_condition_id: m.linked_condition_id,
      reason: m.reason || "",
      start_date: m.start_date || "",
      requires_prescription: !!m.requires_prescription,
      prescription_type: (m.prescription_type === "permanent" ? "permanent" : "standard"),
      prescription_expiry: m.prescription_expiry || "",
      status: ((m.status as any) || "active"),
    });
    setAiSuggestion(null);
    setOpen(true);
  }

  // AI classification — debounced on name change
  useEffect(() => {
    const n = form.name.trim();
    if (!open || editing) return;
    if (n.length < 2) { setAiSuggestion(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setClassifying(true);
      try {
        const { data, error } = await supabase.functions.invoke("classify-medication", { body: { name: n } });
        if (cancelled) return;
        if (error || !data?.ok) { setAiSuggestion(null); return; }
        setAiSuggestion({ category: data.category, typical_condition: data.typical_condition, suggest_condition: !!data.suggest_condition });
      } finally {
        if (!cancelled) setClassifying(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.name, open, editing]);

  async function save() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message || "Dati non validi"); return; }
    setSaving(true);
    const payload: any = {
      user_id: user!.id,
      name: parsed.data.name,
      dosage: parsed.data.dosage ? parsed.data.dosage : null,
      frequency: parsed.data.frequency ? parsed.data.frequency : null,
      linked_condition_id: parsed.data.linked_condition_id || null,
      reason: parsed.data.reason ? parsed.data.reason : null,
      start_date: parsed.data.start_date ? parsed.data.start_date : null,
      requires_prescription: form.requires_prescription,
      prescription_type: form.requires_prescription ? form.prescription_type : null,
      prescription_expiry: form.requires_prescription && form.prescription_type === "standard" && form.prescription_expiry ? form.prescription_expiry : null,
      status: form.status,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("medications").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("medications").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Errore nel salvataggio"); return; }

    // Soft warning if AI suggests a chronic category but no matching condition exists.
    if (!editing && aiSuggestion?.suggest_condition && !payload.linked_condition_id && conditions.length === 0) {
      toast.message("Non hai nessuna condizione correlata nel tuo profilo. Vuoi aggiungerla?", {
        action: onRequestAddCondition ? { label: "Aggiungi", onClick: () => onRequestAddCondition(aiSuggestion.typical_condition || undefined) } : undefined,
      });
    }

    toast.success(editing ? "Farmaco aggiornato" : "Farmaco aggiunto");
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo farmaco?")) return;
    const { error } = await supabase.from("medications").delete().eq("id", id);
    if (error) return toast.error("Errore");
    toast.success("Eliminato");
    load();
  }

  const condById = (id: string | null) => conditions.find((c) => c.id === id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base">Farmaci regolari</Label>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi farmaco
        </Button>
      </div>

      {(() => {
        const discontinuedCount = items.filter((m) => m.status === "discontinued").length;
        const visible = items.filter((m) => showDiscontinued || m.status !== "discontinued");
        if (items.length === 0) {
          return (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
              Nessun farmaco registrato.
            </div>
          );
        }
        return (
          <>
            {discontinuedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Switch id="show-discontinued" checked={showDiscontinued} onCheckedChange={setShowDiscontinued} />
                <Label htmlFor="show-discontinued" className="cursor-pointer text-muted-foreground">
                  Mostra farmaci terminati ({discontinuedCount})
                </Label>
              </div>
            )}
            <ul className="space-y-2">
              {visible.map((m) => {
                const cond = condById(m.linked_condition_id);
                const isDiscontinued = m.status === "discontinued";
                const isSuspended = m.status === "suspended";
                const isRR = m.prescription_type === "permanent";
                let expiringSoon = false;
                if (m.prescription_expiry) {
                  const days = differenceInDays(new Date(m.prescription_expiry), new Date());
                  expiringSoon = days >= 0 && days <= 30;
                }
                return (
                  <li key={m.id} className="border rounded-lg p-3 flex items-start gap-3 bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill className="w-4 h-4 text-primary shrink-0" />
                        <div className={`font-semibold ${isDiscontinued ? "line-through text-muted-foreground" : ""}`}>
                          {m.name}{m.dosage ? ` ${m.dosage}` : ""}
                        </div>
                        {isRR && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30 font-medium">
                            RR
                          </span>
                        )}
                        {expiringSoon && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Ricetta in scadenza
                          </span>
                        )}
                        {isSuspended && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                            Sospeso
                          </span>
                        )}
                        {isDiscontinued && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border">
                            Terminato
                          </span>
                        )}
                      </div>
                      {m.frequency && <div className="text-sm text-muted-foreground mt-0.5">{m.frequency}</div>}
                      {cond && (
                        <div className="text-sm mt-1 inline-flex items-center gap-1 text-primary">
                          <Link2 className="w-3.5 h-3.5" /> Per: {cond.name}
                        </div>
                      )}
                      {m.reason && !cond && <div className="text-sm mt-1 text-foreground/80">{m.reason}</div>}
                      {m.start_date && <div className="text-xs text-muted-foreground mt-1">Dal {fmtDate(m.start_date)}</div>}
                      {m.prescription_expiry && (
                        <div className="text-xs text-muted-foreground mt-1">Ricetta scade il {fmtDate(m.prescription_expiry)}</div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica farmaco" : "Aggiungi farmaco"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome farmaco*</Label>
              <Input
                value={form.name}
                placeholder="es. Bisoprololo, Metformina, Vitamina D"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>

            {!editing && aiSuggestion?.suggest_condition && aiSuggestion.typical_condition && (
              <div className="rounded-lg bg-primary/5 border border-primary/30 p-3 text-sm">
                💡 Il {form.name.trim()} è tipicamente usato per <b>{aiSuggestion.typical_condition}</b>. Vuoi collegarlo a una condizione esistente o aggiungerne una nuova?
              </div>
            )}
            {!editing && classifying && (
              <div className="text-xs text-muted-foreground">Riconoscimento del farmaco in corso…</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dosaggio</Label>
                <Input
                  value={form.dosage}
                  placeholder="es. 5mg, 500mg, 1000UI"
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                  maxLength={60}
                />
              </div>
              <div>
                <Label>Frequenza</Label>
                <Select value={form.frequency || undefined} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                  <SelectContent>
                    {FREQS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Collega a una condizione</Label>
              <Select
                value={form.linked_condition_id || "__none__"}
                onValueChange={(v) => {
                  if (v === "__add__") {
                    if (onRequestAddCondition) onRequestAddCondition(aiSuggestion?.typical_condition || undefined);
                    else toast.message("Aggiungi la condizione dalla sezione 'Condizioni croniche' più in basso, poi torna qui per collegarla.");
                    return;
                  }
                  setForm({ ...form, linked_condition_id: v === "__none__" ? null : v });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuna</SelectItem>
                  {conditions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  <SelectItem value="__add__">+ Aggiungi nuova condizione</SelectItem>
                </SelectContent>
              </Select>
              {aiSuggestion?.suggest_condition && conditions.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  ⚠️ Non hai nessuna condizione correlata nel tuo profilo{aiSuggestion.typical_condition ? ` (${CATEGORY_TO_CONDITION_HINT[aiSuggestion.category] || "una condizione correlata"})` : ""}. Puoi aggiungerla.
                </p>
              )}
            </div>

            <div>
              <Label>Motivo (opzionale)</Label>
              <Input
                value={form.reason}
                placeholder="es. per il controllo della pressione"
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                maxLength={500}
              />
            </div>

            <div>
              <Label>Data di inizio</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="req-presc" className="cursor-pointer">Richiede ricetta</Label>
                <Switch
                  id="req-presc"
                  checked={form.requires_prescription}
                  onCheckedChange={(v) => setForm({ ...form, requires_prescription: v })}
                />
              </div>

              {form.requires_prescription && (
                <>
                  <div>
                    <Label>Tipo di ricetta</Label>
                    <RadioGroup
                      value={form.prescription_type}
                      onValueChange={(v) => setForm({ ...form, prescription_type: v as "standard" | "permanent" })}
                      className="mt-1 space-y-1"
                    >
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="standard" id="pt-standard" className="mt-1" />
                        <Label htmlFor="pt-standard" className="font-normal cursor-pointer">
                          Ricetta standard <span className="text-muted-foreground">(si rinnova periodicamente)</span>
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="permanent" id="pt-permanent" className="mt-1" />
                        <Label htmlFor="pt-permanent" className="font-normal cursor-pointer">
                          Ricetta permanente (RR) <span className="text-muted-foreground">(non scade)</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {form.prescription_type === "standard" && (
                    <div>
                      <Label>Data scadenza ricetta (opzionale)</Label>
                      <Input
                        type="date"
                        value={form.prescription_expiry}
                        onChange={(e) => setForm({ ...form, prescription_expiry: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Stato del farmaco</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Attivo</SelectItem>
                    <SelectItem value="suspended">Sospeso temporaneamente</SelectItem>
                    <SelectItem value="discontinued">Terminato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
