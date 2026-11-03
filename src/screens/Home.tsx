import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Illustration } from "../Illustration";
import { durationLabel, Routine, totalSeconds } from "../routines";
import { Preferences } from "../storage";
import { color, font, radius, shadow, type, ui } from "../components/design";
import { Icon, IconName } from "../components/Icon";
import { LogoMark, Wordmark } from "../components/Logo";
import { RoutineSheet } from "../components/RoutineSheet";
import {
  Button,
  IconButton,
  Overline,
  RadioDot,
  Segmented,
} from "../components/ui";

export type Tab = "presets" | "custom";

export function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour >= 4 && hour < 12
    ? "GOOD MORNING"
    : hour >= 12 && hour < 17
      ? "GOOD AFTERNOON"
      : "GOOD EVENING";
}

type Action = {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export function Home({
  presets,
  custom,
  selected,
  onSelect,
  tab,
  onTab,
  preferences,
  error,
  onOpenSettings,
  onStart,
  onCreate,
  onCustomize,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  presets: Routine[];
  custom: Routine[];
  selected: Routine;
  onSelect: (routine: Routine) => void;
  tab: Tab;
  onTab: (tab: Tab) => void;
  preferences: Preferences;
  error: string | null;
  onOpenSettings: () => void;
  onStart: () => void;
  onCreate: () => void;
  onCustomize: (routine: Routine) => void;
  onEdit: (routine: Routine) => void;
  onDuplicate: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
}) {
  const [details, setDetails] = useState(false);
  const shown = tab === "presets" ? presets : custom;
  const moves = (n: number) => `${n} ${n === 1 ? "move" : "moves"}`;
  const actionsFor = (r: Routine): Action[] => [
    {
      icon: "list",
      label: "Moves",
      accessibilityLabel: `See the moves in ${r.name}`,
      onPress: () => setDetails(true),
    },
    ...(r.custom
      ? ([
          {
            icon: "edit",
            label: "Edit",
            accessibilityLabel: "Edit routine",
            onPress: () => onEdit(r),
          },
          {
            icon: "copy",
            label: "Duplicate",
            accessibilityLabel: "Duplicate routine",
            onPress: () => onDuplicate(r),
          },
          {
            icon: "trash",
            label: "Delete",
            accessibilityLabel: "Delete routine",
            onPress: () => onDelete(r),
          },
        ] as Action[])
      : ([
          {
            icon: "copy",
            label: "Customize",
            accessibilityLabel: `Customize ${r.name}`,
            onPress: () => onCustomize(r),
          },
        ] as Action[])),
  ];
  return (
    <>
      <ScrollView
        contentContainerStyle={s.home}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Wordmark size={30} />
          <IconButton
            icon="settings"
            label="Settings"
            variant="outline"
            onPress={onOpenSettings}
          />
        </View>
        <Overline tint={color.sageDeep} style={{ marginTop: 30 }}>
          {greeting()}
        </Overline>
        <Text style={[type.display, { marginTop: 8 }]}>Your practice.</Text>
        <Text style={[type.muted, { marginTop: 6 }]}>
          Come as you are. Begin gently.
        </Text>
        <View style={s.sectionRow}>
          <Overline>FIND YOUR FLOW</Overline>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Audio guide ${preferences.guide ? "on" : "off"}. Open settings`}
            onPress={onOpenSettings}
            style={({ pressed }) => [
              s.guideChip,
              preferences.guide && s.guideChipOn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Icon
              name="headphones"
              size={16}
              tint={preferences.guide ? color.forest : color.muted}
            />
            <Text
              style={[
                s.guideChipText,
                preferences.guide && { color: color.forest },
              ]}
            >
              Audio guide {preferences.guide ? "on" : "off"}
            </Text>
          </Pressable>
        </View>
        <Segmented
          role="tab"
          value={tab}
          onChange={onTab}
          options={[
            { value: "presets", label: "Ready-made" },
            {
              value: "custom",
              label: custom.length ? `My routines · ${custom.length}` : "My routines",
              accessibilityLabel: "My routines",
            },
          ]}
        />
        <View style={{ height: 16 }} />
        {tab === "custom" &&
          (custom.length ? (
            <Button
              label="Create a routine"
              icon="plus"
              variant="soft"
              size="md"
              onPress={onCreate}
              style={{ marginBottom: 14 }}
            />
          ) : (
            <View style={s.empty}>
              <LogoMark size={44} />
              <Text style={[type.heading, { marginTop: 12 }]}>
                Your own little flow
              </Text>
              <Text style={[type.muted, { textAlign: "center", marginTop: 6 }]}>
                Make room for your favorite moves. Choose, arrange, and save a
                practice that feels like you.
              </Text>
              <Button
                label="Create a routine"
                icon="plus"
                size="md"
                onPress={onCreate}
                style={{ marginTop: 16, alignSelf: "stretch" }}
              />
              <Text style={[type.caption, { marginTop: 12, textAlign: "center" }]}>
                Or pick a ready-made routine and tap Customize.
              </Text>
            </View>
          ))}
        {error && <Text style={ui.error}>{error}</Text>}
        {shown.map((r) => {
          const isSelected = r.id === selected.id;
          return (
            <View key={r.id} style={[s.card, isSelected && s.cardSelected]}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                aria-checked={isSelected}
                accessibilityLabel={`${r.name}, ${r.minutes} minutes`}
                onPress={() => onSelect(r)}
                style={({ pressed }) => [s.cardMain, pressed && { opacity: 0.8 }]}
              >
                <View style={[s.cardArt, { backgroundColor: r.color }]}>
                  <Illustration shape={r.art} compact />
                </View>
                <View style={s.cardContent}>
                  <Overline style={{ fontSize: 10, marginBottom: 6 }}>
                    {r.mood}
                  </Overline>
                  <Text style={s.cardTitle} numberOfLines={2}>
                    {r.name}
                  </Text>
                  <View style={s.meta}>
                    <View style={s.metaItem}>
                      <Icon name="clock" size={14} tint={color.muted} />
                      <Text style={type.caption} numberOfLines={1}>
                        {durationLabel(totalSeconds(r))}
                      </Text>
                    </View>
                    <View style={s.metaItem}>
                      <Icon name="list" size={14} tint={color.muted} />
                      <Text style={type.caption} numberOfLines={1}>
                        {moves(r.poses.length)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 14 }}>
                  <RadioDot selected={isSelected} />
                </View>
              </Pressable>
              {isSelected && (
                <View style={s.actions}>
                  {actionsFor(r).map((action, i) => (
                    <Pressable
                      key={action.label}
                      accessibilityRole="button"
                      accessibilityLabel={action.accessibilityLabel}
                      onPress={action.onPress}
                      style={({ pressed }) => [
                        s.action,
                        i > 0 && s.actionDivider,
                        pressed && { backgroundColor: color.sageSoft },
                      ]}
                    >
                      <Icon name={action.icon} size={18} tint={color.forest} />
                      <Text style={s.actionText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={s.note}>
          <LogoMark size={22} />
          <Text style={[type.caption, { flex: 1 }]}>
            No goals to chase. Just a moment to return to yourself. Move within
            comfort, and rest whenever you need.
          </Text>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <Text style={s.selectedLabel} numberOfLines={1}>
          <Text style={{ fontFamily: font.medium, color: color.ink }}>
            {selected.name}
          </Text>
          {"  ·  "}
          {durationLabel(totalSeconds(selected))} of holds ·{" "}
          {moves(selected.poses.length)}
        </Text>
        <Button label="Start yoga" icon="play" onPress={onStart} />
      </View>
      {details && (
        <RoutineSheet
          routine={selected}
          onClose={() => setDetails(false)}
          onStart={() => {
            setDetails(false);
            onStart();
          }}
          onCustomize={
            selected.custom
              ? undefined
              : () => {
                  setDetails(false);
                  onCustomize(selected);
                }
          }
          onEdit={
            selected.custom
              ? () => {
                  setDetails(false);
                  onEdit(selected);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  home: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  guideChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.card,
  },
  guideChipOn: { backgroundColor: color.sageSoft, borderColor: color.sageLine },
  guideChipText: { fontFamily: font.medium, fontSize: 13, color: color.muted },
  empty: {
    alignItems: "center",
    padding: 22,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.sageLine,
    backgroundColor: color.card,
    marginBottom: 14,
  },
  card: {
    marginBottom: 14,
    backgroundColor: color.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    overflow: "hidden",
    boxShadow: shadow.card,
  },
  cardSelected: { borderColor: color.forest, borderWidth: 1.5 },
  cardMain: { flexDirection: "row", alignItems: "center", minHeight: 128 },
  cardArt: { width: "30%", alignSelf: "stretch", minHeight: 128 },
  cardContent: { flex: 1, paddingLeft: 14, paddingVertical: 16 },
  cardTitle: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 30,
    color: color.ink,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 4,
    marginTop: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  actions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: color.line,
    backgroundColor: "#FBFAF3",
  },
  action: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
  },
  actionDivider: { borderLeftWidth: 1, borderColor: color.line },
  actionText: { fontFamily: font.medium, fontSize: 12, color: color.forest },
  note: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: color.line,
    backgroundColor: color.paper,
  },
  selectedLabel: {
    ...type.caption,
    textAlign: "center",
    marginBottom: 10,
  },
});
