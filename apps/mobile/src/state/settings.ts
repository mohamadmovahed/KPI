import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IndustryId } from '@kpi/shared';
import { persistStorage } from '@/lib/storage';

interface SettingsState {
  theme: 'system' | 'light' | 'dark';
  /** Optional override of the API base URL (e.g. a company-hosted backend). */
  apiUrl?: string;
  defaultIndustry?: IndustryId;
  notifications: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      notifications: false,
      set: (patch) => set(patch),
    }),
    { name: 'settings', storage: persistStorage },
  ),
);
