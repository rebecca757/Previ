import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Mic, Send, ChevronDown, ChevronUp, Heart, Bell, FileText, X, Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Assistente — Prevì" }] }),
  validateSearch: (s: Record<string, unknown>): { doc?: string; ask?: string; conv?: string } => {
    const out: { doc?: string; ask?: string; conv?: string } = {};
    if (typeof s.doc === "string" && s.doc) out.doc = s.doc;
    if (typeof s.ask === "string" && s.ask) out.ask = s.ask;
    if (typeof s.conv === "string" && s.conv) out.conv = s.conv;
    return out;
  },
  component: () => <AuthGate><AppShell><Chat /></AppShell></AuthGate>,
});

const STARTERS = [
  "Ho un referto da capire",
  "Devo fare un controllo?",
  "Cosa significa questo valore?",
  "Ho avuto un problema di salute in passato",
];

type MemorySuggestion = {
  description: string;
  body_part?: string | null;
  approximate_date?: string | null;
  notes?: string | null;
  body_systems?: string[] | null;
  similar_existing_id?: string | null;
};
type PreventionSuggestion = {
  title: string;
  reason: string;
  suggested_specialty?: string | null;
  suggested_timeframe?: string | null;
  linked_health_memory_id?: string | null;
  linked_document_id?: string | null;
  linked_family_history_id?: string | null;
  source?: "ai_prevention" | "ai_family_prevention" | null;
  priority?: "urgent" | "normal" | null;
  priority_reason?: string | null;
};
type ReminderAction = {
  reminder_id: string;
  action: "disable" | "delete";
  title: string;
};
type MemoryDelete = {
  memory_id: string;
  description: string;
};
type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  memorySuggestions?: MemorySuggestion[] | null;
  preventionSuggestion?: PreventionSuggestion | null;
  reminderAction?: ReminderAction | null;
  memoryDelete?: MemoryDelete | null;
  memoryHandled?: boolean;
  preventionHandled?: boolean;
  reminderActionHandled?: boolean;
  memoryDeleteHandled?: boolean;
};

function normalizeDate(s?: string | null): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return null;
}

// Defense-in-depth so the user NEVER sees raw JSON. The chat Edge Function
// already returns clean prose, but messages saved before that fix are stored in
// the DB as raw JSON (e.g. `{"reply":"..."}` or a ```json fence), and a rare
// model response could still slip through. Extract the "reply" text on the way
// in — mirrors parseModelReply in supabase/functions/chat/index.ts (repair
// in-string control chars, then regex-salvage the reply field).
function cleanReply(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return text;
  // Fast path: nothing JSON-shaped, leave it untouched.
  if (!text.startsWith("{") && !text.startsWith("```") && !text.includes('"reply"')) return text;

  const repair = (s: string): string => {
    let out = "", inStr = false, esc = false;
    for (const ch of s) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === "\\") { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = !inStr; out += ch; continue; }
      if (inStr && ch === "\n") { out += "\\n"; continue; }
      if (inStr && ch === "\r") { out += "\\r"; continue; }
      if (inStr && ch === "\t") { out += "\\t"; continue; }
      out += ch;
    }
    return out;
  };

  const candidates = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) candidates.push(fence[1].trim());
  const first = text.indexOf("{"), last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const c of candidates) {
    for (const attempt of [c, repair(c)]) {
      try {
        const p = JSON.parse(attempt);
        if (p && typeof p === "object" && typeof p.reply === "string") return p.reply.trim();
      } catch { /* try next */ }
    }
  }
  // Bound the reply by the next sibling key (or the closing brace) rather than
  // the first quote, so unescaped double-quotes inside the prose don't truncate
  // the message. If no terminator is found the text was cut off mid-reply, so
  // keep everything present.
  const start = /"reply"\s*:\s*"/.exec(text);
  if (start) {
    const rest = text.slice(start.index + start[0].length);
    const end = /"\s*,\s*"(?:memory_suggestions?|prevention_suggestion|reminder_action|memory_delete)"|"\s*\}/.exec(rest);
    const body = (end ? rest.slice(0, end.index) : rest.replace(/"\s*$/, ""))
      .replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "")
      .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (body.trim()) return body.trim();
  }
  return text;
}

function Chat() {
  const { user } = useAuth();
  const { activeId } = useActiveProfile();
  const { doc: docId, ask, conv } = Route.useSearch();
  const navigate = useNavigate();
  const uid = activeId || user?.id;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [discOpen, setDiscOpen] = useState(true);
  const [docContext, setDocContext] = useState<{ id: string; title: string; interpretation: string | null } | null>(null);
  // True once we've *attempted* to resolve the document context (even if it came
  // back null). The auto-ask flow waits on this rather than on docContext being
  // truthy, so a failed/empty doc fetch can never silently swallow the question.
  const [docLoaded, setDocLoaded] = useState(false);
  const [convId, setConvId] = useState<string | null>(conv ?? null);
  const [conversations, setConversations] = useState<{ id: string; title: string; document_id: string | null; updated_at: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const autoAskedRef = useRef(false);

  // Recent conversations, for the "riapri" list.
  const loadConversations = useCallback(async () => {
    if (!uid) { setConversations([]); return; }
    const { data } = await (supabase as any)
      .from("conversations")
      .select("id,title,document_id,updated_at")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations(data || []);
  }, [uid]);
  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Open a saved conversation (?conv=<id>) → load its messages; otherwise start fresh.
  useEffect(() => {
    if (!uid) return;
    setConvId(conv ?? null);
    if (!conv) { setMessages([]); return; }
    (supabase as any)
      .from("chat_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conv)
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data }: any) => {
        setMessages((data || []).map((m: any) => ({
          role: m.role,
          content: m.role === "assistant" ? cleanReply(m.content) : m.content,
          id: m.id,
        })));
      });
  }, [uid, conv]);

  // Resolve the document context: from the open conversation, or from ?doc=<id>.
  useEffect(() => {
    if (!uid) { setDocContext(null); setDocLoaded(true); return; }
    let cancelled = false;
    setDocLoaded(false);
    (async () => {
      try {
        let documentId: string | null = null;
        if (conv) {
          const { data: c } = await (supabase as any).from("conversations").select("document_id").eq("id", conv).maybeSingle();
          documentId = c?.document_id ?? null;
        } else if (docId) {
          documentId = docId;
        }
        if (!documentId) { if (!cancelled) setDocContext(null); return; }
        const { data } = await supabase
          .from("documents")
          .select("id,title,ai_full_interpretation")
          .eq("id", documentId)
          .maybeSingle();
        if (!cancelled) setDocContext(data ? { id: data.id, title: data.title, interpretation: (data as any).ai_full_interpretation ?? null } : null);
      } finally {
        // Always mark as resolved so the auto-ask never hangs on a failed fetch.
        if (!cancelled) setDocLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, conv, docId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-send the question passed from the referto page, once context + thread are ready.
  useEffect(() => {
    if (!ask || !uid || autoAskedRef.current) return;
    if (docId && !docLoaded) return; // wait until the doc context has been *attempted* (see docLoaded)
    autoAskedRef.current = true;
    const q = ask;
    // Clear ?ask from the URL so a refresh doesn't re-send it.
    navigate({ to: "/assistente", search: docId ? { doc: docId } : {}, replace: true });
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, uid, docId, docLoaded]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !uid) return;
    setInput("");
    const newUser: Msg = { role: "user", content };
    setMessages((m) => [...m, newUser, { role: "assistant", content: "…" }]);
    setSending(true);
    try {
      const linkedDocId = docContext?.id ?? docId ?? null;

      // Create the conversation lazily on the first message so empty chats aren't stored.
      let cid = convId;
      if (!cid) {
        const { data: created, error: convErr } = await (supabase as any)
          .from("conversations")
          .insert({ user_id: uid, title: content.slice(0, 80), document_id: linkedDocId })
          .select("id")
          .single();
        if (convErr) throw convErr;
        cid = created.id as string;
        setConvId(cid);
      }

      await (supabase as any).from("chat_messages").insert({ user_id: uid, role: "user", content, conversation_id: cid, document_id: linkedDocId });
      // When a document context is active, inject its title + interpretation into the
      // FIRST user message of every request so the AI always knows which referto we're
      // discussing — including follow-up turns, since we persist only the plain question
      // and rebuild the history from it each time. The bulky context is never stored.
      const history = [...messages, newUser].map((m) => ({ role: m.role, content: m.content }));
      if (docContext) {
        const firstUserIdx = history.findIndex((h) => h.role === "user");
        if (firstUserIdx !== -1 && !history[firstUserIdx].content.startsWith("[Contesto:")) {
          const ctx = `[Contesto: il paziente fa riferimento al documento "${docContext.title}".` +
            (docContext.interpretation ? ` Interpretazione AI del documento:\n${docContext.interpretation}` : "") +
            `]\n\n${history[firstUserIdx].content}`;
          history[firstUserIdx] = { role: "user", content: ctx };
        }
      }
      // Always route AI calls through the server-side Edge Function so the
      // Anthropic API key stays on the server and is never shipped to the browser.
      const result = await supabase.functions.invoke("chat", { body: { messages: history, active_user_id: uid } });
      if (result.error) throw result.error;
      const data: any = result.data;
      // The Edge Function returns clean prose, but clean once more here as a
      // safety net so a raw-JSON reply is never stored or shown.
      const reply: string = cleanReply(data.reply);
      await (supabase as any).from("chat_messages").insert({ user_id: uid, role: "assistant", content: reply, conversation_id: cid, document_id: linkedDocId });
      await (supabase as any).from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", cid);
      loadConversations();
      setMessages((m) => {
        const copy = [...m];
        const sugg = (data as any).memory_suggestions ?? ((data as any).memory_suggestion ? [(data as any).memory_suggestion] : null);
        copy[copy.length - 1] = {
          role: "assistant",
          content: reply,
          memorySuggestions: sugg,
          preventionSuggestion: data.prevention_suggestion || null,
          reminderAction: (data as any).reminder_action || null,
          memoryDelete: (data as any).memory_delete || null,
        };
        return copy;
      });
    } catch (e: unknown) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Errore: " + (e instanceof Error ? e.message : "") };
        return copy;
      });
    } finally { setSending(false); }
  }

  async function saveMemoryItem(s: MemorySuggestion, mode: "new" | "update"): Promise<boolean> {
    if (!uid) return false;
    const payload = {
      description: s.description,
      body_part: s.body_part || null,
      event_date: normalizeDate(s.approximate_date),
      notes: s.notes || null,
      body_systems: Array.isArray(s.body_systems) ? s.body_systems : [],
      source: "user_chat",
    };
    if (mode === "update" && s.similar_existing_id) {
      const { data: existing } = await supabase.from("health_memories").select("*").eq("id", s.similar_existing_id).eq("user_id", uid).maybeSingle();
      const history: any[] = Array.isArray((existing as any)?.edit_history) ? (existing as any).edit_history : [];
      const fields: Array<keyof typeof payload> = ["description", "body_part", "event_date", "notes"];
      const now = new Date().toISOString();
      const patch: any = {};
      for (const f of fields) {
        const newVal = (payload as any)[f];
        const oldVal = (existing as any)?.[f] ?? null;
        if (newVal != null && newVal !== "" && newVal !== oldVal) {
          patch[f] = newVal;
          history.push({ changed_at: now, field_name: f, old_value: oldVal, new_value: newVal });
        }
      }
      // Merge body_systems (union)
      if (payload.body_systems.length > 0) {
        const oldBs: string[] = Array.isArray((existing as any)?.body_systems) ? (existing as any).body_systems : [];
        const merged = Array.from(new Set([...oldBs, ...payload.body_systems]));
        if (merged.length !== oldBs.length) {
          patch.body_systems = merged;
          history.push({ changed_at: now, field_name: "body_systems", old_value: oldBs, new_value: merged });
        }
      }
      if (Object.keys(patch).length === 0) return true;
      patch.edit_history = history;
      const { error } = await (supabase as any).from("health_memories").update(patch).eq("id", s.similar_existing_id).eq("user_id", uid);
      if (error) { toast.error(error.message); return false; }
    } else {
      const { error } = await supabase.from("health_memories").insert({ user_id: uid, ...payload });
      if (error) { toast.error(error.message); return false; }
    }
    return true;
  }

  async function saveAllMemories(idx: number) {
    const m = messages[idx];
    if (!m.memorySuggestions?.length) return;
    let ok = 0;
    for (const s of m.memorySuggestions) {
      const mode = s.similar_existing_id ? "update" : "new";
      if (await saveMemoryItem(s, mode)) ok++;
    }
    toast.success(`${ok} ricord${ok === 1 ? "o salvato" : "i salvati"} nell'archivio`);
    setMessages((arr) => arr.map((msg, i) => i === idx ? {
      ...msg, memoryHandled: true,
      content: msg.content + `\n\n✓ Ho salvato ${ok} ricord${ok === 1 ? "o" : "i"} nell'archivio (auto-dichiarati, non verificati).`,
    } : msg));
  }

  async function saveSingleMemory(idx: number, sIdx: number, mode: "new" | "update") {
    const m = messages[idx];
    const s = m.memorySuggestions?.[sIdx];
    if (!s) return;
    const ok = await saveMemoryItem(s, mode);
    if (!ok) return;
    toast.success(mode === "update" ? "Ricordo aggiornato" : "Ricordo salvato");
    setMessages((arr) => arr.map((msg, i) => {
      if (i !== idx) return msg;
      const remaining = (msg.memorySuggestions || []).filter((_, k) => k !== sIdx);
      return {
        ...msg,
        memorySuggestions: remaining,
        memoryHandled: remaining.length === 0 ? true : msg.memoryHandled,
      };
    }));
  }


  async function savePrevention(idx: number) {
    const m = messages[idx];
    const s = m.preventionSuggestion;
    if (!s || !uid) return;
    const priority = s.priority === "urgent" ? "urgent" : "normal";
    const { error } = await (supabase as any).from("reminders").insert({
      user_id: uid,
      title: s.title,
      description: s.reason,
      reason: s.reason,
      suggested_specialty: s.suggested_specialty || null,
      suggested_timeframe: s.suggested_timeframe || null,
      linked_health_memory_id: s.linked_health_memory_id || null,
      linked_document_id: s.linked_document_id || null,
      linked_family_history_id: s.linked_family_history_id || null,
      source: s.source === "ai_family_prevention" ? "ai_family_prevention" : "ai_prevention",
      status: "suggested",
      priority,
      priority_reason: s.priority_reason || null,
      enabled: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Promemoria di prevenzione aggiunto");
    setMessages((arr) => arr.map((msg, i) => i === idx ? {
      ...msg, preventionHandled: true,
      content: msg.content + "\n\n✓ Promemoria aggiunto alla sezione Prevenzione.",
    } : msg));
  }

  async function executeReminderAction(idx: number) {
    const m = messages[idx];
    const a = m.reminderAction;
    if (!a || !uid) return;
    let error: any = null;
    if (a.action === "disable") {
      ({ error } = await (supabase as any).from("reminders").update({ enabled: false }).eq("id", a.reminder_id).eq("user_id", uid));
    } else {
      ({ error } = await (supabase as any).from("reminders").delete().eq("id", a.reminder_id).eq("user_id", uid));
    }
    if (error) { toast.error(error.message); return; }
    const verb = a.action === "disable" ? "disattivato" : "eliminato";
    toast.success(`Promemoria ${verb}`);
    setMessages((arr) => arr.map((msg, i) => i === idx ? {
      ...msg, reminderActionHandled: true,
      content: msg.content + `\n\n✓ Il promemoria "${a.title}" è stato ${verb}.`,
    } : msg));
  }

  async function executeMemoryDelete(idx: number) {
    const m = messages[idx];
    const d = m.memoryDelete;
    if (!d || !uid) return;
    // Safety: only delete if not linked to a document
    const { data: row } = await (supabase as any).from("health_memories").select("linked_document_id").eq("id", d.memory_id).eq("user_id", uid).maybeSingle();
    if (row?.linked_document_id) {
      toast.error("Questo ricordo è collegato a un documento e non può essere eliminato dalla chat.");
      return;
    }
    const { error } = await (supabase as any).from("health_memories").delete().eq("id", d.memory_id).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success("Ricordo eliminato");
    setMessages((arr) => arr.map((msg, i) => i === idx ? {
      ...msg, memoryDeleteHandled: true,
      content: msg.content + `\n\n✓ Il ricordo "${d.description}" è stato eliminato.`,
    } : msg));
  }


  function toggleMic() {
    const SR: any = (typeof window !== "undefined") && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { toast.error("Riconoscimento vocale non disponibile"); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "it-IT";
    rec.interimResults = false;
    rec.onresult = (e: any) => setInput((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-5rem)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Assistente</h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/assistente" search={{}}>
            <Plus className="w-4 h-4 mr-1" /> Nuova
          </Link>
        </Button>
      </div>
      {docContext && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Relativo a:</span>
          <Link
            to="/referto/$id"
            params={{ id: docContext.id }}
            className="font-medium text-primary hover:underline truncate"
          >
            {docContext.title}
          </Link>
          <Link
            to="/assistente"
            search={{}}
            className="ml-auto shrink-0 rounded-full p-1 hover:bg-primary/20"
            title="Esci dal contesto del documento"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Link>
        </div>
      )}
      <div className="mb-3">
        <button onClick={() => setDiscOpen(!discOpen)} className="w-full text-left rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>💚 Disclaimer</span>
            {discOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          {discOpen && <p className="mt-2 text-muted-foreground">Prevì non è un medico e non fornisce diagnosi. Usa questa chat per capire meglio la tua salute, non per sostituire una visita medica.</p>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-center text-muted-foreground py-8">Chiedimi qualcosa per iniziare</div>
            <div className="grid grid-cols-2 gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-left text-sm p-3 rounded-xl border bg-card hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>

            {conversations.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="px-1 text-xs font-medium text-muted-foreground">Conversazioni recenti</div>
                {conversations.map((c) => (
                  <Link
                    key={c.id}
                    to="/assistente"
                    search={{ conv: c.id }}
                    className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-muted"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-primary" />
                    <span className="flex-1 truncate">{c.title}</span>
                    {c.document_id && <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(c.updated_at), "d MMM", { locale: it })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "bg-card border"}`}>
              {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}

              {m.memorySuggestions && m.memorySuggestions.length > 0 && !m.memoryHandled && (
                <MemorySaveBlock
                  suggestions={m.memorySuggestions}
                  onSaveAll={() => saveAllMemories(i)}
                  onSaveOne={(sIdx, mode) => saveSingleMemory(i, sIdx, mode)}
                  onSaveSelected={async (indices) => {
                    const list = m.memorySuggestions!;
                    let ok = 0;
                    for (const sIdx of indices) {
                      const s = list[sIdx];
                      const mode = s.similar_existing_id ? "update" : "new";
                      if (await saveMemoryItem(s, mode)) ok++;
                    }
                    toast.success(`${ok} ricord${ok === 1 ? "o salvato" : "i salvati"}`);
                    setMessages((arr) => arr.map((msg, idx) => idx === i ? {
                      ...msg, memoryHandled: true,
                      content: msg.content + `\n\n✓ Ho salvato ${ok} ricord${ok === 1 ? "o" : "i"} nell'archivio.`,
                    } : msg));
                  }}
                />
              )}



              {m.preventionSuggestion && !m.preventionHandled && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Bell className="w-3.5 h-3.5" /> Suggerimento di Prevenzione
                    {m.preventionSuggestion.priority === "urgent" ? (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#E05A2B]/15 text-[#E05A2B] font-semibold">⚠️ Urgente</span>
                    ) : (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">📅 Ordinario</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div><b>{m.preventionSuggestion.title}</b></div>
                    <div className="mt-1">{m.preventionSuggestion.reason}</div>
                    {m.preventionSuggestion.suggested_specialty && <div className="mt-1"><b>Specialità:</b> {m.preventionSuggestion.suggested_specialty}</div>}
                    {m.preventionSuggestion.suggested_timeframe && <div><b>Tempi:</b> {m.preventionSuggestion.suggested_timeframe}</div>}
                    {m.preventionSuggestion.priority === "urgent" && m.preventionSuggestion.priority_reason && (
                      <div className="mt-1 text-[#E05A2B]"><b>Motivo urgenza:</b> {m.preventionSuggestion.priority_reason}</div>
                    )}
                  </div>
                  <div className="text-xs">Vuoi che aggiunga questo promemoria di prevenzione?</div>
                  <Button size="sm" onClick={() => savePrevention(i)}>Sì, aggiungi</Button>
                </div>
              )}

              {m.reminderAction && !m.reminderActionHandled && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Bell className="w-3.5 h-3.5" /> {m.reminderAction.action === "disable" ? "Disattivare promemoria" : "Eliminare promemoria"}
                  </div>
                  <div className="text-xs text-muted-foreground"><b>{m.reminderAction.title}</b></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => executeReminderAction(i)}>
                      Sì, {m.reminderAction.action === "disable" ? "disattiva" : "elimina"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setMessages((arr) => arr.map((msg, idx) => idx === i ? { ...msg, reminderActionHandled: true } : msg))}>Annulla</Button>
                  </div>
                </div>
              )}

              {m.memoryDelete && !m.memoryDeleteHandled && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Heart className="w-3.5 h-3.5" /> Eliminare ricordo
                  </div>
                  <div className="text-xs text-muted-foreground"><b>{m.memoryDelete.description}</b></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => executeMemoryDelete(i)}>Sì, elimina</Button>
                    <Button size="sm" variant="ghost" onClick={() => setMessages((arr) => arr.map((msg, idx) => idx === i ? { ...msg, memoryDeleteHandled: true } : msg))}>Annulla</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2 items-end">
        <Button variant={listening ? "default" : "outline"} size="icon" onClick={toggleMic}>
          <Mic className="w-4 h-4" />
        </Button>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Scrivi un messaggio…"
          className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button onClick={() => send()} disabled={sending || !input.trim()}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function MemorySaveBlock({
  suggestions,
  onSaveAll,
  onSaveOne,
  onSaveSelected,
}: {
  suggestions: MemorySuggestion[];
  onSaveAll: () => void;
  onSaveOne: (sIdx: number, mode: "new" | "update") => void;
  onSaveSelected: (indices: number[]) => void;
}) {
  const [mode, setMode] = useState<"summary" | "pick">("summary");
  const [picked, setPicked] = useState<Set<number>>(new Set(suggestions.map((_, i) => i)));

  function toggle(idx: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  if (suggestions.length === 1) {
    const s = suggestions[0];
    return (
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Heart className="w-3.5 h-3.5" /> Ricordo di Salute rilevato
        </div>
        <div className="rounded-lg border bg-background/50 p-2 text-xs text-muted-foreground space-y-0.5">
          <div><b>Descrizione:</b> {s.description}</div>
          {s.body_part && <div><b>Parte del corpo:</b> {s.body_part}</div>}
          {s.approximate_date && <div><b>Data:</b> {s.approximate_date}</div>}
          {s.notes && <div><b>Note:</b> {s.notes}</div>}
        </div>
        {s.similar_existing_id ? (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => onSaveOne(0, "update")}>Aggiorna esistente</Button>
            <Button size="sm" variant="outline" onClick={() => onSaveOne(0, "new")}>Crea nuovo</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => onSaveOne(0, "new")}>Salva ricordo</Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Heart className="w-3.5 h-3.5" /> Ho trovato {suggestions.length} ricordi da salvare:
      </div>
      <ol className="text-xs text-foreground/90 list-decimal pl-5 space-y-0.5">
        {suggestions.map((s, idx) => (
          <li key={idx}>
            {s.description}
            {s.body_part ? ` — ${s.body_part}` : ""}
            {s.approximate_date ? ` (${s.approximate_date})` : ""}
          </li>
        ))}
      </ol>

      {mode === "summary" ? (
        <div className="flex gap-2 flex-wrap pt-1">
          <Button size="sm" onClick={onSaveAll}>Salva tutti ({suggestions.length})</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("pick")}>Scegli quali salvare</Button>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <div className="space-y-1">
            {suggestions.map((s, idx) => (
              <label key={idx} className="flex items-start gap-2 text-xs cursor-pointer rounded-md hover:bg-muted/40 p-1.5">
                <input
                  type="checkbox"
                  checked={picked.has(idx)}
                  onChange={() => toggle(idx)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <b>{s.description}</b>
                  {s.body_part ? ` — ${s.body_part}` : ""}
                  {s.approximate_date ? ` · ${s.approximate_date}` : ""}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={picked.size === 0}
              onClick={() => onSaveSelected(Array.from(picked).sort((a, b) => a - b))}
            >
              Salva selezionati ({picked.size})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("summary")}>Annulla</Button>
          </div>
        </div>
      )}
    </div>
  );
}
