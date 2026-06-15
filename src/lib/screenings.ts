// Official Italian preventive screenings & care dataset.
// Sources: LEA DPCM 12/01/2017, PNPV 2023-2025, ISS Progetto CUORE, AIMO 2025, SIOMMMS,
// SIMG, SIDeMaST, SIGO, SIA, SIU, SIC, SIS, SIE, SID.
// SINGLE source of truth for prevention suggestions. AI must NEVER invent suggestions outside this list.

export type FamilyHistoryOverride = {
  condition: string; // semantic key
  age_min_override: number;
};

export type ScreeningDetail = {
  a_cosa_serve: string;
  a_chi_e_utile: string;
  fonte: string;
  fonte_url?: string;
};

export type OfficialScreening = {
  id: string;
  category: string;
  name: string;
  description: string;
  source: string;
  eligible_sex: ("M" | "F")[];
  age_min: number;
  age_max: number;
  frequency_months: number | null;
  ssn_free: boolean;
  note: string;
  family_history_override?: FamilyHistoryOverride;
  family_history_required?: boolean;
  detail: ScreeningDetail;
};

export type FamilyTrigger = {
  relation: string;
  condition_label: string;
  onset_age: number | null;
};

export type EligibleScreening = OfficialScreening & {
  _family_trigger?: FamilyTrigger | null;
};

export const OFFICIAL_SCREENINGS: OfficialScreening[] = [
  // ── ESAMI DI ROUTINE ──
  {
    id: "r001",
    category: "Esami di routine",
    name: "Esami del sangue di base",
    description: "Emocromo completo, glicemia, colesterolo totale/LDL/HDL, trigliceridi, transaminasi, creatinina.",
    source: "ISS / SIMG – Società Italiana di Medicina Generale",
    eligible_sex: ["M", "F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Raccomandati ogni 1-2 anni in adulti sani. Ogni anno dai 40 anni o con fattori di rischio. Con prescrizione del medico di base.",
    detail: {
      a_cosa_serve: "Gli esami del sangue di base permettono di rilevare precocemente anomalie come anemia, alterazioni del colesterolo, glicemia alta, problemi epatici o renali — spesso senza sintomi evidenti. Intervenire prima che questi valori peggiorino riduce significativamente il rischio di malattie croniche.",
      a_chi_e_utile: "Tutti gli adulti dai 18 anni, anche in assenza di sintomi. Particolarmente importante dai 40 anni o in presenza di sovrappeso, fumo, familiarità per diabete o malattie cardiovascolari.",
      fonte: "ISS / SIMG – Società Italiana di Medicina Generale",
      fonte_url: "https://www.simg.it",
    },
  },
  {
    id: "r002",
    category: "Esami di routine",
    name: "Analisi delle urine",
    description: "Esame chimico-fisico e microscopico delle urine per la valutazione della funzionalità renale.",
    source: "ISS / SIMG – Società Italiana di Medicina Generale",
    eligible_sex: ["M", "F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Raccomandato ogni 1-2 anni insieme agli esami del sangue.",
    detail: {
      a_cosa_serve: "L'esame delle urine rileva precocemente infezioni urinarie silenti, disfunzioni renali, tracce di sangue o glucosio nelle urine — segnali che spesso non causano sintomi fino a quando il danno non è avanzato.",
      a_chi_e_utile: "Tutti gli adulti ogni 1-2 anni, in abbinamento agli esami del sangue. Più frequente in presenza di diabete, ipertensione o infezioni urinarie ricorrenti.",
      fonte: "ISS / SIMG – Società Italiana di Medicina Generale",
      fonte_url: "https://www.simg.it",
    },
  },
  {
    id: "r003",
    category: "Esami di routine",
    name: "Misurazione pressione arteriosa",
    description: "Controllo periodico della pressione per la prevenzione dell'ipertensione.",
    source: "ISS Progetto CUORE / Piano Nazionale della Prevenzione 2020-2025",
    eligible_sex: ["M", "F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Almeno una volta l'anno dai 18 anni. Eseguibile in farmacia. Più frequente con familiarità o sovrappeso.",
    detail: {
      a_cosa_serve: "L'ipertensione arteriosa è spesso asintomatica per anni, ma danneggia silenziosamente cuore, reni e vasi sanguigni aumentando il rischio di infarto e ictus. Misurarla regolarmente è il modo più semplice per identificarla e trattarla in tempo.",
      a_chi_e_utile: "Tutti gli adulti dai 18 anni. Chi ha familiarità per ipertensione dovrebbe controllarla ogni 6 mesi. Eseguibile gratuitamente in farmacia.",
      fonte: "ISS Progetto CUORE / Piano Nazionale della Prevenzione 2020-2025",
      fonte_url: "https://www.cuore.iss.it",
    },
  },
  {
    id: "r004",
    category: "Esami di routine",
    name: "Controllo peso e IMC",
    description: "Misurazione del peso corporeo e calcolo dell'Indice di Massa Corporea.",
    source: "ISS / Piano Nazionale della Prevenzione 2020-2025",
    eligible_sex: ["M", "F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Raccomandato almeno una volta l'anno. Eseguibile in farmacia o autonomamente.",
    detail: {
      a_cosa_serve: "Un Indice di Massa Corporea (IMC) elevato è associato a rischio aumentato di diabete tipo 2, malattie cardiovascolari, alcuni tumori e problemi articolari. Monitorare il peso nel tempo permette di intervenire con modifiche allo stile di vita prima che si sviluppino complicanze.",
      a_chi_e_utile: "Tutti gli adulti almeno una volta l'anno. Particolarmente importante in presenza di familiarità per diabete, malattie cardiovascolari o storia personale di sovrappeso.",
      fonte: "ISS / Piano Nazionale della Prevenzione 2020-2025",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "r005",
    category: "Esami di routine",
    name: "Visita odontoiatrica e igiene orale",
    description: "Controllo della salute dentale e igiene professionale.",
    source: "Ministero della Salute – Linee guida nazionali per la promozione della salute orale",
    eligible_sex: ["M", "F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Raccomandata ogni 6-12 mesi.",
    detail: {
      a_cosa_serve: "Le patologie del cavo orale — carie, parodontite, lesioni precancerose — spesso progrediscono senza dolore. La parodontite in particolare è collegata a un aumento del rischio cardiovascolare e a complicanze del diabete. La diagnosi precoce permette trattamenti meno invasivi e costosi.",
      a_chi_e_utile: "Tutti gli adulti ogni 6-12 mesi. Fondamentale per chi fuma, ha il diabete o una dieta ad alto contenuto di zuccheri.",
      fonte: "Ministero della Salute – Linee guida nazionali per la promozione della salute orale",
      fonte_url: "https://www.salute.gov.it",
    },
  },

  // ── PREVENZIONE CARDIOVASCOLARE ──
  {
    id: "c001",
    category: "Prevenzione cardiovascolare",
    name: "Profilo lipidico (colesterolo e trigliceridi)",
    description: "Colesterolo totale, LDL, HDL e trigliceridi per la valutazione del rischio cardiovascolare.",
    source: "ISS Progetto CUORE / Linee guida ESC/EAS 2025 / PNP 2020-2025",
    eligible_sex: ["M", "F"],
    age_min: 35,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Ogni 2 anni dai 35 anni. Ogni anno con ipercolesterolemia, diabete o familiarità cardiovascolare.",
    detail: {
      a_cosa_serve: "Colesterolo LDL alto e trigliceridi elevati sono tra i principali fattori di rischio per infarto e ictus, spesso senza alcun sintomo. Il profilo lipidico permette di calcolare il rischio cardiovascolare reale e intervenire con dieta, attività fisica o terapia prima che si verifichino eventi gravi.",
      a_chi_e_utile: "Tutti dai 35 anni ogni 2 anni. Ogni anno in presenza di familiarità per malattie cardiovascolari, diabete o ipertensione. Prima dei 35 con familiarità per infarto precoce.",
      fonte: "ISS Progetto CUORE / Linee guida ESC/EAS 2025",
      fonte_url: "https://www.cuore.iss.it",
    },
  },
  {
    id: "c002",
    category: "Prevenzione cardiovascolare",
    name: "Glicemia a digiuno",
    description: "Controllo della glicemia per la prevenzione del diabete mellito tipo 2.",
    source: "ISS Progetto CUORE / PNP 2020-2025",
    eligible_sex: ["M", "F"],
    age_min: 45,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Ogni 2 anni dai 45 anni. Dai 35 con sovrappeso, familiarità per diabete o ipertensione.",
    family_history_override: { condition: "diabetes", age_min_override: 35 },
    detail: {
      a_cosa_serve: "Il diabete tipo 2 si sviluppa gradualmente e rimane silente per anni. La glicemia a digiuno permette di identificare la fase di pre-diabete — quando è ancora possibile prevenire o ritardare significativamente la malattia con modifiche allo stile di vita.",
      a_chi_e_utile: "Tutti dai 45 anni ogni 2 anni. Dai 30 anni in presenza di familiarità per diabete tipo 2, sovrappeso o ipertensione.",
      fonte: "ISS Progetto CUORE / Società Italiana di Diabetologia (SID)",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "c003",
    category: "Prevenzione cardiovascolare",
    name: "Valutazione rischio cardiovascolare (Punteggio ISS/CUORE)",
    description: "Calcolo del rischio di infarto o ictus nei successivi 10 anni tramite il punteggio individuale ISS.",
    source: "ISS Progetto CUORE – PNP 2020-2025",
    eligible_sex: ["M", "F"],
    age_min: 40,
    age_max: 69,
    frequency_months: 12,
    ssn_free: false,
    note: "Ogni anno dai 40 ai 69 anni tramite il medico di base. Strumento ufficiale ISS per la prevenzione cardiovascolare primaria.",
    detail: {
      a_cosa_serve: "Il punteggio ISS/CUORE calcola la probabilità di avere un infarto o un ictus nei prossimi 10 anni, combinando pressione, colesterolo, glicemia, fumo ed età. Permette al medico di personalizzare le raccomandazioni di prevenzione in base al rischio reale, non generico.",
      a_chi_e_utile: "Tutti tra i 40 e i 69 anni, ogni anno tramite il medico di base. Strumento ufficiale sviluppato dall'Istituto Superiore di Sanità.",
      fonte: "ISS Progetto CUORE – Piano Nazionale della Prevenzione 2020-2025",
      fonte_url: "https://www.cuore.iss.it",
    },
  },
  {
    id: "c004",
    category: "Prevenzione cardiovascolare",
    name: "ECG (elettrocardiogramma a riposo)",
    description: "Valutazione dell'attività elettrica del cuore.",
    source: "SIMG / Società Italiana di Cardiologia",
    eligible_sex: ["M", "F"],
    age_min: 40,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Ogni 2 anni dai 40 anni. Prima dei 40 con familiarità cardiovascolare o per sport agonistico.",
    detail: {
      a_cosa_serve: "L'elettrocardiogramma a riposo rileva aritmie, anomalie della conduzione cardiaca e segni di pregresso danno al cuore, spesso asintomatici. È un esame semplice, rapido e indolore che fornisce informazioni preziose sulla salute del cuore.",
      a_chi_e_utile: "Tutti dai 40 anni ogni 2 anni. Prima dei 40 in presenza di familiarità per malattie cardiache precoci, palpitazioni o per chi pratica sport agonistico.",
      fonte: "SIMG / Società Italiana di Cardiologia",
      fonte_url: "https://www.sicitalia.org",
    },
  },

  // ── SCREENING ONCOLOGICI LEA ──
  {
    id: "s001",
    category: "Screening oncologico",
    name: "Screening tumore della mammella — Mammografia",
    description: "Mammografia bilaterale per la diagnosi precoce del tumore al seno.",
    source: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
    eligible_sex: ["F"],
    age_min: 50,
    age_max: 69,
    frequency_months: 24,
    ssn_free: true,
    note: "Gratuita dal SSN ogni 2 anni. Alcune Regioni estendono alle fasce 45–49 e 70–74.",
    family_history_override: { condition: "breast_cancer", age_min_override: 40 },
    detail: {
      a_cosa_serve: "La mammografia rileva noduli al seno non ancora palpabili, permettendo una diagnosi in stadio iniziale quando le probabilità di guarigione completa superano il 90%. È lo screening che ha ridotto maggiormente la mortalità per tumore al seno in Italia.",
      a_chi_e_utile: "Donne tra 50 e 69 anni ogni 2 anni, gratuitamente tramite SSN. In presenza di familiarità di primo grado per tumore al seno, è raccomandata dai 40 anni o 10 anni prima dell'età di diagnosi del familiare più giovane.",
      fonte: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "s002",
    category: "Screening oncologico",
    name: "Screening cervice uterina — Pap test",
    description: "Esame citologico cervico-vaginale per la diagnosi precoce del tumore della cervice.",
    source: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
    eligible_sex: ["F"],
    age_min: 25,
    age_max: 29,
    frequency_months: 36,
    ssn_free: true,
    note: "Gratuito dal SSN ogni 3 anni nella fascia 25–29 anni.",
    detail: {
      a_cosa_serve: "Il Pap test identifica cellule anomale del collo dell'utero prima che diventino tumorali, permettendo un trattamento semplice e risolutivo. Grazie a questo screening, il tumore della cervice uterina è oggi uno dei più prevenibili.",
      a_chi_e_utile: "Donne tra 25 e 29 anni ogni 3 anni, gratuitamente tramite SSN. Dai 30 anni viene sostituito dall'HPV test.",
      fonte: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "s003",
    category: "Screening oncologico",
    name: "Screening cervice uterina — HPV test",
    description: "Test HPV-DNA per la diagnosi precoce del tumore della cervice uterina.",
    source: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
    eligible_sex: ["F"],
    age_min: 30,
    age_max: 64,
    frequency_months: 60,
    ssn_free: true,
    note: "Sostituisce il Pap test dai 30 anni. Gratuito dal SSN ogni 5 anni.",
    detail: {
      a_cosa_serve: "Il test HPV rileva la presenza del papillomavirus umano, principale causa del tumore della cervice uterina. È più sensibile del Pap test e permette di identificare le donne a rischio prima che si sviluppino lesioni, consentendo un monitoraggio mirato.",
      a_chi_e_utile: "Donne tra 30 e 64 anni ogni 5 anni, gratuitamente tramite SSN. Sostituisce il Pap test come test primario dai 30 anni.",
      fonte: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "s004",
    category: "Screening oncologico",
    name: "Screening tumore del colon-retto — Sangue occulto nelle feci (SOF)",
    description: "Test per la diagnosi precoce del tumore colorettale.",
    source: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
    eligible_sex: ["M", "F"],
    age_min: 50,
    age_max: 69,
    frequency_months: 24,
    ssn_free: true,
    note: "Gratuito dal SSN ogni 2 anni.",
    family_history_override: { condition: "colorectal_cancer", age_min_override: 40 },
    detail: {
      a_cosa_serve: "Il test del sangue occulto nelle feci rileva tracce di sangue invisibili a occhio nudo, segnale precoce di polipi o tumori del colon-retto. Individuato in fase iniziale, il tumore colorettale è guaribile nel 90% dei casi. Lo screening ha ridotto la mortalità del 15-25% nelle popolazioni in cui è applicato.",
      a_chi_e_utile: "Tutti tra 50 e 69 anni ogni 2 anni, gratuitamente tramite SSN. In presenza di familiarità di primo grado per tumore al colon, anticipato ai 40 anni o 10 anni prima dell'età di diagnosi del familiare.",
      fonte: "LEA DPCM 12/01/2017 – Ministero della Salute / ISS EpiCentro",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },

  // ── VISITE SPECIALISTICHE PREVENTIVE ──
  {
    id: "sp001",
    category: "Visita specialistica",
    name: "Visita dermatologica — mappatura nei",
    description: "Controllo dermatologico con mappatura dei nei per la diagnosi precoce del melanoma.",
    source: "Società Italiana di Dermatologia (SIDeMaST) / ISS",
    eligible_sex: ["M", "F"],
    age_min: 25,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Raccomandata ogni anno dai 25 anni. Ogni 6 mesi con molti nei, fototipo chiaro o familiarità per melanoma.",
    detail: {
      a_cosa_serve: "Il melanoma è il tumore della pelle più pericoloso, ma se individuato in stadio iniziale ha una sopravvivenza a 5 anni superiore al 95%. La mappatura dei nei permette di monitorare nel tempo lesioni sospette e intervenire prima che degenerino.",
      a_chi_e_utile: "Tutti dai 25 anni ogni anno. Ogni 6 mesi in presenza di molti nei, fototipo chiaro, storia di scottature gravi o familiarità per melanoma.",
      fonte: "Società Italiana di Dermatologia (SIDeMaST) / ISS",
      fonte_url: "https://www.sidemast.org",
    },
  },
  {
    id: "sp002",
    category: "Visita specialistica",
    name: "Visita oculistica",
    description: "Controllo della salute visiva per la diagnosi precoce di glaucoma, cataratta e degenerazione maculare.",
    source: "Raccomandazione ISS di Buona Pratica Clinica – AIMO ETS 2025",
    eligible_sex: ["M", "F"],
    age_min: 40,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Ogni 2 anni dai 40 anni. Ogni anno con diabete, ipertensione o familiarità per glaucoma.",
    detail: {
      a_cosa_serve: "Glaucoma, degenerazione maculare e cataratta sono le principali cause di cecità evitabile in Italia. Nella maggior parte dei casi progrediscono senza sintomi per anni. La diagnosi precoce permette trattamenti efficaci che preservano la vista nel tempo.",
      a_chi_e_utile: "Tutti dai 40 anni ogni 2 anni. Ogni anno in presenza di diabete, ipertensione, familiarità per glaucoma o degenerazione maculare.",
      fonte: "Raccomandazione ISS di Buona Pratica Clinica – AIMO ETS 2025",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "sp003",
    category: "Visita specialistica",
    name: "Visita ginecologica",
    description: "Controllo periodico della salute ginecologica.",
    source: "Società Italiana di Ginecologia e Ostetricia (SIGO) / SIMG",
    eligible_sex: ["F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Raccomandata ogni anno dai 18 anni o dall'inizio dell'attività sessuale.",
    detail: {
      a_cosa_serve: "La visita ginecologica permette di rilevare precocemente patologie come endometriosi, fibromi, cisti ovariche e infezioni — spesso asintomatiche. È anche il momento per eseguire il Pap test o l'HPV test e discutere salute riproduttiva e contraccezione.",
      a_chi_e_utile: "Tutte le donne dai 18 anni ogni anno, o dall'inizio dell'attività sessuale.",
      fonte: "Società Italiana di Ginecologia e Ostetricia (SIGO) / SIMG",
      fonte_url: "https://www.sigo.it",
    },
  },
  {
    id: "sp004",
    category: "Visita specialistica",
    name: "Visita andrologica",
    description: "Controllo della salute dell'apparato riproduttivo maschile.",
    source: "Società Italiana di Andrologia (SIA) / SIMG",
    eligible_sex: ["M"],
    age_min: 18,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Raccomandata ogni 2 anni dai 18 anni.",
    detail: {
      a_cosa_serve: "La visita andrologica valuta la salute dell'apparato riproduttivo maschile, rilevando precocemente varicocele, disfunzioni erettili, tumori testicolari e problemi di fertilità. Molte di queste condizioni sono curabili se diagnosticate in tempo.",
      a_chi_e_utile: "Tutti gli uomini dai 18 anni ogni 2 anni. Particolarmente importante in adolescenza e nella prima età adulta per la diagnosi di varicocele e tumori testicolari.",
      fonte: "Società Italiana di Andrologia (SIA) / SIMG",
      fonte_url: "https://www.sia-andrologia.it",
    },
  },
  {
    id: "sp005",
    category: "Visita specialistica",
    name: "Visita urologica + PSA",
    description: "Controllo della salute prostatica tramite visita urologica e dosaggio dell'antigene prostatico specifico (PSA).",
    source: "Società Italiana di Urologia (SIU) / SIMG",
    eligible_sex: ["M"],
    age_min: 50,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Raccomandato ogni anno dai 50 anni. Dai 40 con familiarità per tumore alla prostata.",
    family_history_override: { condition: "prostate_cancer", age_min_override: 40 },
    detail: {
      a_cosa_serve: "Il tumore alla prostata è il più frequente negli uomini italiani. Il dosaggio del PSA, combinato con la visita urologica, permette di identificare alterazioni precoci. Diagnosticato in stadio iniziale, è guaribile nel 95% dei casi.",
      a_chi_e_utile: "Uomini dai 50 anni ogni anno. Dai 40-45 anni in presenza di familiarità di primo grado per tumore alla prostata o origine afroamericana.",
      fonte: "Società Italiana di Urologia (SIU) / SIMG",
      fonte_url: "https://www.siu.it",
    },
  },
  {
    id: "sp006",
    category: "Visita specialistica",
    name: "Visita cardiologica",
    description: "Valutazione specialistica della salute cardiaca.",
    source: "Società Italiana di Cardiologia (SIC) / SIMG",
    eligible_sex: ["M", "F"],
    age_min: 40,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Raccomandata ogni 2 anni dai 40 anni. Più frequente con ipertensione, ipercolesterolemia o familiarità cardiovascolare.",
    family_history_override: { condition: "cardiovascular_disease", age_min_override: 35 },
    detail: {
      a_cosa_serve: "La visita cardiologica valuta la salute del cuore e dei vasi sanguigni, integrando l'anamnesi familiare con l'esame clinico e strumentale. Permette di identificare fattori di rischio e pianificare una prevenzione personalizzata per infarto, ictus e aritmie.",
      a_chi_e_utile: "Tutti dai 40 anni ogni 2 anni. Prima dei 40 in presenza di familiarità per malattie cardiache precoci, ipertensione, colesterolo alto o diabete.",
      fonte: "Società Italiana di Cardiologia (SIC) / SIMG",
      fonte_url: "https://www.sicitalia.org",
    },
  },
  {
    id: "sp007",
    category: "Visita specialistica",
    name: "Visita senologica",
    description: "Visita specialistica al seno per la diagnosi precoce di patologie benigne e maligne.",
    source: "Società Italiana di Senologia (SIS) / SIMG",
    eligible_sex: ["F"],
    age_min: 30,
    age_max: 999,
    frequency_months: 12,
    ssn_free: false,
    note: "Raccomandata ogni anno dai 30 anni.",
    detail: {
      a_cosa_serve: "La visita senologica rileva noduli, asimmetrie e alterazioni del seno non visibili alla mammografia, specialmente nelle donne giovani con tessuto mammario denso. Integrata con ecografia o mammografia, offre una valutazione completa del rischio.",
      a_chi_e_utile: "Tutte le donne dai 30 anni ogni anno. Particolarmente importante tra i 30 e i 50 anni, quando la mammografia è meno indicata ma il rischio può essere già presente per familiarità.",
      fonte: "Società Italiana di Senologia (SIS) / SIMG",
      fonte_url: "https://www.senologia.it",
    },
  },
  {
    id: "sp008",
    category: "Visita specialistica",
    name: "Visita endocrinologica / diabetologica",
    description: "Valutazione della funzione endocrina e del metabolismo glicemico.",
    source: "Società Italiana di Endocrinologia (SIE) / Società Italiana di Diabetologia (SID)",
    eligible_sex: ["M", "F"],
    age_min: 45,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Raccomandata ogni 2 anni dai 45 anni. Prima in presenza di sovrappeso, familiarità per diabete o valori glicemici borderline.",
    family_history_override: { condition: "diabetes", age_min_override: 35 },
    detail: {
      a_cosa_serve: "La visita endocrinologica valuta la funzione di tiroide, surreni, pancreas e sistema ormonale. Permette di identificare precocemente diabete, ipotiroidismo, sindrome metabolica e altre condizioni che aumentano il rischio cardiovascolare e riducono la qualità della vita.",
      a_chi_e_utile: "Tutti dai 45 anni ogni 2 anni. Dai 30-35 anni in presenza di familiarità per diabete tipo 2, sovrappeso, sindrome dell'ovaio policistico o valori glicemici borderline.",
      fonte: "Società Italiana di Endocrinologia (SIE) / Società Italiana di Diabetologia (SID)",
      fonte_url: "https://www.sieitalia.it",
    },
  },

  // ── PREVENZIONE OSTEOPOROSI ──
  {
    id: "os001",
    category: "Prevenzione osteoporosi",
    name: "MOC — Densitometria ossea (DEXA)",
    description: "Misurazione della densità minerale ossea per la diagnosi precoce dell'osteoporosi.",
    source: "Ministero della Salute / SIOMMMS / PNP 2020-2025",
    eligible_sex: ["F"],
    age_min: 65,
    age_max: 999,
    frequency_months: 24,
    ssn_free: false,
    note: "Raccomandata per le donne dai 65 anni ogni 2 anni. Prima con menopausa precoce, terapia cortisonica o familiarità per osteoporosi.",
    detail: {
      a_cosa_serve: "L'osteoporosi riduce la densità ossea aumentando il rischio di fratture, in particolare a femore, polso e vertebre. Le fratture da osteoporosi negli anziani hanno conseguenze gravi sulla qualità della vita e sull'autonomia. La MOC misura la densità ossea prima che le fratture si verifichino.",
      a_chi_e_utile: "Donne dai 65 anni ogni 2 anni. Prima dei 65 in presenza di menopausa precoce, terapia cortisonica prolungata, basso peso corporeo o familiarità per osteoporosi.",
      fonte: "Ministero della Salute / SIOMMMS / PNP 2020-2025",
      fonte_url: "https://www.siommms.it",
    },
  },

  // ── VACCINAZIONI PNPV 2023-2025 ──
  {
    id: "v001",
    category: "Vaccinazione",
    name: "Vaccinazione antinfluenzale",
    description: "Vaccinazione stagionale contro l'influenza.",
    source: "PNPV 2023-2025 – Ministero della Salute",
    eligible_sex: ["M", "F"],
    age_min: 60,
    age_max: 999,
    frequency_months: 12,
    ssn_free: true,
    note: "Gratuita per tutti dai 60 anni. Raccomandata (a pagamento) anche per adulti con patologie croniche e operatori sanitari.",
    detail: {
      a_cosa_serve: "L'influenza stagionale può causare complicanze gravi — polmonite, ospedalizzazione — soprattutto negli anziani e nelle persone con patologie croniche. La vaccinazione riduce il rischio di complicanze del 40-60% e protegge anche chi non può vaccinarsi.",
      a_chi_e_utile: "Tutti dai 60 anni ogni anno, gratuitamente tramite SSN. Raccomandato anche per adulti con patologie croniche (diabete, cardiopatie, asma), donne in gravidanza e operatori sanitari.",
      fonte: "PNPV 2023-2025 – Ministero della Salute",
      fonte_url: "https://www.salute.gov.it/portale/vaccinazioni/homeVaccinazioni.jsp",
    },
  },
  {
    id: "v002",
    category: "Vaccinazione",
    name: "Vaccinazione antipneumococcica",
    description: "Prevenzione della polmonite e delle forme invasive di malattia pneumococcica.",
    source: "PNPV 2023-2025 – Ministero della Salute",
    eligible_sex: ["M", "F"],
    age_min: 65,
    age_max: 65,
    frequency_months: null,
    ssn_free: true,
    note: "Offerta gratuitamente alla coorte dei 65enni, in co-somministrazione con antinfluenzale.",
    detail: {
      a_cosa_serve: "Il pneumococco è la principale causa di polmonite batterica negli anziani. La vaccinazione riduce significativamente il rischio di forme invasive e di ricovero ospedaliero, con effetto protettivo duraturo.",
      a_chi_e_utile: "Offerto gratuitamente a tutti i 65enni, in co-somministrazione con il vaccino antinfluenzale. Raccomandato anche per adulti con patologie croniche a qualsiasi età.",
      fonte: "PNPV 2023-2025 – Ministero della Salute",
      fonte_url: "https://www.salute.gov.it/portale/vaccinazioni/homeVaccinazioni.jsp",
    },
  },
  {
    id: "v003",
    category: "Vaccinazione",
    name: "Richiamo difterite-tetano-pertosse (dTpa)",
    description: "Richiamo vaccinale ogni 10 anni.",
    source: "PNPV 2023-2025 – Ministero della Salute",
    eligible_sex: ["M", "F"],
    age_min: 18,
    age_max: 999,
    frequency_months: 120,
    ssn_free: true,
    note: "Richiamo raccomandato ogni 10 anni per tutta la vita adulta.",
    detail: {
      a_cosa_serve: "La protezione vaccinale contro difterite, tetano e pertosse si riduce nel tempo. Il tetano in particolare può essere contratto anche da adulti sani tramite ferite banali e ha una mortalità significativa senza vaccinazione. Il richiamo ogni 10 anni mantiene la protezione attiva.",
      a_chi_e_utile: "Tutti gli adulti dai 18 anni ogni 10 anni, gratuitamente tramite SSN. Particolarmente importante per chi lavora a contatto con animali, terra o in ambienti a rischio.",
      fonte: "PNPV 2023-2025 – Ministero della Salute",
      fonte_url: "https://www.salute.gov.it/portale/vaccinazioni/homeVaccinazioni.jsp",
    },
  },
  // ── ESTENSIONI PER FAMILIARITÀ ──
  {
    id: "s005",
    category: "Screening oncologico",
    name: "Colonoscopia — screening per familiarità",
    description: "Esame endoscopico del colon-retto in caso di familiarità per tumore colorettale.",
    source: "AIOM / Linee guida ESMO / LEA – Ministero della Salute",
    eligible_sex: ["M", "F"],
    age_min: 30,
    age_max: 999,
    frequency_months: 60,
    ssn_free: false,
    family_history_required: true,
    note: "Raccomandata in caso di familiarità per tumore colorettale, con cadenza ogni 5 anni.",
    detail: {
      a_cosa_serve: "La colonscopia permette di visualizzare direttamente l'interno del colon, identificare e rimuovere polipi prima che diventino tumori. Per chi ha familiarità è più accurata del test del sangue occulto e permette una prevenzione attiva, non solo diagnostica.",
      a_chi_e_utile: "Chi ha un familiare di primo o secondo grado con tumore al colon-retto, specialmente se diagnosticato prima dei 60 anni. L'età di inizio dipende dall'età di diagnosi del familiare più giovane.",
      fonte: "ESGE (European Society of Gastrointestinal Endoscopy) / ISS EpiCentro",
      fonte_url: "https://www.epicentro.iss.it",
    },
  },
  {
    id: "sp009",
    category: "Screening oncologico",
    name: "Ecografia mammaria — screening per familiarità",
    description: "Ecografia del seno per diagnosi precoce in donne con familiarità per tumore mammario.",
    source: "AIRC / AIOM / Linee guida europee screening mammario",
    eligible_sex: ["F"],
    age_min: 25,
    age_max: 49,
    frequency_months: 12,
    ssn_free: false,
    family_history_required: true,
    note: "Raccomandata annualmente in donne con familiarità di primo grado per tumore al seno, prima dell'età per la mammografia.",
    detail: {
      a_cosa_serve: "Nelle donne giovani con tessuto mammario denso, la mammografia è meno efficace. L'ecografia mammaria è in grado di rilevare noduli non visibili alla mammografia ed è particolarmente utile per chi ha familiarità per tumore al seno prima dei 50 anni.",
      a_chi_e_utile: "Donne con familiarità di primo grado per tumore al seno, tra i 25 e i 49 anni, ogni anno. Da affiancare alla visita senologica.",
      fonte: "AIRC / AIOM / Linee guida europee screening mammario",
      fonte_url: "https://www.airc.it/prevenzione",
    },
  },
  {
    id: "sp_brca",
    category: "Consulenza genetica",
    name: "Consulenza genetica oncologica (BRCA)",
    description: "Valutazione del rischio genetico ereditario per tumori di mammella, ovaio e pancreas tramite consulenza specialistica.",
    source: "Linee guida AIOM 2025 – Tumori eredo-familiari / Piano Oncologico Nazionale 2023-2027",
    eligible_sex: ["F"] as ("M" | "F")[],
    age_min: 25,
    age_max: 999,
    frequency_months: null,
    ssn_free: false,
    family_history_required: true,
    note: "Raccomandata per donne con familiarità per tumore al seno diagnosticato sotto i 50 anni, o tumore ovarico in familiari di primo grado. Eseguibile presso centri di genetica oncologica.",
    detail: {
      a_cosa_serve: "La consulenza genetica valuta il rischio di essere portatrice di mutazioni BRCA1/2, che aumentano significativamente il rischio di tumori al seno e all'ovaio. Se confermata la mutazione, è possibile accedere a programmi di sorveglianza intensiva o prevenzione chirurgica profilattica.",
      a_chi_e_utile: "Donne con un familiare di primo grado con tumore al seno diagnosticato prima dei 50 anni, o con tumore ovarico a qualsiasi età. Secondo le linee guida AIOM 2025, il test genetico è raccomandato a cascata nei familiari del caso indice.",
      fonte: "Linee guida AIOM 2025 – Tumori eredo-familiari",
      fonte_url: "https://www.aiom.it/category/pubblicazioni/raccomandazioni-position-paper/",
    },
  },
];

export type FamilyConditionEntry = {
  condition: string;            // raw condition text
  category: string | null;      // normalized category
  onset_age: number | null;     // diagnosis age of the relative
  relation: string;             // human-readable relation
  relation_degree: "first" | "second" | null;
};

export type ScreeningContext = {
  age: number | null;
  sex: "M" | "F" | null;
  familyConditions: FamilyConditionEntry[];
};

export function eligibleScreenings(ctx: ScreeningContext): EligibleScreening[] {
  if (ctx.age == null || !ctx.sex) return [];
  const out = new Map<string, EligibleScreening>();

  for (const s of OFFICIAL_SCREENINGS) {
    if (!s.eligible_sex.includes(ctx.sex as "M" | "F")) continue;
    if (s.family_history_required) continue;
    if (ctx.age < s.age_min || ctx.age > s.age_max) continue;
    out.set(s.id, { ...s, _family_trigger: null });
  }

  const addScreeningOverride = (
    id: string,
    ageMinOverride: number,
    familyEntry: FamilyConditionEntry,
    frequencyMonthsOverride?: number,
  ) => {
    const screening = OFFICIAL_SCREENINGS.find((s) => s.id === id);
    if (!screening) return;
    if (!screening.eligible_sex.includes(ctx.sex as "M" | "F")) return;
    if (ctx.age! < ageMinOverride) return;

    const trigger: FamilyTrigger = {
      relation: familyEntry.relation,
      condition_label: familyEntry.condition,
      onset_age: familyEntry.onset_age,
    };
    const candidate: EligibleScreening = {
      ...screening,
      age_min: ageMinOverride,
      frequency_months: frequencyMonthsOverride ?? screening.frequency_months,
      _family_trigger: trigger,
    };
    const existing = out.get(id);
    if (!existing || !existing._family_trigger || ageMinOverride < existing.age_min) {
      out.set(id, candidate);
    }
  };

  ctx.familyConditions.forEach((entry) => {
    const cat = entry.category;
    const degree = entry.relation_degree;
    const onsetAge = entry.onset_age;

    if (cat === "cardiovascular_disease") {
      const isEarly = degree === "first"
        ? onsetAge != null && onsetAge < 55
        : onsetAge != null && onsetAge <= 50;
      if (isEarly) {
        addScreeningOverride("c001", 25, entry);
        addScreeningOverride("c004", 30, entry);
        addScreeningOverride("sp006", 35, entry);
      }
    }

    if (cat === "diabetes" && degree === "first") {
      addScreeningOverride("c002", 30, entry);
      addScreeningOverride("sp008", 35, entry);
    }

    if (cat === "hypertension") {
      addScreeningOverride("r003", 18, entry, 6);
    }

    if (cat === "colorectal_cancer") {
      const startAge = onsetAge ? Math.max(30, onsetAge - 10) : 40;
      addScreeningOverride("s004", startAge, entry);
      addScreeningOverride("s005", startAge, entry);
    }

    if (cat === "breast_cancer" && degree === "first") {
      const startAge = onsetAge ? Math.max(25, onsetAge - 10) : 40;
      addScreeningOverride("s001", startAge, entry);
      addScreeningOverride("sp009", 25, entry);
    }
  });

  return Array.from(out.values());
}

/** Compute relation degree from a free-text relation label. */
export function getRelationDegree(relation: string): "first" | "second" {
  const t = relation.toLowerCase();
  return /madre|padre|fratello|sorella|figlio|figlia/.test(t) ? "first" : "second";
}

/** Deterministic Italian keyword normalization for family-history conditions. */
export function normalizeCondition(text: string): string {
  const t = text.toLowerCase();
  if (/ictus|stroke/.test(t)) return "stroke";
  if (/fibrillaz|aritmia/.test(t)) return "arrhythmia";
  if (/infarto|cardio|coronar|bypass|cardiovasc|angina|cuore/.test(t)) return "cardiovascular_disease";
  if (/diabet/.test(t)) return "diabetes";
  if (/pressione|ipertens/.test(t)) return "hypertension";
  if (/colesterol|ipercolesterol/.test(t)) return "hypercholesterolemia";
  if (/colon|retto|colorett|intestin|polipo/.test(t)) return "colorectal_cancer";
  if (/seno|mammell/.test(t)) return "breast_cancer";
  if (/ovaio|ovarico/.test(t)) return "ovarian_cancer";
  if (/endometrio|uterina|utero/.test(t)) return "endometrial_cancer";
  if (/pancrea/.test(t)) return "pancreatic_cancer";
  if (/prostata/.test(t)) return "prostate_cancer";
  if (/melanoma|cutaneo/.test(t)) return "melanoma";
  if (/polmone|polmonare/.test(t)) return "lung_cancer";
  if (/alzheimer|demenz/.test(t)) return "alzheimer";
  if (/osteoporos/.test(t)) return "osteoporosis";
  return "other";
}

export const normalizeFamilyCondition = normalizeCondition;
export const computeRelationDegree = getRelationDegree;

export function frequencyLabel(s: OfficialScreening): string {
  if (s.frequency_months == null) return "Una tantum";
  if (s.frequency_months >= 12) {
    const years = Math.round(s.frequency_months / 12);
    return `Ogni ${years} ann${years === 1 ? "o" : "i"}`;
  }
  return `Ogni ${s.frequency_months} mesi`;
}
