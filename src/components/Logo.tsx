import React, { useId } from "react";
import { Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { BRAND, MARK, MARK_CANVAS } from "../brand";
import { color, decorative, font } from "./design";

// The Verdant mark on its own, sized to its square bounds.
export function LogoMark({
  size = 28,
  tone = "paper",
}: {
  size?: number;
  tone?: "paper" | "icon";
}) {
  const c = BRAND[tone];
  const { x, y, size: s } = MARK.bounds;
  return (
    <Svg width={size} height={size} viewBox={`${x} ${y} ${s} ${s}`} {...decorative}>
      <Path d={MARK.left} fill={c.left} />
      <Path d={MARK.right} fill={c.right} />
      <Circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={c.sun} />
    </Svg>
  );
}

// The app icon as it appears on a home screen.
export function AppIcon({ size = 56 }: { size?: number }) {
  const id = `icon${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c = BRAND.icon;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_CANVAS} ${MARK_CANVAS}`}
      {...decorative}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={c.top} />
          <Stop offset="1" stopColor={c.bottom} />
        </LinearGradient>
      </Defs>
      <Rect width={MARK_CANVAS} height={MARK_CANVAS} rx={230} fill={`url(#${id})`} />
      <Path d={MARK.left} fill={c.left} />
      <Path d={MARK.right} fill={c.right} />
      <Circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={c.sun} />
    </Svg>
  );
}

// Mark and name, as in the home screen header.
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="Verdant Yoga"
      style={{ flexDirection: "row", alignItems: "center", gap: size * 0.3 }}
    >
      <LogoMark size={size} />
      <Text
        style={{
          fontFamily: font.display,
          fontSize: size * 0.9,
          lineHeight: size * 1.05,
          color: color.ink,
          letterSpacing: 0.2,
        }}
      >
        verdant
      </Text>
    </View>
  );
}
