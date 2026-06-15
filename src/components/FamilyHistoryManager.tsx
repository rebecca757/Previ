import { useEffect, useState } from "react";
import { normalizeCondition, getRelationDegree } from "@/lib/screenings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type FH = {
  id: string;
  relation: string;
  condition: string;
  onset_age: number | null;
  is_deceased: boolean;
  notes: string | null;
};

const RELATIONS = [
  "Madre", "Padre",
  "Nonno paterno", "Nonna paterna", "Nonno materno", "Nonna materna",
  "Fratello", "Sorella", "Zio/Zia", "Figlio/a",
];

const CONDITION_SUGGESTIONS = [
  "Ipertensione", "Diabete tipo 2", "Tumore al seno", "Tumore al colon",
  "Malattie cardiache", "Ictus", "Alzheimer", "Osteoporosi", "Depressione",
];

export function FamilyHistoryManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<FH[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FH | null>(null);
  const [relationMode, setRelationMode] = useState<"preset" | "custom">("preset");
  const [form, setForm] = useState({
    relation: "Madre",
    customRelation: "",
    condition: "",
    onset_age: "",
    is_deceased: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("family_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setItems((data || []) as FH[]);
  }
  useEffect(() => { load(); }, [user]);

  function openNew() {
    setEditing(null);
    setRelationMode("preset");
    setForm({ relation: "Madre", customRelation: "", condition: "", onset_age: "", is_deceased: false, notes: "" });
    setOpen(true);
  }
  function openEdit(f: FH) {
    setEditing(f);
    const preset = RELATIONS.includes(f.relation);
    setRelationMode(preset ? "preset" : "custom");
    setForm({
      relation: preset ? f.relation : "Madre",
      customRelation: preset ? "" : f.relation,
      condition: f.condition,
      onset_age: f.onset_age?.toString() || "",
      is_deceased: f.is_deceased,
      notes: f.notes || "",
    });
    setOpen(true);
  }

  async function save() {
    const relation = relationMode === "custom" ? form.customRelation.trim() : form.relation;
    if (!relation) return toast.error("Relazione richiesta");
    if (!form.condition.trim()) return toast.error("Condizione richiesta");
    setSaving(true);
    const conditionText = form.condition.trim();
    const conditionCategory = normalizeCondition(conditionText);
    const relationDegree = getRelationDegree(relation);
    const payload: any = {
      user_id: user!.id,
      relation,
      condition: conditionText,
      condition_category: conditionCategory,
      relation_degree: relationDegree,
      onset_age: form.onset_age ? parseInt(form.onset_age, 10) : null,
      is_deceased: form.is_deceased,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await (supabase as any).from("family_history").update(payload).eq("id", editing.id)
      : await (supabase as any).from("family_history").insert(payload);
    setSaving(false);
    if (error) return toast.error("Errore nel salvataggio");
    toast.success(editing ? "Aggiornato" : "Aggiunto");
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questa voce?")) return;
    await (supabase as any).from("family_history").delete().eq("id", id);
    load();
  }

  // Group by relation
  const grouped = items.reduce<Record<string, FH[]>>((acc, it) => {
    (acc[it.relation] = acc[it.relation] || []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base">Anamnesi familiare</Label>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi membro familiare
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
          Nessuna anamnesi familiare inserita. Le condizioni dei tuoi familiari aiutano Prevì a suggerirti prevenzione personalizzata.
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([rel, list]) => (
            <div key={rel} className="border rounded-lg p-3 bg-card">
              <div className="font-semibold flex items-center gap-2">
                <span>👤</span><span>{rel}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {list.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5">🏷️</span>
                    <div className="flex-1">
                      <span className="font-medium">{f.condition}</span>
                      {f.onset_age != null && (
                        <span className="text-muted-foreground"> · insorta a {f.onset_age} anni</span>
                      )}
                      {f.is_deceased && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Deceduto/a</span>
                      )}
                      {f.notes && <div className="text-xs text-muted-foreground">{f.notes}</div>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="w-4 h-4" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica anamnesi" : "Aggiungi familiare"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Relazione*</Label>
              {relationMode === "preset" ? (
                <Select
                  value={form.relation}
                  onValueChange={(v) => {
                    if (v === "__other__") setRelationMode("custom");
                    else setForm({ ...form, relation: v });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    <SelectItem value="__other__">Altro…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Specifica relazione"
                    value={form.customRelation}
                    onChange={(e) => setForm({ ...form, customRelation: e.target.value })}
                    maxLength={60}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRelationMode("preset")}>
                    Predefinite
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Condizione*</Label>
              <Input
                list="condition-suggestions"
                value={form.condition}
                placeholder="Es. Ipertensione"
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                maxLength={120}
              />
              <datalist id="condition-suggestions">
                {CONDITION_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Età di insorgenza</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={form.onset_age}
                  onChange={(e) => setForm({ ...form, onset_age: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Checkbox
                  id="deceased"
                  checked={form.is_deceased}
                  onCheckedChange={(v) => setForm({ ...form, is_deceased: !!v })}
                />
                <Label htmlFor="deceased" className="cursor-pointer">Deceduto/a</Label>
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={1000}
              />
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
