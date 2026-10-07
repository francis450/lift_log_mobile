import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/theme';

export interface LinePoint {
  /** Axis label, e.g. "W3" */
  label: string;
  /** Tooltip label, e.g. "Week 3" */
  name: string;
  value: number;
}

interface Props {
  points: LinePoint[];
  unit: string;
  height?: number;
}

const PAD = { left: 36, right: 52, top: 12, bottom: 22 };

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const n = raw / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * power;
}

/** A clean y-range with 2 or 3 intervals around the data, never flat. */
export function niceScale(values: number[]): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 0.5);
  const step = niceStep(span / 2);
  const lo = Math.floor((min - span * 0.1) / step) * step;
  const hi = Math.ceil((max + span * 0.1) / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
  return { lo, hi, ticks };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** One series by week: 2px line, 8px dots with a surface ring, hairline grid, the latest value at the end. */
export function LineChart({ points, unit, height = 140 }: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const { lo, hi, ticks } = niceScale(points.map((p) => p.value));
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
  const last = points[points.length - 1];
  const showLabel = (i: number) => points.length <= 6 || i % 2 === 0 || i === points.length - 1;
  const shown = selected !== null ? points[selected] : null;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={points.map((p) => `${p.name}: ${fmt(p.value)} ${unit}`).join('. ')}
    >
      <Text style={styles.tooltip}>{shown ? `${shown.name} · ${fmt(shown.value)} ${unit}` : ' '}</Text>
      {width > 0 ? (
        <View>
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.track} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={11} fill={colors.ink3} textAnchor="end" fontFamily={fonts.mono}>
                {fmt(t)}
              </SvgText>
            ))}
            <Polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={selected === i ? 6 : 4}
                fill={colors.accent}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ))}
            <SvgText
              x={x(points.length - 1) + 10}
              y={y(last.value) + 4}
              fontSize={12}
              fill={colors.ink}
              fontFamily={fonts.mono}
            >
              {`${fmt(last.value)} ${unit}`}
            </SvgText>
            {points.map((p, i) =>
              showLabel(i) ? (
                <SvgText key={`x${i}`} x={x(i)} y={height - 4} fontSize={11} fill={colors.ink3} textAnchor="middle" fontFamily={fonts.bodySemi}>
                  {p.label}
                </SvgText>
              ) : null,
            )}
          </Svg>
          {/* Tap targets wider than the dots. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {points.map((p, i) => {
              const slot = points.length === 1 ? plotW : plotW / (points.length - 1);
              return (
                <Pressable
                  key={i}
                  accessibilityLabel={`${p.name}: ${fmt(p.value)} ${unit}`}
                  onPress={() => setSelected(selected === i ? null : i)}
                  style={[styles.hit, { left: x(i) - Math.max(slot, 44) / 2, width: Math.max(slot, 44), height }]}
                />
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink2, minHeight: 18 },
  hit: { position: 'absolute', top: 0 },
});
