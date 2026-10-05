import { Ionicons } from '@expo/vector-icons';
import Tabs from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Five-item bottom navigation: Home, KPI Library, AI Assistant (centre), Projects, More. */
export default function TabsLayout() {
  const { colors } = useTheme();
  const icon =
    (name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => <Ionicons name={focused ? active : name} size={size} color={color as string} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="library" options={{ title: 'KPI Library', tabBarIcon: icon('library-outline', 'library') }} />
      <Tabs.Screen name="assistant" options={{ title: 'Assistant', tabBarIcon: icon('sparkles-outline', 'sparkles') }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: icon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
