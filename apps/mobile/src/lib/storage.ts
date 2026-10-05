import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** All app data lives on the device in AsyncStorage (app-private storage on Android). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
