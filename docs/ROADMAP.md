# Roadmap and phase status

Legend: ✅ built in this repository · 🟡 partly built or designed with interfaces in place · ⬜ not started

## Phase 1: Mobile KPI Intelligence

| Capability | Status | Notes |
|---|---|---|
| iOS/Android app (Expo) | ✅ | Expo SDK 57, Expo Router; Android bundle export verified |
| Authentication | ✅ | Register/login, rotating refresh tokens, secure storage, guest mode |
| Mobile dashboard | ✅ | Greeting, AI prompt, quick actions, needs-attention, recent projects/KPIs |
| KPI library, search, filters | ✅ | Natural-language interpretation, IDF ranking, bottom-sheet filters |
| KPI detail | ✅ | Collapsible sections incl. drivers, trade-offs, gaming risks, data, benchmarks, sources |
| KPI comparison | ✅ | Side by side, with a verdict and sharing |
| KPI quality score | ✅ | Transparent 6-criterion score (0–100) with a breakdown |
| KPI recommendation | ✅ | Balanced outcome and driver sets, built from the relationship graph |
| Industry/function hierarchy | ✅ | 11 industries + cross-industry, 12 functions |
| Leading/lagging classification | ✅ | |
| KPI relationships | ✅ | Graph, value chain, relationship view on mobile |
| Source management | ✅ | Source registry with reliability; admin editing comes with the web admin |
| Saved KPIs and collections | ✅ | Synced collections API; AI conversations cached |
| Initial dataset | ✅ | 60 curated KPIs across all BSC perspectives |
| AI Assistant | ✅ | Engine plus optional Claude refinement; offline fallback |

## Phase 2: Mobile Performance Intelligence

| Capability | Status | Notes |
|---|---|---|
| Benchmarking | 🟡 | Indicative ranges, clearly labelled; sourced datasets are still needed |
| Target setting | 🟡 | Baseline, target and owner per KPI; assistant guidance; trajectory modelling still to do |
| KPI diagnostics, driver trees, root cause | ✅ | Diagnosis screen and assistant |
| KPI trade-offs, gaming risks | ✅ | |
| Performance analysis (time series) | ⬜ | Needs actuals ingestion |
| Advanced relationship visualisation | 🟡 | Layered neighbourhood graph; force layout and editing still to do |
| Voice input | 🟡 | Mic button and `VoiceInputService` interface; plug in `expo-speech-recognition` |
| Document/image analysis | ✅ | Camera, photos or PDF → Claude vision → KPI classification (needs an API key) |
| Push notifications | 🟡 | Token registration and computed nudges; still needs `expo-notifications` delivery |

## Phase 3: Mobile Strategy Consultant

| Capability | Status | Notes |
|---|---|---|
| Project workspaces | ✅ | Overview, Strategy, KPIs, Targets, Initiatives, Diagnostics, Reports |
| Strategy-map generation and touch editing | ✅ | Pinch, pan, tap, long-press to connect, drag, add, edit, delete |
| Strategy → KPI mapping, KPI alignment and balance score | ✅ | |
| Strategy audit (map health) | ✅ | Objectives without KPIs, orphans, missing perspectives, links pointing down |
| Executive reports and mobile sharing | ✅ | Share sheet, PDF, copy, email |
| Organisation profiles, roles, project permissions | 🟡 | Backend done; member management UI still to do |
| OKR integration | ⬜ | |
| Optional web administration | 🟡 | Admin API in place; the web client is not built |
| PowerPoint/Excel export | ⬜ | Mobile quick-share formats come first |

## Next engineering steps
1. Move the store to Postgres (schema in ARCHITECTURE.md) and keep the route handlers unchanged.
2. Add sourced benchmark datasets with dates, plus benchmark-update notifications.
3. Wire voice input and push delivery (both need development builds).
4. Build the web admin for KPI, relation and source editing and bulk import.
5. Expand the dataset towards hundreds of KPIs. The editorial queue is `GET /v1/admin/kpis/quality`.
