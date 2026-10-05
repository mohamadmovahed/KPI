import { useMemo } from 'react';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { IndicatorType, Kpi, KnowledgeBase } from '@kpi/shared';
import { AppText } from '@/components/ui/primitives';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { ZoomPanView } from './ZoomPanView';

const NODE_W = 150;
const NODE_H = 64;
const COL_GAP = 16;
const ROW_GAP = 70;
const MAX_PER_LAYER = 6;

interface Placed {
  kpi: Kpi;
  x: number;
  y: number;
  layer: number;
}

/**
 * Layered neighbourhood of one KPI: drivers above, outcomes below (cause → effect flows down
 * toward financial results). Never renders the whole graph; depth and indicator filters keep
 * small screens readable. Tap a node to refocus.
 */
export function RelationshipGraph({
  kb,
  focusId,
  depth,
  indicatorFilter,
  onFocus,
}: {
  kb: KnowledgeBase;
  focusId: string;
  depth: 1 | 2;
  indicatorFilter?: IndicatorType;
  onFocus: (id: string) => void;
}) {
  const { colors } = useTheme();

  const { placed, edges, width, height } = useMemo(() => {
    const keep = (k: Kpi) => !indicatorFilter || k.indicator === indicatorFilter;
    const layers = new Map<number, Kpi[]>();
    const seen = new Set([focusId]);
    layers.set(0, [kb.get(focusId)!]);
    let up = [focusId];
    let down = [focusId];
    for (let d = 1; d <= depth; d++) {
      const nextUp = up.flatMap((id) => kb.graph.drivers(id)).filter((k) => !seen.has(k.id) && keep(k)).slice(0, MAX_PER_LAYER);
      nextUp.forEach((k) => seen.add(k.id));
      const nextDown = down.flatMap((id) => kb.graph.outcomes(id)).filter((k) => !seen.has(k.id) && keep(k)).slice(0, MAX_PER_LAYER);
      nextDown.forEach((k) => seen.add(k.id));
      if (nextUp.length) layers.set(-d, dedupe(nextUp));
      if (nextDown.length) layers.set(d, dedupe(nextDown));
      up = nextUp.map((k) => k.id);
      down = nextDown.map((k) => k.id);
    }
    const order = [...layers.keys()].sort((a, b) => a - b);
    const widest = Math.max(...[...layers.values()].map((l) => l.length));
    const w = Math.max(NODE_W + 40, widest * (NODE_W + COL_GAP) + 24);
    const placed: Placed[] = [];
    order.forEach((layer, row) => {
      const items = layers.get(layer)!;
      const rowW = items.length * NODE_W + (items.length - 1) * COL_GAP;
      items.forEach((kpi, i) => placed.push({ kpi, layer, x: (w - rowW) / 2 + i * (NODE_W + COL_GAP), y: 20 + row * (NODE_H + ROW_GAP) }));
    });
    const pos = new Map(placed.map((p) => [p.kpi.id, p]));
    const edges = kb.graph.edges().filter((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      return a && b && b.layer === a.layer + 1;
    });
    return { placed, edges: edges.map((e) => ({ a: pos.get(e.from)!, b: pos.get(e.to)! })), width: w, height: 40 + order.length * (NODE_H + ROW_GAP) - ROW_GAP };
  }, [kb, focusId, depth, indicatorFilter]);

  return (
    <ZoomPanView contentWidth={width} contentHeight={height} resetKey={`${focusId}-${depth}-${indicatorFilter}`}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        {edges.map(({ a, b }) => {
          const sx = a.x + NODE_W / 2;
          const sy = a.y + NODE_H;
          const ex = b.x + NODE_W / 2;
          const ey = b.y;
          const my = (sy + ey) / 2;
          const hot = a.kpi.id === focusId || b.kpi.id === focusId;
          return <Path key={`${a.kpi.id}-${b.kpi.id}`} d={`M${sx} ${sy} C${sx} ${my} ${ex} ${my} ${ex} ${ey}`} stroke={hot ? colors.primary : colors.textMuted} strokeWidth={hot ? 2.5 : 1.5} opacity={hot ? 0.9 : 0.5} fill="none" />;
        })}
      </Svg>
      {placed.map((p) => {
        const focus = p.kpi.id === focusId;
        const pc = colors.perspective[p.kpi.perspective];
        return (
          <Pressable
            key={p.kpi.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.kpi.name}, ${p.kpi.indicator}${focus ? ', focused' : ', tap to focus'}`}
            onPress={() => onFocus(p.kpi.id)}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: NODE_W,
              height: NODE_H,
              borderRadius: radius.md,
              padding: 8,
              justifyContent: 'center',
              backgroundColor: focus ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: focus ? colors.primary : colors.border,
              borderTopWidth: 4,
              borderTopColor: focus ? colors.primary : pc.fg,
            }}
          >
            <AppText variant="label" numberOfLines={2} color={focus ? colors.onPrimary : colors.text} style={{ fontSize: 13 }}>
              {p.kpi.name}
            </AppText>
            <AppText variant="caption" color={focus ? colors.onPrimary : colors.indicator[p.kpi.indicator].fg} style={{ fontSize: 11 }}>
              {p.kpi.indicator === 'leading' ? '▲ Leading' : '■ Lagging'}
            </AppText>
          </Pressable>
        );
      })}
    </ZoomPanView>
  );
}

const dedupe = (ks: Kpi[]) => [...new Map(ks.map((k) => [k.id, k])).values()];
