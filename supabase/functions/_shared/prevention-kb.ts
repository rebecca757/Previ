// Italian preventive care knowledge base.
// Sources: Ministero della Salute, Piano Nazionale della Prevenzione 2020–2025,
// LEA screening programs (DPCM 12/01/2017), ISS / EpiCentro guidelines.
// Each rule is generic / informational — not medical advice.

export type Sex = "M" | "F" | "any";
export type Priority = "overdue" | "upcoming" | "future";

export type KBRule = {
  id: string;
  title: string;
  specialty?: string;
  frequency_months: number;          // cadence
  min_age: number;
  max_age?: number;
  sex: Sex;
  source_label: string;              // e.g. "LEA — Screening colorettale"
  rationale: string;                 // why
  // optional conditional triggers
  if_conditions?: string[];          // substrings of chronic condition names
  if_family_conditions?: string[];   // family history substring match
  if_medications?: string[];         // medication substring match
  if_memory_keywords?: string[];     // health memory description match
  if_lifestyle?: ("smoker" | "obesity" | "hypertension" | "high_cholesterol")[];
  earlier_age_if_family_months?: number; // start earlier if family history hits
};

export const KNOWLEDGE_BASE: KBRule[] = [
  // ─── LEA national screening programs ──────────────────────────────────────
  {
    id: "lea-mammografia",
    title: "Mammografia di screening",
    specialty: "Senologia / Radiologia",
    frequency_months: 24,
    min_age: 50, max_age: 69, sex: "F",
    source_label: "LEA — Programma nazionale screening mammografico",
    rationale: "Screening organizzato gratuito per la diagnosi precoce del tumore al seno (donne 50–69, ogni 2 anni).",
    if_family_conditions: ["seno", "mammar", "ovai"],
    earlier_age_if_family_months: 60, // 5 anni prima se familiarità
  },
  {
    id: "lea-pap-hpv",
    title: "Pap-test / HPV-DNA test",
    specialty: "Ginecologia",
    frequency_months: 36,
    min_age: 25, max_age: 64, sex: "F",
    source_label: "LEA — Screening cervicale (Ministero della Salute)",
    rationale: "Screening cervicale: Pap-test ogni 3 anni dai 25–30, HPV-DNA test ogni 5 anni dai 30–64.",
  },
  {
    id: "lea-sof-colon",
    title: "Test del sangue occulto nelle feci (SOF)",
    specialty: "Gastroenterologia",
    frequency_months: 24,
    min_age: 50, max_age: 74, sex: "any",
    source_label: "LEA — Screening colorettale",
    rationale: "Screening organizzato per la prevenzione del tumore del colon-retto (50–74 anni, ogni 2 anni).",
    if_family_conditions: ["colon", "rett", "intestino"],
    earlier_age_if_family_months: 120, // 10 anni prima se familiarità di primo grado
  },

  // ─── Cardiovascular / metabolic ──────────────────────────────────────────
  {
    id: "pressione",
    title: "Misurazione pressione arteriosa",
    specialty: "Medicina generale",
    frequency_months: 12,
    min_age: 18, sex: "any",
    source_label: "ISS / EpiCentro — Prevenzione cardiovascolare",
    rationale: "Controllo annuale della pressione: l'ipertensione spesso non dà sintomi.",
    if_family_conditions: ["ipertension", "press"],
    if_conditions: ["ipertension"],
  },
  {
    id: "profilo-lipidico",
    title: "Profilo lipidico (colesterolo, trigliceridi)",
    specialty: "Medicina generale",
    frequency_months: 60,
    min_age: 40, sex: "any",
    source_label: "Piano Nazionale Prevenzione — Rischio cardiovascolare",
    rationale: "Valutazione del rischio cardiovascolare con colesterolo totale, HDL, LDL e trigliceridi.",
    if_family_conditions: ["infarto", "cardiovascolar", "colesterolo"],
    if_conditions: ["diabet", "ipertension"],
    earlier_age_if_family_months: 120,
  },
  {
    id: "glicemia",
    title: "Glicemia a digiuno",
    specialty: "Medicina generale",
    frequency_months: 36,
    min_age: 45, sex: "any",
    source_label: "ISS — Linee guida prevenzione diabete tipo 2",
    rationale: "Screening per diabete tipo 2 ogni 3 anni dai 45 anni; prima in presenza di familiarità o obesità.",
    if_family_conditions: ["diabet"],
    if_conditions: ["diabet", "obesit"],
    earlier_age_if_family_months: 120,
  },
  {
    id: "ecg-cardiologica",
    title: "Visita cardiologica con ECG",
    specialty: "Cardiologia",
    frequency_months: 24,
    min_age: 40, sex: "any",
    source_label: "Piano Nazionale Prevenzione — Patologie cardiovascolari",
    rationale: "Valutazione cardiologica periodica in presenza di fattori di rischio o familiarità.",
    if_family_conditions: ["infarto", "cardiac", "cardiovascolar"],
    if_conditions: ["ipertension"],
  },

  // ─── Bone / endocrine ────────────────────────────────────────────────────
  {
    id: "moc-osteoporosi",
    title: "MOC (densitometria ossea)",
    specialty: "Reumatologia / Endocrinologia",
    frequency_months: 24,
    min_age: 65, sex: "F",
    source_label: "LEA — Prevenzione osteoporosi post-menopausale",
    rationale: "Densitometria ossea raccomandata per donne dopo i 65 anni, prima se ci sono fattori di rischio.",
  },
  {
    id: "tiroide-tsh",
    title: "TSH (funzionalità tiroidea)",
    specialty: "Endocrinologia",
    frequency_months: 60,
    min_age: 35, sex: "F",
    source_label: "ISS — Prevenzione tireopatie",
    rationale: "Controllo TSH periodico nelle donne adulte; più frequente in presenza di familiarità.",
    if_family_conditions: ["tiroid"],
  },

  // ─── Lifestyle / age-based ────────────────────────────────────────────────
  {
    id: "vista-occhi",
    title: "Visita oculistica",
    specialty: "Oculistica",
    frequency_months: 24,
    min_age: 40, sex: "any",
    source_label: "Ministero della Salute — Prevenzione visiva",
    rationale: "Controllo della pressione oculare, retina e vista; importante dopo i 40 anni.",
  },
  {
    id: "dermatologica-nei",
    title: "Visita dermatologica (controllo nei)",
    specialty: "Dermatologia",
    frequency_months: 12,
    min_age: 18, sex: "any",
    source_label: "ISS — Prevenzione melanoma",
    rationale: "Controllo annuale dei nei, soprattutto in presenza di familiarità o esposizione solare.",
    if_family_conditions: ["melanom", "pelle"],
  },
  {
    id: "ecografia-addome",
    title: "Ecografia addome completo",
    specialty: "Radiologia",
    frequency_months: 60,
    min_age: 50, sex: "any",
    source_label: "Piano Nazionale Prevenzione — Screening organi addominali",
    rationale: "Controllo periodico di fegato, reni, vescica e pancreas dopo i 50 anni.",
  },
  {
    id: "psa-prostata",
    title: "PSA — Antigene prostatico specifico",
    specialty: "Urologia",
    frequency_months: 24,
    min_age: 50, sex: "M",
    source_label: "ISS — Prevenzione patologie prostatiche",
    rationale: "Valutazione PSA da concordare con il medico; più precoce in caso di familiarità.",
    if_family_conditions: ["prostat"],
    earlier_age_if_family_months: 60,
  },
  {
    id: "vaccino-antinfluenzale",
    title: "Vaccinazione antinfluenzale stagionale",
    specialty: "Medicina generale",
    frequency_months: 12,
    min_age: 60, sex: "any",
    source_label: "Ministero della Salute — Campagna vaccinale annuale",
    rationale: "Raccomandata ogni autunno per gli over 60 e per chi ha condizioni croniche.",
    if_conditions: ["diabet", "asma", "bpco", "cardi", "ipertension"],
  },
  {
    id: "spirometria",
    title: "Spirometria",
    specialty: "Pneumologia",
    frequency_months: 24,
    min_age: 40, sex: "any",
    source_label: "ISS — Prevenzione BPCO",
    rationale: "Valutazione funzione respiratoria, indicata soprattutto per fumatori o ex-fumatori.",
    if_lifestyle: ["smoker"],
  },
];

export function buildKBReference(): string {
  return KNOWLEDGE_BASE.map((r) => {
    const parts = [
      `${r.id}: ${r.title}`,
      `cadenza ${r.frequency_months} mesi`,
      `${r.min_age}${r.max_age ? `–${r.max_age}` : "+"} anni`,
      `sesso ${r.sex}`,
      `fonte: ${r.source_label}`,
    ];
    return `- ${parts.join(" | ")} — ${r.rationale}`;
  }).join("\n");
}
