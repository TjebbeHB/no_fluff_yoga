import React from "react";
import Svg, { Path } from "react-native-svg";
import { color, decorative } from "./design";

// Line icons on a 24 × 24 grid, drawn with one stroke weight so they sit
// together. Filled shapes are listed in FILLED.
const PATHS = {
  back: "M19 12H5m6-6-6 6 6 6",
  close: "M6.5 6.5l11 11m0-11-11 11",
  play: "M8.5 6.2v11.6a1 1 0 0 0 1.53.85l9.1-5.8a1 1 0 0 0 0-1.7l-9.1-5.8a1 1 0 0 0-1.53.85Z",
  pause: "M8.5 5.5v13M15.5 5.5v13",
  sound: "M4 9.5h3.5L12 6v12l-4.5-3.5H4Zm12 .2a3.4 3.4 0 0 1 0 4.6m2.6-7.3a7.2 7.2 0 0 1 0 10",
  mute: "M4 9.5h3.5L12 6v12l-4.5-3.5H4Zm11.5.5 5 5m0-5-5 5",
  next: "M6 6.2v11.6a.8.8 0 0 0 1.25.66L15.5 12.7a.8.8 0 0 0 0-1.4L7.25 5.54A.8.8 0 0 0 6 6.2ZM19 5.5v13",
  check: "m5.5 12.5 4 4 9-9.5",
  settings:
    "M4 7.5h9m4 0h3M4 16.5h3m4 0h9M17 7.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM11 16.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  up: "M12 19V5m-6 6 6-6 6 6",
  down: "M12 5v14m6-6-6 6-6-6",
  edit: "M4.5 19.5h4l10-10a2.83 2.83 0 0 0-4-4l-10 10v4ZM13 7l4 4",
  copy: "M9.5 8.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM15.5 8.5v-3a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2",
  trash: "M4.5 7h15M10 11v5.5M14 11v5.5M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V7",
  clock: "M12 7.5V12l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z",
  list: "M9.5 6.5h10M9.5 12h10M9.5 17.5h10M5 6.5h.01M5 12h.01M5 17.5h.01",
  chevron: "m9.5 6 6 6-6 6",
  headphones:
    "M4.5 15.5V12a7.5 7.5 0 0 1 15 0v3.5M4.5 15.5a2 2 0 0 1 2-2h1v6.5h-1a2 2 0 0 1-2-2Zm15 0a2 2 0 0 0-2-2h-1v6.5h1a2 2 0 0 0 2-2Z",
  repeat:
    "M4.5 11.5a7.5 7.5 0 0 1 13.1-4.9l1.9 2.1M19.5 4.5v4.2h-4.2M19.5 12.5a7.5 7.5 0 0 1-13.1 4.9l-1.9-2.1M4.5 19.5v-4.2h4.2",
  bell: "M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Zm4 3.5h3",
  leaf: "M5 19c0-8 5-13.5 14-14-.3 9-5.8 14-14 14Zm0 0 7-7",
} as const;
const FILLED = new Set(["play", "next"]);
export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  tint = color.ink,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  tint?: string;
  strokeWidth?: number;
}) {
  const filled = FILLED.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...decorative}
    >
      <Path
        d={PATHS[name]}
        stroke={tint}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? tint : "none"}
      />
    </Svg>
  );
}
