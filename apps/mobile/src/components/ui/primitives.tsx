import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { radius, space, touch, type as typo } from '@/theme/tokens';

/**
 * Role for pressable containers that may hold other buttons. On web a `button` role renders a
 * <button>, and nested <button>s are invalid HTML, so containers fall back to a generic element there.
 */
export const containerRole = Platform.OS === 'web' ? undefined : ('button' as const);
import { useTheme } from '@/theme/ThemeProvider';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Text ----------
type Variant = keyof typeof typo;
export function AppText({ variant = 'body', muted, color, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[typo[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]} />;
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.text} />;
}

// ---------- Card ----------
export function Card({ children, onPress, style, padded = true, accessibilityLabel }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean; accessibilityLabel?: string }) {
  const { colors, isDark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: padded ? space.lg : 0,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    shadowColor: '#0B1F3A',
    shadowOpacity: isDark ? 0 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 2,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole={containerRole} accessibilityLabel={accessibilityLabel} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

// ---------- Buttons ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
  full,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
    ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : touch.min + 4,
          paddingHorizontal: small ? space.md : space.xl,
          borderRadius: radius.md,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
      <AppText variant={small ? 'label' : 'bodyStrong'} color={palette.fg}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color, size = 22, filled }: { icon: IconName; onPress: () => void; label: string; color?: string; size?: number; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: touch.min,
        height: touch.min,
        borderRadius: touch.min / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.primarySoft : pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

// ---------- Chips & badges ----------
export function Chip({ label, selected, onPress, icon, count, dropdown }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; count?: number; dropdown?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        alignSelf: 'flex-start',
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon && <Ionicons name={icon} size={15} color={selected ? colors.onPrimary : colors.textMuted} />}
      <AppText variant="label" color={selected ? colors.onPrimary : colors.text}>
        {label}
        {count ? ` · ${count}` : ''}
      </AppText>
      {dropdown && <Ionicons name="chevron-down" size={13} color={selected ? colors.onPrimary : colors.textMuted} />}
    </Pressable>
  );
}

export function Badge({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: bg }}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

// ---------- Inputs ----------
export function TextField({ label, style, ...rest }: TextInputProps & { label?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      {label && (
        <AppText variant="label" muted>
          {label.toUpperCase()}
        </AppText>
      )}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          typo.body,
          {
            minHeight: touch.min + 4,
            paddingHorizontal: space.md,
            paddingVertical: rest.multiline ? space.md : 0,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            textAlignVertical: rest.multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder, onSubmit, autoFocus, right }: { value: string; onChangeText: (s: string) => void; placeholder: string; onSubmit?: () => void; autoFocus?: boolean; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityLabel={placeholder}
        style={[typo.body, { flex: 1, color: colors.text, paddingVertical: space.sm }]}
      />
      {value ? (
        <Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {right}
    </View>
  );
}

// ---------- Layout helpers ----------
export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm }}>
      <AppText variant="heading">{title}</AppText>
      {action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <AppText variant="label" color={colors.primary}>
            {action}
          </AppText>
        </Pressable>
      )}
    </Row>
  );
}

export function ListRow({ title, subtitle, icon, onPress, right, danger }: { title: string; subtitle?: string; icon?: IconName; onPress?: () => void; right?: ReactNode; danger?: boolean } & Pick<PressableProps, 'onLongPress'>) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? containerRole : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, opacity: pressed ? 0.7 : 1 })}
    >
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? colors.dangerSoft : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={danger ? colors.danger : undefined}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.xs }} />;
}
