import { useAuth } from '@/state/auth';
import { useNetwork } from '@/state/network';
import { useProjects } from '@/state/projects';
import { api, ApiError } from './api';

let running = false;

/**
 * Offline-first project sync. Local edits are always accepted immediately; when signed in and
 * online, dirty projects are pushed (last-write-wins on `updatedAt`, server returns the winner)
 * and server projects (e.g. shared by colleagues) are pulled.
 */
export async function syncProjects(): Promise<void> {
  if (running || useAuth.getState().status !== 'signedIn' || !useNetwork.getState().online) return;
  running = true;
  try {
    const store = useProjects.getState();
    const pushed: string[] = [];
    for (const id of store.dirty) {
      const p = store.projects.find((x) => x.id === id);
      if (!p) continue;
      const { project, conflict } = await api.putProject(p);
      if (conflict) useProjects.getState().replaceFromServer(project);
      pushed.push(id);
    }
    const deleted: string[] = [];
    for (const id of store.deleted) {
      try {
        await api.deleteProject(id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
      deleted.push(id);
    }
    useProjects.getState().markSynced(pushed, deleted);

    const { projects: remote } = await api.listProjects();
    const local = useProjects.getState();
    for (const r of remote) {
      const l = local.projects.find((p) => p.id === r.id);
      if (local.deleted.includes(r.id) || local.dirty.includes(r.id)) continue;
      if (!l || r.updatedAt > l.updatedAt) local.replaceFromServer(r);
    }
  } catch {
    // Retry on next trigger (app foreground, reconnect, edit).
  } finally {
    running = false;
  }
}
