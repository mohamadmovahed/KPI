import { INDUSTRY_LABEL, PERSPECTIVE_LABEL, PERSPECTIVE_ORDER } from '../taxonomy';
import type { ExecutiveSummary, Project } from '../types';
import { analyzeBalance } from './balance';
import type { KnowledgeBase } from './knowledgeBase';
import { mapHealth } from './strategyMap';

/** Concise, shareable executive summary of a project (strategy, map, KPI set, balance, next steps). */
export function buildExecutiveSummary(project: Project, kb: KnowledgeBase, now = new Date()): ExecutiveSummary {
  const kpis = kb.require(project.kpis.map((p) => p.kpiId));
  const balance = analyzeBalance(kpis, { graph: kb.graph, library: kb.kpis, industry: project.industry, projectKpis: project.kpis });
  const sections: ExecutiveSummary['sections'] = [];

  const context = [
    project.client && `Client: ${project.client}`,
    project.industry && `Industry: ${INDUSTRY_LABEL[project.industry]}`,
    project.horizon && `Horizon: ${project.horizon}`,
    project.strategyStatement && `Ambition: ${project.strategyStatement}`,
  ].filter(Boolean) as string[];
  if (context.length) sections.push({ heading: 'Context', bullets: context });

  if (project.map.objectives.length) {
    sections.push({
      heading: 'Strategic objectives',
      bullets: PERSPECTIVE_ORDER.flatMap((p) => {
        const objs = project.map.objectives.filter((o) => o.perspective === p);
        return objs.length ? [`${PERSPECTIVE_LABEL[p]}: ${objs.map((o) => o.title).join('; ')}`] : [];
      }),
    });
  }

  if (kpis.length) {
    sections.push({
      heading: `KPI scorecard (${kpis.length})`,
      bullets: project.kpis.map((pk) => {
        const k = kb.get(pk.kpiId);
        if (!k) return pk.kpiId;
        const target = pk.target ? ` → target ${pk.target}` : '';
        const base = pk.baseline ? ` (baseline ${pk.baseline})` : '';
        return `${k.name} — ${k.indicator}, ${PERSPECTIVE_LABEL[k.perspective]}${base}${target}`;
      }),
    });
  }

  sections.push({
    heading: `KPI balance: ${balance.score}/100`,
    bullets: balance.findings.map((f) => f.message),
  });

  const mapFindings = project.map.objectives.length ? mapHealth(project.map).filter((f) => f.severity !== 'positive') : [];
  const active = project.initiatives.filter((i) => i.status !== 'done');
  if (active.length) {
    sections.push({ heading: 'Key initiatives', bullets: active.slice(0, 6).map((i) => `${i.title}${i.owner ? ` (${i.owner})` : ''} — ${i.status}`) });
  }

  const next: string[] = [];
  balance.suggestedKpiIds.forEach((id) => {
    const k = kb.get(id);
    if (k) next.push(`Consider adding ${k.name} (${PERSPECTIVE_LABEL[k.perspective]}, ${k.indicator}).`);
  });
  mapFindings.forEach((f) => next.push(`Strategy map: ${f.message}`));
  const noTarget = project.kpis.filter((p) => !p.target).length;
  if (noTarget) next.push(`Set targets for ${noTarget} KPI${noTarget > 1 ? 's' : ''}.`);
  if (!project.map.objectives.length) next.push('Build the strategy map to link objectives to KPIs.');
  if (next.length) sections.push({ heading: 'Recommended next steps', bullets: next.slice(0, 6) });

  return { title: `${project.name} — Executive Summary`, generatedAt: now.toISOString(), sections };
}

export function summaryToText(s: ExecutiveSummary): string {
  return [s.title, '', ...s.sections.flatMap((sec) => [sec.heading.toUpperCase(), ...sec.bullets.map((b) => `• ${b}`), ''])].join('\n').trim();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Print-ready HTML (used by the mobile PDF export via the OS print engine). */
export function summaryToHtml(s: ExecutiveSummary): string {
  const date = new Date(s.generatedAt).toLocaleDateString();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0f172a;margin:40px;line-height:1.45}
  h1{font-size:22px;margin:0 0 4px} .meta{color:#64748b;font-size:12px;margin-bottom:24px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:22px}
  li{margin:4px 0;font-size:13px}
</style></head><body>
<h1>${esc(s.title)}</h1><div class="meta">Generated ${esc(date)}</div>
${s.sections.map((sec) => `<h2>${esc(sec.heading)}</h2><ul>${sec.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`).join('\n')}
</body></html>`;
}
