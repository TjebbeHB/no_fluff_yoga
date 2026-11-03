import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, font, MAX_WIDTH, radius, shadow, type } from "./design";
import { Icon, IconName } from "./Icon";
import { LogoMark } from "./Logo";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
const BUTTON: Record<
  ButtonVariant,
  { bg: string; pressed: string; text: string; border?: string; shadow?: string }
> = {
  primary: {
    bg: color.forest,
    pressed: color.forestPressed,
    text: color.white,
    shadow: shadow.button,
  },
  secondary: {
    bg: color.card,
    pressed: color.sunken,
    text: color.ink,
    border: color.lineStrong,
  },
  soft: { bg: color.sageSoft, pressed: "#DCE3D2", text: color.ink },
  ghost: { bg: "transparent", pressed: color.sunken, text: color.ink },
  danger: {
    bg: color.card,
    pressed: color.dangerSoft,
    text: color.danger,
    border: "#E5C8BD",
  },
};
const BUTTON_SIZE = {
  lg: { height: 56, radius: 18, font: 16, padding: 22, icon: 20 },
  md: { height: 48, radius: 14, font: 15, padding: 18, icon: 18 },
  sm: { height: 40, radius: 12, font: 14, padding: 14, icon: 17 },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  iconAfter,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
  icon?: IconName;
  iconAfter?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTON[variant],
    z = BUTTON_SIZE[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: z.height,
          borderRadius: z.radius,
          paddingHorizontal: z.padding,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          backgroundColor: pressed ? v.pressed : v.bg,
        },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        v.shadow && !disabled ? { boxShadow: v.shadow } : null,
        disabled ? { opacity: 0.45 } : null,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={z.icon} tint={v.text} />}
      <Text style={{ fontFamily: font.medium, fontSize: z.font, color: v.text }}>
        {label}
      </Text>
      {iconAfter && <Icon name={iconAfter} size={z.icon} tint={v.text} />}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = "plain",
  size = 44,
  iconSize = 22,
  tint,
  disabled = false,
  hint,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: "plain" | "outline" | "soft" | "filled";
  size?: number;
  iconSize?: number;
  tint?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const filled = variant === "filled";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size < 44 ? (44 - size) / 2 : undefined}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
        },
        variant === "outline" && {
          borderWidth: 1,
          borderColor: color.lineStrong,
          backgroundColor: color.card,
        },
        variant === "soft" && { backgroundColor: color.sunken },
        filled && { backgroundColor: color.forest, boxShadow: shadow.button },
        pressed && {
          backgroundColor: filled ? color.forestPressed : color.sageSoft,
        },
        disabled && { opacity: 0.3 },
      ]}
    >
      <Icon
        name={icon}
        size={iconSize}
        tint={tint ?? (filled ? color.white : color.ink)}
      />
    </Pressable>
  );
}

export function Overline({
  children,
  tint = color.muted,
  style,
}: {
  children: ReactNode;
  tint?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[type.overline, { color: tint }, style]}>{children}</Text>;
}

// A titled group of rows, as in Settings.
export function Group({
  title,
  children,
  note,
}: {
  title?: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <View style={{ marginTop: 26 }}>
      {title && (
        <Overline style={{ marginBottom: 10, marginLeft: 4 }}>{title}</Overline>
      )}
      <View style={[styles.group]}>{children}</View>
      {note && <View style={{ marginTop: 10, marginHorizontal: 4 }}>{note}</View>}
    </View>
  );
}
export function Divider({ inset = 16 }: { inset?: number }) {
  return (
    <View
      style={{ height: 1, backgroundColor: color.line, marginLeft: inset }}
    />
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{label}</Text>
        {description && (
          <Text style={[type.small, { marginTop: 2 }]}>{description}</Text>
        )}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

export function RadioDot({
  selected,
  disabled = false,
}: {
  selected: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={[
        styles.radio,
        selected && styles.radioOn,
        disabled && !selected && { borderColor: color.line },
      ]}
    >
      {selected && <Icon name="check" size={13} tint={color.white} strokeWidth={2.4} />}
    </View>
  );
}

export function RadioRow({
  label,
  description,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessory,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  // Buttons beside the choice, outside it so they stay separate controls.
  accessory?: ReactNode;
}) {
  return (
    <View style={[styles.row, { paddingVertical: 0 }]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ checked: selected, disabled }}
        aria-checked={selected}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingVertical: 14,
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <RadioDot selected={selected} disabled={disabled} />
        <View style={{ flex: 1 }}>
          <Text style={[type.label, disabled && { color: color.muted }]}>
            {label}
          </Text>
          {description && (
            <Text style={[type.small, { marginTop: 1 }]}>{description}</Text>
          )}
        </View>
      </Pressable>
      {accessory}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  role,
}: {
  options: { value: T; label: string; accessibilityLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  role: "tab" | "radio";
}) {
  return (
    <View
      accessibilityRole={role === "tab" ? "tablist" : "radiogroup"}
      style={styles.segmented}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole={role}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={
              role === "tab" ? { selected } : { checked: selected }
            }
            {...(role === "tab"
              ? { "aria-selected": selected }
              : { "aria-checked": selected })}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentOn]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && { color: color.ink, fontFamily: font.medium },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Dialog({
  visible,
  onRequestClose,
  title,
  body,
  children,
  mark = true,
}: {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  body?: string;
  children: ReactNode;
  mark?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {mark && (
            <View style={{ alignItems: "center", marginBottom: 6 }}>
              <LogoMark size={40} />
            </View>
          )}
          <Text style={[type.title, { textAlign: "center", fontSize: 30 }]}>
            {title}
          </Text>
          {body && (
            <Text style={[type.muted, { textAlign: "center", marginTop: 8 }]}>
              {body}
            </Text>
          )}
          <View style={{ gap: 10, marginTop: 22 }}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

// A panel that rises from the bottom of the screen.
export function Sheet({
  onClose,
  title,
  overline,
  subtitle,
  closeLabel,
  children,
  footer,
}: {
  onClose: () => void;
  title: string;
  overline?: string;
  subtitle?: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: reduced ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [reduced, rise]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, styles.sheetOverlay]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: rise,
              transform: [
                {
                  translateY: rise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SafeAreaView edges={["bottom"]} style={{ flexShrink: 1 }}>
            <View style={styles.grabber} />
            <View style={[styles.row, styles.sheetHeader]}>
              <View style={{ flex: 1 }}>
                {overline && (
                  <Overline style={{ marginBottom: 6 }}>{overline}</Overline>
                )}
                <Text style={type.title}>{title}</Text>
                {subtitle && (
                  <Text style={[type.muted, { marginTop: 4 }]}>{subtitle}</Text>
                )}
              </View>
              <IconButton
                icon="close"
                label={closeLabel}
                onPress={onClose}
                variant="soft"
                size={40}
                iconSize={20}
              />
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer && <View style={styles.sheetFooter}>{footer}</View>}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowPressed: { backgroundColor: color.sunken },
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D7DBCD",
    padding: 3,
    justifyContent: "center",
  },
  trackOn: { backgroundColor: color.forest },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.white,
    boxShadow: "0px 1px 3px rgba(35, 54, 42, 0.25)",
  },
  knobOn: { transform: [{ translateX: 18 }] },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: color.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.card,
  },
  radioOn: { backgroundColor: color.forest, borderColor: color.forest },
  segmented: {
    flexDirection: "row",
    backgroundColor: color.sunken,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  segmentOn: { backgroundColor: color.card, boxShadow: shadow.card },
  segmentText: { fontFamily: font.body, fontSize: 14, color: color.muted },
  overlay: {
    flex: 1,
    backgroundColor: color.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: color.paper,
    borderRadius: radius.xl,
    padding: 26,
    boxShadow: shadow.raised,
  },
  sheetOverlay: { justifyContent: "flex-end", padding: 0 },
  sheet: {
    width: "100%",
    maxWidth: MAX_WIDTH + 40,
    maxHeight: "90%",
    backgroundColor: color.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    boxShadow: shadow.raised,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.lineStrong,
    marginTop: 10,
  },
  sheetHeader: {
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: color.line,
    gap: 10,
  },
});
