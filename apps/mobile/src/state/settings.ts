import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IndustryId } from '@kpi/shared';
import { persistStorage } from '@/lib/storage';

interface SettingsState {
  theme: 'system' | 'light' | 'dark';
  /** Used for the Home greeting only; stays on the device. */
  userName?: string;
  defaultIndustry?: IndustryId;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      set: (patch) => set(patch),
    }),
    { name: 'settings', storage: persistStorage },
  ),
);
