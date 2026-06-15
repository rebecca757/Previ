import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Brain, Link2, CheckCircle2, ShieldCheck, UserCircle2, Archive as ArchiveIcon, ArchiveRestore, Tag, X, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { it } from "date-fns/locale";
import { BODY_SYSTEMS } from "@/lib/body-systems";

export const Route = createFileRoute("/archivio")({
  head: () => ({ meta: [{ title: "Archivio — Prevì" }] }),
  component: () => <AuthGate><AppShell><Archive /></AppShell></AuthGate>,
});

const DOC_TYPES = ["Referto", "Esame del sangue", "Radiografia / Imaging", "Prescrizione", "Visita specialistica", "Certificato", "Altro"];

const EVENT_TYPES = [
  "Visita specialistica",
  "Esame del sangue / Analisi di laboratorio",
  "Radiografia / Imaging (RX, TAC, RMN, ecografia)",
  "Intervento chirurgico",
  "Ricovero ospedaliero",
  "Diagnosi",
  "Terapia / Farmaco",
  "Vaccinazione",
  "Altro",
];


type DocItem = { id: string; title: string; doc_type: string; document_date: string | null; source: string | null; facility_name: string | null; ai_summary: string | null; body_systems?: string[] | null; created_at: string; event_type?: string | null; facility_type?: string | null; doctor_name?: string | null; linked_memory_description?: string | null; linked_memory_notes?: string | null };
type Memory = { id: string; description: string; body_part: string | null; event_date: string | null; notes: string | null; linked_document_id: string | null; is_documented: boolean; status?: string | null; source?: string | null; body_systems?: string[] | null; created_at: string; event_type?: string | null; facility_name?: string | null; facility_type?: string | null; doctor_name?: string | null; scheduled_deletion_at?: string | null; kept_after_link?: boolean | null };

/** Clean any AI/JSON noise out of a free-text summary before display. */
function cleanSummary(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();

  // Try repeatedly to parse JSON (handles double-encoded / wrapped strings).
  for (let i = 0; i < 3; i++) {
    const trimmed = s.trim();
    if (!trimmed) break;
    const looksJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'));
    if (!looksJson) break;
    try {
      const obj = JSON.parse(trimmed);
      const pick = (o: any): string => {
        if (o == null) return "";
        if (typeof o === "string") return o;
        if (Array.isArray(o)) return o.map(pick).filter(Boolean).join(" ");
        if (typeof o === "object") {
          return (o.reply || o.summary || o.riassunto || o.text || o.content || o.message || pick(Object.values(o)[0])) ?? "";
        }
        return "";
      };
      const next = String(pick(obj) || "").trim();
      if (!next || next === s) break;
      s = next;
    } catch {
      break;
    }
  }

  // Salvage an embedded "reply"/"summary" key from a malformed/partial JSON fragment.
  const embed = s.match(/"(?:reply|summary|riassunto|text|content|message)"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (embed) {
    try { s = JSON.parse(`"${embed[1]}"`); } catch { s = embed[1]; }
  }

  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/[*_#`>]+/g, "");
  s = s.replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
  if (s.length > 120) s = s.slice(0, 117).trimEnd() + "...";
  return s;
}

type FilterKey = "all" | "documents" | "memories" | "verified" | "self" | "archived" | "cestino";

type TrashItem = {
  kind: "doc" | "mem";
  id: string;
  title: string;
  deleted_at: string;
  scheduled_permanent_deletion_at: string | null;
  file_path: string | null;
};

type TimelineItem =
  | { kind: "doc"; date: string; data: DocItem; linkedMemory?: Memory }
  | { kind: "mem"; date: string; data: Memory; linkedDoc?: DocItem };

function Archive() {
  const { user } = useAuth();
  const { activeId, queryFilter } = useActiveProfile();
  const uid = activeId || user?.id;
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [organFilter, setOrganFilter] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const reload = async () => {
    if (!uid || !queryFilter) return;
    const [{ data: d }, { data: m }, { data: td }, { data: tm }] = await Promise.all([
      supabase.from("documents").select("*").eq(queryFilter.col as any, queryFilter.val).is("deleted_at", null).order("created_at", { ascending: false }),
      (supabase as any).from("health_memories").select("*").eq(queryFilter.col as any, queryFilter.val).is("deleted_at", null).order("event_date", { ascending: false, nullsFirst: false }),
      supabase.from("documents").select("id,title,deleted_at,scheduled_permanent_deletion_at,file_path").eq(queryFilter.col as any, queryFilter.val).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
      (supabase as any).from("health_memories").select("id,description,deleted_at,scheduled_permanent_deletion_at").eq(queryFilter.col as any, queryFilter.val).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    ]);
    setDocs(d || []);
    setMemories((m as Memory[]) || []);
    const combined: TrashItem[] = [
      ...(((td as any[]) || []).map((x) => ({ kind: "doc" as const, id: x.id, title: x.title, deleted_at: x.deleted_at, scheduled_permanent_deletion_at: x.scheduled_permanent_deletion_at, file_path: x.file_path }))),
      ...(((tm as any[]) || []).map((x) => ({ kind: "mem" as const, id: x.id, title: x.description, deleted_at: x.deleted_at, scheduled_permanent_deletion_at: x.scheduled_permanent_deletion_at, file_path: null }))),
    ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    setTrash(combined);
  };
  useEffect(() => { reload(); }, [uid]);

  // Retroactive one-shot cleanup: scrub any rows whose summary/notes still hold raw JSON or "reply" payloads.
  useEffect(() => {
    if (!uid) return;
    const key = `archivio-summary-cleanup-v1:${uid}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;
    (async () => {
      try {
        const looksDirty = (v: string | null | undefined) => {
          if (!v) return false;
          const t = String(v).trim();
          return t.startsWith("{") || t.startsWith("[") || /"reply"|"riassunto"|"summary"|"content"/.test(t);
        };
        const [{ data: dDocs }, { data: dMems }] = await Promise.all([
          supabase.from("documents").select("id,ai_summary").eq(queryFilter!.col as any, queryFilter!.val),
          (supabase as any).from("health_memories").select("id,ai_summary,notes").eq(queryFilter!.col, queryFilter!.val),
        ]);
        for (const d of (dDocs || []) as any[]) {
          if (looksDirty(d.ai_summary)) {
            const cleaned = cleanSummary(d.ai_summary);
            await supabase.from("documents").update({ ai_summary: cleaned || null }).eq("id", d.id);
          }
        }
        for (const m of (dMems || []) as any[]) {
          const patch: any = {};
          if (looksDirty(m.ai_summary)) patch.ai_summary = cleanSummary(m.ai_summary) || null;
          if (looksDirty(m.notes)) patch.notes = cleanSummary(m.notes) || null;
          if (Object.keys(patch).length) {
            await (supabase as any).from("health_memories").update(patch).eq("id", m.id);
          }
        }
        if (typeof window !== "undefined") sessionStorage.setItem(key, "1");
      } catch (e) {
        console.warn("[archivio] retroactive summary cleanup failed", e);
      }
    })();
  }, [uid]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    const includeArchived = filter === "archived" || filter === "all";
    for (const d of docs) {
      const linkedMemory = memories.find((mm) => mm.linked_document_id === d.id);
      items.push({ kind: "doc", date: d.document_date || d.created_at, data: d, linkedMemory });
    }
    for (const m of memories) {
      if (m.status === "archived" && !includeArchived) continue;
      const linkedDoc = m.linked_document_id ? docs.find((d) => d.id === m.linked_document_id) : undefined;
      items.push({ kind: "mem", date: m.event_date || m.created_at, data: m, linkedDoc });
    }
    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const q = searchQuery.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "documents" && it.kind !== "doc") return false;
      if (filter === "memories" && !(it.kind === "mem" && it.data.status !== "archived")) return false;
      if (filter === "verified" && !((it.kind === "doc") || (it.kind === "mem" && !!it.data.linked_document_id))) return false;
      if (filter === "self" && !(it.kind === "mem" && !it.data.linked_document_id && it.data.status !== "archived")) return false;
      if (filter === "archived" && !(it.kind === "mem" && it.data.status === "archived")) return false;
      if (organFilter !== "__all__") {
        const tags = (it.data as any).body_systems as string[] | null | undefined;
        if (!tags || !tags.includes(organFilter)) return false;
      }
      if (q) {
        const d = it.data as any;
        const hay = [
          d.title, d.description, d.doc_type, d.event_type,
          d.facility_name, d.facility_type, d.doctor_name,
          d.notes, d.ai_summary, d.body_part,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, memories, filter, organFilter, searchQuery]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Tutto" },
    { key: "verified", label: "Verificati" },
    { key: "self", label: "Da verificare" },
    { key: "archived", label: "Archiviati" },
    { key: "cestino", label: `Cestino${trash.length ? ` (${trash.length})` : ""}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">La tua storia di salute</h1>
          <p className="text-sm text-muted-foreground">Una cronologia unica di tutti gli eventi sanitari.</p>
        </div>
        <div className="flex gap-2">
          <AddHealthInfoModal onDone={reload} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter !== "cestino" && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per nome, struttura o tipo di esame…"
              className="pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label="Cancella ricerca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">Organo / area del corpo</Label>
            <Select value={organFilter} onValueChange={setOrganFilter}>
              <SelectTrigger className="h-8 text-xs w-[280px] max-w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tutti gli organi</SelectItem>
                {BODY_SYSTEMS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            {organFilter !== "__all__" && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOrganFilter("__all__")}>
                <X className="w-3 h-3 mr-1" />Rimuovi filtro
              </Button>
            )}
          </div>
        </div>
      )}

      {filter === "cestino" ? (
        <TrashList items={trash} onChange={reload} />
      ) : timeline.length === 0 ? (
        <EmptyState
          title="La tua cronologia è vuota"
          text="Carica un documento o racconta un evento alla chat per iniziare."
        />
      ) : (
        <ol className="relative border-l-2 border-border ml-3 space-y-4">
          {timeline.map((it, idx) => (
            <li key={`${it.kind}-${it.data.id}-${idx}`} className="pl-5 relative">
              <span className={`absolute -left-[9px] top-3 w-4 h-4 rounded-full border-2 border-background ${it.kind === "doc" ? "bg-primary" : (it.data as Memory).linked_document_id ? "bg-primary/70" : "bg-warning"}`} />
              {it.kind === "doc" ? (
                <DocCard doc={it.data} linkedMemory={it.linkedMemory} onChange={reload} />
              ) : (
                <MemoryCard memory={it.data} linkedDoc={it.linkedDoc} docs={docs} onChange={reload} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function dateLabel(d?: string | null) {
  if (!d) return "Data non specificata";
  try { return format(new Date(d), "d MMMM yyyy", { locale: it }); } catch { return d; }
}

/** Soft-delete an item; show toast with a 5-second Annulla. */
async function softDeleteItem(table: "documents" | "health_memories", id: string, onChange: () => void) {
  const now = new Date();
  const purge = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error } = await (supabase as any)
    .from(table)
    .update({ deleted_at: now.toISOString(), scheduled_permanent_deletion_at: purge.toISOString() })
    .eq("id", id);
  if (error) { toast.error(error.message); return; }
  onChange();
  toast("Elemento spostato nel cestino. Verrà eliminato definitivamente tra 30 giorni.", {
    duration: 5000,
    action: {
      label: "Annulla",
      onClick: async () => {
        const { error: undoErr } = await (supabase as any)
          .from(table)
          .update({ deleted_at: null, scheduled_permanent_deletion_at: null })
          .eq("id", id);
        if (undoErr) { toast.error(undoErr.message); return; }
        toast.success("Eliminazione annullata");
        onChange();
      },
    },
  });
}

function ConfirmDeleteButton({ table, id, onChange }: { table: "documents" | "health_memories"; id: string; onChange: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive">
          <Trash2 className="w-3 h-3 mr-1" />Elimina
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare questo elemento?</AlertDialogTitle>
          <AlertDialogDescription>
            Sei sicuro di voler eliminare questo elemento? Verrà spostato nel cestino e eliminato definitivamente dopo 30 giorni.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={() => softDeleteItem(table, id, onChange)}>Elimina</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function daysRemaining(scheduled: string | null): number {
  if (!scheduled) return 30;
  return Math.max(0, differenceInCalendarDays(new Date(scheduled), new Date()));
}

function TrashList({ items, onChange }: { items: TrashItem[]; onChange: () => void }) {
  async function restore(item: TrashItem) {
    const table = item.kind === "doc" ? "documents" : "health_memories";
    const { error } = await (supabase as any).from(table).update({ deleted_at: null, scheduled_permanent_deletion_at: null }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Elemento ripristinato");
    onChange();
  }
  async function permanentDelete(item: TrashItem) {
    const table = item.kind === "doc" ? "documents" : "health_memories";
    if (item.kind === "doc" && item.file_path) {
      await supabase.storage.from("health-documents").remove([item.file_path]);
    }
    const { error } = await (supabase as any).from(table).delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminato definitivamente");
    onChange();
  }

  if (items.length === 0) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-muted grid place-items-center mx-auto mb-4">
          <Trash2 className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="font-semibold">Il cestino è vuoto.</div>
        <p className="text-sm text-muted-foreground mt-1">Gli elementi eliminati appaiono qui per 30 giorni.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const days = daysRemaining(item.scheduled_permanent_deletion_at);
        const urgent = days <= 7;
        const Icon = item.kind === "doc" ? FileText : Brain;
        return (
          <li key={`${item.kind}-${item.id}`} className="bg-card border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted grid place-items-center shrink-0">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Eliminato il {dateLabel(item.deleted_at)}
                </div>
                <div className={`text-xs mt-0.5 ${urgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  Verrà eliminato definitivamente tra {days} {days === 1 ? "giorno" : "giorni"}
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => restore(item)}>
                    <RotateCcw className="w-3 h-3 mr-1" />Ripristina
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-destructive">
                        <Trash2 className="w-3 h-3 mr-1" />Elimina definitivamente
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => permanentDelete(item)}>Elimina definitivamente</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DocCard({ doc, linkedMemory, onChange }: { doc: DocItem; linkedMemory?: Memory; onChange: () => void }) {
  return (
    <div className="block bg-card border rounded-xl p-4 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <Link to="/referto/$id" params={{ id: doc.id }} className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
          <FileText className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30"><ShieldCheck className="w-3 h-3 mr-1" />Verificato</Badge>
            <Badge variant="outline" className="text-[10px]"><FileText className="w-3 h-3 mr-1" />Con documento</Badge>
            {doc.source && <Badge variant="outline" className="text-[10px]">{doc.source}</Badge>}
          </div>
          <Link to="/referto/$id" params={{ id: doc.id }} className="block">
            <div className="font-medium truncate mt-1">{doc.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {doc.doc_type} • {dateLabel(doc.document_date)}
              {doc.facility_name ? ` • ${doc.facility_name}` : ""}
            </div>
            {(() => { const s = cleanSummary(doc.ai_summary); return <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s || "Nessuna nota aggiunta."}</p>; })()}
          </Link>
          <BodySystemTags table="documents" id={doc.id} tags={doc.body_systems || []} onChange={onChange} />
          {linkedMemory && (
            <div className="mt-2 text-xs text-primary flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Collegato a: {linkedMemory.description}
            </div>
          )}
          {!linkedMemory && doc.linked_memory_description && (
            <div className="mt-2 rounded-md bg-muted/50 border border-border/50 px-2 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Ricordo di origine:</span> {doc.linked_memory_description}
              {doc.linked_memory_notes && <div className="mt-0.5 italic">{doc.linked_memory_notes}</div>}
            </div>
          )}
          <div className="mt-3 flex gap-2 flex-wrap">
            <ConfirmDeleteButton table="documents" id={doc.id} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ memory, linkedDoc, docs, onChange }: { memory: Memory; linkedDoc?: DocItem; docs: DocItem[]; onChange: () => void }) {
  const archived = memory.status === "archived";
  const documented = !!memory.linked_document_id;
  const hoursLeft = memory.scheduled_deletion_at && !memory.kept_after_link
    ? Math.max(0, Math.round((new Date(memory.scheduled_deletion_at).getTime() - Date.now()) / 36e5))
    : null;
  const showAutoDeleteBanner = documented && hoursLeft !== null && !memory.kept_after_link;

  async function archive() {
    const { error } = await (supabase as any).from("health_memories").update({ status: "archived" }).eq("id", memory.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ricordo archiviato");
    onChange();
  }
  async function restore() {
    const { error } = await (supabase as any).from("health_memories").update({ status: documented ? "linked_to_document" : "active" }).eq("id", memory.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ricordo ripristinato");
    onChange();
  }
  async function unlink() {
    const { error } = await (supabase as any).from("health_memories").update({ linked_document_id: null }).eq("id", memory.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento scollegato — l'evento torna da verificare");
    onChange();
  }
  async function keepForever() {
    const { error } = await (supabase as any).from("health_memories").update({ kept_after_link: true, scheduled_deletion_at: null }).eq("id", memory.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ricordo mantenuto");
    onChange();
  }

  return (
    <div className={`rounded-xl p-4 ${archived ? "bg-muted/30 border border-dashed opacity-70" : documented ? "bg-card border" : "bg-muted/40 border-2 border-dashed"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${documented ? "bg-primary/10 text-primary" : "bg-warning/20 text-warning-foreground"}`}>
          <Brain className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {archived ? (
              <Badge variant="outline" className="text-[10px]"><ArchiveIcon className="w-3 h-3 mr-1" />Archiviato</Badge>
            ) : documented ? (
              <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/40"><ShieldCheck className="w-3 h-3 mr-1" />Verificato</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-warning/20 text-warning-foreground border-warning/40"><UserCircle2 className="w-3 h-3 mr-1" />Da verificare</Badge>
            )}
          </div>
          <div className="font-medium mt-1">{memory.description}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {memory.body_part || "Parte del corpo non specificata"} • {dateLabel(memory.event_date)}
          </div>
          {(() => {
            const noteClean = cleanSummary(memory.notes);
            const sumClean = cleanSummary((memory as any).ai_summary);
            const final = noteClean || sumClean || "Nessuna nota aggiunta.";
            return <p className="text-xs text-muted-foreground mt-2">{final}</p>;
          })()}
          <BodySystemTags table="health_memories" id={memory.id} tags={memory.body_systems || []} onChange={onChange} />
          {linkedDoc && (
            <Link to="/referto/$id" params={{ id: linkedDoc.id }} className="mt-2 text-xs text-primary flex items-center gap-1 hover:underline">
              <Link2 className="w-3 h-3" /> Documento allegato: {linkedDoc.title}
            </Link>
          )}
          {showAutoDeleteBanner && (
            <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs flex items-start gap-2">
              <div className="flex-1">
                Questo ricordo verrà eliminato automaticamente tra <strong>{hoursLeft} or{hoursLeft === 1 ? "a" : "e"}</strong>, ora che è collegato a un documento. Le informazioni saranno conservate nel documento.
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={keepForever}>Mantieni comunque</Button>
            </div>
          )}
          <div className="mt-3 flex gap-2 flex-wrap">
            {!archived && !documented && <LinkDocumentModal memory={memory} docs={docs} onDone={onChange} />}
            {!archived && documented && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={unlink}>Scollega documento</Button>
            )}
            {!archived ? (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={archive}><ArchiveIcon className="w-3 h-3 mr-1" />Archivia</Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={restore}><ArchiveRestore className="w-3 h-3 mr-1" />Ripristina</Button>
            )}
            <ConfirmDeleteButton table="health_memories" id={memory.id} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-card border rounded-2xl p-10 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 grid place-items-center mx-auto mb-4">
        <FileText className="w-7 h-7 text-primary" />
      </div>
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{text}</p>
    </div>
  );
}

const BODY_PARTS = ["Ginocchio", "Schiena", "Cuore", "Testa", "Addome", "Spalla", "Caviglia", "Altro"];

const EVENT_TYPE_MAP: Record<string, string> = {
  "Visita specialistica": "Visita specialistica",
  "Esame del sangue / Analisi di laboratorio": "Esame del sangue / Analisi di laboratorio",
  "Radiografia / Imaging": "Radiografia / Imaging (RX, TAC, RMN, ecografia)",
  "Radiografia / Imaging (RX, TAC, RMN, ecografia)": "Radiografia / Imaging (RX, TAC, RMN, ecografia)",
  "Intervento chirurgico": "Intervento chirurgico",
  "Ricovero ospedaliero": "Ricovero ospedaliero",
  "Diagnosi": "Diagnosi",
  "Terapia / Farmaco": "Terapia / Farmaco",
  "Vaccinazione": "Vaccinazione",
  "Altro": "Altro",
};

function AddHealthInfoModal({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { activeId, queryFilter } = useActiveProfile();
  const uid = activeId || user?.id;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "analyzing" | "preview">("input");

  // Step 1
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  // Strict single-state for banner: 'success' shows green, 'error' shows red. Never both.
  const [extractionStatus, setExtractionStatus] = useState<"success" | "error" | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);

  // Step 3 (editable preview)
  const [eventType, setEventType] = useState<string>("");
  const [bodyPart, setBodyPart] = useState("");
  const [facility, setFacility] = useState("");
  const [facilityType, setFacilityType] = useState<"public" | "private">("public");
  const [doctorName, setDoctorName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  // Track which fields were auto-filled by AI for the ✨ icons
  const [aiFilled, setAiFilled] = useState<Record<string, boolean>>({});

  // Uploaded file path (set during analyze if a file is present)
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep("input");
    setTitle(""); setNotes(""); setFile(null);
    setInputError(null); setAnalyzeError(null); setExtractStatus(null);
    setExtractionStatus(null);
    setEventType(""); setBodyPart(""); setFacility(""); setFacilityType("public");
    setDoctorName(""); setDate(new Date().toISOString().slice(0, 10)); setSummary("");
    setAiFilled({});
    setUploadedPath(null); setUploadedUrl(null);
  }

  async function analyze() {
    if (!uid) return;
    // Clear ALL previous banner state before starting a new attempt.
    setInputError(null);
    setAnalyzeError(null);
    setExtractStatus(null);
    setExtractionStatus(null);
    setAiFilled({});
    if (!title.trim() && !notes.trim() && !file) {
      setInputError("Aggiungi almeno un'informazione per continuare.");
      return;
    }
    setStep("analyzing");
    try {
      // 1) Upload the file (if any) to storage so we can persist it on save
      let path: string | null = uploadedPath;
      let url: string | null = uploadedUrl;
      if (file && !path) {
        const p = `${uid}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("health-documents").upload(p, file);
        if (upErr) throw upErr;
        const { data: urlData } = await supabase.storage.from("health-documents").createSignedUrl(p, 60 * 60 * 24 * 365);
        path = p;
        url = urlData?.signedUrl || null;
        setUploadedPath(p);
        setUploadedUrl(url);
      }

      // 2) Build the AI input: extracted text and/or image data URL
      let extractedText = "";
      let imageDataUrl: string | null = null;

      if (file) {
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        console.log("[archivio] file selected:", { name: file.name, type: file.type, size: file.size, isPdf });
        const { extractTextFromPDF, renderPdfFirstPageToDataUrl, fileToDataUrl } = await import("@/lib/pdf-extract");
        setExtractStatus("Lettura documento…");
        if (isPdf) {
          try {
            extractedText = await extractTextFromPDF(file);
            console.log("[archivio] PDF text extracted, length:", extractedText.length);
          } catch (err) {
            console.error("[archivio] PDF text extraction failed:", err);
            extractedText = "";
          }
          if (!extractedText || extractedText.length < 10) {
            console.log("[archivio] insufficient text → falling back to image render");
            try {
              imageDataUrl = await renderPdfFirstPageToDataUrl(file);
              console.log("[archivio] rendered PDF first page as image, bytes:", imageDataUrl.length);
            } catch (err) {
              console.error("[archivio] PDF image render failed:", err);
              imageDataUrl = null;
            }
          }
        } else {
          imageDataUrl = await fileToDataUrl(file);
          console.log("[archivio] image data URL bytes:", imageDataUrl.length);
        }
        setExtractStatus(null);
      }

      // 3) Call the AI with the extracted text (and/or image fallback)
      console.log("[archivio] invoking extract-health-info", {
        hasTitle: !!title.trim(),
        hasNotes: !!notes.trim(),
        extractedTextLength: extractedText.length,
        hasImage: !!imageDataUrl,
      });
      const { data, error } = await supabase.functions.invoke("extract-health-info", {
        body: {
          title: title.trim() || null,
          notes: notes.trim() || null,
          extracted_text: extractedText || null,
          image_data_url: imageDataUrl,
        },
      });
      console.log("[archivio] extract-health-info response:", { data, error });

      // If the function returned non-2xx, try to read the response body for the real error
      let payload: any = data;
      if (error) {
        try {
          const resp = (error as any)?.context?.response;
          if (resp && typeof resp.json === "function") {
            payload = await resp.json();
            console.error("[archivio] edge function error body:", payload);
          } else {
            console.error("[archivio] edge function error (no body):", error);
          }
        } catch (readErr) {
          console.error("[archivio] failed to read error body:", readErr);
        }
      }

      if (!payload?.ok) {
        const detail = payload?.detail || payload?.error || (error as any)?.message || "Errore sconosciuto";
        throw new Error(`[${payload?.error || "edge_error"}] ${detail}`);
      }

      const ex = payload.extracted;
      if (!ex || typeof ex !== "object") throw new Error("Risposta AI senza campo 'extracted'");

      const filled: Record<string, boolean> = {};
      const newTitle = (ex.titolo && String(ex.titolo).trim()) || title;
      if (ex.titolo && String(ex.titolo).trim() && !title) filled.title = true;
      setTitle(newTitle);
      const mapped = EVENT_TYPE_MAP[ex.tipo_evento] || "";
      if (mapped) filled.eventType = true;
      setEventType(mapped);
      if (ex.parte_del_corpo) filled.bodyPart = true;
      setBodyPart(ex.parte_del_corpo || "");
      if (ex.struttura_sanitaria) filled.facility = true;
      setFacility(ex.struttura_sanitaria || "");
      setFacilityType(ex.tipo_struttura === "privata" ? "private" : "public");
      if (ex.medico) filled.doctorName = true;
      setDoctorName(ex.medico || "");
      if (ex.data_evento) filled.date = true;
      setDate(ex.data_evento || new Date().toISOString().slice(0, 10));
      if (ex.riassunto) filled.summary = true;
      setSummary(cleanSummary(ex.riassunto || ""));
      setAiFilled(filled);
      // Success requires that at least one structured field was filled by the AI.
      if (Object.keys(filled).length === 0) {
        throw new Error("L'AI non ha estratto alcun campo dal documento.");
      }
      setAnalyzeError(null);
      setExtractionStatus("success");
      setStep("preview");
    } catch (e) {
      console.error("[archivio] analyze flow failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setAiFilled({});
      setEventType("");
      setBodyPart("");
      setFacility("");
      setFacilityType("public");
      setDoctorName("");
      setDate(new Date().toISOString().slice(0, 10));
      setSummary(notes.trim() || "");
      setAnalyzeError(`Estrazione AI fallita: ${msg}. Compila i campi manualmente.`);
      setExtractionStatus("error");
      setStep("preview");
    }
  }

  async function save() {
    if (!uid || !queryFilter || !title.trim() || !eventType) {
      toast.error("Titolo e tipo di evento sono obbligatori");
      return;
    }
    setSaving(true);
    const profileField = { [queryFilter.col]: queryFilter.val };
    try {
      if (uploadedPath) {
        const { data: inserted, error: dbErr } = await supabase.from("documents").insert({
          ...profileField,
          title: title.trim(),
          doc_type: "Referto",
          event_type: eventType,
          document_date: date || null,
          source: facilityType === "private" ? "Struttura privata" : "Struttura pubblica",
          facility_name: facility.trim() || null,
          facility_type: facility.trim() ? facilityType : null,
          doctor_name: doctorName.trim() || null,
          file_path: uploadedPath,
          file_url: uploadedUrl,
          ai_summary: cleanSummary(summary) || null,
          ...(bodyPart ? { body_systems: [bodyPart] } : {}),
        } as any).select().single();
        if (dbErr) throw dbErr;
        toast.success("Documento salvato come verificato");
        supabase.functions.invoke("interpret-document", { body: { document_id: inserted.id } }).catch(() => {});
      } else {
        const { error } = await supabase.from("health_memories").insert({
          ...profileField,
          description: title.trim(),
          body_part: bodyPart || null,
          event_date: date || null,
          notes: cleanSummary(summary) || null,
          source: "manual_entry",
          event_type: eventType,
          facility_name: facility.trim() || null,
          facility_type: facility.trim() ? facilityType : null,
          doctor_name: doctorName.trim() || null,
          ...(bodyPart ? { body_systems: [bodyPart] } : {}),
        } as any);
        if (error) throw error;
        toast.success("Informazione salvata come da verificare");
      }
      setOpen(false);
      reset();
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Aggiungi informazione sanitaria</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Aggiungi informazione sanitaria</DialogTitle></DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div>
              <Label>Titolo</Label>
              <Input
                placeholder="es. Visita cardiologica, Analisi del sangue..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Documento PDF / immagine</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Note libere</Label>
              <Textarea
                rows={5}
                placeholder="Scrivi liberamente quello che ricordi: cosa è successo, quando, dove, quale medico..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {inputError && <p className="text-sm text-destructive">{inputError}</p>}
            <Button onClick={analyze} className="w-full">Analizza con AI →</Button>
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              {extractStatus || (file ? "Prevì sta analizzando il documento…" : "Prevì sta analizzando le informazioni…")}
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {extractionStatus === "error" ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {analyzeError || "Non sono riuscito ad analizzare automaticamente. Compila i campi manualmente."}
              </div>
            ) : extractionStatus === "success" ? (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                ✨ Prevì ha compilato automaticamente questi campi. Controlla e correggi se necessario.
              </div>
            ) : null}

            <div>
              <Label>Titolo {aiFilled.title && <span title="Compilato da AI">✨</span>}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Tipo di evento {aiFilled.eventType && <span title="Compilato da AI">✨</span>}</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue placeholder="Seleziona tipo di evento" /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parte del corpo {aiFilled.bodyPart && <span title="Compilato da AI">✨</span>}</Label>
              <Input
                placeholder="es. Ginocchio sinistro, Cuore"
                value={bodyPart}
                onChange={(e) => setBodyPart(e.target.value)}
              />
            </div>
            <div>
              <Label>Struttura sanitaria {aiFilled.facility && <span title="Compilato da AI">✨</span>}</Label>
              <Input
                placeholder="Nome struttura"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
              />
              <div className="mt-2 inline-flex rounded-full border bg-card p-0.5 text-xs">
                <button type="button" onClick={() => setFacilityType("public")} className={`px-3 py-1 rounded-full transition ${facilityType === "public" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pubblica</button>
                <button type="button" onClick={() => setFacilityType("private")} className={`px-3 py-1 rounded-full transition ${facilityType === "private" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Privata</button>
              </div>
            </div>
            <div>
              <Label>Medico / Specialista {aiFilled.doctorName && <span title="Compilato da AI">✨</span>}</Label>
              <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
            </div>
            <div>
              <Label>Data {aiFilled.date && <span title="Compilato da AI">✨</span>}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Riassunto AI {aiFilled.summary && <span title="Compilato da AI">✨</span>}</Label>
              <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("input")} className="flex-1">← Modifica input</Button>
              <Button onClick={save} disabled={saving || !title.trim() || !eventType} className="flex-1">
                {saving ? "Salvataggio…" : "Salva"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function LinkDocumentModal({ memory, docs, onDone }: { memory: Memory; docs: DocItem[]; onDone: () => void }) {
  const { user } = useAuth();
  const { activeId } = useActiveProfile();
  const uid = activeId || user?.id;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"choose" | "existing" | "upload">("choose");

  async function linkExisting(docId: string) {
    if (!uid) return;
    const { error } = await (supabase as any)
      .from("health_memories")
      .update({ linked_document_id: docId })
      .eq("id", memory.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento collegato. Il ricordo è ora verificato.");
    setOpen(false); setMode("choose"); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode("choose"); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs"><Link2 className="w-3 h-3 mr-1" />Collega documento</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Collega un documento al ricordo</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">
          <b>{memory.description}</b>
          {memory.body_part ? ` • ${memory.body_part}` : ""}
          {memory.event_date ? ` • ${format(new Date(memory.event_date), "MMM yyyy", { locale: it })}` : ""}
        </div>

        {mode === "choose" && (
          <div className="grid gap-3">
            <button onClick={() => setMode("upload")} className="text-left border rounded-xl p-4 hover:bg-muted">
              <div className="font-medium">Carica ora</div>
              <div className="text-xs text-muted-foreground mt-1">Apri il caricamento documento (precompilato con i dati del ricordo).</div>
            </button>
            <button onClick={() => setMode("existing")} className="text-left border rounded-xl p-4 hover:bg-muted">
              <div className="font-medium">Collega esistente</div>
              <div className="text-xs text-muted-foreground mt-1">Scegli da un documento già caricato.</div>
            </button>
          </div>
        )}

        {mode === "existing" && (
          <div className="space-y-2">
            {docs.length === 0 && <div className="text-sm text-muted-foreground">Nessun documento ancora caricato.</div>}
            {docs.map((d) => (
              <button key={d.id} onClick={() => linkExisting(d.id)} className="w-full text-left border rounded-xl p-3 hover:bg-muted">
                <div className="font-medium text-sm">{d.title}</div>
                <div className="text-xs text-muted-foreground">{d.doc_type}{d.document_date ? ` • ${format(new Date(d.document_date), "d MMM yyyy", { locale: it })}` : ""}</div>
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>Indietro</Button>
          </div>
        )}

        {mode === "upload" && (
          <InlineUpload memory={memory} onUploaded={(docId) => linkExisting(docId)} onBack={() => setMode("choose")} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InlineUpload({ memory, onUploaded, onBack }: { memory: Memory; onUploaded: (docId: string) => void; onBack: () => void }) {
  const { user } = useAuth();
  const { activeId, queryFilter } = useActiveProfile();
  const uid = activeId || user?.id;
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(memory.description);
  const [docType, setDocType] = useState("Referto");
  const [docDate, setDocDate] = useState(memory.event_date || new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!uid || !queryFilter || !file) return;
    setUploading(true);
    try {
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("health-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = await supabase.storage.from("health-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { data: inserted, error: dbErr } = await supabase.from("documents").insert({
        [queryFilter.col]: queryFilter.val, title, doc_type: docType, document_date: docDate || null,
        source: "Struttura pubblica", file_path: path, file_url: urlData?.signedUrl || null,
      } as any).select().single();
      if (dbErr) throw dbErr;
      supabase.functions.invoke("interpret-document", { body: { document_id: inserted.id } }).catch(() => {});
      onUploaded(inserted.id);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Errore"); } finally { setUploading(false); }
  }

  return (
    <div className="space-y-3">
      <div><Label>File (PDF o immagine)</Label><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <div><Label>Titolo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label>Tipo</Label><Select value={docType} onValueChange={setDocType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Data documento</Label><Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>Indietro</Button>
        <Button onClick={submit} disabled={!file || !title || uploading} className="flex-1">{uploading ? "Caricamento…" : "Carica e collega"}</Button>
      </div>
    </div>
  );
}

function BodySystemTags({ table, id, tags, onChange }: { table: "documents" | "health_memories"; id: string; tags: string[]; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(tags);
  const [saving, setSaving] = useState(false);

  function toggle(t: string) {
    setSelected((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t]);
  }

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).from(table).update({ body_systems: selected }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tag aggiornati");
    setEditing(false);
    onChange();
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      {tags.length === 0 && !editing && (
        <button onClick={() => { setSelected([]); setEditing(true); }} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <Tag className="w-3 h-3" />Aggiungi organo/area
        </button>
      )}
      {tags.map((t) => (
        <Badge key={t} variant="outline" className="text-[10px] bg-accent/40">
          <Tag className="w-3 h-3 mr-1" />{t}
        </Badge>
      ))}
      {tags.length > 0 && !editing && (
        <button onClick={() => { setSelected(tags); setEditing(true); }} className="text-[10px] text-muted-foreground hover:text-foreground underline">
          Modifica
        </button>
      )}

      <Dialog open={editing} onOpenChange={(v) => { setEditing(v); if (!v) setSelected(tags); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Organi e aree del corpo</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Seleziona uno o più organi, apparati o aree del corpo correlati.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {BODY_SYSTEMS.map((b) => {
              const on = selected.includes(b);
              return (
                <button key={b} type="button" onClick={() => toggle(b)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground hover:bg-muted"}`}>
                  {b}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
