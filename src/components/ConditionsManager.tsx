import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";

type Condition = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
};

const schema = z.object({
  name: z.string().trim().min(1, "Nome richiesto").max(120),
  start_date: z.string().min(4, "Data di inizio richiesta").max(10),
  end_date: z.string().max(10).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

function fmtDate(d: string) {
  // accepts YYYY, YYYY-MM, YYYY-MM-DD
  if (/^\d{4}$/.test(d)) return d;
  if (/^\d{4}-\d{2}$/.test(d)) return format(new Date(d + "-01"), "MMM yyyy", { locale: it });
  try {
    return format(new Date(d), "d MMM yyyy", { locale: it });
  } catch {
    return d;
  }
}

export function ConditionsManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<Condition[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Condition | null>(null);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("health_conditions")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });
    setItems((data || []) as Condition[]);
  }

  useEffect(() => { load(); }, [user]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", start_date: "", end_date: "", notes: "" });
    setOpen(true);
  }
  function openEdit(c: Condition) {
    setEditing(c);
    setForm({
      name: c.name,
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      notes: c.notes || "",
    });
    setOpen(true);
  }

  async function save() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Dati non validi");
      return;
    }
    setSaving(true);
    const payload: any = {
      user_id: user!.id,
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date ? parsed.data.end_date : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("health_conditions").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("health_conditions").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio");
      return;
    }
    toast.success(editing ? "Condizione aggiornata" : "Condizione aggiunta");
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questa condizione?")) return;
    const { error } = await supabase.from("health_conditions").delete().eq("id", id);
    if (error) return toast.error("Errore");
    toast.success("Eliminata");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base">Condizioni croniche</Label>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi condizione
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
          Nessuna condizione registrata.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const active = c.status === "active";
            return (
              <li key={c.id} className="border rounded-lg p-3 flex items-start gap-3 bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{c.name}</div>
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded-full " +
                        (active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {active ? "Attiva" : "Risolta"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {c.end_date
                      ? `Dal ${fmtDate(c.start_date)} al ${fmtDate(c.end_date)}`
                      : `Dal ${fmtDate(c.start_date)}`}
                  </div>
                  {c.notes && <div className="text-sm mt-1 text-foreground/80">{c.notes}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica condizione" : "Aggiungi condizione"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome*</Label>
              <Input
                value={form.name}
                placeholder="Es. Ipertensione"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data di inizio*</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Anche approssimativa.</p>
              </div>
              <div>
                <Label>Data di fine</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Solo se risolta.</p>
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
