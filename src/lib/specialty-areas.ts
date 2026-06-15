// Body area / specialty taxonomy for the "Riassunto per specialista" feature.
// Each area has a list of lowercase keywords used to match free-text fields
// (condition names, document titles/types, body parts, body_systems arrays,
// family-history conditions, reminder titles/specialty).
export type SpecialtyArea = {
  id: string;
  label: string;
  keywords: string[];
  family_categories?: string[];
};

export const SPECIALTY_AREAS: SpecialtyArea[] = [
  {
    id: "head_neck",
    label: "Testa e collo",
    keywords: ["testa", "collo", "cervic", "tiroide", "linfonod", "mal di testa", "cefalea", "emicrania"],
  },
  {
    id: "cardio",
    label: "Cuore e apparato cardiovascolare",
    keywords: ["cuor", "cardio", "pressione", "ipertens", "colesterolo", "ecg", "ecocardio", "infarto", "vascolare", "circol", "aritm"],
    family_categories: ["hypertension", "cardiovascular_disease", "stroke"],
  },
  {
    id: "respiratory",
    label: "Polmoni e apparato respiratorio",
    keywords: ["polmon", "respirat", "broncho", "bronc", "asma", "spirometr", "tosse", "torace", "rx torace"],
  },
  {
    id: "digestive",
    label: "Addome e apparato digerente",
    keywords: ["addom", "stomac", "intestin", "colon", "gastr", "fegato", "epat", "pancreas", "cistifel", "reflusso", "celiac", "colonscop", "gastroscop"],
    family_categories: ["colorectal_cancer"],
  },
  {
    id: "urinary",
    label: "Reni e apparato urinario",
    keywords: ["ren", "urin", "vesc", "prostat", "nefr", "calcoli"],
  },
  {
    id: "musculoskeletal",
    label: "Sistema muscolo-scheletrico",
    keywords: ["ossa", "osteo", "articolaz", "muscol", "tendin", "schiena", "lombar", "scoliosi", "frattur", "ortoped", "reumat", "artrite", "artrosi", "ginocch", "anca", "spalla", "piede", "polso", "caviglia", "gomito", "mano"],
    family_categories: ["osteoporosis"],
  },
  {
    id: "knee",
    label: "Ginocchio",
    keywords: ["ginocch", "menisc", "crociat", "rotul"],
  },
  {
    id: "hip",
    label: "Anca",
    keywords: ["anca", "femor"],
  },
  {
    id: "shoulder",
    label: "Spalla",
    keywords: ["spalla", "cuffia dei rotatori", "scapol"],
  },
  {
    id: "foot",
    label: "Piede",
    keywords: ["piede", "tallon", "caviglia", "alluce"],
  },
  {
    id: "wrist",
    label: "Polso",
    keywords: ["polso", "carpale", "mano"],
  },
  {
    id: "neuro",
    label: "Sistema nervoso",
    keywords: ["neuro", "cervell", "nerv", "emicran", "cefal", "epiless", "parkinson", "alzheimer", "ictus", "memoria"],
    family_categories: ["stroke"],
  },
  {
    id: "eyes",
    label: "Occhi",
    keywords: ["occh", "vista", "vis", "ocul", "oculist", "retina", "miop", "cataratta", "glaucoma"],
  },
  {
    id: "ent",
    label: "Orecchie, naso, gola",
    keywords: ["orecch", "udit", "naso", "rinit", "gola", "otorinol", "sinus", "tonsil", "faring"],
  },
  {
    id: "skin",
    label: "Pelle",
    keywords: ["pelle", "cutane", "dermat", "neo", "melanoma", "eczema", "psorias", "acne"],
    family_categories: ["melanoma"],
  },
  {
    id: "endocrine",
    label: "Sistema endocrino (tiroide, diabete)",
    keywords: ["endocrin", "tiroide", "diabet", "glicem", "insulin", "ormon", "surren"],
    family_categories: ["diabetes", "type1_diabetes"],
  },
  {
    id: "gyn",
    label: "Apparato riproduttivo femminile",
    keywords: ["ginec", "utero", "ovari", "mestru", "menopaus", "pap test", "seno", "mammar", "mammograf", "hpv", "gravidanz"],
    family_categories: ["breast_cancer", "ovarian_cancer", "cervical_cancer"],
  },
  {
    id: "uro",
    label: "Apparato riproduttivo maschile",
    keywords: ["androl", "prostat", "testicol", "pene", "fertil", "psa"],
    family_categories: ["prostate_cancer"],
  },
];

export const GENERAL_AREA: SpecialtyArea = {
  id: "general",
  label: "Altro / Generale",
  keywords: [],
};

export function matchesArea(text: string | null | undefined, area: SpecialtyArea): boolean {
  if (area.id === "general") return true;
  if (!text) return false;
  const t = text.toLowerCase();
  return area.keywords.some((k) => t.includes(k));
}
