import { useEffect, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Generic pinch-zoom + pan viewport for fixed-size content (graphs, diagrams). Fits width on layout. */
export function ZoomPanView({ contentWidth, contentHeight, children, resetKey }: { contentWidth: number; contentHeight: number; children: ReactNode; resetKey?: string }) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ s: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!size.w) return;
    const s = Math.min(1.2, size.w / (contentWidth + 24));
    scale.value = withTiming(s);
    tx.value = withTiming((size.w - contentWidth * s) / 2);
    ty.value = withTiming(12);
  }, [size.w, contentWidth, contentHeight, resetKey, scale, tx, ty]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { s: scale.value, x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      const s = Math.min(3, Math.max(0.3, start.value.s * e.scale));
      const k = s / start.value.s;
      scale.value = s;
      tx.value = e.focalX - (e.focalX - start.value.x) * k;
      ty.value = e.focalY - (e.focalY - start.value.y) * k;
    });
  const pan = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onStart(() => {
      start.value = { s: scale.value, x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      tx.value = start.value.x + e.translationX;
      ty.value = start.value.y + e.translationY;
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  return (
    <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <View style={{ flex: 1 }} collapsable={false}>
          <Animated.View style={[{ width: contentWidth, height: contentHeight, transformOrigin: 'top left' }, style]}>{children}</Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}
