import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polyline,
  Line as SvgLine,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { computeDateLabels, linReg } from "@/utils/chartHelpers";

interface TrendLineChartProps {
  history: number[];
  lastUpdated: string;
}

export function TrendLineChart({ history, lastUpdated }: TrendLineChartProps) {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();

  const [chartWidth, setChartWidth] = useState(screenWidth - 70);

  const PAD_TOP = 22;
  const PAD_BOT = 38;
  const PAD_H   = 10;
  const HEIGHT  = 130;

  const n      = history.length;
  const fc     = linReg(history);
  const maxVal = Math.max(...history, fc.high, 1);

  const totalSlots = n + 1;
  const labels     = computeDateLabels(lastUpdated, n);

  const [ly, lm, ld] = lastUpdated.replace(/-/g, "/").split("/").map(Number);
  const fcDate = new Date(ly, lm - 1, ld + 7);
  const fcLabel = `${fcDate.getMonth() + 1}/${fcDate.getDate()}`;

  const plotW  = chartWidth - PAD_H * 2;
  const plotH  = HEIGHT - PAD_TOP - PAD_BOT;

  const xOf = (slot: number) => PAD_H + (slot / (totalSlots - 1)) * plotW;
  const yOf = (val: number)  => PAD_TOP + (1 - val / maxVal) * plotH;

  const pts = history.map((val, i) => ({
    x:         xOf(i),
    y:         yOf(val),
    val,
    label:     labels[i],
    isCurrent: i === n - 1,
    isPrev:    i === n - 2,
  }));

  const fcPt = { x: xOf(n), y: yOf(fc.value) };
  const fcLowY  = yOf(fc.high);
  const fcHighY = yOf(fc.low);

  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPath = [
    `M ${pts[0].x} ${PAD_TOP + plotH}`,
    ...pts.map((p) => `L ${p.x} ${p.y}`),
    `L ${pts[n - 1].x} ${PAD_TOP + plotH}`,
    "Z",
  ].join(" ");

  const gridYs = [0, 0.5, 1].map((f) => PAD_TOP + (1 - f) * plotH);

  return (
    <View
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      style={{ marginTop: 4 }}
    >
      <Svg width={chartWidth} height={HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {gridYs.map((y, i) => (
          <SvgLine
            key={i}
            x1={PAD_H} y1={y} x2={chartWidth - PAD_H} y2={y}
            stroke={colors.border}
            strokeWidth={0.8}
            strokeDasharray={i === 2 ? undefined : "3,3"}
          />
        ))}

        <Path d={fillPath} fill="url(#areaGrad)" />

        <Polyline
          points={linePts}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {pts.map((p, i) => {
          const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
          return (
            <G key={i}>
              <SvgText
                x={p.x} y={p.y - 8}
                textAnchor={anchor}
                fontSize={9}
                fontWeight={p.isCurrent ? "700" : "400"}
                fill={p.isCurrent ? colors.primary : colors.mutedForeground}
              >
                {p.val}
              </SvgText>

              <Circle
                cx={p.x} cy={p.y}
                r={p.isCurrent ? 5.5 : 3.5}
                fill={p.isCurrent ? colors.primary : colors.background}
                stroke={colors.primary}
                strokeWidth={2}
              />

              <SvgText
                x={p.x} y={HEIGHT - PAD_BOT + 14}
                textAnchor={anchor}
                fontSize={9}
                fontWeight={p.isCurrent ? "700" : "400"}
                fill={p.isCurrent ? colors.primary : colors.mutedForeground}
              >
                {p.label}
              </SvgText>

              {(p.isCurrent || p.isPrev) && (
                <SvgText
                  x={p.x} y={HEIGHT - PAD_BOT + 26}
                  textAnchor={anchor}
                  fontSize={8}
                  fontWeight="700"
                  fill={p.isCurrent ? colors.primary : colors.mutedForeground}
                >
                  {p.isCurrent ? "今週" : "先週"}
                </SvgText>
              )}
            </G>
          );
        })}

        <Path
          d={`M ${fcPt.x} ${fcLowY} L ${fcPt.x} ${fcHighY}`}
          stroke={colors.primary}
          strokeWidth={6}
          strokeOpacity={0.15}
          strokeLinecap="round"
        />

        <Polyline
          points={`${pts[n - 1].x},${pts[n - 1].y} ${fcPt.x},${fcPt.y}`}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeDasharray="4,4"
          strokeLinecap="round"
        />

        <Circle
          cx={fcPt.x} cy={fcPt.y}
          r={5.5}
          fill={colors.background}
          stroke={colors.primary}
          strokeWidth={2}
          strokeDasharray="3,3"
        />

        <SvgText
          x={fcPt.x} y={fcPt.y - 8}
          textAnchor="end"
          fontSize={9}
          fontWeight="700"
          fill={colors.primary}
          fillOpacity={0.7}
        >
          {fc.value}
        </SvgText>

        <SvgText
          x={fcPt.x} y={HEIGHT - PAD_BOT + 14}
          textAnchor="end"
          fontSize={9}
          fill={colors.mutedForeground}
        >
          {fcLabel}
        </SvgText>

        <SvgText
          x={fcPt.x} y={HEIGHT - PAD_BOT + 26}
          textAnchor="end"
          fontSize={8}
          fontWeight="700"
          fill={colors.mutedForeground}
        >
          予測
        </SvgText>
      </Svg>
    </View>
  );
}
