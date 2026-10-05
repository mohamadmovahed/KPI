import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createJSONStorage } from 'zustand/middleware';

/** Non-sensitive app data (KPI cache, saved items, projects) — AsyncStorage. */
export const persistStorage = createJSONStorage(() => AsyncStorage);

/**
 * Secrets (auth tokens) — iOS Keychain / Android Keystore via SecureStore.
 * Web has no secure equivalent; tokens are kept in memory only there.
 */
const memory = new Map<string, string>();
export const secureStorage = {
  async get(key: string) {
    if (Platform.OS === 'web') return memory.get(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return void memory.set(key, value);
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  async remove(key: string) {
    if (Platform.OS === 'web') return void memory.delete(key);
    await SecureStore.deleteItemAsync(key);
  },
};
