import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { OfflineBanner } from './feedback';
import { AppText } from './primitives';

/**
 * Standard screen container. `title` renders a large in-content title (tab roots);
 * stack screens use the native header instead.
 */
export function Screen({
  children,
  title,
  subtitle,
  scroll = true,
  headerRight,
  safeTop,
  footer,
  ...scrollProps
}: { children: ReactNode; title?: string; subtitle?: string; scroll?: boolean; headerRight?: ReactNode; safeTop?: boolean; footer?: ReactNode } & ScrollViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: space.md }}>
      <View style={{ flex: 1 }}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle && <AppText muted>{subtitle}</AppText>}
      </View>
      {headerRight}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: safeTop ? insets.top : 0 }}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl * 2 }}
          {...scrollProps}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg }}>
          {header}
          {children}
        </View>
      )}
      {footer}
    </View>
  );
}
