import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Illustration } from "../Illustration";
import {
  clockLabel,
  durationLabel,
  poseLabel,
  Routine,
  totalSeconds,
} from "../routines";
import { color, font, radius, tabular, type } from "./design";
import { Icon } from "./Icon";
import { Button, Sheet } from "./ui";

// Every move in a routine, in order, before you begin.
export function RoutineSheet({
  routine,
  onClose,
  onStart,
  onCustomize,
  onEdit,
}: {
  routine: Routine;
  onClose: () => void;
  onStart: () => void;
  onCustomize?: () => void;
  onEdit?: () => void;
}) {
  const sides = routine.poses.filter((p) => p.side).length;
  return (
    <Sheet
      onClose={onClose}
      title={routine.name}
      overline={routine.mood}
      subtitle={routine.description}
      closeLabel="Close routine details"
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {onCustomize && (
            <Button
              label="Customize"
              icon="copy"
              variant="secondary"
              accessibilityLabel={`Customize ${routine.name}`}
              onPress={onCustomize}
              style={{ flex: 1 }}
            />
          )}
          {onEdit && (
            <Button
              label="Edit"
              icon="edit"
              variant="secondary"
              accessibilityLabel={`Edit ${routine.name}`}
              onPress={onEdit}
              style={{ flex: 1 }}
            />
          )}
          <Button
            label="Begin"
            icon="play"
            accessibilityLabel={`Begin ${routine.name}`}
            onPress={onStart}
            style={{ flex: 1.3 }}
          />
        </View>
      }
    >
      <View style={s.meta}>
        <View style={s.chip}>
          <Icon name="clock" size={15} tint={color.sageDeep} />
          <Text style={s.chipText}>
            {durationLabel(totalSeconds(routine))} of holds
          </Text>
        </View>
        <View style={s.chip}>
          <Icon name="list" size={15} tint={color.sageDeep} />
          <Text style={s.chipText}>
            {routine.poses.length} {routine.poses.length === 1 ? "move" : "moves"}
          </Text>
        </View>
        {sides > 0 && (
          <View style={s.chip}>
            <Text style={s.chipText}>Both sides</Text>
          </View>
        )}
      </View>
      <Text style={[type.small, { marginTop: 10 }]}>
        Plus a little time to move between poses. Pause or skip whenever you
        like.
      </Text>
      <View accessibilityRole="list" style={s.list}>
        {routine.poses.map((pose, i) => (
          <View
            key={i}
            accessibilityRole="none"
            accessible
            accessibilityLabel={`${i + 1}. ${poseLabel(pose)}, ${pose.seconds} seconds`}
            style={[s.item, i > 0 && s.itemDivider]}
          >
            <Text style={s.number}>{i + 1}</Text>
            <View style={[s.thumb, { backgroundColor: routine.color }]}>
              <Illustration shape={pose.shape} side={pose.side} compact />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {pose.name}
              </Text>
              {pose.side && (
                <Text style={type.caption}>
                  {pose.side === "left" ? "Left" : "Right"} side
                </Text>
              )}
            </View>
            <Text style={s.time}>{clockLabel(pose.seconds)}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.sageSoft,
  },
  chipText: { fontFamily: font.medium, fontSize: 12, color: color.sageDeep },
  list: {
    marginTop: 16,
    backgroundColor: color.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  itemDivider: { borderTopWidth: 1, borderColor: color.line },
  number: {
    ...type.caption,
    width: 18,
    textAlign: "center",
    ...tabular,
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: "hidden",
  },
  name: {
    fontFamily: font.display,
    fontSize: 20,
    lineHeight: 24,
    color: color.ink,
  },
  time: { ...type.small, color: color.text, ...tabular },
});
