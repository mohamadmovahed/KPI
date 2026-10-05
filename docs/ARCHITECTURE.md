# Architecture

The product is a self-contained Android app. Nothing runs on a server.

```
Android app (apps/mobile)                       React Native 0.86 + Expo SDK 57, Expo Router
  ├ Screens & touch UI                          src/app, src/components
  ├ Local state, persisted on device            src/state (Zustand → AsyncStorage)
  ├ Services                                    knowledge base, share/PDF, backup, insights
  └ Engine (packages/shared, bundled into app)
       ├ KPI knowledge base                      src/data (KPIs, sources, benchmarks)
       ├ Strategy / KPI relationship model       engine/graph.ts, strategyMap.ts
       └ Reasoning                               search, quality, recommend, balance, diagnose,
                                                 summary, assistant
```

## Why this stack
- **React Native + Expo:** native Android UI, smooth gestures through Reanimated and Gesture Handler,
  and no hand-maintained native project (`expo prebuild` generates `android/`).
- **TypeScript engine in a separate package:** the reasoning code is pure TypeScript with no React or
  platform dependencies, so it is unit-tested in Node and bundled unchanged into the app.

## Data and storage
- The **knowledge base** is compiled into the JavaScript bundle (`packages/shared/src/data`). It needs
  no download or network access.
- **User data** (projects, strategy maps, targets, initiatives, saved KPIs, collections, assistant
  history, settings) is persisted by Zustand stores into AsyncStorage, which is app-private storage on
  Android. The app waits for hydration before showing screens.
- **Backup/restore** (`services/backup.ts`) writes a versioned JSON file (`backupSchema`) and shares
  it through the Android share sheet. Restoring validates the file with zod before merging.

## Assistant
`runAssistant()` classifies the request into one of these intents: recommend, explain, compare,
diagnose, balance, strategy-map, targets, summary or search. It then builds structured cards from the
knowledge base and the relationship graph. Answers are deterministic, instant and grounded in the
dataset; the app never calls a language model.

## Search performance
`KpiIndex` precomputes stem sets and IDF weights. A query is a single pass using set lookups, and
results are paginated in a windowed `FlatList`. This stays fast as the dataset grows into the
thousands of KPIs.

## Permissions
The app needs no runtime permissions. Camera, microphone and media permissions are explicitly
removed in `app.json`. `INTERNET` stays in the manifest only because React Native debug builds use it
to load code from the dev server; the app makes no network requests.

## Extending
- **Add KPIs** in `packages/shared/src/data/kpis.ts`. Relationships only need declaring on one side.
  The tests check every reference.
- **Voice input:** `services/voice.ts` defines the interface; an on-device recogniser can be plugged in.
- **Notifications:** `services/insights.ts` computes project-health nudges, which are shown on Home.
