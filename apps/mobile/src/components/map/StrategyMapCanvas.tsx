import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { MAP_GEOMETRY, PERSPECTIVE_LABEL, PERSPECTIVE_ORDER, type StrategicObjective, type StrategyMap } from '@kpi/shared';
import { AppText } from '@/components/ui/primitives';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const { width: CANVAS_W, rowHeight, topPadding, nodeWidth: NODE_W, nodeHeight: NODE_H } = MAP_GEOMETRY;
const CANVAS_H = topPadding + PERSPECTIVE_ORDER.length * rowHeight;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

export interface StrategyMapCanvasProps {
  map: StrategyMap;
  selectedId?: string;
  connectFromId?: string;
  editable: boolean;
  onTapObjective: (id: string) => void;
  onLongPressObjective: (id: string) => void;
  onMoveObjective: (id: string, x: number, y: number) => void;
  onTapBackground: () => void;
}

/**
 * Touch-first strategy map: pinch to zoom, pan with one finger on empty space, tap an objective
 * to open its sheet, long-press to start a connection, drag an objective to move it.
 * Geometry is in map units; the viewport transform is driven on the UI thread (Reanimated).
 */
export function StrategyMapCanvas(props: StrategyMapCanvasProps) {
  const { map, selectedId, connectFromId, editable } = props;
  const { colors } = useTheme();
  const scale = useSharedValue(0.4);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 0.4, tx: 0, ty: 0 });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

  const fit = useCallback(
    (animated = true) => {
      if (!viewport.w) return;
      const s = Math.min(viewport.w / (CANVAS_W + 40), viewport.h / (CANVAS_H + 40));
      const nx = (viewport.w - CANVAS_W * s) / 2;
      const ny = Math.max(8, (viewport.h - CANVAS_H * s) / 2);
      scale.value = animated ? withTiming(s) : s;
      tx.value = animated ? withTiming(nx) : nx;
      ty.value = animated ? withTiming(ny) : ny;
    },
    [viewport, scale, tx, ty],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const first = viewport.w === 0;
    setViewport({ w: width, h: height });
    if (first) {
      const s = Math.min(width / (CANVAS_W + 40), height / (CANVAS_H + 40));
      scale.value = s;
      tx.value = (width - CANVAS_W * s) / 2;
      ty.value = Math.max(8, (height - CANVAS_H * s) / 2);
    }
  };

  const zoomBy = (factor: number) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value * factor));
    const cx = viewport.w / 2;
    const cy = viewport.h / 2;
    tx.value = withTiming(cx - (cx - tx.value) * (s / scale.value));
    ty.value = withTiming(cy - (cy - ty.value) * (s / scale.value));
    scale.value = withTiming(s);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { scale: scale.value, tx: tx.value, ty: ty.value };
    })
    .onUpdate((e) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.value.scale * e.scale));
      const k = s / start.value.scale;
      scale.value = s;
      tx.value = e.focalX - (e.focalX - start.value.tx) * k;
      ty.value = e.focalY - (e.focalY - start.value.ty) * k;
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    .averageTouches(true)
    .onStart(() => {
      start.value = { scale: scale.value, tx: tx.value, ty: ty.value };
    })
    .onUpdate((e) => {
      tx.value = start.value.tx + e.translationX;
      ty.value = start.value.ty + e.translationY;
    });

  const background = Gesture.Tap().runOnJS(true).onEnd((_e, ok) => ok && props.onTapBackground());
  const viewportGesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), background);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const objectives = useMemo(() => map.objectives.map((o) => (drag && drag.id === o.id ? { ...o, x: drag.x, y: drag.y } : o)), [map.objectives, drag]);
  const byId = useMemo(() => new Map(objectives.map((o) => [o.id, o])), [objectives]);

  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.bg }} onLayout={onLayout}>
      <GestureDetector gesture={viewportGesture}>
        <View style={{ flex: 1 }} collapsable={false}>
          <Animated.View style={[{ width: CANVAS_W, height: CANVAS_H, transformOrigin: 'top left' }, canvasStyle]}>
            <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute' }}>
              {PERSPECTIVE_ORDER.map((p, i) => (
                <Rect key={p} x={0} y={topPadding / 2 + i * rowHeight - 10} width={CANVAS_W} height={rowHeight - 12} rx={18} fill={colors.perspective[p].bg} opacity={0.55} />
              ))}
              {PERSPECTIVE_ORDER.map((p, i) => (
                <SvgText key={`${p}-l`} x={18} y={topPadding / 2 + i * rowHeight + 14} fill={colors.perspective[p].fg} fontSize={16} fontWeight="700">
                  {PERSPECTIVE_LABEL[p].toUpperCase()}
                </SvgText>
              ))}
              {map.links.map((l) => {
                const a = byId.get(l.from);
                const b = byId.get(l.to);
                return a && b ? <LinkPath key={l.id} from={a} to={b} color={colors.textMuted} highlight={selectedId === a.id || selectedId === b.id ? colors.primary : undefined} /> : null;
              })}
            </Svg>
            {objectives.map((o) => (
              <ObjectiveNode
                key={o.id}
                objective={o}
                selected={o.id === selectedId}
                connectSource={o.id === connectFromId}
                connecting={Boolean(connectFromId)}
                editable={editable}
                scale={scale}
                onTap={props.onTapObjective}
                onLongPress={props.onLongPressObjective}
                onDrag={(x, y) => setDrag({ id: o.id, x, y })}
                onDrop={(x, y) => {
                  setDrag(null);
                  props.onMoveObjective(o.id, x, y);
                }}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={{ position: 'absolute', right: space.md, bottom: space.md, gap: space.sm }}>
        <ZoomButton icon="add" label="Zoom in" onPress={() => zoomBy(1.3)} />
        <ZoomButton icon="remove" label="Zoom out" onPress={() => zoomBy(1 / 1.3)} />
        <ZoomButton icon="scan-outline" label="Fit map to screen" onPress={() => fit()} />
      </View>
    </View>
  );
}

function ZoomButton({ icon, label, onPress }: { icon: 'add' | 'remove' | 'scan-outline'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/** Cause → effect curve from the edge of one objective to the facing edge of the other, with an arrowhead. */
function LinkPath({ from, to, color, highlight }: { from: StrategicObjective; to: StrategicObjective; color: string; highlight?: string }) {
  const fromBelow = from.y > to.y;
  const sx = from.x + NODE_W / 2;
  const sy = fromBelow ? from.y : from.y + NODE_H;
  const ex = to.x + NODE_W / 2;
  const ey = fromBelow ? to.y + NODE_H + 8 : to.y - 8;
  const dy = (ey - sy) / 2;
  const d = `M ${sx} ${sy} C ${sx} ${sy + dy}, ${ex} ${ey - dy}, ${ex} ${ey}`;
  const dir = fromBelow ? -1 : 1;
  const arrow = `${ex - 7},${ey - 9 * dir} ${ex + 7},${ey - 9 * dir} ${ex},${ey + 2 * dir}`;
  const c = highlight ?? color;
  return (
    <>
      <Path d={d} stroke={c} strokeWidth={highlight ? 3.5 : 2.5} fill="none" opacity={highlight ? 1 : 0.7} />
      <Polygon points={arrow} fill={c} opacity={highlight ? 1 : 0.8} />
    </>
  );
}

const ObjectiveNode = memo(function ObjectiveNode({
  objective,
  selected,
  connectSource,
  connecting,
  editable,
  scale,
  onTap,
  onLongPress,
  onDrag,
  onDrop,
}: {
  objective: StrategicObjective;
  selected: boolean;
  connectSource: boolean;
  connecting: boolean;
  editable: boolean;
  scale: { value: number };
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  onDrag: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const pc = colors.perspective[objective.perspective];
  const startPos = useSharedValue({ x: 0, y: 0 });

  const clamp = (x: number, y: number) => ({
    x: Math.max(0, Math.min(CANVAS_W - NODE_W, x)),
    y: Math.max(0, Math.min(CANVAS_H - NODE_H, y)),
  });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_e, ok) => ok && onTap(objective.id));
  const longPress = Gesture.LongPress()
    .minDuration(450)
    .maxDistance(10)
    .runOnJS(true)
    .onStart(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      onLongPress(objective.id);
    });
  const drag = Gesture.Pan()
    .enabled(editable && !connecting)
    .minDistance(4)
    .runOnJS(true)
    .onStart(() => {
      startPos.value = { x: objective.x, y: objective.y };
      Haptics.selectionAsync().catch(() => undefined);
    })
    .onUpdate((e) => {
      const p = clamp(startPos.value.x + e.translationX / scale.value, startPos.value.y + e.translationY / scale.value);
      onDrag(p.x, p.y);
    })
    .onEnd((e) => {
      const p = clamp(startPos.value.x + e.translationX / scale.value, startPos.value.y + e.translationY / scale.value);
      onDrop(Math.round(p.x), Math.round(p.y));
    });

  const gesture = Gesture.Race(drag, Gesture.Exclusive(longPress, tap));
  const borderColor = connectSource ? colors.accent : selected ? colors.primary : colors.border;

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${objective.title}, ${PERSPECTIVE_LABEL[objective.perspective]} objective, ${objective.kpiIds.length} KPIs`}
        accessibilityHint="Tap for details, long press to connect"
        style={{
          position: 'absolute',
          left: objective.x,
          top: objective.y,
          width: NODE_W,
          height: NODE_H,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: selected || connectSource ? 3 : 1,
          borderColor,
          borderLeftWidth: 8,
          borderLeftColor: pc.fg,
          padding: 10,
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        }}
      >
        <AppText variant="bodyStrong" numberOfLines={2} style={{ fontSize: 16, lineHeight: 20 }}>
          {objective.title}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="stats-chart" size={13} color={objective.kpiIds.length ? pc.fg : colors.danger} />
          <AppText variant="label" color={objective.kpiIds.length ? pc.fg : colors.danger}>
            {objective.kpiIds.length ? `${objective.kpiIds.length} KPI${objective.kpiIds.length > 1 ? 's' : ''}` : 'No KPI yet'}
          </AppText>
        </View>
      </View>
    </GestureDetector>
  );
});
