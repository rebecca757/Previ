// Local-dev bypass: calls Claude API directly from the browser when
// VITE_ANTHROPIC_API_KEY is set in .env, avoiding the Edge Function which
// doesn't run locally. Production always uses the Edge Function instead.

import { supabase } from "@/integrations/supabase/client";

const TOOLS = [
  {
    name: "create_reminder",
    description: "Crea un nuovo promemoria sanitario per l'utente. Agisci direttamente senza chiedere conferma.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titolo del promemoria" },
        reason: { type: "string", description: "Motivazione del promemoria" },
        suggested_timeframe: { type: "string", description: "Quando eseguire (es. 'entro 3 mesi', 'annualmente')" },
        priority: { type: "string", enum: ["urgent", "normal"], description: "Urgenza del promemoria" },
      },
      required: ["title"],
    },
  },
  {
    name: "activate_reminder",
    description: "Riattiva un promemoria precedentemente disattivato (enabled = true). Agisci direttamente senza chiedere conferma.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "UUID del promemoria dal tag [rem:UUID]" },
        title: { type: "string", description: "Titolo del promemoria, per la conferma all'utente" },
      },
      required: ["reminder_id", "title"],
    },
  },
  {
    name: "deactivate_reminder",
    description: "Disattiva un promemoria (enabled = false) senza eliminarlo. Agisci direttamente senza chiedere conferma.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "UUID del promemoria dal tag [rem:UUID]" },
        title: { type: "string", description: "Titolo del promemoria, per la conferma all'utente" },
      },
      required: ["reminder_id", "title"],
    },
  },
  {
    name: "delete_reminder",
    description: "Elimina definitivamente un promemoria. USA SOLO dopo aver ricevuto conferma esplicita dall'utente.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "UUID del promemoria dal tag [rem:UUID]" },
        title: { type: "string", description: "Titolo del promemoria, per la conferma all'utente" },
      },
      required: ["reminder_id", "title"],
    },
  },
  {
    name: "list_reminders",
    description: "Elenca i promemoria quando l'utente vuole vederli. Usa il filtro per mostrare tutti, solo attivi, o solo disattivati.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "active", "inactive"], description: "Quale sottoinsieme mostrare" },
      },
    },
  },
  {
    name: "create_health_memory",
    description: "Salva un ricordo di salute per l'utente quando lo chiede esplicitamente.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Descrizione concisa dell'evento sanitario" },
        body_part: { type: "string", description: "Parte del corpo coinvolta" },
        event_date: { type: "string", description: "Data approssimativa (YYYY-MM-DD, YYYY-MM, o YYYY)" },
        notes: { type: "string", description: "Dettagli aggiuntivi" },
      },
      required: ["description"],
    },
  },
];

async function buildSystemPrompt(userId: string): Promise<string> {
  const [
    { data: profile },
    { data: docs },
    { data: memories },
    { data: bio },
    { data: reminders },
    { data: conditions },
    { data: family },
    { data: links },
    { data: meds },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("documents")
      .select("id,title,doc_type,document_date,source,ai_summary")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("health_memories")
      .select("id,description,body_part,event_date,notes,linked_document_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("event_date", { ascending: false, nullsFirst: false } as any)
      .limit(50),
    supabase
      .from("biometric_history")
      .select("weight_kg,height_cm,recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reminders")
      .select("id,title,description,suggested_specialty,status,source,enabled,priority,suggested_timeframe")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("health_conditions")
      .select("id,name,start_date,end_date,status,notes")
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("family_history")
      .select("id,relation,condition,onset_age,is_deceased,notes")
      .eq("user_id", userId)
      .order("relation"),
    supabase
      .from("family_links")
      .select("caregiver_user_id,managed_user_id,relation,link_type,status")
      .eq("status", "active")
      .or(`caregiver_user_id.eq.${userId},managed_user_id.eq.${userId}`),
    supabase
      .from("medications")
      .select("name,dosage,frequency,linked_condition_id,reason,start_date,active")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);

  const linkedIds = Array.from(
    new Set(
      ((links || []) as any[])
        .flatMap((l: any) => [l.caregiver_user_id, l.managed_user_id])
        .filter((id: string) => id !== userId)
    )
  );
  let linkedProfilesBlock = "Nessuno";
  if (linkedIds.length) {
    const [{ data: lProfs }, { data: lConds }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,date_of_birth").in("id", linkedIds),
      supabase.from("health_conditions").select("user_id,name,start_date,end_date,status").in("user_id", linkedIds),
    ]);
    const ageOf = (dob?: string | null) =>
      dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
    const yr = (d?: string | null) => (d ? String(d).slice(0, 4) : "—");
    linkedProfilesBlock =
      (lProfs || [])
        .map((lp: any) => {
          const link = (links as any[]).find(
            (l: any) => l.caregiver_user_id === lp.id || l.managed_user_id === lp.id
          );
          const rel = link?.relation || "Familiare";
          const a = ageOf(lp.date_of_birth);
          const conds =
            (lConds || [])
              .filter((c: any) => c.user_id === lp.id)
              .map((c: any) => {
                const range = c.end_date
                  ? `${yr(c.start_date)}–${yr(c.end_date)}`
                  : `dal ${yr(c.start_date)}`;
                return `${c.name} (${range})`;
              })
              .join(", ") || "nessuna condizione registrata";
          return `- ${rel} (${lp.full_name || "n/d"}${a !== null ? `, ${a} anni` : ""}): ${conds}`;
        })
        .join("\n") || "Nessuno";
  }

  const p: any = profile || {};
  const age = p.date_of_birth
    ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "n/d";

  const docList =
    (docs || [])
      .map(
        (d: any) =>
          `- [doc:${d.id}] ${d.title} (${d.doc_type}, ${d.document_date || "data n/d"})${d.ai_summary ? " — " + String(d.ai_summary).slice(0, 140) : ""}`
      )
      .join("\n") || "Nessuno";

  const memList =
    (memories || [])
      .map(
        (m: any) =>
          `- [mem:${m.id}] ${m.description} (${m.body_part || "—"}, ${m.event_date || "data n/d"})${m.linked_document_id ? " [documentato]" : " [non documentato]"}${m.notes ? " — " + m.notes : ""}`
      )
      .join("\n") || "Nessuno";

  const fmtReminder = (r: any) =>
    `- [rem:${r.id}] ${r.title}${r.suggested_specialty ? ` (${r.suggested_specialty})` : ""}${r.priority === "urgent" ? " ⚠️ URGENTE" : ""}${r.suggested_timeframe ? ` — ${r.suggested_timeframe}` : ""}`;
  const activeRems = (reminders || []).filter((r: any) => r.enabled);
  const inactiveRems = (reminders || []).filter((r: any) => !r.enabled);
  const activeRemList = activeRems.map(fmtReminder).join("\n") || "Nessuno";
  const inactiveRemList = inactiveRems.map(fmtReminder).join("\n") || "Nessuno";

  const yearOf = (d?: string | null) => (d ? String(d).slice(0, 4) : "data n/d");
  const condById: Record<string, any> = {};
  const condList =
    (conditions || [])
      .map((c: any) => {
        condById[c.id] = c;
        const range = c.end_date
          ? `${yearOf(c.start_date)}–${yearOf(c.end_date)}`
          : `dal ${yearOf(c.start_date)}`;
        const status = c.status === "active" ? "attiva" : "risolta";
        return `- ${c.name} (${status}, ${range})${c.notes ? ` — ${c.notes}` : ""}`;
      })
      .join("\n") || "Nessuna";

  const fmtItDate = (d?: string | null) => {
    if (!d) return null;
    try {
      const dt = new Date(d);
      const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
      return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch {
      return d;
    }
  };
  const medList =
    (meds || [])
      .map((m: any) => {
        const head = `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? `, ${m.frequency}` : ""}`;
        const linked =
          m.linked_condition_id && condById[m.linked_condition_id]
            ? condById[m.linked_condition_id].name
            : null;
        const tail = linked
          ? ` → per: ${linked}${m.start_date ? ` (dal ${fmtItDate(m.start_date)})` : ""}`
          : m.reason
            ? ` → motivo: ${m.reason}${m.start_date ? ` (dal ${fmtItDate(m.start_date)})` : ""}`
            : ` → motivo non specificato${m.start_date ? ` (dal ${fmtItDate(m.start_date)})` : ""}`;
        return `- ${head}${tail}`;
      })
      .join("\n") || "nessuno";

  const famByRel = (family || []).reduce<Record<string, any[]>>((acc, f: any) => {
    (acc[f.relation] = acc[f.relation] || []).push(f);
    return acc;
  }, {});
  const famList =
    Object.entries(famByRel)
      .map(([rel, list]) => {
        const conds = (list as any[])
          .map((f: any) => {
            const parts: string[] = [];
            if (f.onset_age != null) parts.push(`insorta a ${f.onset_age} anni`);
            if (f.is_deceased) parts.push("deceduto");
            const meta = parts.length ? ` (${parts.join(", ")})` : "";
            return `${f.condition}${meta} [fam:${f.id}]`;
          })
          .join(", ");
        return `- ${rel}: ${conds}`;
      })
      .join("\n") || "Nessuna";

  const lastBio = (bio as any) || {};

  return `Sei Prevì, un assistente sanitario personale digitale in italiano. Aiuti l'utente a comprendere documenti sanitari, organizzare la storia clinica e ricevere consigli di PREVENZIONE personalizzati. Non sei un medico: non diagnosticare e non prescrivere trattamenti. Linguaggio chiaro, empatico, accessibile.

PROFILO UTENTE:
- Nome: ${p.full_name || "n/d"}
- Età: ${age}
- Sesso biologico: ${p.biological_sex || "n/d"}
- Gruppo sanguigno: ${p.blood_type || "n/d"}
- Allergie: ${(p.allergies || []).join(", ") || "nessuna nota"}
- Condizioni croniche: vedi sezione dedicata sotto
- Farmaci regolari: vedi sezione dedicata sotto
- Peso: ${lastBio.weight_kg || "n/d"} kg | Altezza: ${lastBio.height_cm || "n/d"} cm

CONDIZIONI CRONICHE:
${condList}

FARMACI REGOLARI:
${medList}

DOCUMENTI (ultimi):
${docList}

RICORDI DI SALUTE (auto-dichiarati, NON verificati) — il marker [non documentato] indica un ricordo eliminabile:
${memList}

PROMEMORIA ATTIVI (enabled=true):
${activeRemList}

PROMEMORIA DISATTIVATI (enabled=false, riattivabili):
${inactiveRemList}

ANAMNESI FAMILIARE (dati dichiarati dall'utente, non verificati):
${famList}

PROFILI FAMILIARI COLLEGATI (collegamenti reali su Prevì, dati verificati dai familiari stessi):
${linkedProfilesBlock}

Quando suggerisci prevenzione genetica, dai priorità ai dati dei PROFILI FAMILIARI COLLEGATI rispetto all'anamnesi familiare auto-dichiarata, perché sono dati verificati dal familiare stesso.


═══════════════════════════════════════════
RICONOSCIMENTO RICORDI DI SALUTE
═══════════════════════════════════════════
Se l'utente racconta un evento sanitario passato — diagnosi, intervento chirurgico, infortunio, allergia, condizione cronica, ricovero, gravidanza, o altro elemento rilevante della storia clinica — estrai:
- description (testo conciso)
- body_part (parte del corpo coinvolta, se pertinente)
- approximate_date (YYYY-MM-DD o solo l'anno se sconosciuto)
- notes (dettagli aggiuntivi forniti dall'utente)
- body_systems (1-3 organi/apparati/aree del corpo correlati, SOLO da questo elenco esatto: ["Cuore / Sistema cardiovascolare","Polmoni / Sistema respiratorio","Cervello / Sistema neurologico","Stomaco / Apparato digerente","Intestino","Fegato","Reni / Apparato urinario","Tiroide / Sistema endocrino","Ginocchio","Spalla","Schiena / Colonna vertebrale","Pelle","Occhi","Orecchie","Apparato ginecologico","Apparato urologico","Sangue / Sistema ematologico","Sistema immunitario","Salute generale"])

Confronta con i RICORDI DI SALUTE elencati sopra. Se trovi un ricordo simile (stessa parte del corpo, stessa condizione, o descrizione simile), imposta "similar_existing_id" con l'UUID [mem:xxx] del ricordo esistente e SOLLEVA esplicitamente il match nel "reply": "Ho trovato un ricordo simile nel tuo archivio: '[descrizione esistente]' del [data]. Vuoi aggiornarlo con questa nuova informazione, o preferisci crearne uno nuovo?"

ESTRAZIONE MULTI-RICORDO (IMPORTANTE):
Se in un singolo messaggio l'utente racconta PIÙ eventi sanitari distinti (es. "ho avuto la rottura del crociato nel 2019 e una polmonite nel 2022"), riconoscili TUTTI e proponili insieme in "memory_suggestions" come ARRAY. Per ciascuno fai un breve riepilogo nel "reply" e chiedi una conferma cumulativa: "Ho identificato N ricordi: [elenco]. Vuoi che li salvi tutti nel tuo archivio?".

Quando i campi essenziali (data approssimativa, parte del corpo) per uno o più eventi sono completamente assenti o ambigui, chiedi UN chiarimento alla volta — riferendoti esplicitamente all'evento ("Per la polmonite, ricordi l'anno?") — e nel frattempo "memory_suggestions = null". Quando hai abbastanza informazioni su almeno l'anno e la zona del corpo (anche se generici), procedi al riepilogo. Le note restano opzionali; non bloccare il salvataggio se l'utente non vuole aggiungerle.

Per un singolo evento la regola è la stessa: chiedi solo i campi davvero mancanti, una domanda per messaggio, poi proponi il salvataggio.

NON salvare mai automaticamente. I ricordi sono SEMPRE marcati come auto-dichiarati e non verificati.

COLLEGAMENTO DOCUMENTO–RICORDO:
Se noti che un DOCUMENTO recente (vedi sezione DOCUMENTI) riguarda la stessa parte del corpo o condizione di un RICORDO esistente non ancora documentato, suggerisci proattivamente il collegamento nel "reply": "Ho notato che hai caricato un referto [titolo/tipo]. Vuoi collegarlo al ricordo '[descrizione]'?" — l'utente potrà collegarlo dall'archivio.

═══════════════════════════════════════════
INTELLIGENZA DI PREVENZIONE
═══════════════════════════════════════════
Analizza costantemente profilo, ricordi, documenti, condizioni croniche, farmaci, biometrie, età e sesso per identificare opportunità di PREVENZIONE personalizzate.

Quando individui un'opportunità rilevante, spiega brevemente PERCHÉ può essere utile e chiedi conferma. Collega il promemoria quando possibile usando gli ID [mem:xxx], [doc:xxx] o [fam:xxx]. Non duplicare promemoria già esistenti.

SCREENING UFFICIALI (vincolante):
Per gli screening oncologici e di popolazione, suggerisci ESCLUSIVAMENTE quelli del LEA / Ministero della Salute italiani:
- Mammografia (donne 50–69, ogni 2 anni; dai 40 se familiarità di seno/ovaio)
- Pap test (donne 25–29, ogni 3 anni)
- HPV test (donne 30–64, ogni 5 anni)
- Ricerca sangue occulto nelle feci / SOF (uomini e donne 50–70, ogni 2 anni; dai 40 se familiarità di colon-retto)

Se l'utente chiede di altri screening non presenti in questa lista ufficiale, rispondi: "Non ho informazioni ufficiali su questo screening nelle linee guida ministeriali. Ti consiglio di consultare il tuo medico di base." Non inventare cadenze o fasce d'età.

═══════════════════════════════════════════
RISCHIO FAMILIARE / GENETICO
═══════════════════════════════════════════
Incrocia ANAMNESI FAMILIARE con profilo dell'utente. Usa SEMPRE linguaggio prudente: "potresti avere una predisposizione", "è consigliabile monitorare". Cita il familiare. Source = "ai_family_prevention", "linked_family_history_id" = UUID [fam:xxx].

═══════════════════════════════════════════
GESTIONE PROMEMORIA DALLA CHAT
═══════════════════════════════════════════
Puoi eseguire QUALSIASI azione sui promemoria direttamente tramite i tool disponibili.

REGOLE DI COMPORTAMENTO:
- "crea" / "aggiungi" / "ricordami di" → usa create_reminder, agisci DIRETTAMENTE senza chiedere conferma
- "disattiva" / "non mi serve più" / "metti in pausa" → usa deactivate_reminder, agisci DIRETTAMENTE
- "riattiva" / "riabilita" / "reattiva" → usa activate_reminder, agisci DIRETTAMENTE
- "mostrami" / "elenca" / "vedi" i promemoria → usa list_reminders
- "elimina" / "cancella" / "rimuovi" → PRIMA chiedi conferma nel "reply": "Sei sicuro di voler eliminare il promemoria '[titolo]'? Una volta eliminato non sarà recuperabile." — usa delete_reminder SOLO dopo conferma esplicita dell'utente (sì, ok, confermo, ecc.)

RICERCA DEL PROMEMORIA CORRETTO:
1. Cerca nei PROMEMORIA ATTIVI e DISATTIVATI quello che corrisponde per titolo/descrizione.
2. Se NESSUNA corrispondenza: rispondiche non hai trovato un promemoria corrispondente.
3. Se PIÙ corrispondenze ambigue: elencale e chiedi quale. NON chiamare alcun tool finché non è chiaro quale.
4. Se UNA corrispondenza chiara: procedi con l'azione appropriata.

Dopo ogni azione completata conferma brevemente: "Ho [creato/attivato/disattivato/eliminato] il promemoria '[titolo]'."

RICORDI DI SALUTE — quando l'utente chiede di eliminare un ricordo ("elimina il ricordo della slogatura", "togli il ricordo X", "quel ricordo non è più rilevante"):
1. Cerca SOLO tra i ricordi marcati [non documentato]. I ricordi [documentato] NON possono essere eliminati dalla chat.
2. Se l'utente prova a eliminare un ricordo [documentato], rispondi: "Questo ricordo è collegato a un documento ufficiale e non può essere eliminato dalla chat. Vai nell'Archivio per gestirlo." memory_delete = null.
3. Se PIÙ corrispondenze tra i [non documentato]: elencale nel "reply" e chiedi quale. memory_delete = null.
4. Se UNA corrispondenza, chiedi conferma: "Vuoi eliminare il ricordo '[description]'? Non è collegato a nessun documento, quindi verrà rimosso definitivamente." e popola memory_delete con memory_id e description.

In una stessa risposta NON proporre contemporaneamente memory_suggestions e azioni di eliminazione. reminder_action e memory_delete sono mutuamente esclusivi: al massimo uno dei due per risposta.

═══════════════════════════════════════════
DISCLAIMER
═══════════════════════════════════════════
Quando la conversazione riguarda sintomi o condizioni cliniche, chiudi con: "Ricorda: questo non sostituisce il parere del tuo medico."

═══════════════════════════════════════════
OUTPUT FORMAT (OBBLIGATORIO)
═══════════════════════════════════════════
Rispondi SEMPRE con un JSON valido di questa forma esatta:

{
  "reply": "testo per l'utente",
  "memory_suggestions": null | [
    {
      "description": "string",
      "body_part": "string | null",
      "approximate_date": "YYYY-MM-DD o YYYY | null",
      "notes": "string | null",
      "body_systems": ["..."],
      "similar_existing_id": "uuid del ricordo simile | null"
    }
  ],
  "prevention_suggestion": null | {
    "title": "string",
    "reason": "string",
    "suggested_specialty": "string | null",
    "suggested_timeframe": "string | null",
    "linked_health_memory_id": "uuid | null",
    "linked_document_id": "uuid | null",
    "linked_family_history_id": "uuid | null",
    "source": "ai_prevention | ai_family_prevention",
    "priority": "urgent | normal",
    "priority_reason": "string | null"
  },
  "reminder_action": null | {
    "reminder_id": "uuid del promemoria [rem:xxx]",
    "action": "activate | disable | delete",
    "title": "string"
  },
  "memory_delete": null | {
    "memory_id": "uuid del ricordo [mem:xxx] non documentato",
    "description": "string"
  }
}

NOTA RETROCOMPATIBILITÀ: "memory_suggestions" è SEMPRE un array (anche con un solo elemento) oppure null. Non usare la chiave singolare "memory_suggestion".

REGOLE DI PRIORITÀ:
- "urgent": richiede attenzione entro 3 mesi, OPPURE legata a condizione cronica/valore anomalo. Includi nel "reply": "Ho classificato questo promemoria come urgente perché [motivo]."
- "normal": screening di routine.

Massimo UN prevention_suggestion, UN reminder_action e UN memory_delete per risposta.

IMPORTANTE: Puoi agire sul database SOLO tramite i tool disponibili:
- create_reminder → crea un nuovo promemoria
- activate_reminder → riattiva un promemoria disattivato
- deactivate_reminder → disattiva un promemoria attivo
- delete_reminder → elimina definitivamente (solo dopo conferma utente)
- list_reminders → elenca promemoria per l'utente
- create_health_memory → salva ricordi di salute
Per qualsiasi altro dato (condizioni, farmaci, documenti) NON hai capacità di modifica diretta — indirizza l'utente alle sezioni dell'app.`;
}

export type ChatResponse = {
  reply: string;
  memory_suggestions: any[] | null;
  prevention_suggestion: any | null;
  reminder_action: any | null;
  memory_delete: any | null;
};

function normalizeDate(s?: string | null): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return null;
}

// Extracts JSON from Claude's text response robustly:
// handles markdown code fences, surrounding prose, and escape sequences.
function parseClaudeJson(text: string): any | null {
  // 1. Direct parse (clean response)
  try { return JSON.parse(text); } catch {}

  // 2. Strip ALL backtick code fences globally (no multiline regex edge cases)
  const noFences = text.replace(/```(?:json)?/g, "").trim();
  try { return JSON.parse(noFences); } catch {}

  // 3. Extract the outermost { ... } block and parse that
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  // 4. Last resort: regex-extract just the "reply" field value so the user
  //    always sees the reply text and never raw JSON.
  const m = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  if (m) {
    const replyText = m[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    return { reply: replyText };
  }

  return null;
}

// Strips common markdown formatting from Claude's reply text so the chat
// bubble shows plain readable text instead of raw markdown syntax.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/\*(.*?)\*/gs, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function callAnthropic(apiKey: string, body: object): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required for direct browser access (dev only — never expose this key in prod)
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function chatLocal(
  messages: { role: string; content: string }[],
  userId: string
): Promise<ChatResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY non impostato nel file .env");

  const system = await buildSystemPrompt(userId);

  const firstRes = await callAnthropic(apiKey, {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system,
    messages,
    tools: TOOLS,
  });

  if (!firstRes.ok) {
    const t = await firstRes.text();
    throw new Error(`Claude API error ${firstRes.status}: ${t}`);
  }

  const firstJson = await firstRes.json();
  const toolUseBlock = (firstJson.content || []).find((b: any) => b.type === "tool_use");

  if (toolUseBlock) {
    const { id: toolUseId, name: toolName, input: toolInput } = toolUseBlock;

    let dbError: any = null;
    let toolResult = "";
    let fallbackReply = "";

    if (toolName === "create_reminder") {
      const { title, reason, suggested_timeframe, priority } = toolInput;
      ({ error: dbError } = await (supabase as any).from("reminders").insert({
        user_id: userId,
        title,
        reason: reason || null,
        suggested_timeframe: suggested_timeframe || null,
        priority: priority || "normal",
        source: "ai_chat",
        enabled: true,
        status: "active",
      }));
      toolResult = dbError ? `Errore: ${dbError.message}` : "Promemoria creato con successo.";
      fallbackReply = dbError ? `Errore: ${dbError.message}` : `Ho creato il promemoria "${title}".`;
    } else if (toolName === "activate_reminder") {
      const { reminder_id, title } = toolInput;
      ({ error: dbError } = await supabase.from("reminders").update({ enabled: true }).eq("id", reminder_id).eq("user_id", userId));
      toolResult = dbError ? `Errore: ${dbError.message}` : "Promemoria riattivato.";
      fallbackReply = dbError ? `Errore: ${dbError.message}` : `Ho riattivato il promemoria "${title}".`;
    } else if (toolName === "deactivate_reminder") {
      const { reminder_id, title } = toolInput;
      ({ error: dbError } = await supabase.from("reminders").update({ enabled: false }).eq("id", reminder_id).eq("user_id", userId));
      toolResult = dbError ? `Errore: ${dbError.message}` : "Promemoria disattivato.";
      fallbackReply = dbError ? `Errore: ${dbError.message}` : `Ho disattivato il promemoria "${title}".`;
    } else if (toolName === "delete_reminder") {
      const { reminder_id, title } = toolInput;
      ({ error: dbError } = await supabase.from("reminders").delete().eq("id", reminder_id).eq("user_id", userId));
      toolResult = dbError ? `Errore: ${dbError.message}` : "Promemoria eliminato.";
      fallbackReply = dbError ? `Errore: ${dbError.message}` : `Ho eliminato il promemoria "${title}".`;
    } else if (toolName === "list_reminders") {
      const filter: string = toolInput.filter || "all";
      const allRems = await supabase
        .from("reminders")
        .select("id,title,enabled,priority,suggested_timeframe")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      const rows = (allRems.data || []) as any[];
      const filtered = filter === "active" ? rows.filter(r => r.enabled)
                     : filter === "inactive" ? rows.filter(r => !r.enabled)
                     : rows;
      if (filtered.length === 0) {
        toolResult = filter === "active" ? "Nessun promemoria attivo."
                   : filter === "inactive" ? "Nessun promemoria disattivato."
                   : "Nessun promemoria trovato.";
      } else {
        toolResult = filtered.map((r: any) =>
          `[rem:${r.id}] ${r.title}${r.priority === "urgent" ? " ⚠️" : ""} — ${r.enabled ? "ATTIVO" : "DISATTIVATO"}${r.suggested_timeframe ? ` — ${r.suggested_timeframe}` : ""}`
        ).join("\n");
      }
      fallbackReply = "";
    } else if (toolName === "create_health_memory") {
      const { description, body_part, event_date, notes } = toolInput;
      ({ error: dbError } = await supabase.from("health_memories").insert({
        user_id: userId,
        description,
        body_part: body_part || null,
        event_date: normalizeDate(event_date) || null,
        notes: notes || null,
        source: "user_chat",
      }));
      toolResult = dbError ? `Errore: ${dbError.message}` : "Ricordo salvato.";
      fallbackReply = dbError ? `Errore: ${dbError.message}` : `Ho salvato il ricordo "${description}".`;
    }

    let reply = fallbackReply;

    const secondMaxTokens = toolName === "list_reminders" ? 4096 : 1024;
    const secondRes = await callAnthropic(apiKey, {
      model: "claude-sonnet-4-6",
      max_tokens: secondMaxTokens,
      system,
      messages: [
        ...messages,
        { role: "assistant", content: firstJson.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: toolResult }] },
      ],
      tools: TOOLS,
    });

    if (secondRes.ok) {
      const secondJson = await secondRes.json();
      const textBlock = (secondJson.content || []).find((b: any) => b.type === "text");
      if (textBlock?.text) {
        const p = parseClaudeJson(textBlock.text);
        reply = stripMarkdown((p?.reply) || textBlock.text);
      }
    }

    return { reply, memory_suggestions: null, prevention_suggestion: null, reminder_action: null, memory_delete: null };
  }

  // No tool used — parse the standard JSON response
  const raw = (firstJson.content || []).find((b: any) => b.type === "text")?.text || "";
  const parsed = parseClaudeJson(raw);

  // If all strategies fail, show the raw text rather than crashing.
  // stripMarkdown keeps it readable even if it contains some formatting.
  if (!parsed) {
    return { reply: stripMarkdown(raw), memory_suggestions: null, prevention_suggestion: null, reminder_action: null, memory_delete: null };
  }

  let memorySuggestions: any[] | null = null;
  if (Array.isArray(parsed.memory_suggestions)) {
    const filtered = parsed.memory_suggestions.filter(Boolean);
    memorySuggestions = filtered.length > 0 ? filtered : null;
  } else if (parsed.memory_suggestion) {
    memorySuggestions = [parsed.memory_suggestion];
  }

  return {
    reply: stripMarkdown(parsed.reply ?? raw),
    memory_suggestions: memorySuggestions,
    prevention_suggestion: parsed.prevention_suggestion || null,
    reminder_action: parsed.reminder_action || null,
    memory_delete: parsed.memory_delete || null,
  };
}
