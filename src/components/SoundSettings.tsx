import React, { useEffect, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Preferences } from "../storage";
import { SOUND_OPTIONS } from "../soundCatalog";
import { useAmbientAudio } from "../useAmbientAudio";
import { ui, palette } from "./design";
type Toggle = {
  key: "ambientEnabled" | "chime" | "speech" | "smile" | "stripes" | "bun";
  label: string;
  description: string;
};
const SOUND_TOGGLES: Toggle[] = [
  {
    key: "ambientEnabled",
    label: "Nature sounds",
    description: "Play softly during your practice.",
  },
  {
    key: "chime",
    label: "Soft transition chime",
    description: "A small bell when a new move begins.",
  },
  {
    key: "speech",
    label: "Spoken move names",
    description: "Hear the move and its left or right side.",
  },
];
const LOOK_TOGGLES: Toggle[] = [
  {
    key: "smile",
    label: "Open smile",
    description: "A big, open smile. Off for a softer, closed smile.",
  },
  {
    key: "stripes",
    label: "Striped tee",
    description: "Cream with green stripes. Off for a plain green sports shirt.",
  },
  {
    key: "bun",
    label: "Hair in a bun",
    description: "Hair up for practice. Off to wear it long and loose.",
  },
];
export function SoundSettings({
  preferences,
  onChange,
  onClose,
  error,
}: {
  preferences: Preferences;
  onChange: (p: Partial<Preferences>) => void;
  onClose: () => void;
  error: string | null;
}) {
  const [preview, setPreview] = useState(false);
  const toggle = (item: Toggle) => (
    <View
      key={item.key}
      style={[
        ui.row,
        {
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderColor: palette.line,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={ui.link}>{item.label}</Text>
        <Text style={ui.body}>{item.description}</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={item.label}
        accessibilityState={{ checked: preferences[item.key] }}
        aria-checked={preferences[item.key]}
        onPress={() => onChange({ [item.key]: !preferences[item.key] })}
        style={{
          minWidth: 48,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 40,
            height: 24,
            borderRadius: 12,
            backgroundColor: preferences[item.key] ? palette.sage : "#D9DDCF",
            padding: 3,
            alignItems: preferences[item.key] ? "flex-end" : "flex-start",
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: palette.paper,
            }}
          />
        </View>
      </Pressable>
    </View>
  );
  const audio = useAmbientAudio(preview, preferences.ambient);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") setPreview(false);
    });
    const hide = () => {
      if (document.hidden) setPreview(false);
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", hide);
    return () => {
      sub.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={ui.overlay}>
        <View style={ui.dialog}>
          <ScrollView>
            <View style={ui.row}>
              <Text style={ui.heading}>Sound & guidance</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sound settings"
                style={ui.textButton}
                onPress={onClose}
              >
                <Text style={ui.link}>Done</Text>
              </Pressable>
            </View>
            <Text style={ui.body}>A quiet backdrop, in your own way.</Text>
            <View style={ui.gap} />
            {SOUND_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={option.name}
                accessibilityState={{
                  checked: preferences.ambient === option.id,
                }}
                aria-checked={preferences.ambient === option.id}
                onPress={() => onChange({ ambient: option.id })}
                style={[
                  ui.card,
                  preferences.ambient === option.id && ui.selected,
                ]}
              >
                <Text style={ui.link}>
                  {option.name}
                  {preferences.ambient === option.id ? "  ✓" : ""}
                </Text>
                <Text style={ui.body}>{option.description}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setPreview(!preview)}
              style={ui.textButton}
            >
              <Text style={ui.link}>
                {preview ? "Stop preview" : "Listen to sound"}
              </Text>
            </Pressable>
            {audio.error && (
              <Text style={ui.error}>
                This sound could not play. Try again.
              </Text>
            )}
            {SOUND_TOGGLES.map(toggle)}
            <Text style={[ui.body, { marginTop: 18 }]}>
              Speech uses an English voice from your device. Voice availability
              depends on your system settings. On iPhone, turn silent mode off
              to hear spoken guidance.
            </Text>
            <Text style={[ui.body, { marginTop: 8 }]}>
              Natural recordings are CC0. Rain: Q.K. · Birds: Magnesus · Stream:
              peridactyloptrix.
            </Text>
            <Text style={[ui.heading, { marginTop: 26 }]}>Character</Text>
            <Text style={ui.body}>How she looks in every illustration.</Text>
            {LOOK_TOGGLES.map(toggle)}
            {error && <Text style={ui.error}>{error}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
