# Prevì — Personal AI Health Assistant

## What this app is
Prevì is an Italian health management web app for adults 25-50. It helps users:
- Store and understand health documents (referti, esami, prescrizioni)
- Save health memories (events without documents)
- Get personalized prevention screening recommendations
- Manage medications and chronic conditions
- Generate clinical summaries for specialist visits

## Tech stack
- React + TypeScript + Vite (frontend)
- Supabase (database + auth + storage)
- Anthropic Claude API (AI features)
- TailwindCSS + shadcn/ui (styling)
- pdf-lib + pdfjs-dist (PDF handling)

## Key database tables
- `profiles` — user data (name, dob, sex, blood_type)
- `documents` — uploaded health files (PDFs, images)
- `health_memories` — self-reported health events (no document)
- `health_conditions` — chronic conditions with start/end dates
- `medications` — structured medication list with dosage and frequency
- `allergies` — structured allergy list with severity
- `family_history` — family health history with condition_category and relation_degree
- `reminders` — prevention reminders (active/inactive)
- `biometric_history` — weight/height over time
- `chat_messages` — persistent chat history
- `monthly_summaries` — AI-generated monthly health summaries

## AI features
- Chat assistant — calls the `chat` Supabase Edge Function (supabase/functions/chat); the Anthropic key stays server-side (ANTHROPIC_API_KEY secret), never in the client bundle
- Document interpretation — auto-analyzes uploaded PDFs
- Health memory extraction — detects and saves health events from chat
- Prevention filtering — matches official Italian screening guidelines to user profile

## Prevention system
- Static dataset of official Italian screenings (LEA, PNPV, ISS, società scientifiche) in src/lib/screenings.ts
- `getEligibleScreenings(age, sex, familyHistory)` in screenings.ts is the SINGLE source of truth for eligibility: it filters by age/sex AND applies family-history overrides. prevenzione.tsx consumes it directly — do NOT reintroduce a parallel copy of this logic.
- Family history overrides: a relative's condition can unlock a screening or anticipate its starting age (shown in the UI with an "a partire dai N anni" note and a purple family-trigger badge).
- condition_category field maps free text to: cardiovascular_disease, stroke, arrhythmia, diabetes, hypertension, hypercholesterolemia, colorectal_cancer, breast_cancer, ovarian_cancer, endometrial_cancer, pancreatic_cancer, prostate_cancer, melanoma, lung_cancer, alzheimer, osteoporosis
- ALL of the above categories now drive at least one screening trigger in getEligibleScreenings (cardiovascular/diabetes require the documented degree/onset gating).
- relation_degree: 'first' (madre/padre/fratello/sorella/figlio/figlia) or 'second' (nonno/nonna/zio/zia)
- family_history_required screenings (only surface via family history): s005 colonoscopia, sp009 ecografia mammaria, s006 TC torace basso dosaggio (lung), sp_brca BRCA genetic counseling
- normalizeCondition() / getRelationDegree() in screenings.ts are the single source of truth for classification; FamilyHistoryManager saves them on write and prevenzione.tsx recomputes them as a fallback for legacy rows

## Known bugs to fix
- (none currently tracked)

## AI chat tools available
- create_health_memory
- create_reminder
- activate_reminder
- deactivate_reminder
- delete_reminder
- list_reminders

## Language
All UI text is in Italian. Claude API responses must always be in Italian.

## Important rules
- Prevention suggestions must ONLY come from the static official dataset — never invented by AI
- AI must never claim to perform actions it cannot execute
- All medical content must include disclaimer: not a substitute for medical advice
