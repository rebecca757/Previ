# Prevì — AI Personal Health Assistant

> Your medical history, unified. Your health, explained. Your next step, clear.

🌐 **[prev-app.vercel.app](https://prev-app.vercel.app)** · Invite-only beta

---

## The Problem

Healthcare records are fragmented across dozens of providers. Medical reports are written in clinical language no one understands. People don't know when to get screened, when to see a specialist, or what to tell their doctor — and every time they switch providers, they start from zero.

This isn't a niche problem. It's universal.

---

## What Prevì Does

Prevì is an AI health assistant that knows your full medical history, explains it in plain language, and helps you make informed decisions about your health — without replacing your doctor.

Upload a lab report → Prevì reads it, explains it, and tells you what to watch.
Ask a question → Prevì answers with the context of your actual health history.
Switch doctors → Hand them a clean PDF summary filtered by body part or condition.

---

## Market Opportunity

The AI health assistant market was validated by the biggest players in Q1 2026:

| Player | Move | When |
|---|---|---|
| OpenAI | ChatGPT Health + medical records via b.well | Jan 2026 |
| Amazon | One Medical AI, free for all Prime users | Mar 2026 |
| Google | Fitbit AI Coach + medical records integration | Apr 2026 |

**The gap they all left open:** every single one of them built for individual users, US-only, on closed ecosystems. None of them offers family plans, none explains reports in local languages, and none works across both public and private healthcare systems.

That's where Prevì wins.

---

## Features

**Unified Health Archive** — Upload reports and medical documents (PDF/images), auto-organized into a timeline. AI extracts key information and generates a plain-language explanation for every document.

**AI Report Interpretation** — Claude reads each document and explains what it means, without medical jargon. Users can ask follow-up questions directly from the document page.

**AI Assistant with Memory** — Conversational chat with persistent memory of the user's full health history. Answers health questions, explains values and medical terminology, suggests what to ask the doctor. Conversations are saved and searchable.

**Personalized Prevention** — Screening plan based on age and biological sex, following national health guidelines. Proactive reminders for periodic exams and check-ups, including family history-based suggestions (e.g. "my father has diabetes — should I get screened?").

**Health Profile + PDF Export** — Personal data, medications, allergies, family history, monthly biometrics. Generates a clinical summary PDF for specialists, filterable by body part — so switching doctors doesn't mean starting from scratch.

**Family Accounts** — One user can link their account to a family member's and switch between profiles from the top selector. Built for caregivers and parents managing health for multiple people.

**Installable PWA** — Works on iPhone and Android as a native app, with home screen icon and basic offline support.

**Invite-Only Access** — Beta access via invite code, for controlled growth and quality onboarding.

---

## Why We Win

| | Prevì | ChatGPT Health | Amazon Health | Fitbit AI | Function Health |
|---|---|---|---|---|---|
| Family plan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Public + private unified | ✅ | ❌ | ❌ | ❌ | ❌ |
| Non-US markets | ✅ | ❌ | ❌ | ❌ | ❌ |
| Explains reports in local language | ✅ | ❌ | ❌ | ❌ | ❌ |
| Price accessible to mass market | ✅ €3–5/mo | Free (generic) | Free (US only) | Requires device | $499/yr |

No competitor offers all five simultaneously. We do.

---

## Business Model

- **Subscription** — €3–5/month, designed for mass market adoption
- **Family plans** — single subscription covering multiple family members
- **B2B partnerships** — insurance companies and clinics (data insights, white-label)
- **Premium features** — advanced AI analysis, extended history, priority support

---

## Traction

- ✅ MVP live in production at [prev-app.vercel.app](https://prev-app.vercel.app)
- ✅ 12 production deployments
- ✅ Core features shipped: health archive, AI interpretation, assistant with memory, prevention plan, family accounts, PWA

---

## Tech Stack

- **Frontend** — React + TypeScript, Tailwind CSS, PWA
- **Backend** — Supabase (auth, database, storage)
- **AI** — Claude (Anthropic) for report interpretation and health assistant
- **Deploy** — Vercel
- **Runtime** — Bun

---

## The Vision

Start in Italy — where the public/private fragmentation is most acute and regulation is navigable. Expand across Europe, where no AI health assistant has meaningful penetration. Build the health layer that works for families, not just individuals, and for systems, not just US portals.

The biggest players just validated the market. They built for the US. We're building for everyone else — and doing it better on the features that matter most.

---

*Prevì does not replace doctors. It helps people understand their health and show up to appointments prepared.*
