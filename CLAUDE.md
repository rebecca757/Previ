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
- Chat assistant (src/lib/chat-local.ts) — uses Claude API directly with tool use
- Document interpretation — auto-analyzes uploaded PDFs
- Health memory extraction — detects and saves health events from chat
- Prevention filtering — matches official Italian screening guidelines to user profile

## Prevention system
- Static dataset of official Italian screenings (LEA, PNPV, ISS, società scientifiche)
- Filtered by age and sex from user profile
- Family history overrides: conditions in family_history trigger earlier screenings
- condition_category field maps free text to: cardiovascular_disease, stroke, arrhythmia, diabetes, hypertension, hypercholesterolemia, colorectal_cancer, breast_cancer, ovarian_cancer, endometrial_cancer, pancreatic_cancer, prostate_cancer, melanoma, lung_cancer, alzheimer, osteoporosis
- relation_degree: 'first' (madre/padre/fratello/sorella) or 'second' (nonno/nonna/zio/zia)
- sp_brca (Consulenza genetica oncologica BRCA) added to dataset — triggered by ovarian_cancer family history, family_history_required: true
- normalizeCondition() in screenings.ts is the single source of truth; FamilyHistoryManager imports it directly

## Known bugs to fix
- Family history filtering not working for diabetes and cardiovascular conditions

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
