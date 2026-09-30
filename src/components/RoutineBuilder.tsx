import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { poseLibrary } from "../routines";
import { SavedRoutine } from "../storage";
import { Illustration } from "../Illustration";
import { palette as C, ui } from "./design";
export function RoutineBuilder({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SavedRoutine;
  onSave: (routine: SavedRoutine) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? ""),
    [steps, setSteps] = useState(initial?.steps ?? []),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [discard, setDiscard] = useState(false);
  const dirty =
    name !== (initial?.name ?? "") ||
    JSON.stringify(steps) !== JSON.stringify(initial?.steps ?? []);
  const leave = () => (dirty ? setDiscard(true) : onCancel());
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [dirty]);
  const change = (i: number, seconds: number) =>
    setSteps((s) => s.map((v, j) => (j === i ? { ...v, seconds } : v)));
  const move = (i: number, d: number) =>
    setSteps((s) => {
      const next = [...s];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
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
        id:
          initial?.id ??
          `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  return (
    <View style={ui.page}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={ui.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
            onPress={leave}
            style={ui.textButton}
          >
            <Text style={ui.link}>‹ Back</Text>
          </Pressable>
          <Text style={ui.label}>
            {initial ? "YOUR SAVED ROUTINE" : "MAKE IT YOURS"}
          </Text>
        </View>
        <View style={ui.gap} />
        <Text style={ui.title}>
          {initial ? "Edit your flow." : "Your own little flow."}
        </Text>
        <Text style={[ui.body, { marginTop: 8 }]}>
          Choose familiar moves, then set your order and time.
        </Text>
        <View style={ui.gap} />
        <Text style={ui.label}>ROUTINE NAME</Text>
        <TextInput
          accessibilityLabel="Routine name"
          value={name}
          onChangeText={setName}
          placeholder="My quiet morning"
          placeholderTextColor="#929787"
          maxLength={40}
          style={ui.input}
        />
        <View style={[ui.row, { marginTop: 25 }]}>
          <Text style={ui.label}>YOUR SEQUENCE</Text>
          <Text style={ui.body}>
            {steps.length} moves · {Math.floor(seconds / 60)}m {seconds % 60}s
          </Text>
        </View>
        {!steps.length && (
          <View style={ui.card}>
            <Text style={ui.heading}>Begin with a move.</Text>
            <Text style={ui.body}>
              A breath in Mountain pose or Easy seat is a gentle place to start.
            </Text>
          </View>
        )}
        {steps.map((step, i) => {
          const pose = poseLibrary.find((p) => p.id === step.poseId)!;
          return (
            <View key={`${i}-${step.poseId}`} style={ui.card}>
              <View style={ui.row}>
                <View
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <Illustration shape={pose.shape} side={pose.side} compact />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.label, { marginBottom: 4 }]}>
                    MOVE {i + 1}
                    {pose.side ? ` · ${pose.side.toUpperCase()} SIDE` : ""}
                  </Text>
                  <Text style={[ui.heading, { fontSize: 23 }]}>
                    {pose.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove move ${i + 1}`}
                  style={ui.smallButton}
                  onPress={() => setSteps((s) => s.filter((_, j) => i !== j))}
                >
                  <Text style={ui.link}>×</Text>
                </Pressable>
              </View>
              <View style={[ui.row, { marginTop: 12 }]}>
                <View style={[ui.row, { gap: 8 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Shorten move ${i + 1}`}
                    disabled={step.seconds <= 15}
                    style={[
                      ui.smallButton,
                      step.seconds <= 15 && { opacity: 0.3 },
                    ]}
                    onPress={() => change(i, step.seconds - 15)}
                  >
                    <Text>−</Text>
                  </Pressable>
                  <Text
                    accessibilityLabel={`Move ${i + 1} duration`}
                    style={[ui.body, { minWidth: 42, textAlign: "center" }]}
                  >
                    {step.seconds}s
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Lengthen move ${i + 1}`}
                    disabled={step.seconds >= 180}
                    style={[
                      ui.smallButton,
                      step.seconds >= 180 && { opacity: 0.3 },
                    ]}
                    onPress={() => change(i, step.seconds + 15)}
                  >
                    <Text>+</Text>
                  </Pressable>
                </View>
                <View style={[ui.row, { gap: 7 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${i + 1} earlier`}
                    disabled={i === 0}
                    onPress={() => move(i, -1)}
                    style={[ui.smallButton, i === 0 && { opacity: 0.3 }]}
                  >
                    <Text>↑</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${i + 1} later`}
                    disabled={i === steps.length - 1}
                    onPress={() => move(i, 1)}
                    style={[
                      ui.smallButton,
                      i === steps.length - 1 && { opacity: 0.3 },
                    ]}
                  >
                    <Text>↓</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          disabled={steps.length >= 30}
          style={[
            ui.button,
            { marginTop: 15, backgroundColor: "#E3E9DA" },
            steps.length >= 30 && { opacity: 0.4 },
          ]}
          onPress={() => {
            setQuery("");
            setPicker(true);
          }}
        >
          <Text style={[ui.buttonText, { color: C.ink }]}>＋ Add a move</Text>
        </Pressable>
        <Text style={[ui.body, { marginTop: 16 }]}>
          The illustration shows each target pose. It doesn’t teach every
          transition. Take time to change position, and pause whenever you need.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        )}
      </ScrollView>
      <View style={ui.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save routine"
          disabled={saving}
          onPress={save}
          style={ui.button}
        >
          <Text style={ui.buttonText}>
            {saving ? "Saving…" : "Save routine"}
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(false)}
      >
        <View style={ui.overlay}>
          <View style={ui.dialog}>
            <View style={ui.row}>
              <Text style={ui.heading}>Choose a move</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close move library"
                onPress={() => setPicker(false)}
                style={ui.textButton}
              >
                <Text style={ui.link}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Search moves"
              placeholder="Search moves"
              value={query}
              onChangeText={setQuery}
              style={ui.input}
            />
            <Text style={[ui.body, { marginTop: 8 }]}>
              {steps.length} / 30 moves added · add both sides where needed
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ marginTop: 8 }}
            >
              {poseLibrary
                .filter((p) =>
                  `${p.name} ${p.side ?? ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((p) => (
                  <View key={p.id} style={[ui.card, { padding: 10 }]}>
                    <View style={ui.row}>
                      <View style={{ width: 62, height: 65 }}>
                        <Illustration shape={p.shape} side={p.side} compact />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ui.heading, { fontSize: 22 }]}>
                          {p.name}
                        </Text>
                        <Text style={ui.body}>
                          {p.side ? `${p.side} side · ` : ""}
                          {p.seconds}s
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${p.name}${p.side ? ` ${p.side}` : ""}`}
                        disabled={steps.length >= 30}
                        onPress={() =>
                          setSteps((s) =>
                            s.length < 30
                              ? [...s, { poseId: p.id, seconds: p.seconds }]
                              : s,
                          )
                        }
                        style={[
                          ui.smallButton,
                          steps.length >= 30 && { opacity: 0.3 },
                        ]}
                      >
                        <Text>＋</Text>
                      </Pressable>
                    </View>
                    <Text style={[ui.body, { fontSize: 11, marginTop: 6 }]}>
                      {p.cue}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={discard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscard(false)}
      >
        <View style={ui.overlay}>
          <View style={ui.dialog}>
            <Text style={ui.heading}>Leave without saving?</Text>
            <Text style={[ui.body, { marginVertical: 14 }]}>
              Your changes to this routine will be discarded.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDiscard(false)}
              style={ui.button}
            >
              <Text style={ui.buttonText}>Keep editing</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[ui.textButton, { alignItems: "center", marginTop: 8 }]}
            >
              <Text style={ui.link}>Discard changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
