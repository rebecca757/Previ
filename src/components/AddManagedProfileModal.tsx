import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { NewManagedProfile } from "@/contexts/ActiveProfile";

const RELATIONS = [
  "Madre", "Padre", "Figlio", "Figlia",
  "Nonno", "Nonna", "Fratello", "Sorella",
  "Coniuge/Partner", "Altro",
];

const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "0+", "0−"];

const AVATAR_COLORS = [
  "#0F6E56", "#0891B2", "#7C3AED", "#B45309",
  "#BE185D", "#15803D", "#1D4ED8", "#9D174D",
];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  editing?: NewManagedProfile | null;
};

const EMPTY_FORM = {
  name: "",
  date_of_birth: "",
  sex: "",
  relation: "",
  blood_type: "",
  notes: "",
};

export function AddManagedProfileModal({ open, onOpenChange, onDone, editing }: Props) {
  const { ownId } = useActiveProfile();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: editing?.name ?? "",
    date_of_birth: editing?.date_of_birth ?? "",
    sex: editing?.sex ?? "",
    relation: editing?.relation ?? "",
    blood_type: editing?.blood_type ?? "",
    notes: editing?.notes ?? "",
  });

  function handleOpen(v: boolean) {
    if (!v) setForm(editing ? {
      name: editing.name,
      date_of_birth: editing.date_of_birth ?? "",
      sex: editing.sex ?? "",
      relation: editing.relation,
      blood_type: editing.blood_type ?? "",
      notes: editing.notes ?? "",
    } : EMPTY_FORM);
    onOpenChange(v);
  }

  async function save() {
    console.log("[AddManagedProfileModal.save] called — ownId:", ownId, "editing:", editing?.id ?? "new");

    if (!ownId) {
      toast.error("Sessione non caricata. Ricarica la pagina e riprova.");
      return;
    }

    if (!form.name.trim()) { toast.error("Nome richiesto"); return; }
    if (!form.sex) { toast.error("Sesso biologico richiesto"); return; }
    if (!form.relation) { toast.error("Relazione richiesta"); return; }
    if (!form.date_of_birth) { toast.error("Data di nascita richiesta"); return; }

    setSaving(true);
    try {
      const payload = {
        owner_user_id: ownId,
        name: form.name.trim(),
        date_of_birth: form.date_of_birth,
        sex: form.sex,
        relation: form.relation,
        blood_type: form.blood_type || null,
        notes: form.notes.trim() || null,
        avatar_color: editing?.avatar_color ?? randomColor(),
      };
      console.log("[AddManagedProfileModal.save] payload:", payload);

      const { error } = editing
        ? await (supabase as any).from("managed_profiles").update(payload).eq("id", editing.id)
        : await (supabase as any).from("managed_profiles").insert(payload);

      if (error) {
        console.error("[AddManagedProfileModal.save] DB error:", error.code, error.message);
        if (error.code === "42P01") {
          toast.error("Tabella managed_profiles non trovata. Applica la migrazione in Supabase Dashboard.");
        } else {
          toast.error(`Errore: ${error.message}`);
        }
        return;
      }

      console.log("[AddManagedProfileModal.save] success");
      toast.success(editing ? "Profilo aggiornato" : "Profilo familiare aggiunto");
      handleOpen(false);
      onDone();
    } catch (err) {
      console.error("[AddManagedProfileModal.save] unexpected:", err);
      toast.error("Errore imprevisto. Vedi la console per dettagli.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica profilo" : "Aggiungi profilo familiare"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label>Nome e cognome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Es. Maria Rossi"
              maxLength={80}
            />
          </div>

          <div>
            <Label>Relazione *</Label>
            <Select value={form.relation} onValueChange={(v) => setForm({ ...form, relation: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
              <SelectContent>
                {RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Sesso biologico *</Label>
            <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Femmina</SelectItem>
                <SelectItem value="M">Maschio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data di nascita *</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>

          <div>
            <Label>Gruppo sanguigno</Label>
            <Select value={form.blood_type} onValueChange={(v) => setForm({ ...form, blood_type: v })}>
              <SelectTrigger><SelectValue placeholder="Non specificato" /></SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((bt) => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Condizioni rilevanti, allergie note…"
              maxLength={500}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => handleOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Salvataggio…" : editing ? "Aggiorna profilo" : "Salva profilo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
