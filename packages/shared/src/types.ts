// Core domain model shared by the mobile client and the API.
// Hierarchy: Strategy / KPI relationship model -> KPI knowledge base -> AI engine -> mobile consultant.

export type BscPerspective = 'financial' | 'customer' | 'internal' | 'learning';
export type KpiLevel = 'corporate' | 'functional' | 'operational';
export type IndicatorType = 'leading' | 'lagging';
export type KpiType = 'outcome' | 'output' | 'process' | 'input' | 'quality' | 'efficiency' | 'risk';
export type Direction = 'higher' | 'lower' | 'target';
export type Unit = '%' | 'currency' | 'ratio' | 'days' | 'hours' | 'minutes' | 'count' | 'score' | 'index';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type IndustryId =
  | 'cross'
  | 'telecom'
  | 'banking'
  | 'insurance'
  | 'manufacturing'
  | 'retail'
  | 'saas'
  | 'healthcare'
  | 'energy'
  | 'logistics'
  | 'public'
  | 'holding';

export type FunctionId =
  | 'executive'
  | 'finance'
  | 'sales'
  | 'marketing'
  | 'customer'
  | 'operations'
  | 'supply-chain'
  | 'procurement'
  | 'hr'
  | 'it'
  | 'risk'
  | 'rnd';

export interface Benchmark {
  /** Industry the benchmark applies to; omitted = cross-industry. */
  industry?: IndustryId;
  /** Human readable value or range, e.g. "1–2% monthly". */
  value: string;
  note?: string;
  sourceId?: string;
  /**
   * true when the value is an indicative orientation range curated by the editorial team and
   * not a citable statistic. The UI must label these clearly. Phase 2 replaces them with
   * sourced benchmark datasets.
   */
  illustrative: boolean;
}

export interface TradeOff {
  kpiId?: string;
  text: string;
}

export interface Kpi {
  id: string;
  name: string;
  aliases?: string[];
  shortDefinition: string;
  purpose: string;
  formula: string;
  formulaExample?: string;
  unit: Unit;
  direction: Direction;
  frequency: Frequency;
  levels: KpiLevel[];
  perspective: BscPerspective;
  indicator: IndicatorType;
  kpiType: KpiType;
  functions: FunctionId[];
  industries: IndustryId[];
  /** Strategic themes used for search and recommendation, e.g. "loyalty", "profitability". */
  themes: string[];
  /** KPIs that typically move before this one (drivers / leading indicators). */
  leadingIds: string[];
  /** Outcome KPIs this one influences. */
  laggingIds: string[];
  /** KPI that measures the same phenomenon inversely (e.g. churn vs retention). */
  inverseOf?: string;
  drivers: string[];
  tradeoffs: TradeOff[];
  gamingRisks: string[];
  dataRequirements: string[];
  dataSources: string[];
  benchmarks: Benchmark[];
  sourceIds: string[];
}

export type SourceType = 'book' | 'article' | 'standard' | 'framework' | 'editorial' | 'dataset';

export interface Source {
  id: string;
  title: string;
  authors?: string;
  publisher?: string;
  year?: number;
  type: SourceType;
  url?: string;
  /** 1 (weak) – 5 (authoritative) */
  reliability: 1 | 2 | 3 | 4 | 5;
}

export interface KpiFilters {
  industries?: IndustryId[];
  functions?: FunctionId[];
  levels?: KpiLevel[];
  perspectives?: BscPerspective[];
  indicators?: IndicatorType[];
  kpiTypes?: KpiType[];
}

export interface QueryInterpretation {
  industries: IndustryId[];
  functions: FunctionId[];
  levels: KpiLevel[];
  perspectives: BscPerspective[];
  indicators: IndicatorType[];
  themes: string[];
  /** Remaining free-text terms after entity extraction. */
  terms: string[];
}

export interface SearchHit {
  kpi: Kpi;
  score: number;
  matched: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  interpretation: QueryInterpretation;
}

export interface QualityScore {
  total: number;
  breakdown: { criterion: string; score: number; max: number; note: string }[];
}

// ---------- Strategy / projects ----------

export interface StrategicObjective {
  id: string;
  title: string;
  perspective: BscPerspective;
  description?: string;
  kpiIds: string[];
  /** Canvas position in map units (strategy map). */
  x: number;
  y: number;
}

export interface ObjectiveLink {
  id: string;
  from: string;
  to: string;
}

export interface StrategyMap {
  objectives: StrategicObjective[];
  links: ObjectiveLink[];
}

export interface ProjectKpi {
  kpiId: string;
  baseline?: string;
  target?: string;
  owner?: string;
  note?: string;
  addedAt: string;
}

export type InitiativeStatus = 'planned' | 'active' | 'done' | 'at-risk';

export interface Initiative {
  id: string;
  title: string;
  objectiveId?: string;
  owner?: string;
  status: InitiativeStatus;
}

export interface Project {
  id: string;
  name: string;
  client?: string;
  industry?: IndustryId;
  horizon?: string;
  strategyStatement?: string;
  description?: string;
  kpis: ProjectKpi[];
  map: StrategyMap;
  initiatives: Initiative[];
  createdAt: string;
  updatedAt: string;
  /** Server-side ownership; absent for purely local projects. */
  ownerId?: string;
  orgId?: string;
}

export interface KpiCollection {
  id: string;
  name: string;
  kpiIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Analyses ----------

export type Severity = 'info' | 'warning' | 'critical' | 'positive';

export interface Finding {
  severity: Severity;
  message: string;
}

export interface BalanceReport {
  score: number;
  perspectives: Record<BscPerspective, number>;
  indicators: Record<IndicatorType, number>;
  levels: Record<KpiLevel, number>;
  leadingShare: number;
  findings: Finding[];
  suggestedKpiIds: string[];
}

export interface DriverNode {
  id: string;
  label: string;
  kpiId?: string;
  children: DriverNode[];
}

export interface Hypothesis {
  driver: string;
  kpiId?: string;
  checks: string[];
}

export interface Diagnosis {
  kpiId: string;
  from?: number;
  to?: number;
  absoluteChange?: number;
  relativeChange?: number;
  /** Whether the movement is unfavourable given the KPI's direction. */
  deterioration?: boolean;
  severity: Severity;
  headline: string;
  driverTree: DriverNode;
  hypotheses: Hypothesis[];
  questions: string[];
  dataToRequest: string[];
  gamingWatchouts: string[];
}

export interface Recommendation {
  kpiId: string;
  role: 'outcome' | 'driver';
  rationale: string;
  complementIds: string[];
}

// ---------- AI assistant ----------

export type AiIntent =
  | 'recommend'
  | 'explain'
  | 'compare'
  | 'diagnose'
  | 'balance'
  | 'strategy-map'
  | 'targets'
  | 'summary'
  | 'search'
  | 'smalltalk';

export type AiCard =
  | {
      kind: 'recommendation';
      title: string;
      kpiId: string;
      why: string;
      indicator: IndicatorType;
      complementIds: string[];
    }
  | { kind: 'insight'; title: string; body: string; severity?: Severity }
  | { kind: 'checklist'; title: string; items: string[] }
  | { kind: 'kpi-list'; title: string; kpiIds: string[]; note?: string }
  | { kind: 'comparison'; title: string; kpiIds: string[]; rows: { label: string; values: string[] }[]; verdict: string }
  | { kind: 'driver-tree'; title: string; tree: DriverNode }
  | { kind: 'balance'; title: string; report: BalanceReport }
  | { kind: 'map-proposal'; title: string; map: StrategyMap };

export interface AiContext {
  industry?: IndustryId;
  projectId?: string;
  /** KPI ids in scope, e.g. the active project's KPI set, for balance reviews. */
  kpiIds?: string[];
  projectName?: string;
}

export interface AiResponse {
  intent: AiIntent;
  summary: string;
  cards: AiCard[];
  followUps: string[];
  /** 'llm' when a large language model generated/refined the response, 'engine' for deterministic. */
  engine: 'llm' | 'engine';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AiResponse;
  createdAt: string;
}

export interface ExecutiveSummary {
  title: string;
  generatedAt: string;
  sections: { heading: string; bullets: string[] }[];
}

// ---------- Platform ----------

export type Role = 'admin' | 'consultant' | 'viewer';
export type ProjectPermission = 'owner' | 'editor' | 'viewer';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AppNotification {
  id: string;
  kind: 'project-health' | 'benchmark' | 'system';
  title: string;
  body: string;
  projectId?: string;
  kpiId?: string;
  createdAt: string;
}
