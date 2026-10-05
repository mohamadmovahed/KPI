# KPI Consultant — mobile strategy & KPI intelligence

A **mobile-first** (iOS + Android) professional tool for strategy consultants and managers: find and
understand KPIs in seconds, get AI recommendations and diagnostics, build touch-enabled strategy maps,
check whether a KPI set is balanced, and share an executive summary — all from a phone, including
offline in meetings.

| Home | Search | KPI detail | AI diagnosis | Strategy map |
|---|---|---|---|---|
| ![](docs/screenshots/02-home.png) | ![](docs/screenshots/03-search.png) | ![](docs/screenshots/05-kpi-detail-expanded.png) | ![](docs/screenshots/06-assistant-diagnose.png) | ![](docs/screenshots/09-map.png) |

| Objective sheet | Balance check | Executive summary | Dark mode |
|---|---|---|---|
| ![](docs/screenshots/10-map-objective-sheet.png) | ![](docs/screenshots/13-balanced.png) | ![](docs/screenshots/12-summary.png) | ![](docs/screenshots/14-home-dark.png) |

*Screenshots are from the real app (Expo web build at 390×844), captured by the end-to-end walkthrough of the acceptance criteria.*

## Architecture at a glance

```
Mobile Strategy Consultant   apps/mobile   React Native + Expo (SDK 57), Expo Router, Reanimated, Gesture Handler
        │  supported by
AI Engine                    apps/server   Fastify API · AI orchestrator (Claude, structured outputs) · auth · sync
        │  supported by
KPI Knowledge Base           packages/shared/src/data   curated KPIs, sources, benchmarks
        │  supported by
Strategy / KPI Relationship  packages/shared/src/engine  cause-and-effect graph, balance, diagnosis, maps
        │  supported by
Benchmark & org data         server store (projects, orgs, members, audit) → Postgres in production
```

- **Why React Native + Expo:** one TypeScript codebase for iOS and Android, shares the domain engine
  with the backend byte-for-byte, mature gesture/animation stack for the touch strategy map, OTA updates
  via EAS, and no native projects to maintain (Continuous Native Generation).
- **Offline-first:** the knowledge base, search, relationship graph, balance check, diagnostics,
  strategy-map generation and executive summaries all run **on device** from the shared package.
  Projects, saved KPIs, collections and AI conversations are cached locally and synced when online.
- **AI layer:** the deterministic engine always answers first (fast, grounded, offline-capable); when
  `ANTHROPIC_API_KEY` is set the server has Claude refine the engine draft into consultant-grade cards
  via structured outputs, validated against the knowledge base (no invented KPI ids), with automatic
  fallback to the engine answer on any failure.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Roadmap/phase status: [docs/ROADMAP.md](docs/ROADMAP.md) ·
Design system: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)

## Repository layout

```
apps/mobile      Expo app (src/app = routes, src/components, src/state, src/services, src/theme)
apps/server      Fastify API (routes, AI orchestrator, auth, store) + tests
packages/shared  Domain types, KPI dataset, engines (search, quality, graph, recommend, balance,
                 diagnose, strategy map, summary, assistant), zod validation + tests
docs/            Architecture, roadmap, design system, screenshots
```

## Getting started

Requirements: Node 20+ (22 recommended), npm 10+. For devices: Expo Go is **not** enough for every
native module long-term; use a development build (`npx expo run:ios|android` or `eas build --profile development`).

```bash
npm install                      # installs all workspaces

# API (http://localhost:4000). Seeds demo@kpi.app / demo1234 outside production.
cp apps/server/.env.example apps/server/.env   # optional: add ANTHROPIC_API_KEY to enable the LLM layer
npm run dev:server

# Mobile app
npm run dev:mobile               # then press i (iOS simulator), a (Android) or scan the QR code
```

On a physical device, set the API URL to your machine's LAN address in **More → Settings → Server**
(or `expo.extra.apiUrl` in `apps/mobile/app.json`). You can also tap **Explore without an account**:
everything works locally and the assistant uses the on-device engine.

### Quality checks

```bash
npm test          # shared engine tests + API integration tests (vitest)
npm run typecheck # shared, server, mobile
cd apps/mobile && npx expo export --platform android   # verifies the native bundle builds
```

## Acceptance criteria (all from a smartphone)

| # | Use case | Where |
|---|---|---|
| 1 | Search “KPIs for customer loyalty in telecom” | KPI Library — natural-language interpretation (“understood: Telecom, loyalty”), filter chips → bottom sheets |
| 2 | Open a KPI: definition, formula, leading/lagging, level, BSC, related KPIs, sources | KPI detail — collapsible sections, value chain, relationship graph |
| 3 | “Our customer churn increased from 4% to 7%. What should I investigate?” | AI Assistant — assessment, checks, expandable driver tree, hypotheses, data to request |
| 4 | Create project “Telecom Strategy 2027–2030” | Projects → New project |
| 5 | Add KPIs to the project | Any KPI card / detail / AI recommendation → *Add to project*; project KPI picker; collections |
| 6 | Build & edit a strategy map by touch | Project → Strategy map — pinch, pan, tap, long-press to connect, drag, add/edit objectives & KPIs |
| 7 | “Are my KPIs balanced?” | Assistant with project context, or Project → Diagnostics |
| 8 | Generate & share an executive summary | Project → Reports → Executive summary — Share, PDF, Copy, Email |

## Security notes

- Passwords hashed with scrypt; short-lived JWT access tokens (15 min) + rotating refresh tokens with
  reuse detection (stored hashed); tokens on device live in Keychain/Keystore (`expo-secure-store`).
- Org-scoped data, project-level permissions (owner/editor/viewer), role-based admin endpoints,
  audit log that never stores prompt or project content, request logging with credential redaction,
  Helmet headers, rate limiting, zod validation on every input, upload type/size limits.
- Use HTTPS in production and set `JWT_SECRET` (≥ 32 chars; with `NODE_ENV=production` the server refuses to start without it).
