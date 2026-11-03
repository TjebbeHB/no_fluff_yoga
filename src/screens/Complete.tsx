import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Illustration } from "../Illustration";
import { clockLabel, Routine } from "../routines";
import { color, font, radius, tabular, type } from "../components/design";
import { LogoMark } from "../components/Logo";
import { Button, Overline } from "../components/ui";

export function Complete({
  routine,
  seconds,
  onDone,
  onAgain,
}: {
  routine: Routine;
  seconds: number;
  onDone: () => void;
  onAgain: () => void;
}) {
  const stats = [
    { value: clockLabel(Math.floor(seconds)), label: "practiced" },
    {
      value: `${routine.poses.length}`,
      label: routine.poses.length === 1 ? "move" : "moves",
    },
  ];
  return (
    <ScrollView
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
    >
      <LogoMark size={52} />
      <Overline tint={color.sageDeep} style={{ marginTop: 18 }}>
        PRACTICE COMPLETE
      </Overline>
      <Text style={[type.display, { textAlign: "center", marginTop: 10 }]}>
        A little more{"\n"}grounded.
      </Text>
      <View style={s.art}>
        <Illustration shape="seated" />
      </View>
      <Text style={[type.muted, { textAlign: "center" }]}>
        Thank you for showing up for yourself.
      </Text>
      <View style={s.stats}>
        <Text style={s.statRoutine} numberOfLines={1}>
          {routine.name}
        </Text>
        <View style={s.statRow}>
          {stats.map((stat, i) => (
            <View key={stat.label} style={[s.stat, i > 0 && s.statDivider]}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={type.caption}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.actions}>
        <Button label="Back to your practice" onPress={onDone} />
        <Button
          label="Practice again"
          icon="repeat"
          variant="secondary"
          onPress={onAgain}
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  art: { width: "100%", height: 230, marginVertical: 6 },
  stats: {
    alignSelf: "stretch",
    marginTop: 22,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  statRoutine: {
    fontFamily: font.display,
    fontSize: 21,
    lineHeight: 25,
    color: color.ink,
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: color.line,
  },
  statRow: { flexDirection: "row", paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 8, gap: 2 },
  statDivider: { borderLeftWidth: 1, borderColor: color.line },
  statValue: {
    fontFamily: font.display,
    fontSize: 30,
    lineHeight: 34,
    color: color.ink,
    ...tabular,
  },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 22 },
});
