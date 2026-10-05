import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hydrateKnowledgeBase, syncKnowledgeBase } from '@/services/knowledgeBase';
import { syncProjects } from '@/services/sync';
import { useAuth } from '@/state/auth';
import { startNetworkMonitor, useNetwork } from '@/state/network';
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
  const status = useAuth((s) => s.status);
  const segments = useSegments();

  // Startup: everything needed for offline use is local; network work happens in the background.
  useEffect(() => {
    useAuth.getState().bootstrap();
    hydrateKnowledgeBase().then(syncKnowledgeBase);
    const unsubscribeNet = startNetworkMonitor();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncProjects());
    let wasOnline = useNetwork.getState().online;
    const unsubscribeOnline = useNetwork.subscribe((s) => {
      if (s.online && !wasOnline) {
        syncProjects();
        syncKnowledgeBase();
      }
      wasOnline = s.online;
    });
    return () => {
      unsubscribeNet();
      unsubscribeOnline();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (status === 'signedIn') syncProjects();
  }, [status]);

  // Auth gate: signed-out users see the sign-in screen; guests and members use the app.
  useEffect(() => {
    if (status === 'loading') return;
    const inAuth = segments[0] === 'sign-in';
    if (status === 'signedOut' && !inAuth) router.replace('/sign-in');
    if (status !== 'signedOut' && inAuth) router.replace('/');
  }, [status, segments]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: { ...(isDark ? DarkTheme : DefaultTheme).colors, background: colors.bg, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
  };

  if (status === 'loading') {
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
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'fade' }} />
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
        <Stack.Screen name="scan" options={{ title: 'Analyze a document' }} />
        <Stack.Screen name="benchmarks" options={{ title: 'Benchmarks' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </NavThemeProvider>
  );
}
