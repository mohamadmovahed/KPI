import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '@/state/network';
import { radius, space, touch } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Icon, type IconName } from './primitives';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

// ---------- Accordion (progressive disclosure) ----------
export function Accordion({ title, icon, children, initiallyOpen, badge }: { title: string; icon?: IconName; children: ReactNode; initiallyOpen?: boolean; badge?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(Boolean(initiallyOpen));
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: space.md }}
      >
        {icon && <Icon name={icon} size={18} color={colors.primary} />}
        <AppText variant="heading" style={{ flex: 1 }}>
          {title}
        </AppText>
        {badge && (
          <AppText variant="label" muted>
            {badge}
          </AppText>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {open && <View style={{ paddingBottom: space.lg, gap: space.sm }}>{children}</View>}
    </View>
  );
}

// ---------- Bottom sheet ----------
/**
 * Lightweight modal bottom sheet with drag-to-dismiss. Used for filters, objective details,
 * pickers and actions instead of desktop-style sidebars and dialogs.
 */
export function BottomSheet({ visible, onClose, title, children, footer, maxHeightRatio = 0.85 }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; maxHeightRatio?: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 1.2) onCloseRef.current();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Animated.View
          style={{
            maxHeight: height * maxHeightRatio,
            backgroundColor: colors.elevated,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: Math.max(insets.bottom, space.lg),
            transform: [{ translateY: drag }],
          }}
        >
          <View {...pan.panHandlers} style={{ alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xs }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            {title && (
              <AppText variant="heading" style={{ marginTop: space.md, alignSelf: 'flex-start', paddingHorizontal: space.xl }}>
                {title}
              </AppText>
            )}
          </View>
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- States ----------
export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body && (
        <AppText muted style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      )}
      {action && <Button title={action} onPress={onAction} variant="secondary" />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: space.lg, borderRadius: radius.md, backgroundColor: colors.dangerSoft, gap: space.sm }}>
      <AppText color={colors.danger}>{message}</AppText>
      {onRetry && <Button title="Try again" small variant="danger" onPress={onRetry} />}
    </View>
  );
}

/** Pulsing skeleton block for loading states. */
export function Skeleton({ height = 16, width = '100%' as number | `${number}%`, style }: { height?: number; width?: number | `${number}%`; style?: object }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ height, width, borderRadius: 6, backgroundColor: colors.surfaceAlt, opacity }, style]} />;
}

export function OfflineBanner() {
  const online = useNetwork((s) => s.online);
  const { colors } = useTheme();
  if (online) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.warningSoft }}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
      <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
        You’re offline. Library, saved items and projects work; AI answers use the offline engine.
      </AppText>
    </View>
  );
}

// ---------- Segmented navigation ----------
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingVertical: space.xs }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={{ minHeight: 38, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: active ? colors.text : 'transparent' }}
          >
            <AppText variant="label" color={active ? colors.bg : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Fab({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: space.xl,
        bottom: space.xl,
        minHeight: touch.min + 8,
        paddingHorizontal: space.xl,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.onPrimary} />
      <AppText variant="bodyStrong" color={colors.onPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}
