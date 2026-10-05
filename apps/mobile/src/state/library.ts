import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId, type KpiCollection } from '@kpi/shared';
import { persistStorage } from '@/lib/storage';

interface LibraryState {
  savedIds: string[];
  recentIds: string[];
  recentSearches: string[];
  collections: KpiCollection[];
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  addRecent: (id: string) => void;
  addRecentSearch: (q: string) => void;
  createCollection: (name: string, kpiIds?: string[]) => KpiCollection;
  addToCollection: (collectionId: string, kpiIds: string[]) => void;
  removeFromCollection: (collectionId: string, kpiId: string) => void;
  renameCollection: (collectionId: string, name: string) => void;
  deleteCollection: (collectionId: string) => void;
}

const touch = (c: KpiCollection, patch: Partial<KpiCollection>): KpiCollection => ({ ...c, ...patch, updatedAt: new Date().toISOString() });

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      recentIds: [],
      recentSearches: [],
      collections: [],
      toggleSaved: (id) => set((s) => ({ savedIds: s.savedIds.includes(id) ? s.savedIds.filter((x) => x !== id) : [id, ...s.savedIds] })),
      isSaved: (id) => get().savedIds.includes(id),
      addRecent: (id) => set((s) => ({ recentIds: [id, ...s.recentIds.filter((x) => x !== id)].slice(0, 30) })),
      addRecentSearch: (q) => {
        const t = q.trim();
        if (t.length < 3) return;
        set((s) => ({ recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) }));
      },
      createCollection: (name, kpiIds = []) => {
        const now = new Date().toISOString();
        const c: KpiCollection = { id: newId('col'), name: name.trim() || 'Untitled collection', kpiIds: [...new Set(kpiIds)], createdAt: now, updatedAt: now };
        set((s) => ({ collections: [c, ...s.collections] }));
        return c;
      },
      addToCollection: (id, kpiIds) =>
        set((s) => ({ collections: s.collections.map((c) => (c.id === id ? touch(c, { kpiIds: [...new Set([...c.kpiIds, ...kpiIds])] }) : c)) })),
      removeFromCollection: (id, kpiId) =>
        set((s) => ({ collections: s.collections.map((c) => (c.id === id ? touch(c, { kpiIds: c.kpiIds.filter((x) => x !== kpiId) }) : c)) })),
      renameCollection: (id, name) => set((s) => ({ collections: s.collections.map((c) => (c.id === id ? touch(c, { name }) : c)) })),
      deleteCollection: (id) => set((s) => ({ collections: s.collections.filter((c) => c.id !== id) })),
    }),
    { name: 'library', storage: persistStorage, partialize: ({ savedIds, recentIds, recentSearches, collections }) => ({ savedIds, recentIds, recentSearches, collections }) },
  ),
);
