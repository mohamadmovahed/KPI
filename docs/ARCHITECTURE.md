# Architecture

## Product hierarchy

```
Mobile Strategy Consultant      ← the product (apps/mobile)
  └ AI Engine                   ← apps/server/src/ai + packages/shared/src/engine/assistant.ts
     └ KPI Knowledge Base       ← packages/shared/src/data
        └ Strategy/KPI Relationship Model  ← packages/shared/src/engine/graph.ts, strategyMap.ts
           └ Benchmark & Organizational Data  ← server store (orgs, projects, members), benchmarks
```

## Components

### Mobile client (`apps/mobile`)
- **Framework:** React Native 0.86 + Expo SDK 57, TypeScript, Expo Router (file-based, `src/app`).
- **Navigation:** bottom tabs — Home, KPI Library, Assistant, Projects, More. Detail screens are a
  native stack; filters, pickers and objective details are bottom sheets.
- **State:** Zustand stores persisted to AsyncStorage (`src/state`): settings, library (saved, recents,
  collections), projects (with dirty/deleted queues), chat (cached answers). Network status via NetInfo.
- **Knowledge base on device:** `services/knowledgeBase.ts` builds a `KnowledgeBase` from the bundled
  seed, replaces it with a newer cached/server dataset (`GET /v1/kpis/sync?version=` → 204 when unchanged).
- **Sync:** `services/sync.ts` pushes dirty projects (`PUT /v1/projects/:id`, last-write-wins by
  `updatedAt`, server returns the winner), replays deletes, then pulls server projects (e.g. shared by
  colleagues). Triggered on sign-in, app foreground, reconnect and after edits.
- **Security:** tokens in Keychain/Keystore (`expo-secure-store`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`),
  automatic refresh with single-flight; no confidential content is logged.
- **Touch visualisations:** `components/map/StrategyMapCanvas.tsx` (Reanimated viewport transform on
  the UI thread; pinch with focal-point zoom, pan, tap, long-press-to-connect, drag-to-move, zoom
  buttons for one-handed use) and `components/graph/RelationshipGraph.tsx` (layered neighbourhood,
  depth & leading/lagging filters, tap-to-refocus, pinch/pan; never the whole graph).
- **Future-ready inputs:** `services/voice.ts` (`VoiceInputService` interface; mic button already in the
  composer), `services/documents.ts` (camera / photo library / PDF → `POST /v1/ai/documents`).
- **Sharing:** native share sheet, PDF via the OS print engine (`expo-print` + `expo-sharing`), clipboard,
  `mailto:`.

### Backend (`apps/server`)
- **Fastify 5** with Helmet, CORS allow-list, rate limiting (stricter on auth and AI), multipart uploads.
- **Auth:** scrypt password hashes, HS256 JWT access tokens (15 min, issuer/audience checked), opaque
  refresh tokens stored as SHA-256 hashes with rotation + family revocation on reuse.
- **Authorization:** org-scoped data; project membership with `owner | editor | viewer`; admin role for
  `/v1/admin/*`; other orgs' projects return 404.
- **Store:** `store/store.ts` — in-memory with atomic JSON snapshots, accessed only through route
  handlers. Production target is Postgres (schema below).
- **Audit log:** identifiers and action names only (never prompts or project content).

### AI layer
1. `runAssistant()` (shared) classifies intent — recommend, explain, compare, diagnose, balance,
   strategy-map, targets, summary, search — and produces structured **cards** from the knowledge base and
   relationship model.
2. If an Anthropic key is configured, `AiOrchestrator.refine()` sends the question, context, the
   engine draft and reference data for the relevant KPIs to Claude (`claude-opus-5-5`, effort `medium`,
   `fallbacks: "default"`), with a cached, stable system prompt containing the KPI catalogue and a
   JSON-schema structured output. The response is zod-validated, unknown KPI ids are dropped, and
   engine-computed structural cards (driver trees, balance reports, map proposals, comparisons) are kept.
3. Any error, refusal or malformed output falls back to the engine answer. The mobile app additionally
   falls back to the on-device engine when offline or signed out, and labels the answer accordingly.
4. Document analysis: image/PDF → Claude vision lists the KPIs it can read → names are mapped to the
   knowledge base → leading/lagging summary and balance report.

### API surface (v1)

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /v1/ai/status` |
| Auth | `POST /v1/auth/register`, `/login`, `/refresh`, `/logout`; `GET /v1/me` |
| Knowledge base | `GET /v1/taxonomy`, `GET /v1/kpis?q=&industries=…`, `GET /v1/kpis/:id`, `GET /v1/kpis/:id/graph`, `POST /v1/kpis/compare`, `GET /v1/kpis/sync`, `GET /v1/sources` |
| Reasoning | `POST /v1/recommendations`, `POST /v1/diagnostics`, `POST /v1/ai/chat`, `POST /v1/ai/documents` |
| Projects | `GET /v1/projects`, `GET/PUT/DELETE /v1/projects/:id`, `POST /v1/projects/:id/members`, `GET /v1/projects/:id/balance`, `GET /v1/projects/:id/summary` |
| Saved items | `GET /v1/collections`, `PUT/DELETE /v1/collections/:id` |
| Notifications | `POST /v1/notifications/push-token`, `GET /v1/notifications` |
| Admin | `GET /v1/admin/users`, `PATCH /v1/admin/users/:id`, `GET /v1/admin/audit`, `GET /v1/admin/kpis/quality` |

## Scaling the knowledge base (hundreds → tens of thousands of KPIs)

- On device: `KpiIndex` precomputes stem sets and IDF weights; a query is a single linear pass with
  set lookups (sub-millisecond at today's size, low milliseconds at ~10k). Results are paginated
  (`FlatList` with windowing, 25 per page).
- Beyond that, the mobile app keeps a **subset** offline (saved, recent, project KPIs, the user's
  industries) and queries the API for the long tail. The API swaps the in-memory index for Postgres
  full-text search + `pgvector` embeddings behind the same `SearchResult` contract.

## Production data model (Postgres)

```
orgs(id, name, created_at)
users(id, org_id → orgs, email unique, name, role, password_hash, created_at)
refresh_tokens(hash pk, user_id → users, family, expires_at, revoked)
kpis(id, version, payload jsonb, search tsvector, embedding vector(1024), updated_at)
kpi_relations(from_id → kpis, to_id → kpis, kind)          -- driver → outcome
sources(id, title, authors, publisher, year, type, url, reliability)
benchmarks(id, kpi_id → kpis, industry, value, period, source_id → sources, illustrative, published_at)
projects(id, org_id → orgs, owner_id → users, payload jsonb, updated_at)
project_members(project_id → projects, user_id → users, permission)
collections(id, owner_id → users, name, kpi_ids text[], updated_at)
push_tokens(token pk, user_id → users, platform, updated_at)
audit_log(id, at, org_id, user_id, action, target, meta jsonb)
```

Row-level security by `org_id`; encryption at rest; uploaded documents in object storage with
short-lived signed URLs (today they are processed in memory and never stored).

## Web admin (optional, Phase 3)

The admin interface is a separate web client over the same API (`/v1/admin/*`): KPI and relation
editing, bulk import (CSV/JSON validated against the shared zod schemas), benchmark & source
management, users/roles, audit log, AI knowledge-base management. The end-user product stays mobile.

## Push notifications (designed, delivery in Phase 2)

Device tokens are registered via `POST /v1/notifications/push-token`. `GET /v1/notifications` already
computes the non-intrusive project-health nudges (“5 KPIs without targets”, “3 objectives without
KPIs”); Phase 2 adds `expo-notifications` and a scheduled sender for these plus benchmark updates.
