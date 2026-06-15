import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { SPECIALTY_AREAS, GENERAL_AREA, matchesArea, type SpecialtyArea } from "@/lib/specialty-areas";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, Copy, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Profile = {
  full_name: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  medications: string[] | null;
};

type DocRow = {
  id: string;
  title: string;
  doc_type: string;
  document_date: string | null;
  facility_name: string | null;
  ai_summary: string | null;
  body_systems: string[] | null;
  file_url: string | null;
  file_path: string | null;
  source: string | null;
};

type Section = { heading: string; items: string[] };

const ALL_AREAS: SpecialtyArea[] = [...SPECIALTY_AREAS, GENERAL_AREA];

export function SpecialistSummaryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { activeId } = useActiveProfile();
  const uid = activeId || user?.id;

  const [step, setStep] = useState<1 | 2>(1);
  const [areaId, setAreaId] = useState<string>("cardio");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [matchedDocs, setMatchedDocs] = useState<DocRow[]>([]);

  const filteredAreas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_AREAS;
    return ALL_AREAS.filter((a) => a.label.toLowerCase().includes(q));
  }, [search]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSections([]);
      setMatchedDocs([]);
      setReason("");
    }
  }, [open]);

  async function buildPreview() {
    if (!uid) return;
    const area = ALL_AREAS.find((a) => a.id === areaId) || GENERAL_AREA;
    setLoading(true);
    try {
      const [{ data: p }, { data: conditions }, { data: docs }, { data: memories }, { data: family }, { data: medsRows }] = await Promise.all([
        supabase.from("profiles").select("full_name,date_of_birth,biological_sex,medications").eq("id", uid).maybeSingle(),
        supabase.from("health_conditions").select("id,name,start_date,end_date,status,notes").eq("user_id", uid),
        supabase.from("documents").select("id,title,doc_type,document_date,facility_name,ai_summary,body_systems,file_url,file_path,source").eq("user_id", uid).is("deleted_at", null).order("document_date", { ascending: false }),
        supabase.from("health_memories").select("description,body_part,event_date,notes,body_systems,is_documented").eq("user_id", uid).is("deleted_at", null).order("event_date", { ascending: false }),
        supabase.from("family_history").select("relation,condition,onset_age,is_deceased,condition_category"),
        supabase.from("medications").select("name,dosage,frequency,linked_condition_id,reason,start_date,active").eq("user_id", uid).eq("active", true).order("created_at", { ascending: false }),
      ]);

      setProfile(p as Profile);

      const matchAny = (texts: (string | null | undefined)[], extra?: string[]) => {
        if (area.id === "general") return true;
        for (const t of texts) if (matchesArea(t, area)) return true;
        if (extra && area.family_categories) {
          for (const e of extra) if (e && area.family_categories.includes(e)) return true;
        }
        return false;
      };

      const matchArray = (arr: string[] | null | undefined) => {
        if (area.id === "general") return true;
        if (!arr || arr.length === 0) return false;
        return arr.some((s) => matchesArea(s, area));
      };

      const condItems = (conditions || [])
        .map((c: any) => {
          const dates = c.start_date ? ` (dal ${formatDate(c.start_date)}${c.end_date ? ` al ${formatDate(c.end_date)}` : ""})` : "";
          const st = c.status === "resolved" ? " — risolta" : "";
          return `${c.name}${dates}${st}${c.notes ? ` — ${c.notes}` : ""}`;
        });

      const matchedDocRows = ((docs || []) as DocRow[]).filter((d) => matchAny([d.title, d.doc_type, d.facility_name, d.ai_summary]) || matchArray(d.body_systems));
      setMatchedDocs(matchedDocRows);

      const docItems = matchedDocRows.map((d) => {
        const date = d.document_date ? formatDate(d.document_date) : "data n/d";
        const type = d.doc_type ? ` — ${d.doc_type}` : "";
        const fac = d.facility_name ? ` — ${d.facility_name}` : "";
        return `${date} — ${d.title}${type}${fac}`;
      });

      const memItems = (memories || [])
        .filter((m: any) => matchAny([m.description, m.body_part, m.notes]) || matchArray(m.body_systems))
        .map((m: any) => {
          const date = m.event_date ? formatDate(m.event_date) : "data n/d";
          const bp = m.body_part ? ` (${m.body_part})` : "";
          return `[⚠ Dichiarazione non verificata] ${date} — ${m.description}${bp}${m.notes ? ` — ${m.notes}` : ""}`;
        });

      const famItems = (family || [])
        .filter((f: any) => matchAny([f.condition], [f.condition_category]))
        .map((f: any) => {
          const age = f.onset_age ? ` a ${f.onset_age} anni` : "";
          const dec = f.is_deceased ? " (deceduto/a)" : "";
          return `${f.relation}: ${f.condition}${age}${dec}`;
        });

      const condById: Record<string, any> = {};
      for (const c of (conditions || []) as any[]) condById[c.id] = c;
      const medItems = ((medsRows || []) as any[]).map((m: any) => {
        const head = `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`;
        const freq = m.frequency ? ` — ${m.frequency}` : "";
        const linked = m.linked_condition_id && condById[m.linked_condition_id]
          ? ` — Per: ${condById[m.linked_condition_id].name}`
          : (m.reason ? ` — ${m.reason}` : "");
        const start = m.start_date ? ` (dal ${formatDate(m.start_date)})` : "";
        return `${head}${freq}${linked}${start}`;
      });

      setSections([
        { heading: "CONDIZIONI CRONICHE CORRELATE", items: condItems },
        { heading: "FARMACI ATTUALI", items: medItems },
        { heading: "ANAMNESI FAMILIARE CORRELATA", items: famItems },
        { heading: "DOCUMENTI SANITARI", items: docItems },
        { heading: "RICORDI DI SALUTE", items: memItems },
      ]);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || "Errore nel generare il riassunto");
    } finally {
      setLoading(false);
    }
  }

  const area = ALL_AREAS.find((a) => a.id === areaId) || GENERAL_AREA;
  const generatedOn = format(new Date(), "d MMMM yyyy", { locale: it });

  function plainText(): string {
    const lines: string[] = [];
    lines.push(`RIASSUNTO CLINICO — ${area.label}`);
    lines.push("");
    const dob = profile?.date_of_birth ? formatDate(profile.date_of_birth) : "n/d";
    const sex = profile?.biological_sex || "n/d";
    lines.push(`Paziente: ${profile?.full_name || "n/d"} | Nato/a il: ${dob} | Sesso: ${sex}`);
    lines.push(`Generato il: ${generatedOn}`);
    if (reason.trim()) {
      lines.push("");
      lines.push(`Motivo della visita: ${reason.trim()}`);
    }
    lines.push("");
    for (const s of sections) {
      lines.push(s.heading);
      if (s.items.length === 0) lines.push("  — Nessun dato disponibile");
      else for (const it of s.items) lines.push(`  • ${it}`);
      lines.push("");
    }
    lines.push("DISCLAIMER");
    lines.push("Questo documento è stato generato da Prevì a scopo informativo.");
    lines.push("Non sostituisce la cartella clinica ufficiale.");
    lines.push("I \"ricordi di salute\" sono dichiarazioni dell'utente non verificate da documenti ufficiali.");
    return lines.join("\n");
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(plainText());
      toast.success("Testo copiato negli appunti");
    } catch {
      toast.error("Impossibile copiare il testo");
    }
  }

  function buildSummaryPdfBytes(skippedNotes: string[]): ArrayBuffer {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    let y = margin;
    let pageNum = 1;

    const addFooter = () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generato da Prevì il ${generatedOn} — Solo per uso informativo`, margin, pageH - 24);
      doc.text(`Pag. ${pageNum}`, pageW - margin, pageH - 24, { align: "right" });
      pageNum++;
    };

    const writeLine = (text: string, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number }) => {
      const size = opts?.size ?? 10;
      doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
      doc.setFontSize(size);
      const col = opts?.color ?? [30, 30, 30];
      doc.setTextColor(col[0], col[1], col[2]);
      const indent = opts?.indent ?? 0;
      const maxW = pageW - margin * 2 - indent;
      const wrapped = doc.splitTextToSize(text, maxW);
      for (const w of wrapped) {
        if (y > pageH - margin - 30) {
          addFooter();
          doc.addPage();
          y = margin;
        }
        doc.text(w, margin + indent, y);
        y += size + 4;
      }
    };

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 110, 86);
    doc.text("Prevì", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Riassunto clinico", pageW - margin, y, { align: "right" });
    y += 20;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    writeLine(`RIASSUNTO CLINICO — ${area.label.toUpperCase()}`, { size: 14, bold: true, color: [15, 110, 86] });
    y += 4;
    const dob = profile?.date_of_birth ? formatDate(profile.date_of_birth) : "n/d";
    const sex = profile?.biological_sex || "n/d";
    writeLine(`Paziente: ${profile?.full_name || "n/d"}    Nato/a il: ${dob}    Sesso: ${sex}`, { size: 10 });
    writeLine(`Generato il: ${generatedOn}`, { size: 10, color: [110, 110, 110] });
    y += 6;

    if (reason.trim()) {
      writeLine("MOTIVO DELLA VISITA", { size: 11, bold: true, color: [15, 110, 86] });
      writeLine(reason.trim(), { size: 10, indent: 4 });
      y += 6;
    }

    for (const s of sections) {
      // Hide sections with no data in the PDF
      if (s.items.length === 0) continue;
      if (y > pageH - margin - 80) {
        addFooter();
        doc.addPage();
        y = margin;
      }
      writeLine(s.heading, { size: 11, bold: true, color: [15, 110, 86] });
      y += 2;
      for (const it of s.items) writeLine(`•  ${it}`, { size: 10, indent: 12 });
      y += 8;
    }

    if (skippedNotes.length > 0) {
      if (y > pageH - margin - 80) {
        addFooter();
        doc.addPage();
        y = margin;
      }
      writeLine("NOTE", { size: 11, bold: true, color: [180, 100, 0] });
      for (const n of skippedNotes) writeLine(`•  ${n}`, { size: 9, indent: 12, color: [120, 80, 0] });
      y += 6;
    }

    if (y > pageH - margin - 80) {
      addFooter();
      doc.addPage();
      y = margin;
    }
    writeLine("DISCLAIMER", { size: 10, bold: true, color: [120, 120, 120] });
    writeLine("Questo documento è stato generato da Prevì a scopo informativo. Non sostituisce la cartella clinica ufficiale. I \"ricordi di salute\" sono dichiarazioni dell'utente non verificate da documenti ufficiali.", { size: 9, color: [110, 110, 110] });

    addFooter();
    return doc.output("arraybuffer");
  }

  async function fetchDocFile(d: DocRow): Promise<{ bytes: Uint8Array; mime: string } | null> {
    try {
      if (d.file_path) {
        const { data, error } = await supabase.storage.from("health-documents").download(d.file_path);
        if (error || !data) return null;
        const buf = new Uint8Array(await data.arrayBuffer());
        return { bytes: buf, mime: data.type || guessMime(d.file_path) };
      }
      if (d.file_url) {
        const res = await fetch(d.file_url);
        if (!res.ok) return null;
        const buf = new Uint8Array(await res.arrayBuffer());
        return { bytes: buf, mime: res.headers.get("content-type") || guessMime(d.file_url) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function downloadPdf() {
    if (downloading) return;
    setDownloading(true);
    const skippedNotes: string[] = [];
    try {
      const docsWithFiles = matchedDocs.filter((d) => d.file_path || d.file_url);

      // Pre-fetch all doc files so we can list "skipped" notes inside the summary PDF
      const fetched: Array<{ doc: DocRow; file: { bytes: Uint8Array; mime: string } | null }> = [];
      for (const d of docsWithFiles) {
        const file = await fetchDocFile(d);
        if (!file) skippedNotes.push(`Il documento "${d.title}" non è stato incluso perché il file non è più disponibile.`);
        fetched.push({ doc: d, file });
      }

      // Build summary PDF (with skipped notes appended)
      const summaryBytes = buildSummaryPdfBytes(skippedNotes);

      // Assemble final PDF with pdf-lib
      const finalPdf = await PDFDocument.create();
      const helv = await finalPdf.embedFont(StandardFonts.Helvetica);
      const helvBold = await finalPdf.embedFont(StandardFonts.HelveticaBold);

      // Append summary pages
      const summaryDoc = await PDFDocument.load(summaryBytes);
      const summaryPages = await finalPdf.copyPages(summaryDoc, summaryDoc.getPageIndices());
      for (const p of summaryPages) finalPdf.addPage(p);

      const usable = fetched.filter((f) => f.file);
      if (usable.length > 0) {
        // "Documenti allegati" header page
        const header = finalPdf.addPage([595.28, 841.89]);
        const { width: hw, height: hh } = header.getSize();
        header.drawText(sanitizeWinAnsi("Documenti allegati"), {
          x: 48, y: hh - 120, size: 26, font: helvBold, color: rgb(0.058, 0.43, 0.337),
        });
        header.drawText(sanitizeWinAnsi(`${usable.length} document${usable.length === 1 ? "o" : "i"} allegat${usable.length === 1 ? "o" : "i"} per l'area: ${area.label}`), {
          x: 48, y: hh - 150, size: 11, font: helv, color: rgb(0.35, 0.35, 0.35),
        });
        header.drawLine({ start: { x: 48, y: hh - 170 }, end: { x: hw - 48, y: hh - 170 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });

        let idx = 0;
        for (const { doc, file } of usable) {
          idx++;
          if (!file) continue;

          const a4w = 595.28, a4h = 841.89;
          const isPdf = file.mime.includes("pdf") || (doc.file_path || "").toLowerCase().endsWith(".pdf");
          const isJpg = file.mime.includes("jpeg") || file.mime.includes("jpg") || /\.(jpe?g)$/i.test(doc.file_path || "");
          const isPng = file.mime.includes("png") || /\.png$/i.test(doc.file_path || "");

          // Compact header strip overlaid on the first page of the document (no blank page).
          const drawHeaderStrip = (page: any, pageW: number, pageH: number) => {
            const teal = rgb(0.058, 0.43, 0.337);
            const barH = 34;
            const metaBgH = 22;
            // White background strip behind meta so it remains readable over document content
            page.drawRectangle({ x: 0, y: pageH - barH - metaBgH, width: pageW, height: metaBgH, color: rgb(1, 1, 1), opacity: 0.92 });
            page.drawRectangle({ x: 0, y: pageH - barH, width: pageW, height: barH, color: teal });
            const titleStr = sanitizeWinAnsi(`Documento ${idx} di ${usable.length} - ${doc.title || "Senza titolo"}`);
            const maxChars = 78;
            const display = titleStr.length > maxChars ? titleStr.slice(0, maxChars - 1) + "…" : titleStr;
            page.drawText(display, { x: 16, y: pageH - barH + 11, size: 12, font: helvBold, color: rgb(1, 1, 1) });

            const meta = [
              doc.document_date ? `Data: ${formatDate(doc.document_date)}` : null,
              doc.doc_type ? `Tipo: ${doc.doc_type}` : null,
              doc.facility_name ? `Struttura: ${doc.facility_name}` : null,
            ].filter(Boolean) as string[];
            const verified = (doc.source || "").toLowerCase().includes("struttura") || (doc.source || "").toLowerCase().includes("verificato");
            const badge = verified ? "Verificato" : "Da verificare";
            const badgeColor = verified ? rgb(0.058, 0.43, 0.337) : rgb(0.72, 0.45, 0.05);
            const metaY = pageH - barH - 14;
            const metaText = sanitizeWinAnsi(meta.join("  ·  "));
            page.drawText(metaText, { x: 16, y: metaY, size: 9, font: helv, color: rgb(0.3, 0.3, 0.3) });
            page.drawText(sanitizeWinAnsi(badge), { x: pageW - 16 - helvBold.widthOfTextAtSize(badge, 9), y: metaY, size: 9, font: helvBold, color: badgeColor });
            return barH + metaBgH;
          };

          try {
            if (isPdf) {
              // Copy original pages full-bleed; overlay the header strip onto the first page only.
              const srcDoc = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
              const pages = await finalPdf.copyPages(srcDoc, srcDoc.getPageIndices());
              pages.forEach((p, i) => {
                finalPdf.addPage(p);
                if (i === 0) {
                  const { width, height } = p.getSize();
                  drawHeaderStrip(p, width, height);
                }
              });
            } else if (isJpg || isPng) {
              // Single page: header strip on top, image fills the rest of the page with zero margins.
              const img = isPng ? await finalPdf.embedPng(file.bytes) : await finalPdf.embedJpg(file.bytes);
              const page = finalPdf.addPage([a4w, a4h]);
              const headerH = drawHeaderStrip(page, a4w, a4h);
              const availH = a4h - headerH;
              const availW = a4w;
              const scale = Math.min(availW / img.width, availH / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              page.drawImage(img, { x: (a4w - w) / 2, y: (availH - h) / 2, width: w, height: h });
            } else {
              skippedNotes.push(`Il documento "${doc.title}" non è stato incluso (formato non supportato).`);
            }
          } catch {
            skippedNotes.push(`Il documento "${doc.title}" non è stato incluso (errore di lettura del file).`);
          }
        }
      }

      finalPdf.setTitle(`Riassunto clinico Prevì — ${area.label} — ${profile?.full_name || ""}`.trim());
      finalPdf.setAuthor("Prevì");
      finalPdf.setCreator("Prevì");
      finalPdf.setProducer("Prevì");
      finalPdf.setCreationDate(new Date());
      finalPdf.setModificationDate(new Date());

      const out = await finalPdf.save();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `previ-riassunto-${area.id}-${format(new Date(), "yyyyMMdd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (skippedNotes.length > 0) {
        toast.warning(`PDF generato. ${skippedNotes.length} documento/i non incluso/i.`);
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore nella generazione del PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!downloading) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Riassunto per specialista
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scegli l'area o specialità: Prevì raccoglierà solo le informazioni cliniche correlate, da portare con te alla visita.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Motivo della visita (opzionale)</Label>
              <Textarea
                id="reason"
                placeholder="Es. dolore persistente al ginocchio destro da 3 mesi…"
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value.slice(0, 200))}
                rows={2}
              />
              <div className="text-[10px] text-muted-foreground text-right">{reason.length}/200</div>
            </div>

            <Input
              placeholder="Cerca area o specialità…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredAreas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button onClick={buildPreview} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Genera anteprima
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 text-sm space-y-3">
              <div className="font-semibold text-primary">RIASSUNTO CLINICO — {area.label}</div>
              <div className="text-xs text-muted-foreground">
                Paziente: <strong>{profile?.full_name || "n/d"}</strong> · Nato/a il: {profile?.date_of_birth ? formatDate(profile.date_of_birth) : "n/d"} · Sesso: {profile?.biological_sex || "n/d"}<br />
                Generato il: {generatedOn}
              </div>
              {reason.trim() && (
                <div>
                  <div className="font-medium text-xs tracking-wide text-primary mt-2">MOTIVO DELLA VISITA</div>
                  <div className="text-xs pl-2 mt-1">{reason.trim()}</div>
                </div>
              )}
              {sections.map((s) => (
                <div key={s.heading}>
                  <div className="font-medium text-xs tracking-wide text-primary mt-2">{s.heading}</div>
                  {s.items.length === 0 ? (
                    <div className="text-xs text-muted-foreground pl-2">— Nessun dato disponibile</div>
                  ) : (
                    <ul className="list-disc pl-5 text-xs space-y-1 mt-1">
                      {s.items.map((it, i) => {
                        const unverified = it.startsWith("[⚠ Dichiarazione non verificata]");
                        const clean = unverified ? it.replace("[⚠ Dichiarazione non verificata]", "").trim() : it;
                        return (
                          <li key={i}>
                            {unverified && (
                              <span className="inline-flex items-center gap-1 mr-1.5 align-middle text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                                <AlertTriangle className="w-3 h-3" /> Dichiarazione non verificata
                              </span>
                            )}
                            {clean}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
              {matchedDocs.some((d) => d.file_path || d.file_url) && (
                <div className="pt-2 mt-2 border-t text-[11px] text-muted-foreground">
                  Il PDF includerà anche {matchedDocs.filter((d) => d.file_path || d.file_url).length} document{matchedDocs.filter((d) => d.file_path || d.file_url).length === 1 ? "o originale" : "i originali"} allegat{matchedDocs.filter((d) => d.file_path || d.file_url).length === 1 ? "o" : "i"}.
                </div>
              )}
              <div className="pt-2 mt-2 border-t text-[10px] text-muted-foreground leading-snug">
                <strong>Disclaimer:</strong> documento informativo generato da Prevì. Non sostituisce la cartella clinica ufficiale. I "ricordi di salute" sono dichiarazioni dell'utente non verificate da documenti.
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={downloading}>← Cambia area</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyText} disabled={downloading}><Copy className="w-4 h-4 mr-1" />Copia testo</Button>
                <Button onClick={downloadPdf} disabled={downloading}>
                  {downloading ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Sto preparando il tuo documento…</>
                  ) : (
                    <><Download className="w-4 h-4 mr-1" />Scarica PDF</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatDate(d: string): string {
  try { return format(new Date(d), "d MMM yyyy", { locale: it }); } catch { return d; }
}

function guessMime(pathOrUrl: string): string {
  const p = pathOrUrl.toLowerCase();
  if (p.endsWith(".pdf")) return "application/pdf";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function wrapText(text: string, maxChars: number): string[] {
  text = sanitizeWinAnsi(text);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + " " : "") + w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// Replace characters not encodable in WinAnsi (used by StandardFonts.Helvetica in pdf-lib)
function sanitizeWinAnsi(s: string): string {
  return s
    .replace(/[\u2713\u2714]/g, "")  // checkmarks
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2026]/g, "...")
    .replace(/[^\x00-\xFF]/g, "?"); // any remaining non-WinAnsi
}

