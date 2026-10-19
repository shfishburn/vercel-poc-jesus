# Hold for Jesus — Architecture & Feature Documentation

## Table of Contents

1. [The Split Brain](#the-split-brain)
2. [The Satirical Half — The Divine Hotline](#the-satirical-half--the-divine-hotline)
3. [The Sincere Half — The Real World](#the-sincere-half--the-real-world)
4. [AI Workflow Architecture](#ai-workflow-architecture)
5. [Safety & Moderation System](#safety--moderation-system)
6. [Data Pipeline — Global Pain Index](#data-pipeline--global-pain-index)
7. [Privacy Architecture](#privacy-architecture)
8. [Tech Stack](#tech-stack)

---

## The Split Brain

The site is built on a deliberate tonal duality: **satirical comedy** and **sincere data/resources** coexist in the same application, and both halves make the other stronger.

The navigation reflects this explicitly:

| Group | Label | Pages | Tone |
|-------|-------|-------|------|
| **The Hotline** | Satirical | Home, Pray, Community, History | Warm corporate-divine comedy |
| **The Real World** | Sincere | Global Pain Index, Crisis Help | No satire — real data, real help |

**Why it works:** The satire targets the absurdity of a chatbot handling spiritual questions — not faith itself, and not suffering. The sincere pages exist as moral counterweights: *"This is why we built a comedy hotline. Because sometimes the only honest response to numbers like these is to laugh — and then do something."*

**The Community page** occupies an intentional middle ground — it's framed as a sincere anonymous space ("not part of the satire") where users can share real reflections, light candles, and add voices to global causes.

**Context for direct visitors:** The Pain Index includes a small banner for users who arrive via search without seeing the hotline: *"This page is part of Hold for Jesus, a satirical AI prayer hotline. The data here is real. The hotline is not."*

---

## The Satirical Half — The Divine Hotline

### Concept

Prayer is reframed as a helpdesk ticket processed by "heavenly customer service." Each faith tradition gets a unique hotline, phone number, AI persona, departments, and closing prayer style.

### Six Faith Traditions

| Faith | Hotline Name | Phone | Voice Inspiration | Manager |
|-------|-------------|-------|-------------------|---------|
| Christianity | Hold for Jesus | 1-800-JESUS | C.S. Lewis — warm, literary, witty | Jesus (Employee of the Millennium) |
| Islam | Hold for Allah | 1-800-SALAM | Rumi — poetic mysticism + mercy | Jibril (Head of Angelic Communications) |
| Judaism | Hold for Hashem | 1-800-SHALOM | Jewish grandmother + Talmudic wit | Moses (Senior VP of Exodus Operations) |
| Hinduism | Hold for Brahman | 1-800-DHARMA | Bhagavad Gita teacher + cosmic warmth | Ganesha (Chief Obstacle Removal Officer) |
| Buddhism | Hold for Enlightenment | 1-800-SANGHA | Thich Nhat Hanh — gentle, present | Avalokiteshvara (Head of Compassion, 1000 arms) |
| Secular | Hold for Reason | 1-800-THINK | Carl Sagan — cosmic wonder + humanism | Carl Sagan's Ghost (Pale Blue Dot Division) |

### Departments Per Faith

Each tradition has 3-4 themed departments that lean into the corporate satire:

- **Christianity:** General, Old Testament Complaints, Saints & Angels Help Desk, Hard Questions Desk
- **Islam:** General, Fiqh Helpline, Sufi Poetry Desk, Whispers & Doubt Desk
- **Judaism:** General, Talmudic Debates, Bubbe's Advice Desk, Inner Struggle Desk
- **Hinduism:** General, Karma Accounting, Bhakti Devotion Desk, Darkness & Dharma Desk
- **Buddhism:** General, Zen Koans Desk, Metta Meditation Desk, Illusion & Clarity Desk
- **Secular:** General, Stoic Support, Existential Help Desk, Cognitive Clarity Desk

### Prayer Categories

Four optional categories modify the AI's response tone: **Gratitude**, **Guidance**, **Complaint**, **Emergency**.

### The User Flow

1. Choose faith tradition → sets persona, hotline branding, closing prayer style
2. Select department (optional) → adds sub-prompt layer
3. Pick category (optional) → further tunes response tone
4. Write prayer (max 500 characters)
5. Hold screen with procedural hold music (Web Audio API: Harps, Gospel, Gregorian)
6. Receive AI-generated response + closing prayer + shareable receipt card
7. Optionally save to local history (Zustand, no server storage)

---

## The Sincere Half — The Real World

### Global Pain Index (`/observatory`)

A real-time dashboard tracking global indicators of poverty, hunger, displacement, conflict, and mortality. **No satire.** Data from 8+ authoritative sources, refreshed every 6 hours.

Features:
- **Composite Pain Index** (0–100) with six interpretive bands: Low Distress → Catastrophic
- **Category groupings:** Conflict & Violence, Displacement & Exploitation, Health & Mortality, Poverty & Hunger, Natural Hazards, Humanitarian Response
- **Top drivers panel** showing the 3 indicators contributing most to the current score
- **Admissibility badges** classifying each data point: Authoritative, Signal, Derived
- **Category headline filters** on each card acting as interactive filter shortcuts
- **Full methodology transparency** including weights, score bands, and source links

### Crisis Resources (`/crisis`)

Paired "Get Help" and "Give Help" resources across 8 categories:
- Mental Health, LGBTQ+ Youth, Domestic Violence, Substance Abuse, Veterans, Human Rights, Hunger, Homelessness
- Emergency banner with 988/911 direct dial
- No tracking, no analytics on this page
- Cross-links to the Pain Index for broader context

### About Page (`/about`)

Explicitly frames the project's dual nature:
- "The Serious Side" section explains why the sincere pages exist
- Research Purpose section documents detection modes and failure modes
- Links to both Pain Index and Crisis Resources

---

## AI Workflow Architecture

### Edge Function: `pray`

The prayer system uses a **single edge function with a 6-section modular architecture:**

```
┌─────────────────────────────────────────────────────┐
│ Section 1: Rate Limiting                            │
│   IP-based sliding window (10 req/min)              │
├─────────────────────────────────────────────────────┤
│ Section 2: Detection Patterns                       │
│   Regex catalog grouped by safety mode              │
│   Priority: crisis > troll > off_topic >            │
│     divine_attribution > scrupulosity > normal      │
├─────────────────────────────────────────────────────┤
│ Section 3: Message Classifier                       │
│   Pure function: message → mode + metadata          │
│   Outputs: InteractionMode, detectedSignals[],      │
│            appliedGuardrails[]                       │
├─────────────────────────────────────────────────────┤
│ Section 4: Prompt Registry                          │
│   Declarative catalog — ALL prompt text lives here  │
│   4A: Structural fragments (crisis rule, core)      │
│   4B: Faith personas (6 traditions)                 │
│   4C: Department sub-prompts (18 departments)       │
│   4D: Category prompts (4 categories)               │
│   4E: Hotline metadata                              │
│   4F: Safety mode overrides                         │
├─────────────────────────────────────────────────────┤
│ Section 5: PromptBuilder                            │
│   Composable builder class — ALL logic, no content  │
│   Methods: base() → section() → when() →            │
│            interpolate() → build()                   │
├─────────────────────────────────────────────────────┤
│ Section 6: Request Handler                          │
│   6A: Validate (IP, message length, API key)        │
│   6B: Classify + build prompt                       │
│   6C: Call AI Gateway (Gemini 3.8 Flash)            │
│   6D: Post-process ([TROLL] prefix detection)       │
│   6E: Generate closing prayer (parallel)            │
│   6F: Log analytics + safety signals (fire-forget)  │
│   6G: Respond { reply, closingPrayer, mode }        │
└─────────────────────────────────────────────────────┘
```

### Prompt Composition

The `PromptBuilder` class strictly separates **content** (Section 4) from **logic** (Section 5). Prompts are composed like layers:

```
Faith Persona (always present)
  + Core Rules (crisis rule, tone guidelines)
    + Department sub-prompt (if selected)
      + Category prompt (if selected)
        + Safety override (if mode ≠ normal)
          + Troll self-classify instruction (if mode ≠ crisis)
```

This means a Christianity + Saints Desk + Guidance + Scrupulosity detection produces a completely different prompt than Islam + Sufi + Complaint + Normal — all from the same composable registry.

### Dual AI Calls

Each prayer request triggers up to **two AI calls in parallel:**

1. **Main response** — the agent persona responds to the prayer
2. **Closing prayer** — a separate prompt generates a faith-appropriate closing prayer/reflection

Closing prayers are skipped for crisis, troll, and off-topic modes.

### AI Gateway

AI calls use Google Gemini 3.8 Flash through OpenRouter from Supabase Edge Functions. Rate limits (429) and upstream errors are caught and surfaced as themed error messages ("The lines are jammed").

---

## Safety & Moderation System

### Hybrid Detection: Regex + AI Self-Classification

The system uses a **two-layer detection strategy:**

**Layer 1 — Regex (instant):**
Pattern groups with strict priority ordering:

| Priority | Mode | Patterns | Example Triggers |
|----------|------|----------|-----------------|
| 1 | **Crisis** | Self-harm, suicidal ideation, hopelessness | "want to die", "no reason to live" |
| 2 | **Troll** | Profanity, slurs, spam, gibberish, satanic trolling | "hail satan", "asdf", slurs |
| 3 | **Off-Topic** | Code requests, recipes, tech support, trivia | "write me python", "fix my car" |
| 4 | **Reality Anchor** | Divine attribution to the AI | "are you really God?", "this is a miracle" |
| 5 | **Scrupulosity** | Religious OCD, damnation anxiety | "unforgivable sin", "am I damned?" |
| 6 | **Normal** | Everything else | Genuine prayers |

**Layer 2 — AI Self-Classification (catches subtle cases):**
Normal-mode prompts include a `[TROLL]` self-classify instruction. If the AI detects subtle mockery or bad-faith intent that regex missed, it prefixes its response with `[TROLL]`. The handler strips the prefix and reclassifies the interaction — all in a single API call with zero added latency.

### Six Interaction Modes

Each mode triggers distinct behavior:

| Mode | Persona | UI Behavior | Closing Prayer |
|------|---------|-------------|----------------|
| **Normal** | Faith-specific agent | Full response + receipt card + share | ✅ Generated |
| **Crisis** | Drops all satire — sincere only | 988 lifeline + Crisis Text Line | ❌ Skipped |
| **Troll** | Switchboard Operator | Playful absorption, archived to joke dept | ❌ Skipped |
| **Off-Topic** | Switchboard Operator | Warm redirect to earthly services | ❌ Skipped |
| **Reality Anchor** | Fourth-wall break | "I'm an AI comedy app, not God" | ✅ Generated |
| **Scrupulosity** | Extra-gentle agent | No tough love, reassurance-first | ✅ Generated |

### Troll Handling: "Playful Absorption"

Instead of scolding or blocking trolls, the system **absorbs** their message into the hotline metaphor:

- The message is "routed" to a random department: *Divine Spam Filter*, *Celestial Noise Desk*, *Department of Crossed Wires*, etc.
- A calm Switchboard Operator acknowledges the "atmospheric interference" and archives it
- The door is left open: *"If something meaningful finds its way to the receiver, the switchboard is always open."*
- Sign-off is branded to the selected faith (e.g., "Switchboard Operator, Hold for Allah")

This deflates trolling without engaging, breaking character, or being preachy.

### Safety Signal Logging

Every interaction logs to `safety_signals`:
- `interaction_mode` — which of the 6 modes was triggered
- `detected_signals[]` — which pattern groups matched (can be multiple)
- `applied_guardrails[]` — which safety prompts were injected
- `consented` — whether the user accepted the disclaimer

This creates an auditable record of the moderation system's decisions without storing prayer text.

---

## Data Pipeline — Global Pain Index

### Edge Function: `suffering-index`

A serverless ETL pipeline with the architecture:

```
Source Adapters (11 active)
    ↓
raw_records (immutable audit trail)
    ↓
canonical_entities (normalized schema)
    ↓
normalization_registry (weights + baselines)
    ↓
derived_scores (composite index)
    ↓
suffering_index (cached final score)
```

### Source Adapters

Each adapter follows the same contract: `fetch → { raw, canonical }` with full provenance metadata.

| Source | Adapter | Entity Kind | Domain | Admissibility |
|--------|---------|-------------|--------|---------------|
| World Bank (5 indicators) | `adapterWorldBank` | indicator_observation | development | Authoritative |
| UNHCR | `adapterUNHCR` | population_observation | displacement | Authoritative |
| Global Slavery Index | `adapterGSI` | indicator_observation | slavery | Authoritative |
| GDELT | `adapterGDELT` | event | conflict | Signal Only |
| UN SDG 16.1.1 | `adapterUNSDG` | indicator_observation | conflict | Authoritative |
| ACLED | `adapterACLED` | event | conflict | Authoritative (pending credentials) |
| WHO Neonatal | `adapterWHO` | indicator_observation | health | Authoritative |
| USGS Earthquakes | `adapterUSGS` | event | disaster | Authoritative |
| NASA FIRMS | `adapterFIRMS` | event | disaster | Authoritative |
| UN OCHA/HDX | `adapterHDX` | dataset_resource | humanitarian_catalog | Authoritative |

### Normalization

Scores are computed using a **registry-driven weighted model** stored in `normalization_registry`:

1. Each indicator has `baseline_min`, `baseline_max`, `direction` (higher_worse / lower_worse), and `weight`
2. Raw values are min-max normalized to 0–1
3. Direction-inverted indicators (e.g., life expectancy) are flipped: `1 - normalized`
4. The composite score is a weighted average × 100

### Data Quality

Every canonical entity carries:
- `admissibility_status`: authoritative | signal_only | derived | needs_review
- `admissibility_reasons[]`: provenance trail
- `quality`: source confidence, estimate/model/aggregate flags
- `lineage`: schema version, normalizer version, transform notes

### Refresh Cycle

A `pg_cron` job triggers the edge function every 6 hours via `pg_net`. Results are cached in `suffering_index` and `suffering_metrics` for instant page loads.

---

## Privacy Architecture

- **No accounts required** — the entire app works without authentication
- **Prayer text is never stored on the server** — responses are generated, returned, and discarded
- **Local-only persistence** — prayer history, favorites, and preferences use Zustand stores backed by `localStorage`
- **Prayer Wall entries are ephemeral** — designed to fade after 24 hours
- **Switchboard panels are simulated** — the Switchboard Ambience feed and the Switchboard Status panel generate random cities, actions, and numbers in the browser for atmosphere; they use no visitor data
- **Crisis page has zero analytics** — no tracking scripts on that page
- **Safety signals log mode + metadata only** — never the prayer content itself

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui + CSS design tokens (HSL) |
| **Animation** | Framer Motion |
| **State** | Zustand (local persistence) |
| **Audio** | Web Audio API (procedural hold music, typewriter sounds) |
| **Backend** | Supabase Edge Functions (Deno) |
| **AI** | Google Gemini 3.8 Flash (via OpenRouter) |
| **Database** | PostgreSQL (via Supabase) |
| **Scheduling** | pg_cron + pg_net (6-hour data refresh) |
| **Error Handling** | Global Error Boundary with themed fallback |
| **SEO** | react-helmet-async, semantic HTML, JSON-LD ready |
