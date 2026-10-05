import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { KnowledgeBase, KPIS, type Kpi } from '@kpi/shared';
import { api } from './api';

const CACHE_KEY = 'kpi.kb.dataset';

interface KbState {
  kb: KnowledgeBase;
  version?: string;
}

/**
 * The KPI knowledge base lives on the device: the bundled seed works fully offline from the
 * first launch, and a newer server dataset (if any) replaces it in the background.
 * Search, relationships and the deterministic engine all run locally for instant results.
 */
export const useKb = create<KbState>(() => ({ kb: new KnowledgeBase(KPIS) }));

export const getKb = () => useKb.getState().kb;

export async function hydrateKnowledgeBase() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { version: string; kpis: Kpi[] };
      if (cached.kpis?.length) useKb.setState({ kb: new KnowledgeBase(cached.kpis), version: cached.version });
    }
  } catch {
    // Corrupt cache: keep the bundled seed.
  }
}

/** Conditional sync (204 when unchanged). Safe to call on every app start / reconnect. */
export async function syncKnowledgeBase() {
  try {
    const res = await api.syncKpis(useKb.getState().version);
    if (!res) return;
    useKb.setState({ kb: new KnowledgeBase(res.kpis), version: res.version });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version: res.version, kpis: res.kpis }));
  } catch {
    // Offline or server unavailable — the local dataset remains authoritative.
  }
}
