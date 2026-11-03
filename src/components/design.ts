import { Platform, StyleSheet, TextStyle } from "react-native";
import { BRAND } from "../brand";

// Colours. Text colours meet WCAG AA on paper and cards: ink 11.8:1,
// text 8.6:1, muted 5.6:1, sageDeep 4.9:1; white on forest is 9.8:1.
export const color = {
  paper: BRAND.paperColor,
  card: "#FFFDF8",
  sunken: "#F0EEE5",
  ink: "#23362A",
  text: "#3D4A40",
  muted: "#5C6557",
  // Placeholders and decoration only: too light for reading text.
  subtle: "#8A9083",
  line: "#E4E2D7",
  lineStrong: "#D3D6C7",
  forest: BRAND.forest,
  forestPressed: "#243B2D",
  sage: "#7D8C6C",
  sageDeep: "#5E7050",
  sageSoft: "#E7ECDF",
  sageLine: "#B5C1A4",
  sun: BRAND.paper.sun,
  danger: "#9A4A38",
  dangerSoft: "#F6E7E1",
  white: "#FFFFFF",
  scrim: "rgba(28, 41, 32, 0.42)",
};

export const font = {
  display: "CormorantGaramond_500Medium",
  displayLight: "CormorantGaramond_400Regular",
  body: "DMSans_400Regular",
  medium: "DMSans_500Medium",
};

export const type = StyleSheet.create({
  display: {
    fontFamily: font.display,
    fontSize: 44,
    lineHeight: 48,
    color: color.ink,
  },
  title: {
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 38,
    color: color.ink,
  },
  heading: {
    fontFamily: font.display,
    fontSize: 25,
    lineHeight: 29,
    color: color.ink,
  },
  subheading: {
    fontFamily: font.display,
    fontSize: 21,
    lineHeight: 25,
    color: color.ink,
  },
  body: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.text },
  muted: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: color.muted,
  },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: color.muted },
  caption: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 16,
    color: color.muted,
  },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: color.ink },
  overline: {
    fontFamily: font.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    color: color.muted,
  },
});

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const shadow = {
  card: "0px 1px 2px rgba(35, 54, 42, 0.05), 0px 6px 18px rgba(35, 54, 42, 0.05)",
  raised:
    "0px 2px 6px rgba(35, 54, 42, 0.08), 0px 12px 28px rgba(35, 54, 42, 0.10)",
  button:
    "0px 2px 4px rgba(35, 54, 42, 0.12), 0px 8px 18px rgba(46, 74, 57, 0.18)",
};
// Comfortable reading width on tablets and the web.
export const MAX_WIDTH = 540;

// Figures that line up in columns and sit at full height, also in Cormorant,
// whose default old-style figures make "12" read like "I2".
export const tabular: TextStyle = {
  fontVariant: ["lining-nums", "tabular-nums"],
};

// Props that hide decorative artwork from screen readers on every platform.
export const decorative =
  Platform.OS === "web"
    ? ({ "aria-hidden": true } as const)
    : ({
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
      } as const);

export const ui = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  card: {
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
  },
  error: {
    color: color.danger,
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  input: {
    fontFamily: font.body,
    fontSize: 16,
    color: color.ink,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.card,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    marginTop: 8,
  },
});
