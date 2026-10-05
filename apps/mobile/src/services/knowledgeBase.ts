import { create } from 'zustand';
import { KnowledgeBase, KPIS } from '@kpi/shared';

interface KbState {
  kb: KnowledgeBase;
}

/**
 * The KPI knowledge base ships inside the app. Search, relationships and the assistant engine all
 * run locally, so the app never needs a network connection.
 */
export const useKb = create<KbState>(() => ({ kb: new KnowledgeBase(KPIS) }));

export const getKb = () => useKb.getState().kb;
