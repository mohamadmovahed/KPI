import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/state/settings';
import { dark, light, type Palette } from './tokens';

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: light, isDark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
