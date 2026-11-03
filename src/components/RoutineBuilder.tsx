import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  durationLabel,
  NAME_LIMIT,
  Pose,
  poseLabel,
  poseLibrary,
  Step,
} from "../routines";
import { newRoutineId, SavedRoutine } from "../storage";
import { Illustration } from "../Illustration";
import { color, font, radius, shadow, tabular, type, ui } from "./design";
import { Icon } from "./Icon";
import { Button, Dialog, IconButton, Overline, Sheet } from "./ui";

type LibraryPose = Pose & { id: string };
const MAX_STEPS = 30;
const MIN_HOLD = 15,
  MAX_HOLD = 180,
  HOLD_STEP = 15;

// The library grouped by move: one entry per pose, with its sides.
const MOVES = poseLibrary.reduce<
  { name: string; shape: Pose["shape"]; cue: string; variants: LibraryPose[] }[]
>((groups, pose) => {
  const group = groups.find((g) => g.name === pose.name);
  if (group) group.variants.push(pose);
  else
    groups.push({
      name: pose.name,
      shape: pose.shape,
      // Side-neutral advice for the group: the cue without its side.
      cue: pose.cue
        .replace(/\bto your (left|right)\b/g, "to one side")
        .replace(/\byour (left|right)\b/g, "one"),
      variants: [pose],
    });
  return groups;
}, []);

export function RoutineBuilder({
  initial,
  template,
  onSave,
  onCancel,
}: {
  // A saved routine to edit.
  initial?: SavedRoutine;
  // Or a starting point for a new routine, such as a ready-made one.
  template?: { name: string; steps: Step[] };
  onSave: (routine: SavedRoutine) => Promise<void>;
  onCancel: () => void;
}) {
  const start = initial ?? template;
  const [name, setName] = useState(start?.name ?? ""),
    [steps, setSteps] = useState<Step[]>(start?.steps ?? []),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [added, setAdded] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [discard, setDiscard] = useState(false);
  // A routine started from a template is new: leaving it unsaved asks first.
  const dirty =
    !!template ||
    name !== (initial?.name ?? "") ||
    JSON.stringify(steps) !== JSON.stringify(initial?.steps ?? []);
  const leave = () => (dirty ? setDiscard(true) : onCancel());
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (picker) setPicker(false);
      else leave();
      return true;
    });
    return () => sub.remove();
  }, [dirty, picker]);
  const change = (i: number, seconds: number) =>
    setSteps((s) => s.map((v, j) => (j === i ? { ...v, seconds } : v)));
  const move = (i: number, d: number) =>
    setSteps((s) => {
      const next = [...s];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const add = (poses: LibraryPose[]) => {
    if (steps.length + poses.length > MAX_STEPS) return;
    setSteps((s) =>
      s.length + poses.length <= MAX_STEPS
        ? [...s, ...poses.map((p) => ({ poseId: p.id, seconds: p.seconds }))]
        : s,
    );
    setAdded(
      poses.length > 1
        ? `Added ${poses[0].name}, both sides.`
        : `Added ${poseLabel(poses[0])}.`,
    );
  };
  const save = async () => {
    if (!name.trim()) {
      setError("Give your routine a name.");
      return;
    }
    if (!steps.length) {
      setError("Add at least one move.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id ?? newRoutineId(),
        name: name.trim(),
        steps,
      });
    } catch {
      setError("Your routine could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const seconds = steps.reduce((sum, p) => sum + p.seconds, 0);
  const full = steps.length >= MAX_STEPS;
  const search = query.trim().toLowerCase();
  const shownMoves = MOVES.filter((group) =>
    group.variants.some((p) =>
      `${p.name} ${p.side ?? ""}`.toLowerCase().includes(search),
    ),
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={ui.row}>
          <View style={{ marginLeft: -10 }}>
            <IconButton icon="back" label="Cancel editing" onPress={leave} />
          </View>
          <Overline>
            {initial
              ? "YOUR SAVED ROUTINE"
              : template
                ? "MAKE IT YOURS"
                : "NEW ROUTINE"}
          </Overline>
        </View>
        <Text style={[type.title, { marginTop: 12 }]}>
          {initial
            ? "Edit your flow."
            : template
              ? "Make it your own."
              : "Your own little flow."}
        </Text>
        <Text style={[type.muted, { marginTop: 6 }]}>
          Choose familiar moves, then set your order and time.
        </Text>
        <Text style={[type.overline, { marginTop: 24 }]}>ROUTINE NAME</Text>
        <TextInput
          accessibilityLabel="Routine name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (error) setError("");
          }}
          placeholder="My quiet morning"
          placeholderTextColor={color.subtle}
          maxLength={NAME_LIMIT}
          style={ui.input}
        />
        <View style={[ui.row, { marginTop: 26, marginBottom: 2 }]}>
          <Overline>YOUR SEQUENCE</Overline>
          <Text style={[type.caption, tabular]}>
            {steps.length
              ? `${steps.length} ${steps.length === 1 ? "move" : "moves"} · ${durationLabel(seconds)}`
              : "No moves yet"}
          </Text>
        </View>
        {!steps.length && (
          <View style={[ui.card, s.emptyCard]}>
            <Text style={type.heading}>Begin with a move.</Text>
            <Text style={[type.small, { marginTop: 4 }]}>
              A breath in Mountain pose or Easy seat is a gentle place to start.
            </Text>
          </View>
        )}
        {steps.map((step, i) => {
          const pose = poseLibrary.find((p) => p.id === step.poseId)!;
          const n = i + 1;
          return (
            <View key={`${i}-${step.poseId}`} style={[ui.card, s.step]}>
              <View style={[ui.row, { alignItems: "flex-start" }]}>
                <View style={s.thumb}>
                  <Illustration shape={pose.shape} side={pose.side} compact />
                </View>
                <View style={{ flex: 1, paddingTop: 4 }}>
                  <Overline style={{ marginBottom: 3 }}>
                    MOVE {n}
                    {pose.side ? ` · ${pose.side.toUpperCase()} SIDE` : ""}
                  </Overline>
                  <Text style={s.stepName}>{pose.name}</Text>
                </View>
                <IconButton
                  icon="close"
                  label={`Remove move ${n}`}
                  onPress={() => setSteps((s) => s.filter((_, j) => i !== j))}
                  size={36}
                  iconSize={18}
                  tint={color.muted}
                />
              </View>
              <View style={[ui.row, { marginTop: 10 }]}>
                <View style={s.stepper}>
                  <IconButton
                    icon="minus"
                    label={`Shorten move ${n}`}
                    disabled={step.seconds <= MIN_HOLD}
                    onPress={() => change(i, step.seconds - HOLD_STEP)}
                    size={38}
                    iconSize={18}
                  />
                  <Text
                    accessibilityLabel={`Move ${n} duration`}
                    style={s.seconds}
                  >
                    {step.seconds} sec
                  </Text>
                  <IconButton
                    icon="plus"
                    label={`Lengthen move ${n}`}
                    disabled={step.seconds >= MAX_HOLD}
                    onPress={() => change(i, step.seconds + HOLD_STEP)}
                    size={38}
                    iconSize={18}
                  />
                </View>
                <View style={[ui.row, { gap: 6 }]}>
                  <IconButton
                    icon="copy"
                    label={`Repeat move ${n}`}
                    disabled={full}
                    onPress={() =>
                      setSteps((s) =>
                        s.length < MAX_STEPS
                          ? [...s.slice(0, i + 1), { ...step }, ...s.slice(i + 1)]
                          : s,
                      )
                    }
                    variant="outline"
                    size={38}
                    iconSize={17}
                  />
                  <IconButton
                    icon="up"
                    label={`Move ${n} earlier`}
                    disabled={i === 0}
                    onPress={() => move(i, -1)}
                    variant="outline"
                    size={38}
                    iconSize={17}
                  />
                  <IconButton
                    icon="down"
                    label={`Move ${n} later`}
                    disabled={i === steps.length - 1}
                    onPress={() => move(i, 1)}
                    variant="outline"
                    size={38}
                    iconSize={17}
                  />
                </View>
              </View>
            </View>
          );
        })}
        <Button
          label="Add a move"
          icon="plus"
          variant="soft"
          size="md"
          disabled={full}
          onPress={() => {
            setQuery("");
            setAdded("");
            setPicker(true);
          }}
          style={{ marginTop: 14 }}
        />
        <Text style={[type.small, { marginTop: 16 }]}>
          The illustration shows each target pose. It doesn’t teach every
          transition. Take time to change position, and pause whenever you need.
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={s.footer}>
        <Button
          label={saving ? "Saving…" : "Save routine"}
          icon="check"
          accessibilityLabel="Save routine"
          disabled={saving}
          onPress={save}
        />
      </View>
      {picker && (
        <Sheet
          onClose={() => setPicker(false)}
          title="Choose a move"
          closeLabel="Close move library"
          footer={
            <Button
              label="Done"
              accessibilityLabel={`Done, ${steps.length} moves in your routine`}
              onPress={() => setPicker(false)}
            />
          }
        >
          <TextInput
            accessibilityLabel="Search moves"
            placeholder="Search moves"
            placeholderTextColor={color.subtle}
            value={query}
            onChangeText={setQuery}
            style={[ui.input, { marginTop: 0 }]}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[type.caption, { marginTop: 8, marginBottom: 4 }]}
          >
            {added
              ? `${added} ${steps.length} of ${MAX_STEPS} moves.`
              : `${steps.length} of ${MAX_STEPS} moves · add both sides where needed`}
          </Text>
          {shownMoves.map((group) => {
            const count = steps.filter((st) =>
              group.variants.some((p) => p.id === st.poseId),
            ).length;
            const sided = group.variants.length > 1;
            return (
              <View key={group.name} style={[ui.card, s.move]}>
                <View style={[ui.row, { alignItems: "flex-start" }]}>
                  <View style={s.moveThumb}>
                    <Illustration
                      shape={group.shape}
                      side={group.variants[0].side}
                      compact
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.moveTitle}>
                      <Text style={s.stepName}>{group.name}</Text>
                      {count > 0 && (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{count} added</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[type.caption, { marginTop: 3 }]}>
                      {group.cue}
                    </Text>
                  </View>
                </View>
                <View style={s.addRow}>
                  {sided ? (
                    <>
                      {group.variants.map((p) => (
                        <AddButton
                          key={p.id}
                          label={p.side === "left" ? "Left" : "Right"}
                          accessibilityLabel={`Add ${p.name} ${p.side}`}
                          disabled={full}
                          onPress={() => add([p])}
                        />
                      ))}
                      <AddButton
                        label="Both sides"
                        accessibilityLabel={`Add ${group.name}, both sides`}
                        disabled={steps.length + group.variants.length > MAX_STEPS}
                        onPress={() => add(group.variants)}
                      />
                    </>
                  ) : (
                    <AddButton
                      label={`Add · ${group.variants[0].seconds} sec`}
                      accessibilityLabel={`Add ${group.name}`}
                      disabled={full}
                      onPress={() => add(group.variants)}
                    />
                  )}
                </View>
              </View>
            );
          })}
          {!shownMoves.length && (
            <Text style={[type.muted, { marginTop: 16, textAlign: "center" }]}>
              No moves match “{query.trim()}”.
            </Text>
          )}
        </Sheet>
      )}
      <Dialog
        visible={discard}
        onRequestClose={() => setDiscard(false)}
        title="Leave without saving?"
        body={
          initial
            ? "Your changes to this routine will be discarded."
            : "This routine hasn’t been saved yet."
        }
      >
        <Button label="Keep editing" onPress={() => setDiscard(false)} />
        <Button
          label="Discard changes"
          variant="secondary"
          onPress={onCancel}
        />
      </Dialog>
    </View>
  );
}

function AddButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.add,
        pressed && { backgroundColor: "#DCE3D2" },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon name="plus" size={15} tint={color.forest} strokeWidth={2} />
      <Text style={s.addText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 32 },
  emptyCard: { marginTop: 12, padding: 18 },
  step: { marginTop: 12, padding: 12 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#E7EADC",
  },
  stepName: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    color: color.ink,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: color.sunken,
    borderRadius: radius.pill,
    padding: 3,
  },
  seconds: {
    fontFamily: font.medium,
    fontSize: 14,
    color: color.ink,
    minWidth: 56,
    textAlign: "center",
    ...tabular,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: color.line,
    backgroundColor: color.paper,
  },
  move: { marginTop: 10, padding: 12, boxShadow: shadow.card },
  moveThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E7EADC",
  },
  moveTitle: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    backgroundColor: color.sageSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: font.medium, fontSize: 11, color: color.sageDeep },
  addRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  add: {
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: color.sageSoft,
  },
  addText: { fontFamily: font.medium, fontSize: 13, color: color.forest },
});
