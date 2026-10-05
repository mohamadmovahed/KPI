import type { Diagnosis, DriverNode, Hypothesis, Kpi, Severity } from '../types';
import type { KpiGraph } from './graph';

export interface DiagnoseInput {
  from?: number;
  to?: number;
}

/** Investigation checks by driver keyword. First match wins; order = specificity. */
const CHECK_LIBRARY: { match: RegExp; checks: string[] }[] = [
  { match: /price|tariff|competit/i, checks: ['Compare current prices/tariffs with the top 3 competitors.', 'Check whether a competitor launched an aggressive offer in the period.', 'Look for promotions or discounts that recently expired.'] },
  { match: /billing|bill/i, checks: ['Analyse billing adjustments and bill-shock complaints in the period.', 'Check for billing system changes or migrations.'] },
  { match: /network|coverage|outage|availability/i, checks: ['Map churners/complaints against network quality by region or cell site.', 'Check major outages or capacity issues in the period.'] },
  { match: /contract|commitment/i, checks: ['Check whether a large cohort reached end of contract/commitment.', 'Review renewal offers and their take-up.'] },
  { match: /onboarding/i, checks: ['Isolate early-life losses (tenure < 90 days) to test onboarding quality.'] },
  { match: /complaint|service|resolution|interaction/i, checks: ['Trend complaint volumes and top reasons over the same period.', 'Check repeat contacts and resolution times for affected customers.'] },
  { match: /usage|engagement|product fit|feature/i, checks: ['Compare usage in the months before loss for lost vs. retained customers.'] },
  { match: /margin|price and mix|mix/i, checks: ['Run a price-volume-mix bridge versus the prior period.'] },
  { match: /cost|personnel|overhead|opex|spend/i, checks: ['Bridge costs by nature versus prior period and budget.', 'Separate one-off from recurring cost changes.'] },
  { match: /volume|demand/i, checks: ['Split the change into volume vs. rate effects.'] },
  { match: /supplier|material|input/i, checks: ['Analyse supplier price and quality changes in the period.'] },
  { match: /staff|skills|training|agent|technician|operator/i, checks: ['Check staffing levels, attrition and new-joiner share in affected teams.'] },
  { match: /maintenance|breakdown|equipment|asset/i, checks: ['Review maintenance backlog and breakdown logs for critical assets.'] },
  { match: /forecast/i, checks: ['Compare forecast vs. actual demand to find the error source.'] },
  { match: /macro|market|economic/i, checks: ['Compare with market or peer trends to separate external from internal causes.'] },
];

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Number(n.toFixed(2)).toString());

export function diagnose(kpi: Kpi, graph: KpiGraph, input: DiagnoseInput = {}): Diagnosis {
  const { from, to } = input;
  const hasChange = typeof from === 'number' && typeof to === 'number';
  const absoluteChange = hasChange ? to! - from! : undefined;
  const relativeChange = hasChange && from !== 0 ? (to! - from!) / Math.abs(from!) : undefined;
  const deterioration =
    hasChange && kpi.direction !== 'target' ? (kpi.direction === 'lower' ? to! > from! : to! < from!) : undefined;

  let severity: Severity = 'info';
  if (deterioration === false) severity = 'positive';
  else if (deterioration && relativeChange !== undefined) {
    const mag = Math.abs(relativeChange);
    severity = mag >= 0.3 ? 'critical' : mag >= 0.1 ? 'warning' : 'info';
  }

  const unit = kpi.unit === '%' ? '%' : '';
  const delta =
    absoluteChange !== undefined
      ? `${absoluteChange >= 0 ? '+' : ''}${fmt(absoluteChange)}${kpi.unit === '%' ? ' pp' : ''}${
          relativeChange !== undefined ? `, ${relativeChange >= 0 ? '+' : ''}${Math.round(relativeChange * 100)}%` : ''
        }`
      : '';
  const headline = hasChange
    ? `${kpi.name} ${to! > from! ? 'rose' : 'fell'} from ${fmt(from!)}${unit} to ${fmt(to!)}${unit} (${delta}) — ${
        deterioration === false ? 'an improvement' : severity === 'critical' ? 'a significant deterioration' : severity === 'warning' ? 'a material deterioration' : 'a change worth watching'
      }.`
    : `Investigation plan for ${kpi.name}.`;

  // Driver tree: KPI drivers from the relationship graph (2 levels) + qualitative drivers.
  const driverKpis = graph.drivers(kpi.id).slice(0, 6);
  const driverTree: DriverNode = {
    id: kpi.id,
    label: kpi.name,
    kpiId: kpi.id,
    children: [
      ...driverKpis.map((d) => ({
        id: d.id,
        label: d.name,
        kpiId: d.id,
        children: graph
          .drivers(d.id)
          .filter((x) => x.id !== kpi.id)
          .slice(0, 3)
          .map((x) => ({ id: `${d.id}>${x.id}`, label: x.name, kpiId: x.id, children: [] })),
      })),
      ...kpi.drivers.map((t, i) => ({ id: `${kpi.id}#${i}`, label: t, children: [] })),
    ],
  };

  const hypotheses: Hypothesis[] = [
    ...kpi.drivers.map((driver) => ({
      driver,
      checks: CHECK_LIBRARY.find((c) => c.match.test(driver))?.checks ?? [
        `Quantify how ${driver.toLowerCase()} changed over the same period and correlate it with the KPI movement.`,
      ],
    })),
    ...driverKpis.slice(0, 4).map((d) => ({
      driver: d.name,
      kpiId: d.id,
      checks: [`Did ${d.name} deteriorate before ${kpi.name}? Compare monthly trends with a 1–3 month lag.`],
    })),
  ];

  const questions = [
    'When exactly did the change start — gradual drift or a step change?',
    'Is it concentrated in specific segments, regions, products, channels or tenure bands?',
    'Did the definition, data source or calculation change? Rule out measurement artefacts first.',
    'Is the market or competitors moving the same way (external vs. internal cause)?',
    'Which initiatives, price changes or organisational changes happened just before the shift?',
  ];
  if (/churn|retention|attrition|turnover/i.test(kpi.name)) {
    questions.splice(2, 0, 'Is the increase voluntary or involuntary (e.g. non-payment, forced migration)?');
  }

  return {
    kpiId: kpi.id,
    from,
    to,
    absoluteChange,
    relativeChange,
    deterioration,
    severity,
    headline,
    driverTree,
    hypotheses,
    questions,
    dataToRequest: [...kpi.dataRequirements, ...driverKpis.slice(0, 4).map((d) => `${d.name} — monthly series, same segmentation`)],
    gamingWatchouts: kpi.gamingRisks,
  };
}
