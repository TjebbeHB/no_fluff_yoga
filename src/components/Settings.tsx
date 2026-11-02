import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Preferences } from "../storage";
import { SOUND_OPTIONS } from "../soundCatalog";
import { useAmbientAudio } from "../useAmbientAudio";
import { GUIDE_LINES } from "../guideScript";
import { GuideVoice, VOICES, VoiceId, voiceUrl } from "../voices";
import {
  installedVoices,
  installVoice,
  openVoicePack,
  removeVoice,
} from "../voicePacks";
import { createClipPlayer } from "../clipPlayer";
import { speak, stopSpeech } from "../deviceSpeech";
import { ui, palette } from "./design";

type Toggle = {
  key: "ambientEnabled" | "chime" | "guide" | "smile" | "stripes" | "bun";
  label: string;
  description: string;
};
const GUIDE_TOGGLE: Toggle = {
  key: "guide",
  label: "Audio guide",
  description:
    "A calm voice leads you from pose to pose, so you can practise with your screen off.",
};
const CHIME_TOGGLE: Toggle = {
  key: "chime",
  label: "Transition chime",
  description: "A soft bell when it's time to move to the next pose.",
};
const SOUND_TOGGLE: Toggle = {
  key: "ambientEnabled",
  label: "Nature sounds",
  description: "Play softly during your practice.",
};
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
const STYLES = [
  {
    id: "detailed",
    name: "Detailed",
    description:
      "Describes how to move into each pose and what to notice while you hold it.",
  },
  {
    id: "brief",
    name: "Brief",
    description: "Just names the next pose, like “Next, warrior two, right side.”",
  },
] as const;

export function Settings({
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
  const audio = useAmbientAudio({
    soundOn: true,
    sound: preferences.ambient,
    active: preview,
  });
  const [installed, setInstalled] = useState<VoiceId[]>([]);
  const [progress, setProgress] = useState<Partial<Record<VoiceId, number>>>(
    {},
  );
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [listening, setListening] = useState<string | null>(null);
  const player = useRef<ReturnType<typeof createClipPlayer> | null>(null);
  useEffect(() => {
    let live = true;
    void installedVoices().then((ids) => {
      if (live) setInstalled(ids);
    });
    player.current = createClipPlayer();
    return () => {
      live = false;
      player.current?.release();
      void stopSpeech().catch(() => {});
    };
  }, []);
  useEffect(() => {
    const quiet = () => {
      setPreview(false);
      player.current?.stop();
      void stopSpeech().catch(() => {});
    };
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") quiet();
    });
    const hide = () => {
      if (document.hidden) quiet();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", hide);
    return () => {
      sub.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  const listen = async (voice: GuideVoice) => {
    const again = listening === voice;
    player.current?.stop();
    await stopSpeech().catch(() => {});
    setVoiceError(null);
    if (again) return setListening(null);
    setListening(voice);
    try {
      if (voice === "device") await speak(GUIDE_LINES.sample, () => true);
      else {
        // Installed voices play from the phone; others stream a short sample.
        const pack = installed.includes(voice)
          ? await openVoicePack(voice)
          : null;
        await player.current!.play(
          pack?.clip("sample") ?? voiceUrl(voice, "sample.m4a"),
        );
      }
    } catch {
      setVoiceError(
        voice === "device"
          ? "The device voice isn’t responding. Check your device’s text-to-speech settings."
          : "That sample could not play. Check your connection and try again.",
      );
    }
    setListening((current) => (current === voice ? null : current));
  };
  const install = async (voice: VoiceId) => {
    setVoiceError(null);
    setProgress((p) => ({ ...p, [voice]: 0 }));
    try {
      await installVoice(voice, (fraction) =>
        setProgress((p) => ({ ...p, [voice]: fraction })),
      );
      setInstalled(await installedVoices());
      onChange({ voice });
    } catch (e) {
      setVoiceError(
        "That voice could not be installed. Check your connection and try again.",
      );
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[voice];
        return next;
      });
    }
  };
  const remove = async (voice: VoiceId) => {
    await removeVoice(voice).catch(() => {});
    setInstalled(await installedVoices());
    if (preferences.voice === voice) onChange({ voice: "device" });
  };
  const toggle = (item: Toggle) => (
    <View key={item.key} style={[ui.row, styles.toggleRow]}>
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
        style={styles.switchHit}
      >
        <View
          style={[
            styles.switchTrack,
            preferences[item.key] && styles.switchOn,
          ]}
        >
          <View style={styles.switchKnob} />
        </View>
      </Pressable>
    </View>
  );
  const voiceCard = (
    id: GuideVoice,
    title: string,
    detail: string,
    ready: boolean,
  ) => {
    const selected = preferences.voice === id;
    const fraction = id === "device" ? undefined : progress[id];
    return (
      <View key={id} style={[ui.card, selected && ui.selected]}>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={id === "device" ? title : `${title} voice`}
          accessibilityState={{ checked: selected, disabled: !ready }}
          aria-checked={selected}
          disabled={!ready}
          onPress={() => onChange({ voice: id })}
        >
          <Text style={ui.link}>
            {title}
            {selected ? "  ✓" : ""}
          </Text>
          <Text style={ui.body}>{detail}</Text>
        </Pressable>
        <View style={[ui.row, { justifyContent: "flex-start", marginTop: 6 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Listen to ${title}`}
            onPress={() => void listen(id)}
            style={ui.textButton}
          >
            <Text style={ui.link}>
              {listening === id ? "Stop" : "Listen"}
            </Text>
          </Pressable>
          {id !== "device" &&
            (fraction !== undefined ? (
              <Text accessibilityLiveRegion="polite" style={ui.body}>
                Installing… {Math.round(fraction * 100)}%
              </Text>
            ) : ready ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${title} voice`}
                onPress={() => void remove(id)}
                style={ui.textButton}
              >
                <Text style={[ui.link, { color: palette.muted }]}>Remove</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Install ${title} voice`}
                onPress={() => void install(id)}
                style={[ui.pill, { justifyContent: "center" }]}
              >
                <Text style={ui.link}>
                  Install ·{" "}
                  {VOICES.find((v) => v.id === id)!.megabytes.toFixed(1)} MB
                </Text>
              </Pressable>
            ))}
        </View>
      </View>
    );
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <View style={[ui.row, styles.column]}>
            <Text style={ui.title}>Settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              style={ui.textButton}
              onPress={onClose}
            >
              <Text style={ui.link}>Done</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.section}>AUDIO GUIDE</Text>
          {toggle(GUIDE_TOGGLE)}
          <View style={!preferences.guide && styles.dimmed}>
            <Text style={[ui.link, styles.subhead]}>How much it says</Text>
            {STYLES.map((style) => {
              const selected = preferences.guideStyle === style.id;
              return (
                <Pressable
                  key={style.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${style.name} guidance`}
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  onPress={() => onChange({ guideStyle: style.id })}
                  style={[ui.card, selected && ui.selected]}
                >
                  <Text style={ui.link}>
                    {style.name}
                    {selected ? "  ✓" : ""}
                  </Text>
                  <Text style={ui.body}>{style.description}</Text>
                </Pressable>
              );
            })}
            <Text style={[ui.link, styles.subhead]}>Voice</Text>
            <Text style={ui.body}>
              Paradee voices are small, natural-sounding recordings that work
              offline once installed.
            </Text>
            {voiceCard(
              "device",
              "Device voice",
              "Your phone's built-in speech. Always available.",
              true,
            )}
            {VOICES.map((voice) =>
              voiceCard(
                voice.id,
                voice.name,
                `Paradee · ${voice.accent}`,
                installed.includes(voice.id),
              ),
            )}
            {voiceError && <Text style={ui.error}>{voiceError}</Text>}
            <Text style={[ui.body, { marginTop: 14 }]}>
              With the audio guide on, your practice keeps going when you lock
              your screen. When a pose needs you to change position, the guide
              explains it and carries on after a short pause.
            </Text>
          </View>
          {toggle(CHIME_TOGGLE)}

          <Text style={styles.section}>SOUND</Text>
          {toggle(SOUND_TOGGLE)}
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
              style={[ui.card, preferences.ambient === option.id && ui.selected]}
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
            <Text style={ui.error}>This sound could not play. Try again.</Text>
          )}

          <Text style={styles.section}>CHARACTER</Text>
          <Text style={ui.body}>How she looks in every illustration.</Text>
          {LOOK_TOGGLES.map(toggle)}

          <Text style={styles.section}>ABOUT</Text>
          <Text style={ui.body}>
            The device voice uses an English voice from your phone; on iPhone,
            turn silent mode off to hear it. Paradee voices are by Sahil
            Mahendrakar (Apache 2.0), distilled from Kokoro-82M.
          </Text>
          <Text style={[ui.body, { marginTop: 8 }]}>
            Natural recordings are CC0. Rain: Q.K. · Birds: Magnesus · Stream:
            peridactyloptrix.
          </Text>
          {error && <Text style={ui.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = {
  page: { flex: 1, backgroundColor: palette.paper },
  header: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  column: {
    width: "100%" as const,
    maxWidth: 516,
    alignSelf: "center" as const,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 48,
    width: "100%" as const,
    maxWidth: 560,
    alignSelf: "center" as const,
  },
  section: { ...ui.label, marginTop: 28, marginBottom: 2 },
  subhead: { marginTop: 18, marginBottom: 2 },
  dimmed: { opacity: 0.55 },
  toggleRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  switchHit: {
    minWidth: 48,
    minHeight: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  switchTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D9DDCF",
    padding: 3,
    alignItems: "flex-start" as const,
  },
  switchOn: { backgroundColor: palette.sage, alignItems: "flex-end" as const },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.paper,
  },
};
