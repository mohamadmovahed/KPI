import type { BscPerspective, FunctionId, IndicatorType, IndustryId, KpiLevel, KpiType } from './types';

export interface TaxonomyEntry<T extends string> {
  id: T;
  label: string;
  /** Natural-language cues used by query interpretation. */
  cues: string[];
}

export const INDUSTRIES: TaxonomyEntry<IndustryId>[] = [
  { id: 'cross', label: 'Cross-industry', cues: [] },
  { id: 'telecom', label: 'Telecom', cues: ['telecom', 'telco', 'telecommunication', 'operator', 'mobile operator', 'carrier', 'isp'] },
  { id: 'banking', label: 'Banking', cues: ['bank', 'banking', 'retail bank', 'lender', 'lending', 'financial services'] },
  { id: 'insurance', label: 'Insurance', cues: ['insurance', 'insurer', 'underwriting', 'claims'] },
  { id: 'manufacturing', label: 'Manufacturing', cues: ['manufacturing', 'manufacturer', 'factory', 'plant', 'production', 'industrial'] },
  { id: 'retail', label: 'Retail', cues: ['retail', 'retailer', 'store', 'ecommerce', 'e-commerce', 'consumer goods'] },
  { id: 'saas', label: 'SaaS / Subscription', cues: ['saas', 'software', 'subscription', 'b2b software', 'recurring revenue'] },
  { id: 'healthcare', label: 'Healthcare', cues: ['healthcare', 'hospital', 'clinic', 'health', 'patient'] },
  { id: 'energy', label: 'Energy & Utilities', cues: ['energy', 'utility', 'utilities', 'power', 'oil', 'gas'] },
  { id: 'logistics', label: 'Logistics', cues: ['logistics', 'transport', 'shipping', 'freight', 'warehouse', '3pl'] },
  { id: 'public', label: 'Public sector', cues: ['public sector', 'government', 'ministry', 'municipal', 'agency'] },
  { id: 'holding', label: 'Holding / Conglomerate', cues: ['holding', 'conglomerate', 'group', 'portfolio company', 'portfolio'] },
];

export const FUNCTIONS: TaxonomyEntry<FunctionId>[] = [
  { id: 'executive', label: 'Executive / Strategy', cues: ['executive', 'board', 'ceo', 'corporate strategy', 'strategy office'] },
  { id: 'finance', label: 'Finance', cues: ['finance', 'financial', 'cfo', 'controlling', 'treasury', 'accounting'] },
  { id: 'sales', label: 'Sales', cues: ['sales', 'commercial', 'selling', 'pipeline'] },
  { id: 'marketing', label: 'Marketing', cues: ['marketing', 'brand', 'campaign', 'acquisition'] },
  { id: 'customer', label: 'Customer Service & CX', cues: ['customer service', 'customer experience', 'cx', 'contact center', 'call center', 'support'] },
  { id: 'operations', label: 'Operations', cues: ['operations', 'operational', 'production', 'maintenance', 'network operations'] },
  { id: 'supply-chain', label: 'Supply Chain', cues: ['supply chain', 'inventory', 'logistics', 'fulfilment', 'fulfillment', 'distribution'] },
  { id: 'procurement', label: 'Procurement', cues: ['procurement', 'purchasing', 'sourcing', 'supplier', 'vendor', 'buying'] },
  { id: 'hr', label: 'HR & People', cues: ['hr', 'human resources', 'people', 'talent', 'employee', 'workforce', 'staff'] },
  { id: 'it', label: 'IT & Digital', cues: ['it', 'digital', 'technology', 'systems', 'software delivery'] },
  { id: 'risk', label: 'Risk & Compliance', cues: ['risk', 'compliance', 'credit risk', 'safety', 'audit'] },
  { id: 'rnd', label: 'R&D / Innovation', cues: ['r&d', 'innovation', 'product development', 'new product', 'research'] },
];

export const LEVELS: TaxonomyEntry<KpiLevel>[] = [
  { id: 'corporate', label: 'Corporate', cues: ['corporate', 'company-level', 'board-level', 'group-level', 'strategic'] },
  { id: 'functional', label: 'Functional', cues: ['functional', 'departmental', 'business unit'] },
  { id: 'operational', label: 'Operational', cues: ['operational', 'frontline', 'team-level', 'daily'] },
];

export const PERSPECTIVES: TaxonomyEntry<BscPerspective>[] = [
  { id: 'financial', label: 'Financial', cues: ['financial perspective', 'financial kpis', 'shareholder'] },
  { id: 'customer', label: 'Customer', cues: ['customer perspective', 'customer kpis', 'customer'] },
  { id: 'internal', label: 'Internal Process', cues: ['internal process', 'process kpis', 'process'] },
  { id: 'learning', label: 'Learning & Growth', cues: ['learning and growth', 'learning & growth', 'people kpis', 'capability', 'capabilities'] },
];

export const INDICATORS: TaxonomyEntry<IndicatorType>[] = [
  { id: 'leading', label: 'Leading', cues: ['leading', 'predictive', 'early warning', 'forward-looking', 'driver'] },
  { id: 'lagging', label: 'Lagging', cues: ['lagging', 'outcome', 'result', 'backward-looking'] },
];

export const KPI_TYPES: TaxonomyEntry<KpiType>[] = [
  { id: 'outcome', label: 'Outcome', cues: [] },
  { id: 'output', label: 'Output', cues: [] },
  { id: 'process', label: 'Process', cues: [] },
  { id: 'input', label: 'Input', cues: [] },
  { id: 'quality', label: 'Quality', cues: [] },
  { id: 'efficiency', label: 'Efficiency', cues: [] },
  { id: 'risk', label: 'Risk', cues: [] },
];

const labelMap = <T extends string>(entries: TaxonomyEntry<T>[]) =>
  Object.fromEntries(entries.map((e) => [e.id, e.label])) as Record<T, string>;

export const INDUSTRY_LABEL = labelMap(INDUSTRIES);
export const FUNCTION_LABEL = labelMap(FUNCTIONS);
export const LEVEL_LABEL = labelMap(LEVELS);
export const PERSPECTIVE_LABEL = labelMap(PERSPECTIVES);
export const INDICATOR_LABEL = labelMap(INDICATORS);
export const KPI_TYPE_LABEL = labelMap(KPI_TYPES);

/** Order used for strategy maps: top (financial) to bottom (learning). */
export const PERSPECTIVE_ORDER: BscPerspective[] = ['financial', 'customer', 'internal', 'learning'];

/**
 * Strategic themes with the vocabulary that signals them in natural language.
 * Themes bridge user language ("loyalty") to KPI tagging.
 */
export const THEMES: Record<string, string[]> = {
  loyalty: ['loyalty', 'loyal', 'retention', 'retain', 'churn', 'attrition of customers', 'advocacy', 'stickiness'],
  satisfaction: ['satisfaction', 'satisfied', 'experience', 'cx', 'happy customers', 'service quality'],
  growth: ['growth', 'grow', 'expansion', 'top line', 'top-line', 'revenue'],
  profitability: ['profitability', 'profitable', 'profit', 'margin', 'margins', 'earnings', 'ebitda', 'bottom line'],
  'value-creation': ['value creation', 'shareholder value', 'returns', 'capital efficiency', 'roic', 'economic profit'],
  cash: ['cash', 'liquidity', 'working capital', 'cash flow', 'receivables'],
  cost: ['cost', 'costs', 'efficiency', 'savings', 'spend', 'opex', 'cost reduction'],
  productivity: ['productivity', 'productive', 'output per', 'per employee', 'utilization', 'utilisation'],
  quality: ['quality', 'defect', 'defects', 'errors', 'accuracy', 'right first time', 'reliability'],
  speed: ['speed', 'fast', 'cycle time', 'lead time', 'turnaround', 'time to', 'agility', 'responsiveness'],
  acquisition: ['acquisition', 'acquire', 'new customers', 'conversion', 'lead generation', 'funnel'],
  engagement: ['engagement', 'engaged', 'motivation', 'morale', 'active users', 'usage'],
  talent: ['talent', 'skills', 'capability', 'capabilities', 'training', 'learning', 'hiring', 'recruitment', 'succession'],
  innovation: ['innovation', 'innovate', 'new products', 'time to market', 'r&d'],
  digital: ['digital', 'digitalization', 'digitalisation', 'self-service', 'online', 'app adoption', 'automation'],
  network: ['network', 'coverage', 'availability', 'uptime', 'outage', 'dropped calls'],
  risk: ['risk', 'credit quality', 'default', 'compliance', 'safety', 'incidents', 'exposure'],
  supplier: ['supplier', 'suppliers', 'vendor', 'vendors', 'sourcing', 'procurement'],
  delivery: ['delivery', 'on time', 'on-time', 'otif', 'service level', 'fulfilment', 'fulfillment'],
  execution: ['execution', 'initiatives', 'projects', 'transformation', 'strategy execution'],
};
