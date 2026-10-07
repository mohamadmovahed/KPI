# Status

Legend: ✅ built · 🟡 partly built · ⬜ not started. Everything below runs offline on Android.

| Capability | Status | Notes |
|---|---|---|
| Android app, no server, no account | ✅ | Expo SDK 57; APK built by GitHub Actions and attached to GitHub Releases |
| Home dashboard | ✅ | Assistant prompt, quick actions, needs-attention items, recent projects and KPIs |
| KPI library, natural-language search, filters | ✅ | 271 KPIs (60 core + 211 library entries); filters open in bottom sheets |
| KPI detail, comparison, quality score | ✅ | |
| Industry/function hierarchy, leading/lagging | ✅ | |
| KPI relationships and graph | ✅ | Layered neighbourhood with pinch and pan |
| Saved KPIs and collections | ✅ | |
| On-device assistant | ✅ | Recommend, explain, compare, diagnose, balance, map draft, targets |
| Diagnostics and driver trees | ✅ | |
| Trade-offs and gaming risks | ✅ | |
| Project workspaces | ✅ | |
| Strategy map: generation and touch editing | ✅ | |
| KPI balance and strategy-map audit | ✅ | |
| Executive summary and sharing | ✅ | Share sheet, PDF, copy, email |
| Backup and restore | ✅ | JSON file |
| Benchmarks | 🟡 | Indicative ranges only, labelled as such |
| Target setting | 🟡 | Baseline, target and owner per KPI; no trajectory modelling |
| Voice input | 🟡 | Interface in place; use the keyboard's dictation button for now |
| Document or photo analysis | ⬜ | Removed; it needed a cloud AI model |
| Performance tracking over time | ⬜ | |
| PowerPoint/Excel export | ⬜ | |

## Next steps
1. Promote frequently used library entries to fully documented core KPIs (drivers, risks, data).
2. Add actuals over time per KPI, with simple trend charts.
3. Add on-device speech recognition.
4. Set up a release keystore for Google Play distribution.
