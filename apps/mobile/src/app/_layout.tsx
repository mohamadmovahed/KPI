import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useProjects } from '@/state/projects';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();
  // Wait until locally persisted data is loaded so screens never flash empty states.
  const [ready, setReady] = useState(() => useProjects.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    return useProjects.persist.onFinishHydration(() => setReady(true));
  }, [ready]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: { ...(isDark ? DarkTheme : DefaultTheme).colors, background: colors.bg, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerStyle: { backgroundColor: colors.surface }, contentStyle: { backgroundColor: colors.bg }, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="kpi/[id]" options={{ title: '' }} />
        <Stack.Screen name="kpi/graph" options={{ title: 'KPI relationships' }} />
        <Stack.Screen name="compare" options={{ title: 'Compare KPIs' }} />
        <Stack.Screen name="project/new" options={{ title: 'New project', presentation: 'modal' }} />
        <Stack.Screen name="project/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="project/[id]/map" options={{ title: 'Strategy map' }} />
        <Stack.Screen name="project/[id]/summary" options={{ title: 'Executive summary' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved' }} />
        <Stack.Screen name="collection/[id]" options={{ title: 'Collection' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Diagnose a KPI' }} />
        <Stack.Screen name="benchmarks" options={{ title: 'Benchmarks' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </NavThemeProvider>
  );
}
