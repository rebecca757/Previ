import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Lang = "it" | "en";
export const SUPPORTED_LANGS: Lang[] = ["it", "en"];
const STORAGE_KEY = "previ-lang";

// Nested dictionaries. Access with dot paths, e.g. t("auth.signIn").
// Italian is the source/fallback language; English mirrors its keys.
const dictionaries: Record<Lang, Record<string, any>> = {
  it: {
    common: {
      loading: "Caricamento…",
      save: "Salva",
      cancel: "Annulla",
      delete: "Elimina",
      add: "Aggiungi",
      back: "Indietro",
      next: "Avanti",
      wait: "Attendi…",
      email: "Email",
      password: "Password",
      logout: "Esci",
      error: "Errore",
    },
    lang: { it: "Italiano", en: "English", label: "Lingua" },
    landing: {
      tagline1: "Il tuo assistente",
      tagline2: "sanitario personale",
      subtitle:
        "Organizza la tua storia clinica, comprendi i tuoi referti con l'AI e ricevi consigli di prevenzione personalizzati. Senza sostituire il tuo medico.",
      ctaStart: "Inizia ora",
      ctaHaveAccount: "Ho già un account",
      f1Title: "Organizza",
      f1Text: "Carica referti, esami e ricordi in un unico archivio sicuro.",
      f2Title: "Comprendi",
      f2Text: "L'AI spiega i tuoi documenti in italiano semplice e chiaro.",
      f3Title: "Previeni",
      f3Text: "Promemoria personalizzati per i tuoi controlli di prevenzione.",
    },
    auth: {
      titleSignup: "Crea il tuo account",
      titleSignin: "Bentornato",
      subtitleSignup: "Bastano un'email e una password.",
      subtitleSignin: "Accedi al tuo assistente sanitario.",
      inviteLabel: "Codice invito",
      invitePlaceholder: "Inserisci il codice che hai ricevuto",
      createAccount: "Crea account",
      signIn: "Accedi",
      toggleToSignin: "Hai già un account? Accedi",
      toggleToSignup: "Non hai un account? Registrati",
      inviteRequired: "Inserisci il codice invito per registrarti.",
      inviteExhausted:
        "Questo codice invito ha raggiunto il numero massimo di utilizzi. Contatta il team Prevì.",
      inviteInvalid: "Codice invito non valido. Controlla di averlo inserito correttamente.",
      createdOnboard: "Account creato! Ora completa il tuo profilo.",
      createdConfirm: "Account creato! Controlla la tua email per confermare.",
      confirmTitle: "Controlla la tua email",
      confirmBody:
        "Abbiamo inviato un link di conferma a {email}. Clicca il link per attivare l'account, poi accedi per completare il tuo profilo.",
      confirmSpam: "Non trovi l'email? Controlla nella cartella spam o attendi qualche minuto.",
      confirmGoSignin: "Vai all'accesso",
      genericError: "Errore",
    },
    nav: {
      home: "Home",
      archive: "Archivio",
      assistant: "Assistente",
      prevention: "Prevenzione",
      profile: "Profilo",
      activeProfile: "Profilo attivo",
      myProfile: "Il mio profilo",
      linkedAccounts: "Account collegati",
      linkedAccount: "Account collegato",
      you: "Tu",
      genericProfile: "Profilo",
      viewingAccount: "Stai visualizzando l'account di {name}",
      ageYear: "{n} anno",
      ageYears: "{n} anni",
    },
    onboarding: {
      stepOf: "Step {n} di 3",
      s1Title: "Dati anagrafici",
      s1Sub: "Iniziamo dalle basi.",
      fullName: "Nome e cognome *",
      dob: "Data di nascita *",
      sex: "Sesso biologico",
      select: "Seleziona",
      selectOptional: "Seleziona (opzionale)",
      sexM: "Maschile",
      sexF: "Femminile",
      sexNS: "Preferisco non specificare",
      bloodType: "Gruppo sanguigno",
      continue: "Continua",
      back: "Indietro",
      s2Title: "Condizioni di salute",
      s2Sub: "Separati da virgola. Tutti i campi sono opzionali.",
      allergies: "Allergie note",
      allergiesPh: "penicillina, lattosio…",
      conditions: "Condizioni croniche",
      conditionsPh: "ipertensione, diabete tipo 2…",
      meds: "Farmaci assunti regolarmente",
      medsPh: "es. ramipril 5mg…",
      s3Title: "Dati biometrici iniziali",
      s3Sub: "Potrai aggiornarli ogni mese dal Profilo.",
      weight: "Peso (kg)",
      height: "Altezza (cm)",
      readyNote: "Perfetto! Il tuo profilo è pronto. Puoi aggiornare questi dati ogni mese dalla sezione Profilo.",
      complete: "Completa",
      saving: "Salvataggio…",
      created: "Profilo creato!",
    },
    profile: {
      title: "Profilo",
      secStable: "Dati stabili",
      secMeds: "Farmaci regolari",
      secConditions: "Condizioni croniche",
      secFamily: "Anamnesi Familiare",
      secLinked: "Account collegati",
      secMonthly: "Aggiornamento mensile",
      secSettings: "Impostazioni",
      fullName: "Nome e cognome",
      dob: "Data di nascita",
      sex: "Sesso biologico",
      bloodType: "Gruppo sanguigno",
      allergiesComma: "Allergie (separate da virgola)",
      saveChanges: "Salva modifiche",
      saving: "Salvataggio…",
      lastUpdate: "Ultimo aggiornamento: {date}. Vuoi aggiornare?",
      weight: "Peso (kg)",
      height: "Altezza (cm)",
      updateData: "Aggiorna dati",
      settingsNote:
        "I tuoi dati sono protetti e accessibili solo a te. Prevì usa l'AI per aiutarti a comprendere — non sostituisce mai un medico.",
      languageLabel: "Lingua dell'app",
      languageNote: "Cambia la lingua dell'interfaccia e delle risposte dell'assistente AI.",
      updated: "Profilo aggiornato",
      dataUpdated: "Dati aggiornati",
      linked: {
        intro:
          "Inserisci l'email di un altro utente Prevì già registrato per richiedere l'accesso al suo account. Quando accetterà, potrai passare al suo profilo dal selettore in alto.",
        emailPh: "email@esempio.it",
        link: "Collega",
        incoming: "Richieste ricevute",
        wantsAccess: "vuole accedere al tuo account",
        accept: "Accetta",
        accessible: "Account a cui hai accesso",
        none: "Nessun account collegato. Inserisci un'email qui sopra per inviare una richiesta.",
        linked: "Collegato",
        pending: "In attesa di conferma",
        user: "Utente",
        requestSent: "Richiesta inviata. L'altro utente deve accettarla.",
        noUser: "Nessun utente registrato con questa email.",
        selfLink: "Non puoi collegare il tuo stesso account.",
        already: "Hai già una richiesta o un collegamento con questo utente.",
        accepted: "Richiesta accettata.",
        rejectConfirm: "Rifiutare questa richiesta?",
        removeConfirm: "Rimuovere questo collegamento?",
        cancelConfirm: "Annullare la richiesta?",
      },
    },
  },
  en: {
    common: {
      loading: "Loading…",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      add: "Add",
      back: "Back",
      next: "Next",
      wait: "Please wait…",
      email: "Email",
      password: "Password",
      logout: "Sign out",
      error: "Error",
    },
    lang: { it: "Italiano", en: "English", label: "Language" },
    landing: {
      tagline1: "Your personal",
      tagline2: "health assistant",
      subtitle:
        "Organize your medical history, understand your reports with AI and get personalized prevention advice. Without replacing your doctor.",
      ctaStart: "Get started",
      ctaHaveAccount: "I already have an account",
      f1Title: "Organize",
      f1Text: "Upload reports, tests and memories into one secure archive.",
      f2Title: "Understand",
      f2Text: "AI explains your documents in plain, clear language.",
      f3Title: "Prevent",
      f3Text: "Personalized reminders for your prevention check-ups.",
    },
    auth: {
      titleSignup: "Create your account",
      titleSignin: "Welcome back",
      subtitleSignup: "Just an email and a password.",
      subtitleSignin: "Sign in to your health assistant.",
      inviteLabel: "Invite code",
      invitePlaceholder: "Enter the code you received",
      createAccount: "Create account",
      signIn: "Sign in",
      toggleToSignin: "Already have an account? Sign in",
      toggleToSignup: "Don't have an account? Sign up",
      inviteRequired: "Enter your invite code to sign up.",
      inviteExhausted:
        "This invite code has reached its maximum number of uses. Contact the Prevì team.",
      inviteInvalid: "Invalid invite code. Please check that you entered it correctly.",
      createdOnboard: "Account created! Now complete your profile.",
      createdConfirm: "Account created! Check your email to confirm.",
      confirmTitle: "Check your email",
      confirmBody:
        "We sent a confirmation link to {email}. Click the link to activate your account, then sign in to complete your profile.",
      confirmSpam: "Can't find the email? Check your spam folder or wait a few minutes.",
      confirmGoSignin: "Go to sign in",
      genericError: "Error",
    },
    nav: {
      home: "Home",
      archive: "Archive",
      assistant: "Assistant",
      prevention: "Prevention",
      profile: "Profile",
      activeProfile: "Active profile",
      myProfile: "My profile",
      linkedAccounts: "Linked accounts",
      linkedAccount: "Linked account",
      you: "You",
      genericProfile: "Profile",
      viewingAccount: "You're viewing {name}'s account",
      ageYear: "{n} year",
      ageYears: "{n} years",
    },
    onboarding: {
      stepOf: "Step {n} of 3",
      s1Title: "Personal details",
      s1Sub: "Let's start with the basics.",
      fullName: "Full name *",
      dob: "Date of birth *",
      sex: "Biological sex",
      select: "Select",
      selectOptional: "Select (optional)",
      sexM: "Male",
      sexF: "Female",
      sexNS: "Prefer not to say",
      bloodType: "Blood type",
      continue: "Continue",
      back: "Back",
      s2Title: "Health conditions",
      s2Sub: "Comma-separated. All fields are optional.",
      allergies: "Known allergies",
      allergiesPh: "penicillin, lactose…",
      conditions: "Chronic conditions",
      conditionsPh: "hypertension, type 2 diabetes…",
      meds: "Medications taken regularly",
      medsPh: "e.g. ramipril 5mg…",
      s3Title: "Initial biometric data",
      s3Sub: "You can update them monthly from your Profile.",
      weight: "Weight (kg)",
      height: "Height (cm)",
      readyNote: "Great! Your profile is ready. You can update this data every month from the Profile section.",
      complete: "Finish",
      saving: "Saving…",
      created: "Profile created!",
    },
    profile: {
      title: "Profile",
      secStable: "Stable data",
      secMeds: "Regular medications",
      secConditions: "Chronic conditions",
      secFamily: "Family history",
      secLinked: "Linked accounts",
      secMonthly: "Monthly update",
      secSettings: "Settings",
      fullName: "Full name",
      dob: "Date of birth",
      sex: "Biological sex",
      bloodType: "Blood type",
      allergiesComma: "Allergies (comma-separated)",
      saveChanges: "Save changes",
      saving: "Saving…",
      lastUpdate: "Last update: {date}. Want to update?",
      weight: "Weight (kg)",
      height: "Height (cm)",
      updateData: "Update data",
      settingsNote:
        "Your data is protected and accessible only to you. Prevì uses AI to help you understand — it never replaces a doctor.",
      languageLabel: "App language",
      languageNote: "Change the language of the interface and of the AI assistant's replies.",
      updated: "Profile updated",
      dataUpdated: "Data updated",
      linked: {
        intro:
          "Enter the email of another registered Prevì user to request access to their account. Once they accept, you can switch to their profile from the selector at the top.",
        emailPh: "email@example.com",
        link: "Link",
        incoming: "Incoming requests",
        wantsAccess: "wants to access your account",
        accept: "Accept",
        accessible: "Accounts you can access",
        none: "No linked accounts. Enter an email above to send a request.",
        linked: "Linked",
        pending: "Awaiting confirmation",
        user: "User",
        requestSent: "Request sent. The other user must accept it.",
        noUser: "No registered user with this email.",
        selfLink: "You can't link your own account.",
        already: "You already have a request or link with this user.",
        accepted: "Request accepted.",
        rejectConfirm: "Reject this request?",
        removeConfirm: "Remove this link?",
        cancelConfirm: "Cancel the request?",
      },
    },
  },
};

function lookup(dict: Record<string, any>, path: string): string | undefined {
  const val = path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), dict);
  return typeof val === "string" ? val : undefined;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof localStorage !== "undefined") {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "it" || s === "en") return s;
    }
    return "it";
  });

  // On mount, adopt the logged-in user's saved preference (overrides localStorage).
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("preferred_language")
        .eq("id", data.session.user.id)
        .maybeSingle();
      const pl = (prof as any)?.preferred_language;
      if (pl === "it" || pl === "en") {
        setLangState(pl);
        if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, pl);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, l);
    // Persist to the profile for logged-in users so the AI uses it too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        (supabase as any).from("profiles").update({ preferred_language: l }).eq("id", data.session.user.id);
      }
    });
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = lookup(dictionaries[lang], key) ?? lookup(dictionaries.it, key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within a LanguageProvider");
  return ctx;
}

export function useT() {
  return useLang().t;
}

/** Compact IT/EN toggle. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex rounded-full border bg-card p-0.5 text-xs font-medium ${className}`}>
      {SUPPORTED_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
