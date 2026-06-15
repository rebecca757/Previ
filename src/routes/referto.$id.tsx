import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, ArrowLeft, FileText, Sparkles, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/referto/$id")({
  head: () => ({ meta: [{ title: "Referto — Prevì" }] }),
  component: () => <AuthGate><AppShell><DocDetail /></AppShell></AuthGate>,
});

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Pull readable Italian prose out of an AI interpretation that may be wrapped in JSON / code fences. */
function extractInterpretation(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();

  // Strip ```json ... ``` or ``` ... ``` code fences first
  s = s.replace(/```(?:json|markdown|md)?\s*([\s\S]*?)```/gi, "$1").trim();

  // Try repeatedly to unwrap JSON / double-encoded strings
  for (let i = 0; i < 4; i++) {
    const t = s.trim();
    const looksJson =
      (t.startsWith("{") && t.endsWith("}")) ||
      (t.startsWith("[") && t.endsWith("]")) ||
      (t.startsWith('"') && t.endsWith('"'));
    if (!looksJson) break;
    try {
      const obj = JSON.parse(t);
      const pick = (o: any): string => {
        if (o == null) return "";
        if (typeof o === "string") return o;
        if (Array.isArray(o)) return o.map(pick).filter(Boolean).join("\n\n");
        if (typeof o === "object") {
          return (
            o.reply || o.interpretation || o.interpretazione || o.text || o.content ||
            o.summary || o.riassunto || o.message || pick(Object.values(o)[0])
          ) ?? "";
        }
        return "";
      };
      const next = String(pick(obj) || "").trim();
      if (!next || next === s) break;
      s = next;
    } catch { break; }
  }

  // Salvage embedded "reply"/"interpretation" if still partial JSON-like
  const embed = s.match(/"(?:reply|interpretation|interpretazione|text|content|summary|riassunto|message)"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (embed) {
    try { s = JSON.parse(`"${embed[1]}"`); } catch { s = embed[1]; }
  }

  // Unescape common escape sequences
  s = s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "  ").replace(/\\\\/g, "\\");
  // Strip remaining stray code fences
  s = s.replace(/```/g, "");
  return s.trim();
}

/** Convert extracted text + lightweight markdown to safe HTML. */
function interpretationToHtml(raw: string | null | undefined): string {
  const text = extractInterpretation(raw);
  if (!text) return "";
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs
    .map((p) => {
      let html = escapeHtml(p);
      // **bold**
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      // *italic* (single asterisks, avoid bold)
      html = html.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1<em>$2</em>");
      // Single newlines → <br>
      html = html.replace(/\n/g, "<br />");
      return `<p>${html}</p>`;
    })
    .join("");
}

function DocDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState("");
  const [hasConvo, setHasConvo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fbComment, setFbComment] = useState("");
  const autoTriggeredRef = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("documents").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    setDoc(data);
    setLoading(false);

    // Retroactive cleanup: if stored interpretation is JSON/code-fenced, rewrite with clean prose.
    if (data?.ai_full_interpretation) {
      const original = String(data.ai_full_interpretation);
      const trimmed = original.trim();
      const looksDirty = /^```/.test(trimmed) || trimmed.startsWith("{") || /"reply"\s*:/.test(trimmed) || /\\n/.test(trimmed);
      if (looksDirty) {
        const cleaned = extractInterpretation(original);
        if (cleaned && cleaned !== original) {
          await supabase.from("documents").update({ ai_full_interpretation: cleaned }).eq("id", id);
          setDoc({ ...data, ai_full_interpretation: cleaned });
        }
      }
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke("interpret-document", { body: { document_id: id } });
      if (error) throw error;
      await load();
      toast.success("Interpretazione pronta");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore AI");
    } finally { setAnalyzing(false); }
  }, [id, load]);

  useEffect(() => {
    if (doc && !doc.ai_full_interpretation && !analyzing && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      analyze();
    }
  }, [doc, analyzing, analyze]);

  // Show the "Vedi conversazioni" link if any chat message is already tagged with this document.
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("chat_messages")
      .select("id")
      .eq("document_id", id)
      .limit(1)
      .then(({ data }: any) => setHasConvo((data?.length ?? 0) > 0));
  }, [user, id]);

  // Redirect the question to the Assistant, carrying the document context (id + question).
  function ask() {
    const q = question.trim();
    if (!q) return;
    navigate({ to: "/assistente", search: { doc: id, ask: q } });
  }

  async function submitFeedback(rating: "up" | "down") {
    if (!user) return;
    setFeedback(rating);
    await supabase.from("ai_feedback").insert({
      user_id: user.id,
      document_id: id,
      rating,
      comment: rating === "down" ? fbComment || null : null,
    });
    toast.success("Grazie per il feedback!");
  }

  if (loading) return <div className="text-muted-foreground">Caricamento…</div>;
  if (!doc) return <div>Documento non trovato.</div>;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/archivio"><ArrowLeft className="w-4 h-4 mr-1" />Archivio</Link></Button>

      <div>
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <div className="text-sm text-muted-foreground">{doc.doc_type}{doc.facility_name ? ` • ${doc.facility_name}` : ""}</div>
      </div>

      {doc.file_url && (
        <div className="bg-card border rounded-xl p-3">
          {doc.file_url.match(/\.(png|jpg|jpeg|gif|webp)/i) ? (
            <img src={doc.file_url} alt={doc.title} className="w-full rounded-lg" />
          ) : (
            <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary p-3">
              <FileText className="w-5 h-5" /> Apri il file originale
            </a>
          )}
        </div>
      )}

      {doc.linked_memory_description && (
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-sm">
          <div className="text-xs font-medium text-muted-foreground mb-1">Ricordo di origine</div>
          <div className="text-foreground/90">{doc.linked_memory_description}</div>
          {doc.linked_memory_notes && <div className="text-xs text-muted-foreground mt-1 italic">{doc.linked_memory_notes}</div>}
        </div>
      )}

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-semibold">Interpretazione AI</h2>
        </div>
        {doc.ai_full_interpretation && (
          <div
            className="prose prose-sm max-w-none text-foreground [&>p]:mb-3 [&>p:last-child]:mb-0 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: interpretationToHtml(doc.ai_full_interpretation) }}
          />
        )}
        {analyzing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Prevì sta analizzando il documento...</span>
          </div>
        ) : (
          <Button onClick={analyze} variant="outline" size="sm">
            {doc.ai_full_interpretation ? "Rigenera interpretazione" : "Analizza con AI"}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
        💚 Prevì ti aiuta a capire, non a diagnosticare. Per qualsiasi decisione clinica, parla con il tuo medico.
      </div>

      {doc.ai_full_interpretation && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">Fai una domanda</div>
            {hasConvo && (
              <Link
                to="/assistente"
                search={{ doc: id }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <MessageCircle className="w-4 h-4" /> Vedi conversazioni su questo referto
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            La tua domanda si aprirà nell'Assistente, con il contesto di questo documento.
          </p>
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
              placeholder="Es. Cosa significano i valori alti?"
            />
            <Button onClick={ask}>Invia</Button>
          </div>
        </div>
      )}

      {doc.ai_full_interpretation && (
        <div className="bg-card border rounded-xl p-4">
          <div className="text-sm mb-2">Questa spiegazione è stata utile?</div>
          {feedback ? (
            <div className="text-sm text-muted-foreground">Grazie!</div>
          ) : (
            <div className="flex gap-2 items-start">
              <Button variant="outline" size="sm" onClick={() => submitFeedback("up")}><ThumbsUp className="w-4 h-4" /></Button>
              <div className="flex-1 flex gap-2">
                <Textarea rows={1} placeholder="Cosa migliorare?" value={fbComment} onChange={(e) => setFbComment(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => submitFeedback("down")}><ThumbsDown className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
