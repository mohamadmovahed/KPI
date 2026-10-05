# Mobile design system

The tokens are in `apps/mobile/src/theme/tokens.ts`. The components are in `apps/mobile/src/components/ui`.

## Principles
- **One primary action per screen.** Use a sticky footer button, for example *Add to project* or *Objective*.
- **Progressive disclosure.** Cards show the essentials and accordions hold the detail. Filters live in bottom sheets.
- **Touch first.** Targets are at least 44 pt, with haptics on primary actions. Map zoom buttons support one-handed use.
- **Search first.** Natural-language search is available from Home and the Library.
- **Professional tone.** Deep navy brand colour, restrained colour use, and colour only when it carries meaning.

## Tokens
- **Spacing:** 4 pt grid (`xxs` 2 → `xxxl` 32).
- **Radius:** `sm` 8, `md` 12, `lg` 16, `xl` 22, `pill`.
- **Type:** display 28/34, title 22/28, heading 17/22, body 15/21, caption 13/18, label 12/16 (semibold, tracking +0.3), mono 14/20 for formulas.
- **Light and dark palettes:** surfaces, text, primary, accent and status colours.
- **Semantic colours:**
  - BSC perspectives: Financial = navy, Customer = teal, Internal Process = amber, Learning & Growth = violet. The same colours are used on badges, map rows and graph nodes.
  - Indicator type: leading = green with an up-trend icon, lagging = slate with a flag icon.
  - Severity: info, warning, critical and positive, used for findings and assessments.

## Components

| Component | Use |
|---|---|
| `AppText`, `Icon` | Typography variants, Ionicons |
| `Card` | Surface. Pressable cards scale slightly on press |
| `Button` | `primary`, `secondary`, `ghost`, `danger`; small or full width; loading state |
| `IconButton` | 44 pt circular hit area |
| `Chip` | Filters and choices; `dropdown` variant opens a bottom sheet |
| `Badge` | KPI badges (perspective, indicator, level) |
| `TextField`, `SearchBar` | Inputs |
| `BottomSheet` | Modal sheet with drag-to-dismiss |
| `Accordion` | Collapsible sections on KPI detail |
| `Segmented` | Scrollable tabs in the project workspace |
| `ListRow`, `SectionHeader`, `Divider`, `Row` | Lists and layout |
| `EmptyState`, `ErrorState`, `Skeleton`, `OfflineBanner` | Empty, error, loading and offline states |
| `Fab` | Floating create action |
| `KpiCard`, `KpiRow`, `KpiBadges`, `QualityPill` | KPI building blocks |
| `AiCardView` | AI response cards: recommendation, insight, checklist, KPI list, comparison, driver tree, balance, map proposal |
| `StrategyMapCanvas`, `RelationshipGraph`, `ZoomPanView` | Touch visualisations |

## Accessibility
- Interactive elements set roles, labels and states such as `expanded`, `selected` and `checked`.
- Map nodes announce their perspective and KPI count, and have hints for tap and long-press.
- Text uses system font scaling.
- Colour is never the only signal: badges also carry text and icons.
