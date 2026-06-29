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
