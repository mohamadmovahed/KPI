import { create } from 'zustand';
import type { PublicUser } from '@kpi/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, tokenStore } from '@/services/api';

type Status = 'loading' | 'signedOut' | 'guest' | 'signedIn';

interface AuthState {
  status: Status;
  user?: PublicUser;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, orgName?: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const USER_KEY = 'kpi.auth.user';
const GUEST_KEY = 'kpi.auth.guest';

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',

  async bootstrap() {
    tokenStore.onExpired(() => set({ status: 'signedOut', user: undefined }));
    const [t, rawUser, guest] = await Promise.all([tokenStore.load(), AsyncStorage.getItem(USER_KEY), AsyncStorage.getItem(GUEST_KEY)]);
    if (t && rawUser) {
      // Offline-first: trust the cached profile; the token is validated on the next API call.
      set({ status: 'signedIn', user: JSON.parse(rawUser) as PublicUser });
      api.me().then((r) => {
        set({ user: r.user });
        AsyncStorage.setItem(USER_KEY, JSON.stringify(r.user));
      }).catch(() => undefined);
    } else {
      set({ status: guest ? 'guest' : 'signedOut' });
    }
  },

  async signIn(email, password) {
    const { user, tokens } = await api.login(email.trim(), password);
    await tokenStore.save(tokens);
    await AsyncStorage.multiSet([[USER_KEY, JSON.stringify(user)]]);
    await AsyncStorage.removeItem(GUEST_KEY);
    set({ status: 'signedIn', user });
  },

  async register(name, email, password, orgName) {
    const { user, tokens } = await api.register(name.trim(), email.trim(), password, orgName?.trim() || undefined);
    await tokenStore.save(tokens);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    await AsyncStorage.removeItem(GUEST_KEY);
    set({ status: 'signedIn', user });
  },

  async continueAsGuest() {
    await AsyncStorage.setItem(GUEST_KEY, '1');
    set({ status: 'guest', user: undefined });
  },

  async signOut() {
    const refresh = api.currentRefreshToken();
    if (refresh) api.logout(refresh).catch(() => undefined);
    await tokenStore.clear();
    await AsyncStorage.multiRemove([USER_KEY, GUEST_KEY]);
    set({ status: 'signedOut', user: undefined });
  },
}));
