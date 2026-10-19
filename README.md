# Hold for Jesus

A satirical AI prayer hotline that explores how chatbots should — and shouldn't — handle spiritual questions, grounded by real crisis resources and real AI failure data.

**Live site:** [holdforjesus.com](https://holdforjesus.com)

## What is this?

You "call in" a prayer to a fake customer service hotline. You get hold music, department transfers, and an AI agent response — complete with a support ticket number.

It's absurd on purpose. The real question underneath: **if an AI can't handle something as low-stakes as a prayer without guardrails, should we trust it with healthcare, criminal justice, or child welfare?**

### Features

- **Multi-faith hotline** — Christianity, Islam, Judaism, Hinduism, Buddhism, and more, each with themed departments, hold music, and response styles
- **AI Incident Archive** — Real AI failures from the [AI Incident Database](https://incidentdatabase.ai/), mapped to the vulnerable communities they harmed ([/incidents](https://holdforjesus.com/incidents))
- **Global Pain Index** — Live indicators of human suffering (poverty, hunger, displacement, conflict) from WHO, UNHCR, World Bank, refreshed every 6 hours ([/observatory](https://holdforjesus.com/observatory))
- **Crisis safety rails** — If anyone expresses real distress, the AI stops and redirects to 988 and other crisis resources
- **Anonymous Prayer Wall** — Community prayer board with candle lighting ([/community](https://holdforjesus.com/community))
- **Procedural hold music** — Harps, gospel, and gregorian chant generated via Web Audio API
- **Voice playback** — TTS for AI responses
- **Shareable prayer cards** — Canvas-rendered cards for social sharing

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Framer Motion |
| UI | shadcn/ui (Radix primitives) |
| State | Zustand (local persistence) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Google Gemini 3.8 Flash (via OpenRouter) |
| Database | PostgreSQL (via Supabase) |
| Hosting | Vercel |
| SEO | Vercel Edge Middleware (bot-aware meta injection) |
| Audio | Web Audio API (procedural hold music) |
| Linting | Biome |
| Testing | Vitest |

## Project structure

```
src/
  components/     # Reusable UI components
  pages/          # Route pages (Landing, Prayer, Incidents, Observatory, etc.)
  hooks/          # Custom React hooks
  lib/            # Utilities, faith configs, formatters
  integrations/   # Supabase client + generated types
supabase/
  functions/      # Edge Functions (pray, tts, ai-incidents, suffering-index)
  migrations/     # SQL migration history
middleware.ts     # Vercel Edge Middleware for bot SEO
public/           # Static assets, OG images, llms.txt
docs/             # Architecture and operations docs
```

## Local development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment variables

Create a `.env` file from `.env.example`:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
```

The app works without Supabase credentials — AI features and live data will be disabled, but all static pages render normally.

### Supabase setup

If you want to run the full backend locally:

```bash
# Start local Supabase
supabase start

# Push migrations
supabase db push

# Generate TypeScript types
npm run types:supabase
```

The 6-hour `pg_cron` refresh jobs read the project's anon key from Supabase Vault at run time, so no migration contains the key. Once per project, run `select vault.create_secret('<anon key>', 'supabase_anon_key');` in the SQL editor before pushing migrations. If the secret is missing, the migration still applies, prints that command as a notice, and skips scheduling; create the secret and run that migration's SQL again.

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Check with Biome |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run types:supabase` | Regenerate Supabase types |

## Deploy to Vercel

This repo includes `vercel.json` with SPA rewrites and Edge Middleware for SEO.

Set these env vars in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Deploy via Git integration or Vercel CLI.

## Safety and moderation

Every AI response passes through a moderation pipeline:

1. **Input classification** — Detects crisis language, trolling, and off-topic requests
2. **Crisis redirect** — Distress signals immediately surface 988 Suicide & Crisis Lifeline and other real resources
3. **Troll deflection** — Bad-faith inputs get themed deflection responses instead of engagement
4. **Rate limiting** — Distributed rate limiting via Supabase RPC with in-memory fallback

See [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for the full safety system design.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
