import { mapHealth, type AppNotification, type Project } from '@kpi/shared';

/**
 * Project-health nudges, computed on device (also available from GET /v1/notifications for
 * future push delivery). Shown quietly on Home — never as interruptive alerts.
 */
export function projectInsights(projects: Project[]): AppNotification[] {
  const out: AppNotification[] = [];
  for (const p of projects) {
    const noTarget = p.kpis.filter((k) => !k.target?.trim()).length;
    if (p.kpis.length && noTarget) {
      out.push({ id: `${p.id}:targets`, kind: 'project-health', title: p.name, body: `${noTarget} KPI${noTarget > 1 ? 's' : ''} without targets`, projectId: p.id, createdAt: p.updatedAt });
    }
    const noKpi = p.map.objectives.filter((o) => !o.kpiIds.length).length;
    if (noKpi) {
      out.push({ id: `${p.id}:map`, kind: 'project-health', title: p.name, body: `${noKpi} objective${noKpi > 1 ? 's' : ''} on the strategy map without KPIs`, projectId: p.id, createdAt: p.updatedAt });
    } else if (p.map.objectives.length) {
      const issue = mapHealth(p.map).find((f) => f.severity === 'warning');
      if (issue) out.push({ id: `${p.id}:maphealth`, kind: 'project-health', title: p.name, body: issue.message, projectId: p.id, createdAt: p.updatedAt });
    }
  }
  return out.slice(0, 4);
}
