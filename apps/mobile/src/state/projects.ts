import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  layoutObjectives,
  newId,
  perspectiveRowY,
  MAP_GEOMETRY,
  type BscPerspective,
  type IndustryId,
  type Initiative,
  type Project,
  type ProjectKpi,
  type StrategicObjective,
  type StrategyMap,
} from '@kpi/shared';
import { persistStorage } from '@/lib/storage';

interface ProjectsState {
  projects: Project[];
  /** Ids changed locally since the last successful sync. */
  dirty: string[];
  /** Ids deleted locally, pending server deletion. */
  deleted: string[];
  lastSyncAt?: string;

  create: (input: { name: string; client?: string; industry?: IndustryId; horizon?: string; strategyStatement?: string }) => Project;
  update: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  addKpis: (id: string, kpiIds: string[]) => number;
  removeKpi: (id: string, kpiId: string) => void;
  updateKpi: (id: string, kpiId: string, patch: Partial<Omit<ProjectKpi, 'kpiId' | 'addedAt'>>) => void;

  // Strategy map
  setMap: (id: string, map: StrategyMap) => void;
  addObjective: (id: string, title: string, perspective: BscPerspective) => StrategicObjective;
  updateObjective: (id: string, objectiveId: string, patch: Partial<Omit<StrategicObjective, 'id'>>) => void;
  moveObjective: (id: string, objectiveId: string, x: number, y: number) => void;
  deleteObjective: (id: string, objectiveId: string) => void;
  toggleLink: (id: string, from: string, to: string) => void;
  autoLayout: (id: string) => void;

  // Initiatives
  addInitiative: (id: string, init: Omit<Initiative, 'id'>) => void;
  updateInitiative: (id: string, initiativeId: string, patch: Partial<Omit<Initiative, 'id'>>) => void;
  removeInitiative: (id: string, initiativeId: string) => void;

  // Sync plumbing
  replaceFromServer: (p: Project) => void;
  markSynced: (ids: string[], deletedIds: string[]) => void;
}

const now = () => new Date().toISOString();

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => {
      const mutate = (id: string, fn: (p: Project) => Project) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)),
          dirty: s.dirty.includes(id) ? s.dirty : [...s.dirty, id],
        }));
      const mutateMap = (id: string, fn: (m: StrategyMap) => StrategyMap) => mutate(id, (p) => ({ ...p, map: fn(p.map) }));

      return {
        projects: [],
        dirty: [],
        deleted: [],

        create: (input) => {
          const t = now();
          const p: Project = {
            id: newId('prj'),
            name: input.name.trim(),
            client: input.client?.trim() || undefined,
            industry: input.industry,
            horizon: input.horizon?.trim() || undefined,
            strategyStatement: input.strategyStatement?.trim() || undefined,
            kpis: [],
            map: { objectives: [], links: [] },
            initiatives: [],
            createdAt: t,
            updatedAt: t,
          };
          set((s) => ({ projects: [p, ...s.projects], dirty: [...s.dirty, p.id] }));
          return p;
        },
        update: (id, patch) => mutate(id, (p) => ({ ...p, ...patch })),
        remove: (id) =>
          set((s) => ({ projects: s.projects.filter((p) => p.id !== id), dirty: s.dirty.filter((d) => d !== id), deleted: [...s.deleted, id] })),

        addKpis: (id, kpiIds) => {
          const p = get().projects.find((x) => x.id === id);
          if (!p) return 0;
          const existing = new Set(p.kpis.map((k) => k.kpiId));
          const fresh = kpiIds.filter((k) => !existing.has(k));
          if (fresh.length) mutate(id, (x) => ({ ...x, kpis: [...x.kpis, ...fresh.map((kpiId) => ({ kpiId, addedAt: now() }))] }));
          return fresh.length;
        },
        removeKpi: (id, kpiId) =>
          mutate(id, (p) => ({
            ...p,
            kpis: p.kpis.filter((k) => k.kpiId !== kpiId),
            map: { ...p.map, objectives: p.map.objectives.map((o) => ({ ...o, kpiIds: o.kpiIds.filter((k) => k !== kpiId) })) },
          })),
        updateKpi: (id, kpiId, patch) => mutate(id, (p) => ({ ...p, kpis: p.kpis.map((k) => (k.kpiId === kpiId ? { ...k, ...patch } : k)) })),

        setMap: (id, map) =>
          mutate(id, (p) => {
            // Applying a generated map also brings its KPIs into the project scorecard.
            const existing = new Set(p.kpis.map((k) => k.kpiId));
            const add = [...new Set(map.objectives.flatMap((o) => o.kpiIds))].filter((k) => !existing.has(k));
            return { ...p, map, kpis: [...p.kpis, ...add.map((kpiId) => ({ kpiId, addedAt: now() }))] };
          }),
        addObjective: (id, title, perspective) => {
          const p = get().projects.find((x) => x.id === id)!;
          const inRow = p.map.objectives.filter((o) => o.perspective === perspective);
          const obj: StrategicObjective = {
            id: newId('obj'),
            title: title.trim(),
            perspective,
            kpiIds: [],
            x: Math.min(MAP_GEOMETRY.width - MAP_GEOMETRY.nodeWidth - 20, 30 + inRow.length * (MAP_GEOMETRY.nodeWidth + 30)),
            y: perspectiveRowY(perspective),
          };
          mutateMap(id, (m) => ({ ...m, objectives: [...m.objectives, obj] }));
          return obj;
        },
        updateObjective: (id, oid, patch) =>
          mutate(id, (p) => {
            const map = { ...p.map, objectives: p.map.objectives.map((o) => (o.id === oid ? { ...o, ...patch } : o)) };
            // KPIs attached to objectives must be part of the project scorecard.
            const existing = new Set(p.kpis.map((k) => k.kpiId));
            const add = (patch.kpiIds ?? []).filter((k) => !existing.has(k));
            return { ...p, map, kpis: [...p.kpis, ...add.map((kpiId) => ({ kpiId, addedAt: now() }))] };
          }),
        moveObjective: (id, oid, x, y) => mutateMap(id, (m) => ({ ...m, objectives: m.objectives.map((o) => (o.id === oid ? { ...o, x, y } : o)) })),
        deleteObjective: (id, oid) =>
          mutateMap(id, (m) => ({ objectives: m.objectives.filter((o) => o.id !== oid), links: m.links.filter((l) => l.from !== oid && l.to !== oid) })),
        toggleLink: (id, from, to) =>
          mutateMap(id, (m) => {
            if (from === to) return m;
            const exists = m.links.find((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from));
            return exists ? { ...m, links: m.links.filter((l) => l !== exists) } : { ...m, links: [...m.links, { id: newId('lnk'), from, to }] };
          }),
        autoLayout: (id) => mutateMap(id, (m) => ({ ...m, objectives: layoutObjectives(m.objectives) })),

        addInitiative: (id, init) => mutate(id, (p) => ({ ...p, initiatives: [...p.initiatives, { ...init, id: newId('ini') }] })),
        updateInitiative: (id, iid, patch) => mutate(id, (p) => ({ ...p, initiatives: p.initiatives.map((i) => (i.id === iid ? { ...i, ...patch } : i)) })),
        removeInitiative: (id, iid) => mutate(id, (p) => ({ ...p, initiatives: p.initiatives.filter((i) => i.id !== iid) })),

        replaceFromServer: (p) =>
          set((s) => ({
            projects: s.projects.some((x) => x.id === p.id) ? s.projects.map((x) => (x.id === p.id ? p : x)) : [p, ...s.projects],
            dirty: s.dirty.filter((d) => d !== p.id),
          })),
        markSynced: (ids, deletedIds) =>
          set((s) => ({ dirty: s.dirty.filter((d) => !ids.includes(d)), deleted: s.deleted.filter((d) => !deletedIds.includes(d)), lastSyncAt: now() })),
      };
    },
    { name: 'projects', storage: persistStorage },
  ),
);

export const useProject = (id?: string) => useProjects((s) => s.projects.find((p) => p.id === id));
